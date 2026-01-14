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

export default function PackagingScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [unitPrice, setUnitPrice] = useState('');
  const [currentStock, setCurrentStock] = useState('');
  const [reorderLevel, setReorderLevel] = useState('10');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data } = await supabase.from('packaging_materials').select('*').eq('is_active', true).order('name');
      setMaterials(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSave = async () => {
    if (!name || !unitPrice) return Alert.alert('Error', 'Fill required fields');
    setSaving(true);
    try {
      const { count } = await supabase.from('packaging_materials').select('*', { count: 'exact', head: true });
      await supabase.from('packaging_materials').insert([{ material_code: `PKG-${String((count || 0) + 1).padStart(5, '0')}`, name, unit, unit_price: parseFloat(unitPrice), current_stock: parseFloat(currentStock) || 0, reorder_level: parseFloat(reorderLevel) || 10, created_by: user?.id }]);
      Alert.alert('Success', 'Material added');
      setShowModal(false);
      loadData();
      setName('');
      setUnitPrice('');
      setCurrentStock('');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Packaging Materials</Text>
      </View>
      {materials.length === 0 ? (
        <EmptyState icon="cube" title="No Materials" description="Add packaging materials" actionText="Add Material" onAction={() => setShowModal(true)} />
      ) : (
        <FlatList data={materials} renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Stock: {item.current_stock} {item.unit}</Text>
              <Text style={styles.price}>₹{item.unit_price}</Text>
            </View>
            {item.current_stock <= item.reorder_level && <Text style={styles.lowStock}>Low Stock!</Text>}
          </Card>
        )} keyExtractor={item => item.id} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />} />
      )}
      <FAB icon="add" onPress={() => setShowModal(true)} />
      <Modal visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
        <SafeAreaView style={styles.modal} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Material</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}><Ionicons name="close" size={28} /></TouchableOpacity>
          </View>
          <ScrollView style={styles.content}>
            <Text style={styles.inputLabel}>Name *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Material name" />
            <Text style={styles.inputLabel}>Unit *</Text>
            <TextInput style={styles.input} value={unit} onChangeText={setUnit} placeholder="pcs, kg, ltr" />
            <Text style={styles.inputLabel}>Unit Price *</Text>
            <TextInput style={styles.input} value={unitPrice} onChangeText={setUnitPrice} placeholder="0.00" keyboardType="decimal-pad" />
            <Text style={styles.inputLabel}>Current Stock</Text>
            <TextInput style={styles.input} value={currentStock} onChangeText={setCurrentStock} placeholder="0" keyboardType="decimal-pad" />
            <Text style={styles.inputLabel}>Reorder Level</Text>
            <TextInput style={styles.input} value={reorderLevel} onChangeText={setReorderLevel} placeholder="10" keyboardType="decimal-pad" />
            <Button title="Add Material" onPress={handleSave} loading={saving} style={{ marginTop: 20, marginBottom: 40 }} />
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
  name: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  price: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.primary },
  lowStock: { fontSize: FontSizes.sm, color: Colors.danger, marginTop: 8, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSizes.xxl, fontWeight: 'bold', color: Colors.text },
  content: { flex: 1, padding: Spacing.lg },
  inputLabel: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text, marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSizes.md, color: Colors.text },
});
