import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../constants/theme';
import Card from '../../components/Card';
import LoadingSpinner from '../../components/LoadingSpinner';
import FAB from '../../components/FAB';

export default function ProductionDrawerScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);

  // Form state
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');

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
      console.error('Error loading production:', error);
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
      Alert.alert('Error', 'Please enter valid quantity');
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
        start_date: new Date().toISOString().split('T')[0],
        created_by: user?.id,
      }]);

      if (error) throw error;
      Alert.alert('Success', 'Production order created!');
      setModalVisible(false);
      setSelectedProduct(null);
      setQuantity('');
      setPriority('normal');
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const updateStatus = async (id: string, status: string, qty?: number) => {
    try {
      const update: any = { status };
      if (qty) update.quantity_produced = qty;
      if (status === 'completed') update.completion_date = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase.from('production_orders').update(update).eq('id', id);
      if (error) throw error;
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return Colors.success;
      case 'in_progress': return Colors.primary;
      case 'cancelled': return Colors.danger;
      default: return Colors.warning;
    }
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'urgent': return Colors.danger;
      case 'high': return Colors.warning;
      case 'low': return Colors.textSecondary;
      default: return Colors.primary;
    }
  };

  const filteredOrders = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  if (loading) return <LoadingSpinner />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
          <Ionicons name="menu" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Production</Text>
        <View style={{ width: 28 }} />
      </View>

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

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />}
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
              <Text style={styles.progressText}>{item.quantity_produced} / {item.quantity_planned} units</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${(item.quantity_produced / item.quantity_planned) * 100}%`, backgroundColor: getStatusColor(item.status) }]} />
              </View>
            </View>
            <View style={styles.orderFooter}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                  {item.status.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
              {item.status === 'planned' && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => updateStatus(item.id, 'in_progress')}>
                  <Ionicons name="play" size={16} color={Colors.primary} />
                  <Text style={styles.actionText}>Start</Text>
                </TouchableOpacity>
              )}
              {item.status === 'in_progress' && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => {
                  Alert.prompt('Complete', 'Enter produced quantity:', (text) => {
                    const qty = parseFloat(text);
                    if (qty > 0) updateStatus(item.id, 'completed', qty);
                  }, 'plain-text', item.quantity_planned.toString());
                }}>
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

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Production</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Product *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {products.map((p) => (
                <TouchableOpacity key={p.id} style={[styles.chip, selectedProduct?.id === p.id && styles.chipActive]} onPress={() => setSelectedProduct(p)}>
                  <Text style={[styles.chipText, selectedProduct?.id === p.id && styles.chipTextActive]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.label}>Quantity *</Text>
            <TextInput style={styles.input} value={quantity} onChangeText={setQuantity} placeholder="Enter quantity" keyboardType="numeric" placeholderTextColor={Colors.textLight} />
            <Text style={styles.label}>Priority</Text>
            <View style={styles.priorityRow}>
              {(['low', 'normal', 'high', 'urgent'] as const).map((p) => (
                <TouchableOpacity key={p} style={[styles.priorityBtn, priority === p && { backgroundColor: getPriorityColor(p) }]} onPress={() => setPriority(p)}>
                  <Text style={[styles.priorityBtnText, priority === p && { color: '#FFF' }]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: FontSizes.xl, fontWeight: 'bold', color: Colors.text },
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
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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
