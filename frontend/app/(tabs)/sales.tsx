import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../constants/theme';
import Card from '../../components/Card';
import Button from '../../components/Button';
import FAB from '../../components/FAB';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { generateInvoicePDF, shareInvoicePDF } from '../../utils/pdfGenerator';

interface SalesOrder {
  id: string;
  invoice_number: string;
  customer_name: string;
  total_amount: number;
  payment_type: string;
  payment_status: string;
  order_date: string;
}

export default function SalesScreen() {
  const { user, refreshUser } = useAuth();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('cash');
  const [items, setItems] = useState<any[]>([]);
  const [discount, setDiscount] = useState('0');
  const [saving, setSaving] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ordersRes, customersRes, productsRes] = await Promise.all([
        supabase.from('sales_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('customers').select('*').eq('is_active', true).order('name'),
        supabase.from('products').select('*').eq('is_active', true).order('name'),
      ]);
      setOrders(ordersRes.data || []);
      setCustomers(customersRes.data || []);
      setProducts(productsRes.data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const addItem = (product: any) => {
    const existing = items.find(i => i.product_id === product.id);
    if (existing) {
      setItems(items.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unit_price } : i));
    } else {
      setItems([...items, { product_id: product.id, product_name: product.name, quantity: 1, unit: product.unit, unit_price: product.selling_price, total: product.selling_price }]);
    }
    setShowProductModal(false);
  };

  const updateQty = (index: number, qty: number) => {
    const newItems = [...items];
    newItems[index].quantity = qty;
    newItems[index].total = qty * newItems[index].unit_price;
    setItems(newItems);
  };

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const calcSubtotal = () => items.reduce((sum, item) => sum + item.total, 0);
  const calcTotal = () => calcSubtotal() - (parseFloat(discount) || 0);

  const handleSave = async () => {
    if (!selectedCustomer && !newCustomerName) return Alert.alert('Error', 'Select customer');
    if (items.length === 0) return Alert.alert('Error', 'Add items');
    setSaving(true);
    try {
      let customerId = selectedCustomer?.id;
      if (!selectedCustomer && newCustomerName) {
        const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true });
        const { data: newCust } = await supabase.from('customers').insert([{ customer_code: `CUST-${String((count || 0) + 1).padStart(5, '0')}`, name: newCustomerName, phone: newCustomerPhone, payment_terms: paymentType, created_by: user?.id }]).select().single();
        customerId = newCust.id;
      }
      const { count } = await supabase.from('sales_orders').select('*', { count: 'exact', head: true });
      const invoiceNumber = `INV-${String((count || 0) + 1).padStart(6, '0')}`;
      const subtotal = calcSubtotal();
      const total = calcTotal();
      const { data: order } = await supabase.from('sales_orders').insert([{ invoice_number: invoiceNumber, customer_id: customerId, customer_name: selectedCustomer?.name || newCustomerName, customer_phone: selectedCustomer?.phone || newCustomerPhone, order_date: new Date().toISOString().split('T')[0], items, subtotal, discount_amount: parseFloat(discount) || 0, total_amount: total, payment_type: paymentType, paid_amount: paymentType === 'cash' ? total : 0, payment_status: paymentType === 'cash' ? 'paid' : 'pending', collected_by: user?.id, collected_by_name: user?.name }]).select().single();
      Alert.alert('Success', 'Sale created!', [{ text: 'OK' }, { text: 'Generate PDF', onPress: () => handlePDF(order) }]);
      setShowModal(false);
      loadData();
      refreshUser();
      setSelectedCustomer(null);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setItems([]);
      setDiscount('0');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePDF = async (order: any) => {
    try {
      const pdfUri = await generateInvoicePDF({ invoice_number: order.invoice_number, order_date: order.order_date, customer_name: order.customer_name, customer_phone: order.customer_phone, customer_address: '', items: order.items, subtotal: order.subtotal, discount_amount: order.discount_amount, total_amount: order.total_amount, payment_type: order.payment_type });
      await shareInvoicePDF(pdfUri);
    } catch (error) {
      Alert.alert('Error', 'PDF generation failed');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sales</Text>
      </View>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
        <TextInput style={styles.searchInput} placeholder="Search..." value={searchQuery} onChangeText={setSearchQuery} placeholderTextColor={Colors.textLight} />
      </View>
      {orders.filter(o => o.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) || o.customer_name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
        <EmptyState icon="cart" title="No Sales" description="Create your first sale" actionText="New Sale" onAction={() => setShowModal(true)} />
      ) : (
        <FlatList data={orders.filter(o => o.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) || o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()))} renderItem={({ item }) => (
          <Card style={styles.card} onPress={() => handlePDF(item)}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.invoice}>{item.invoice_number}</Text>
                <Text style={styles.customer}>{item.customer_name}</Text>
              </View>
              <View style={styles.right}>
                <Text style={styles.amount}>₹{item.total_amount.toLocaleString('en-IN')}</Text>
                <View style={[styles.badge, item.payment_status === 'paid' && styles.badgePaid, item.payment_status === 'pending' && styles.badgePending]}>
                  <Text style={styles.badgeText}>{item.payment_status.toUpperCase()}</Text>
                </View>
              </View>
            </View>
            <View style={styles.footer}>
              <Text style={styles.date}>{new Date(item.order_date).toLocaleDateString('en-IN')}</Text>
              <View style={[styles.payBadge, item.payment_type === 'cash' ? styles.payCash : styles.payCredit]}>
                <Text style={styles.payText}>{item.payment_type.toUpperCase()}</Text>
              </View>
            </View>
          </Card>
        )} keyExtractor={item => item.id} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />} />
      )}
      <FAB icon="add" onPress={() => setShowModal(true)} />
      <Modal visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
        <SafeAreaView style={styles.modal} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Sale</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}><Ionicons name="close" size={28} color={Colors.text} /></TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.sectionTitle}>Customer</Text>
            {selectedCustomer ? (
              <Card style={styles.selectedCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selName}>{selectedCustomer.name}</Text>
                  <Text style={styles.selPhone}>{selectedCustomer.phone}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedCustomer(null)}><Ionicons name="close-circle" size={24} color={Colors.danger} /></TouchableOpacity>
              </Card>
            ) : (
              <>
                <Button title="Select Customer" onPress={() => setShowCustomerModal(true)} variant="outline" style={{ marginBottom: 12 }} />
                <Text style={styles.orText}>OR</Text>
                <TextInput style={styles.input} value={newCustomerName} onChangeText={setNewCustomerName} placeholder="New customer name" />
                <TextInput style={styles.input} value={newCustomerPhone} onChangeText={setNewCustomerPhone} placeholder="Phone" keyboardType="phone-pad" />
              </>
            )}
            <Text style={styles.sectionTitle}>Payment Type</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity style={[styles.radio, paymentType === 'cash' && styles.radioActive]} onPress={() => setPaymentType('cash')}>
                <Text style={[styles.radioText, paymentType === 'cash' && styles.radioTextActive]}>Cash</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.radio, paymentType === 'credit' && styles.radioActive]} onPress={() => setPaymentType('credit')}>
                <Text style={[styles.radioText, paymentType === 'credit' && styles.radioTextActive]}>Credit</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.itemsHeader}>
              <Text style={styles.sectionTitle}>Items ({items.length})</Text>
              <TouchableOpacity onPress={() => setShowProductModal(true)} style={styles.addBtn}>
                <Ionicons name="add-circle" size={24} color={Colors.primary} />
                <Text style={styles.addText}>Add</Text>
              </TouchableOpacity>
            </View>
            {items.map((item, idx) => (
              <Card key={idx} style={styles.itemCard}>
                <View style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.product_name}</Text>
                    <Text style={styles.itemPrice}>₹{item.unit_price} / {item.unit}</Text>
                  </View>
                  <View style={styles.itemControls}>
                    <View style={styles.qtyControl}>
                      <TouchableOpacity onPress={() => updateQty(idx, Math.max(1, item.quantity - 1))} style={styles.qtyBtn}><Ionicons name="remove" size={16} /></TouchableOpacity>
                      <Text style={styles.qty}>{item.quantity}</Text>
                      <TouchableOpacity onPress={() => updateQty(idx, item.quantity + 1)} style={styles.qtyBtn}><Ionicons name="add" size={16} /></TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => removeItem(idx)}><Ionicons name="trash" size={20} color={Colors.danger} /></TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.itemTotal}>₹{item.total.toLocaleString('en-IN')}</Text>
              </Card>
            ))}
            {items.length > 0 && (
              <View style={styles.totals}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Subtotal:</Text>
                  <Text style={styles.totalValue}>₹{calcSubtotal().toLocaleString('en-IN')}</Text>
                </View>
                <Text style={styles.label}>Discount</Text>
                <TextInput style={styles.input} value={discount} onChangeText={setDiscount} placeholder="0.00" keyboardType="decimal-pad" />
                <View style={styles.totalRow}>
                  <Text style={styles.grandLabel}>Total:</Text>
                  <Text style={styles.grandValue}>₹{calcTotal().toLocaleString('en-IN')}</Text>
                </View>
              </View>
            )}
            <Button title="Create Sale" onPress={handleSave} loading={saving} disabled={items.length === 0} style={{ marginBottom: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal visible={showCustomerModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.cardHeader2}>
              <Text style={styles.cardTitle}>Select Customer</Text>
              <TouchableOpacity onPress={() => setShowCustomerModal(false)}><Ionicons name="close" size={24} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.cardContent}>
              {customers.map(c => (
                <TouchableOpacity key={c.id} style={styles.custItem} onPress={() => { setSelectedCustomer(c); setPaymentType(c.payment_terms); setShowCustomerModal(false); }}>
                  <Text style={styles.custName}>{c.name}</Text>
                  <Text style={styles.custPhone}>{c.phone}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={showProductModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.cardHeader2}>
              <Text style={styles.cardTitle}>Select Product</Text>
              <TouchableOpacity onPress={() => setShowProductModal(false)}><Ionicons name="close" size={24} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.cardContent}>
              {products.map(p => (
                <TouchableOpacity key={p.id} style={styles.prodItem} onPress={() => addItem(p)} disabled={p.current_stock <= 0}>
                  <View>
                    <Text style={styles.prodName}>{p.name}</Text>
                    <Text style={styles.prodPrice}>₹{p.selling_price} / {p.unit}</Text>
                  </View>
                  <Text style={[styles.stock, p.current_stock <= 0 && { color: Colors.danger }]}>Stock: {p.current_stock}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: FontSizes.xxl, fontWeight: 'bold', color: Colors.text },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, margin: Spacing.lg, marginBottom: Spacing.md, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  searchIcon: { marginRight: Spacing.sm },
  searchInput: { flex: 1, paddingVertical: Spacing.md, fontSize: FontSizes.md, color: Colors.text },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  card: { marginBottom: Spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  invoice: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text },
  customer: { fontSize: FontSizes.md, color: Colors.textSecondary, marginTop: 4 },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: FontSizes.xl, fontWeight: 'bold', color: Colors.primary },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.sm, marginTop: 4 },
  badgePaid: { backgroundColor: Colors.success + '20' },
  badgePending: { backgroundColor: Colors.warning + '20' },
  badgeText: { fontSize: FontSizes.xs, fontWeight: 'bold' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm },
  date: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  payBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.sm },
  payCash: { backgroundColor: Colors.success + '30' },
  payCredit: { backgroundColor: Colors.warning + '30' },
  payText: { fontSize: FontSizes.xs, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSizes.xxl, fontWeight: 'bold', color: Colors.text },
  modalContent: { flex: 1, padding: Spacing.lg },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.md, marginTop: Spacing.md },
  selectedCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, marginBottom: Spacing.md },
  selName: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.text },
  selPhone: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 2 },
  orText: { textAlign: 'center', color: Colors.textSecondary, marginVertical: Spacing.sm },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSizes.md, color: Colors.text, marginBottom: Spacing.md },
  radioGroup: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  radio: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.surface },
  radioActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  radioText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textSecondary },
  radioTextActive: { color: Colors.primary },
  itemsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.primary },
  itemCard: { marginBottom: Spacing.sm },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  itemName: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.text },
  itemPrice: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 2 },
  itemControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  qtyControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: BorderRadius.sm, padding: 4 },
  qtyBtn: { padding: 4 },
  qty: { fontSize: FontSizes.md, fontWeight: '600', marginHorizontal: Spacing.sm, minWidth: 30, textAlign: 'center' },
  itemTotal: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.primary, textAlign: 'right' },
  totals: { backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: BorderRadius.md, marginTop: Spacing.md, marginBottom: Spacing.lg },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  totalLabel: { fontSize: FontSizes.md, color: Colors.textSecondary },
  totalValue: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.text },
  label: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  grandLabel: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text },
  grandValue: { fontSize: FontSizes.xl, fontWeight: 'bold', color: Colors.primary },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.surface, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, maxHeight: '80%' },
  cardHeader2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cardTitle: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text },
  cardContent: { padding: Spacing.lg },
  custItem: { padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  custName: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.text },
  custPhone: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 4 },
  prodItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  prodName: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.text },
  prodPrice: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 4 },
  stock: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.success },
});
