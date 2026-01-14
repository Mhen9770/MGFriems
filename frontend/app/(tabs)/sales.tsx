import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface SaleItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Sale {
  id: string;
  sale_number: string;
  customer_name: string;
  total_amount: number;
  payment_type: string;
  status: string;
  collected_by_name: string;
  created_at: string;
}

export default function Sales() {
  const { user, refreshUser } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('cash');
  const [items, setItems] = useState<SaleItem[]>([{
    product_name: '',
    quantity: 0,
    unit_price: 0,
    total: 0
  }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSales(data || []);
    } catch (error) {
      console.error('Error loading sales:', error);
    }
  };

  const addItem = () => {
    setItems([...items, { product_name: '', quantity: 0, unit_price: 0, total: 0 }]);
  };

  const updateItem = (index: number, field: keyof SaleItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total = newItems[index].quantity * newItems[index].unit_price;
    }
    
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  const handleCreateSale = async () => {
    if (!customerName || !user) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    const validItems = items.filter(item => item.product_name && item.quantity > 0);
    if (validItems.length === 0) {
      Alert.alert('Error', 'Please add at least one item');
      return;
    }

    setLoading(true);
    try {
      const totalAmount = calculateTotal();
      const saleNumber = await generateSaleNumber();

      const { error } = await supabase
        .from('sales')
        .insert([{
          sale_number: saleNumber,
          customer_name: customerName,
          items: validItems,
          total_amount: totalAmount,
          payment_type: paymentType,
          collected_by: user.id,
          collected_by_name: user.name,
          status: paymentType === 'cash' ? 'settled' : 'pending',
          paid_amount: paymentType === 'cash' ? totalAmount : 0,
        }]);

      if (error) throw error;

      Alert.alert('Success', 'Sale created successfully!');
      setShowModal(false);
      resetForm();
      loadSales();
      refreshUser();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateSaleNumber = async () => {
    const { count } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true });
    
    const nextNum = (count || 0) + 1;
    return `SALE-${String(nextNum).padStart(6, '0')}`;
  };

  const resetForm = () => {
    setCustomerName('');
    setPaymentType('cash');
    setItems([{ product_name: '', quantity: 0, unit_price: 0, total: 0 }]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sales Management</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowModal(true)}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {sales.map((sale) => (
          <View key={sale.id} style={styles.saleCard}>
            <View style={styles.saleHeader}>
              <Text style={styles.saleNumber}>{sale.sale_number}</Text>
              <View style={[
                styles.statusBadge,
                sale.status === 'settled' && styles.statusSettled,
                sale.status === 'pending' && styles.statusPending,
                sale.status === 'partial' && styles.statusPartial,
              ]}>
                <Text style={styles.statusText}>{sale.status.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.customerName}>{sale.customer_name}</Text>
            <View style={styles.saleFooter}>
              <View>
                <Text style={styles.saleLabel}>Amount</Text>
                <Text style={styles.saleAmount}>
                  ₹{sale.total_amount.toLocaleString('en-IN')}
                </Text>
              </View>
              <View>
                <Text style={styles.saleLabel}>Type</Text>
                <Text style={styles.saleType}>{sale.payment_type.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.saleCollector}>By: {sale.collected_by_name}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Create Sale Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Sale</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={28} color="#111827" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Customer Name</Text>
              <TextInput
                style={styles.input}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="Enter customer name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Payment Type</Text>
              <View style={styles.paymentTypes}>
                <TouchableOpacity
                  style={[
                    styles.paymentTypeButton,
                    paymentType === 'cash' && styles.paymentTypeActive,
                  ]}
                  onPress={() => setPaymentType('cash')}
                >
                  <Text
                    style={[
                      styles.paymentTypeText,
                      paymentType === 'cash' && styles.paymentTypeTextActive,
                    ]}
                  >
                    Cash
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.paymentTypeButton,
                    paymentType === 'credit' && styles.paymentTypeActive,
                  ]}
                  onPress={() => setPaymentType('credit')}
                >
                  <Text
                    style={[
                      styles.paymentTypeText,
                      paymentType === 'credit' && styles.paymentTypeTextActive,
                    ]}
                  >
                    Credit
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.label}>Items</Text>
            {items.map((item, index) => (
              <View key={index} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemNumber}>Item {index + 1}</Text>
                  {items.length > 1 && (
                    <TouchableOpacity onPress={() => removeItem(index)}>
                      <Ionicons name="trash" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  style={styles.input}
                  value={item.product_name}
                  onChangeText={(value) => updateItem(index, 'product_name', value)}
                  placeholder="Product name"
                />
                <View style={styles.itemRow}>
                  <TextInput
                    style={[styles.input, styles.inputSmall]}
                    value={item.quantity ? String(item.quantity) : ''}
                    onChangeText={(value) => updateItem(index, 'quantity', parseFloat(value) || 0)}
                    placeholder="Qty"
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={[styles.input, styles.inputSmall]}
                    value={item.unit_price ? String(item.unit_price) : ''}
                    onChangeText={(value) => updateItem(index, 'unit_price', parseFloat(value) || 0)}
                    placeholder="Price"
                    keyboardType="numeric"
                  />
                  <View style={styles.totalContainer}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>₹{item.total.toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.addItemButton} onPress={addItem}>
              <Ionicons name="add-circle-outline" size={24} color="#4F46E5" />
              <Text style={styles.addItemText}>Add Item</Text>
            </TouchableOpacity>

            <View style={styles.totalSection}>
              <Text style={styles.totalSectionLabel}>Grand Total</Text>
              <Text style={styles.totalSectionValue}>
                ₹{calculateTotal().toLocaleString('en-IN')}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleCreateSale}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Creating...' : 'Create Sale'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  addButton: {
    backgroundColor: '#4F46E5',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  saleCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  saleNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusSettled: {
    backgroundColor: '#D1FAE5',
  },
  statusPending: {
    backgroundColor: '#FEE2E2',
  },
  statusPartial: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
  },
  customerName: {
    fontSize: 18,
    color: '#111827',
    marginBottom: 12,
  },
  saleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  saleLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  saleAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4F46E5',
    marginTop: 4,
  },
  saleType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginTop: 4,
  },
  saleCollector: {
    fontSize: 12,
    color: '#6B7280',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
  },
  paymentTypes: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentTypeButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  paymentTypeActive: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  paymentTypeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  paymentTypeTextActive: {
    color: '#4F46E5',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  itemRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  inputSmall: {
    flex: 1,
  },
  totalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 8,
  },
  totalLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    marginBottom: 24,
  },
  addItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
    marginLeft: 8,
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    marginBottom: 24,
  },
  totalSectionLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  totalSectionValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  submitButton: {
    backgroundColor: '#4F46E5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
