import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
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

interface ProductionOrder {
  id: string;
  production_number: string;
  product_name: string;
  quantity_planned: number;
  quantity_produced: number;
  status: string;
  priority: string;
  start_date: string;
}

export default function ProductionScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');

  // Form state
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ordersRes, productsRes] = await Promise.all([
        supabase.from('production_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('*').eq('is_active', true),
      ]);

      if (ordersRes.data) setOrders(ordersRes.data);
      if (productsRes.data) setProducts(productsRes.data);
    } catch (error) {
      console.error('Error loading production data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCreateOrder = async () => {
    if (!selectedProduct) {
      Alert.alert('Error', 'Please select a product');
      return;
    }
    if (!quantity || parseFloat(quantity) <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    try {
      const { data: prodNum } = await supabase.rpc('generate_production_number');

      const { error } = await supabase.from('production_orders').insert([{
        production_number: prodNum || `PROD-${Date.now()}`,
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity_planned: parseFloat(quantity),
        unit: selectedProduct.unit,
        priority,
        start_date: startDate,
        created_by: user?.id,
      }]);

      if (error) throw error;

      Alert.alert('Success', 'Production order created!');
      setModalVisible(false);
      resetForm();
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string, quantityProduced?: number) => {
    try {
      const updateData: any = { status: newStatus };
      if (quantityProduced !== undefined) {
        updateData.quantity_produced = quantityProduced;
      }
      if (newStatus === 'completed') {
        updateData.completion_date = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('production_orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const resetForm = () => {
    setSelectedProduct(null);
    setQuantity('');
    setPriority('normal');
    setStartDate(new Date().toISOString().split('T')[0]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return Colors.success;
      case 'in_progress': return Colors.primary;
      case 'cancelled': return Colors.danger;
      default: return Colors.warning;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return Colors.danger;
      case 'high': return Colors.warning;
      case 'low': return Colors.textSecondary;
      default: return Colors.primary;
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  if (loading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {['all', 'planned', 'in_progress', 'completed'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Card style={styles.orderCard}>
            <View style={styles.orderHeader}>
              <View>
                <Text style={styles.orderNumber}>{item.production_number}</Text>
                <Text style={styles.productName}>{item.product_name}</Text>
              </View>
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) + '20' }]}>
                <Text style={[styles.priorityText, { color: getPriorityColor(item.priority) }]}>
                  {item.priority.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.progressRow}>
              <Text style={styles.progressText}>
                {item.quantity_produced} / {item.quantity_planned} units
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${(item.quantity_produced / item.quantity_planned) * 100}%`, backgroundColor: getStatusColor(item.status) },
                  ]}
                />
              </View>
            </View>

            <View style={styles.orderFooter}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                  {item.status.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
              
              {item.status === 'planned' && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => updateOrderStatus(item.id, 'in_progress')}
                >
                  <Ionicons name="play" size={16} color={Colors.primary} />
                  <Text style={styles.actionText}>Start</Text>
                </TouchableOpacity>
              )}
              
              {item.status === 'in_progress' && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    Alert.prompt(
                      'Complete Production',
                      'Enter quantity produced:',
                      (text) => {
                        const qty = parseFloat(text);
                        if (qty > 0) {
                          updateOrderStatus(item.id, 'completed', qty);
                        }
                      },
                      'plain-text',
                      item.quantity_planned.toString()
                    );
                  }}
                >
                  <Ionicons name="checkmark" size={16} color={Colors.success} />
                  <Text style={[styles.actionText, { color: Colors.success }]}>Complete</Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="construct-outline" size={64} color={Colors.textLight} />
            <Text style={styles.emptyText}>No production orders</Text>
          </View>
        }
      />

      <FAB icon="add" onPress={() => setModalVisible(true)} />

      {/* Create Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Production Order</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Product *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {products.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  style={[styles.chip, selectedProduct?.id === product.id && styles.chipActive]}
                  onPress={() => setSelectedProduct(product)}
                >
                  <Text style={[styles.chipText, selectedProduct?.id === product.id && styles.chipTextActive]}>
                    {product.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Quantity *</Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              placeholder="Enter quantity"
              keyboardType="numeric"
              placeholderTextColor={Colors.textLight}
            />

            <Text style={styles.label}>Priority</Text>
            <View style={styles.priorityRow}>
              {(['low', 'normal', 'high', 'urgent'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.priorityBtn, priority === p && { backgroundColor: getPriorityColor(p) }]}
                  onPress={() => setPriority(p)}
                >
                  <Text style={[styles.priorityBtnText, priority === p && { color: '#FFF' }]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Start Date</Text>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textLight}
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createBtn} onPress={handleCreateOrder}>
              <Text style={styles.createBtnText}>Create Order</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  filterScroll: { backgroundColor: Colors.surface, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterTab: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginRight: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: Colors.background },
  filterTabActive: { backgroundColor: Colors.primary },
  filterText: { fontSize: FontSizes.sm, color: Colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: '#FFF' },
  listContent: { padding: Spacing.md, paddingBottom: 100 },
  orderCard: { marginBottom: Spacing.md },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  orderNumber: { fontSize: FontSizes.md, fontWeight: 'bold', color: Colors.text },
  productName: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 2 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.sm },
  priorityText: { fontSize: FontSizes.xs, fontWeight: '600' },
  progressRow: { marginBottom: Spacing.md },
  progressText: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginBottom: 4 },
  progressBar: { height: 8, backgroundColor: Colors.background, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.sm },
  statusText: { fontSize: FontSizes.xs, fontWeight: '600' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  actionText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.primary },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyText: { fontSize: FontSizes.md, color: Colors.textSecondary, marginTop: Spacing.md },
  modal: { flex: 1, backgroundColor: Colors.surface },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: 'bold', color: Colors.text },
  modalContent: { flex: 1, padding: Spacing.lg },
  label: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm, marginTop: Spacing.md },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.background, borderRadius: BorderRadius.full, marginRight: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSizes.sm, color: Colors.text },
  chipTextActive: { color: '#FFF' },
  input: { backgroundColor: Colors.background, padding: Spacing.md, borderRadius: BorderRadius.md, fontSize: FontSizes.md, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  priorityRow: { flexDirection: 'row', gap: Spacing.sm },
  priorityBtn: { flex: 1, padding: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.background, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  priorityBtnText: { fontSize: FontSizes.sm, fontWeight: '500', color: Colors.text },
  modalFooter: { flexDirection: 'row', padding: Spacing.lg, gap: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.background, alignItems: 'center' },
  cancelBtnText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textSecondary },
  createBtn: { flex: 2, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  createBtnText: { fontSize: FontSizes.md, fontWeight: '600', color: '#FFF' },
});
