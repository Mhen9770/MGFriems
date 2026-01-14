import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../../constants/theme';
import Card from '../../../components/Card';
import LoadingSpinner from '../../../components/LoadingSpinner';
import FAB from '../../../components/FAB';

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
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sales, setSales] = useState<SalesOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  // Form state
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('cash');
  const [items, setItems] = useState<any[]>([]);
  const [discount, setDiscount] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [salesRes, customersRes, productsRes] = await Promise.all([
        supabase.from('sales_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('customers').select('*').eq('is_active', true),
        supabase.from('products').select('*').eq('is_active', true),
      ]);

      if (salesRes.data) setSales(salesRes.data);
      if (customersRes.data) setCustomers(customersRes.data);
      if (productsRes.data) setProducts(productsRes.data);
    } catch (error) {
      console.error('Error loading sales data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const addItem = () => {
    setItems([...items, { product_id: '', product_name: '', quantity: '1', unit_price: '0', unit: 'pcs' }]);
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index][field] = value;
    
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product) {
        newItems[index].product_name = product.name;
        newItems[index].unit_price = product.selling_price.toString();
        newItems[index].unit = product.unit;
      }
    }
    
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    const subtotal = items.reduce((sum, item) => {
      return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
    }, 0);
    const discountAmount = parseFloat(discount) || 0;
    return subtotal - discountAmount;
  };

  const handleCreateSale = async () => {
    if (!selectedCustomer) {
      Alert.alert('Error', 'Please select a customer');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Error', 'Please add at least one item');
      return;
    }

    try {
      const subtotal = items.reduce((sum, item) => {
        return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
      }, 0);
      const discountAmount = parseFloat(discount) || 0;
      const totalAmount = subtotal - discountAmount;

      const { data: invoiceNum } = await supabase.rpc('generate_invoice_number');

      const { error } = await supabase.from('sales_orders').insert([{
        invoice_number: invoiceNum || `INV-${Date.now()}`,
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        customer_phone: selectedCustomer.phone,
        customer_address: selectedCustomer.address,
        items: items.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: parseFloat(item.quantity),
          unit: item.unit,
          unit_price: parseFloat(item.unit_price),
          total: parseFloat(item.quantity) * parseFloat(item.unit_price),
        })),
        subtotal,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        payment_type: paymentType,
        paid_amount: paymentType === 'cash' ? totalAmount : 0,
        payment_status: paymentType === 'cash' ? 'paid' : 'pending',
        collected_by: user?.id,
        collected_by_name: user?.name,
      }]);

      if (error) throw error;

      Alert.alert('Success', 'Sale created successfully!');
      setModalVisible(false);
      resetForm();
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const resetForm = () => {
    setSelectedCustomer(null);
    setPaymentType('cash');
    setItems([]);
    setDiscount('');
  };

  const filteredSales = sales.filter(sale =>
    sale.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sale.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return Colors.success;
      case 'partial': return Colors.warning;
      default: return Colors.danger;
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search invoices..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={Colors.textLight}
        />
      </View>

      {/* Sales List */}
      <FlatList
        data={filteredSales}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Card style={styles.saleCard}>
            <View style={styles.saleHeader}>
              <View>
                <Text style={styles.invoiceNumber}>{item.invoice_number}</Text>
                <Text style={styles.customerName}>{item.customer_name}</Text>
              </View>
              <View style={styles.saleRight}>
                <Text style={styles.amount}>₹{parseFloat(item.total_amount as any).toLocaleString('en-IN')}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.payment_status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(item.payment_status) }]}>
                    {item.payment_status.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.saleFooter}>
              <Text style={styles.saleDate}>{new Date(item.order_date).toLocaleDateString()}</Text>
              <Text style={[styles.paymentType, item.payment_type === 'cash' ? styles.cash : styles.credit]}>
                {item.payment_type.toUpperCase()}
              </Text>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={64} color={Colors.textLight} />
            <Text style={styles.emptyText}>No sales yet</Text>
          </View>
        }
      />

      <FAB icon="add" onPress={() => setModalVisible(true)} />

      {/* Create Sale Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Sale</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Customer Selection */}
            <Text style={styles.label}>Customer *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.customerScroll}>
              {customers.map((customer) => (
                <TouchableOpacity
                  key={customer.id}
                  style={[
                    styles.customerChip,
                    selectedCustomer?.id === customer.id && styles.customerChipActive,
                  ]}
                  onPress={() => setSelectedCustomer(customer)}
                >
                  <Text style={[
                    styles.customerChipText,
                    selectedCustomer?.id === customer.id && styles.customerChipTextActive,
                  ]}>
                    {customer.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Payment Type */}
            <Text style={styles.label}>Payment Type</Text>
            <View style={styles.paymentTypeRow}>
              <TouchableOpacity
                style={[styles.paymentBtn, paymentType === 'cash' && styles.paymentBtnActive]}
                onPress={() => setPaymentType('cash')}
              >
                <Ionicons name="cash" size={20} color={paymentType === 'cash' ? '#FFF' : Colors.success} />
                <Text style={[styles.paymentBtnText, paymentType === 'cash' && styles.paymentBtnTextActive]}>Cash</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paymentBtn, paymentType === 'credit' && styles.paymentBtnActive, { backgroundColor: paymentType === 'credit' ? Colors.warning : Colors.warning + '20' }]}
                onPress={() => setPaymentType('credit')}
              >
                <Ionicons name="card" size={20} color={paymentType === 'credit' ? '#FFF' : Colors.warning} />
                <Text style={[styles.paymentBtnText, paymentType === 'credit' && styles.paymentBtnTextActive]}>Credit</Text>
              </TouchableOpacity>
            </View>

            {/* Items */}
            <View style={styles.itemsHeader}>
              <Text style={styles.label}>Items</Text>
              <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
                <Ionicons name="add" size={20} color={Colors.primary} />
                <Text style={styles.addItemText}>Add Item</Text>
              </TouchableOpacity>
            </View>

            {items.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <View style={styles.itemProduct}>
                  <Text style={styles.itemLabel}>Product</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {products.map((product) => (
                      <TouchableOpacity
                        key={product.id}
                        style={[
                          styles.productChip,
                          item.product_id === product.id && styles.productChipActive,
                        ]}
                        onPress={() => updateItem(index, 'product_id', product.id)}
                      >
                        <Text style={[
                          styles.productChipText,
                          item.product_id === product.id && styles.productChipTextActive,
                        ]}>
                          {product.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.itemDetails}>
                  <View style={styles.itemField}>
                    <Text style={styles.itemLabel}>Qty</Text>
                    <TextInput
                      style={styles.itemInput}
                      value={item.quantity}
                      onChangeText={(text) => updateItem(index, 'quantity', text)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.itemField}>
                    <Text style={styles.itemLabel}>Price</Text>
                    <TextInput
                      style={styles.itemInput}
                      value={item.unit_price}
                      onChangeText={(text) => updateItem(index, 'unit_price', text)}
                      keyboardType="numeric"
                    />
                  </View>
                  <TouchableOpacity onPress={() => removeItem(index)} style={styles.removeBtn}>
                    <Ionicons name="trash" size={20} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* Discount */}
            <Text style={styles.label}>Discount (₹)</Text>
            <TextInput
              style={styles.input}
              value={discount}
              onChangeText={setDiscount}
              placeholder="0"
              keyboardType="numeric"
              placeholderTextColor={Colors.textLight}
            />

            {/* Total */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalAmount}>₹{calculateTotal().toLocaleString('en-IN')}</Text>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createBtn} onPress={handleCreateSale}>
              <Text style={styles.createBtnText}>Create Sale</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, margin: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md, ...Shadows.sm },
  searchInput: { flex: 1, marginLeft: Spacing.sm, fontSize: FontSizes.md, color: Colors.text },
  listContent: { padding: Spacing.md, paddingBottom: 100 },
  saleCard: { marginBottom: Spacing.md },
  saleHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  invoiceNumber: { fontSize: FontSizes.md, fontWeight: 'bold', color: Colors.text },
  customerName: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 2 },
  saleRight: { alignItems: 'flex-end' },
  amount: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.sm, marginTop: 4 },
  statusText: { fontSize: FontSizes.xs, fontWeight: '600' },
  saleFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  saleDate: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  paymentType: { fontSize: FontSizes.xs, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.sm },
  cash: { backgroundColor: Colors.success + '20', color: Colors.success },
  credit: { backgroundColor: Colors.warning + '20', color: Colors.warning },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyText: { fontSize: FontSizes.md, color: Colors.textSecondary, marginTop: Spacing.md },
  modal: { flex: 1, backgroundColor: Colors.surface },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: 'bold', color: Colors.text },
  modalContent: { flex: 1, padding: Spacing.lg },
  label: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm, marginTop: Spacing.md },
  customerScroll: { marginBottom: Spacing.sm },
  customerChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.background, borderRadius: BorderRadius.full, marginRight: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  customerChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  customerChipText: { fontSize: FontSizes.sm, color: Colors.text },
  customerChipTextActive: { color: '#FFF' },
  paymentTypeRow: { flexDirection: 'row', gap: Spacing.md },
  paymentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.success + '20', gap: Spacing.sm },
  paymentBtnActive: { backgroundColor: Colors.success },
  paymentBtnText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.success },
  paymentBtnTextActive: { color: '#FFF' },
  itemsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.lg },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addItemText: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: '600' },
  itemRow: { backgroundColor: Colors.background, padding: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.sm },
  itemProduct: { marginBottom: Spacing.sm },
  itemLabel: { fontSize: FontSizes.xs, color: Colors.textSecondary, marginBottom: 4 },
  productChip: { paddingHorizontal: Spacing.sm, paddingVertical: 4, backgroundColor: Colors.surface, borderRadius: BorderRadius.sm, marginRight: Spacing.xs, borderWidth: 1, borderColor: Colors.border },
  productChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  productChipText: { fontSize: FontSizes.xs, color: Colors.text },
  productChipTextActive: { color: '#FFF' },
  itemDetails: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  itemField: { flex: 1 },
  itemInput: { backgroundColor: Colors.surface, padding: Spacing.sm, borderRadius: BorderRadius.sm, fontSize: FontSizes.md, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  removeBtn: { padding: Spacing.sm },
  input: { backgroundColor: Colors.background, padding: Spacing.md, borderRadius: BorderRadius.md, fontSize: FontSizes.md, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.lg, paddingTop: Spacing.lg, borderTopWidth: 2, borderTopColor: Colors.primary },
  totalLabel: { fontSize: FontSizes.lg, fontWeight: '600', color: Colors.text },
  totalAmount: { fontSize: FontSizes.xxl, fontWeight: 'bold', color: Colors.primary },
  modalFooter: { flexDirection: 'row', padding: Spacing.lg, gap: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.background, alignItems: 'center' },
  cancelBtnText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textSecondary },
  createBtn: { flex: 2, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  createBtnText: { fontSize: FontSizes.md, fontWeight: '600', color: '#FFF' },
});
