import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../constants/theme';
import Card from '../../components/Card';
import Button from '../../components/Button';
import FAB from '../../components/FAB';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';

export default function ProductionScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [ordersRes, productsRes] = await Promise.all([
        supabase.from('production_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('*').eq('is_active', true).order('name'),
      ]);
      setOrders(ordersRes.data || []);
      setProducts(productsRes.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSave = async () => {
    if (!selectedProduct || !quantity) return Alert.alert('Error', 'Select product and quantity');
    setSaving(true);
    try {
      const { count } = await supabase.from('production_orders').select('*', { count: 'exact', head: true });
      await supabase.from('production_orders').insert([{ production_number: `PROD-${String((count || 0) + 1).padStart(6, '0')}`, product_id: selectedProduct.id, product_name: selectedProduct.name, quantity_planned: parseFloat(quantity), quantity_produced: 0, quantity_rejected: 0, unit: selectedProduct.unit, status: 'planned', created_by: user?.id, created_by_name: user?.name, notes }]);
      Alert.alert('Success', 'Production order created');
      setShowModal(false);
      loadData();
      setSelectedProduct(null);
      setQuantity('');
      setNotes('');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await supabase.from('production_orders').update({ status, completion_date: status === 'completed' ? new Date().toISOString().split('T')[0] : null }).eq('id', id);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Production Orders</Text>
      </View>
      {orders.length === 0 ? (
        <EmptyState icon="construct" title="No Orders" description="Create production orders" actionText="New Order" onAction={() => setShowModal(true)} />
      ) : (
        <FlatList data={orders} renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.number}>{item.production_number}</Text>
                <Text style={styles.product}>{item.product_name}</Text>
                <Text style={styles.qty}>Qty: {item.quantity_planned} {item.unit}</Text>
              </View>
              <View style={[styles.badge, item.status === 'completed' && styles.badgeCompleted, item.status === 'planned' && styles.badgePlanned, item.status === 'in_progress' && styles.badgeProgress]}>
                <Text style={styles.badgeText}>{item.status.toUpperCase()}</Text>
              </View>
            </View>
            {item.status !== 'completed' && (
              <View style={styles.actions}>
                {item.status === 'planned' && (
                  <TouchableOpacity style={styles.btn} onPress={() => updateStatus(item.id, 'in_progress')}>
                    <Text style={styles.btnText}>Start</Text>
                  </TouchableOpacity>
                )}
                {item.status === 'in_progress' && (
                  <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.success }]} onPress={() => updateStatus(item.id, 'completed')}>
                    <Text style={styles.btnText}>Complete</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </Card>
        )} keyExtractor={item => item.id} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />} />
      )}
      <FAB icon="add" onPress={() => setShowModal(true)} />
      <Modal visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
        <SafeAreaView style={styles.modal} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Production Order</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}><Ionicons name="close" size={28} /></TouchableOpacity>
          </View>
          <ScrollView style={styles.content}>
            <Text style={styles.inputLabel}>Product *</Text>
            {selectedProduct ? (
              <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: FontSizes.md, fontWeight: '600' }}>{selectedProduct.name}</Text>
                <TouchableOpacity onPress={() => setSelectedProduct(null)}><Ionicons name="close-circle" size={24} color={Colors.danger} /></TouchableOpacity>
              </Card>
            ) : (
              <ScrollView horizontal style={{ marginBottom: 16 }}>
                {products.map(p => (
                  <TouchableOpacity key={p.id} style={styles.productChip} onPress={() => setSelectedProduct(p)}>
                    <Text style={styles.chipText}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <Text style={styles.inputLabel}>Quantity *</Text>
            <TextInput style={styles.input} value={quantity} onChangeText={setQuantity} placeholder="Enter quantity" keyboardType="decimal-pad" />
            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} placeholder="Optional notes" multiline />
            <Button title="Create Order" onPress={handleSave} loading={saving} style={{ marginTop: 20, marginBottom: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: FontSizes.xxl, fontWeight: 'bold', color: Colors.text },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  card: { marginBottom: Spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  number: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  product: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text, marginTop: 4 },
  qty: { fontSize: FontSizes.md, color: Colors.textSecondary, marginTop: 4 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: BorderRadius.sm },
  badgePlanned: { backgroundColor: Colors.info + '20' },
  badgeProgress: { backgroundColor: Colors.warning + '20' },
  badgeCompleted: { backgroundColor: Colors.success + '20' },
  badgeText: { fontSize: FontSizes.xs, fontWeight: 'bold' },
  actions: { marginTop: 12, flexDirection: 'row', gap: 8 },
  btn: { flex: 1, backgroundColor: Colors.primary, padding: 12, borderRadius: BorderRadius.md, alignItems: 'center' },
  btnText: { color: Colors.surface, fontSize: FontSizes.sm, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSizes.xxl, fontWeight: 'bold', color: Colors.text },
  content: { flex: 1, padding: Spacing.lg },
  inputLabel: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text, marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSizes.md, color: Colors.text },
  productChip: { backgroundColor: Colors.primary + '20', paddingHorizontal: 16, paddingVertical: 10, borderRadius: BorderRadius.full, marginRight: 8 },
  chipText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.primary },
});
