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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import Card from '../../components/Card';
import LoadingSpinner from '../../components/LoadingSpinner';
import FAB from '../../components/FAB';

export default function PackagingScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [unitPrice, setUnitPrice] = useState('');
  const [currentStock, setCurrentStock] = useState('0');
  const [reorderLevel, setReorderLevel] = useState('10');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data } = await supabase.from('packaging_materials').select('*').order('name');
      if (data) setMaterials(data);
    } catch (error) {
      console.error('Error loading packaging:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCreateMaterial = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter material name');
      return;
    }
    if (!unitPrice || parseFloat(unitPrice) <= 0) {
      Alert.alert('Error', 'Please enter valid unit price');
      return;
    }

    try {
      const { data: materialCode } = await supabase.rpc('generate_packaging_code');
      
      const { error } = await supabase.from('packaging_materials').insert([{
        material_code: materialCode || `PKG-${Date.now()}`,
        name: name.trim(),
        description,
        unit,
        unit_price: parseFloat(unitPrice),
        current_stock: parseFloat(currentStock) || 0,
        reorder_level: parseFloat(reorderLevel) || 10,
        created_by: user?.id,
      }]);

      if (error) throw error;

      Alert.alert('Success', 'Packaging material added!');
      setModalVisible(false);
      resetForm();
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setUnit('pcs');
    setUnitPrice('');
    setCurrentStock('0');
    setReorderLevel('10');
  };

  const filteredMaterials = materials.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.material_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isLowStock = (stock: number, reorder: number) => stock <= reorder;

  if (loading) return <LoadingSpinner />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
          <Ionicons name="menu" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Packaging</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search materials..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={Colors.textLight}
        />
      </View>

      <FlatList
        data={filteredMaterials}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Card style={styles.materialCard}>
            <View style={styles.materialHeader}>
              <View style={styles.materialIcon}>
                <Ionicons name="gift" size={24} color={Colors.warning} />
              </View>
              <View style={styles.materialInfo}>
                <Text style={styles.materialName}>{item.name}</Text>
                <Text style={styles.materialCode}>{item.material_code}</Text>
              </View>
              <View style={styles.priceColumn}>
                <Text style={styles.materialPrice}>₹{parseFloat(item.unit_price).toLocaleString('en-IN')}</Text>
                <Text style={styles.materialUnit}>/{item.unit}</Text>
              </View>
            </View>
            <View style={styles.stockRow}>
              <View style={styles.stockInfo}>
                <Text style={styles.stockLabel}>Stock</Text>
                <Text style={[
                  styles.stockValue,
                  isLowStock(item.current_stock, item.reorder_level) && styles.lowStock
                ]}>
                  {item.current_stock} {item.unit}
                </Text>
              </View>
              {isLowStock(item.current_stock, item.reorder_level) && (
                <View style={styles.lowStockBadge}>
                  <Ionicons name="warning" size={12} color={Colors.danger} />
                  <Text style={styles.lowStockText}>Low Stock</Text>
                </View>
              )}
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="gift-outline" size={64} color={Colors.textLight} />
            <Text style={styles.emptyText}>No packaging materials</Text>
          </View>
        }
      />

      <FAB icon="add" onPress={() => setModalVisible(true)} />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Packaging</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Name *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Material name" placeholderTextColor={Colors.textLight} />

            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Description" multiline placeholderTextColor={Colors.textLight} />

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Unit</Text>
                <TextInput style={styles.input} value={unit} onChangeText={setUnit} placeholder="pcs" placeholderTextColor={Colors.textLight} />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>Unit Price *</Text>
                <TextInput style={styles.input} value={unitPrice} onChangeText={setUnitPrice} placeholder="0" keyboardType="numeric" placeholderTextColor={Colors.textLight} />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Current Stock</Text>
                <TextInput style={styles.input} value={currentStock} onChangeText={setCurrentStock} placeholder="0" keyboardType="numeric" placeholderTextColor={Colors.textLight} />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>Reorder Level</Text>
                <TextInput style={styles.input} value={reorderLevel} onChangeText={setReorderLevel} placeholder="10" keyboardType="numeric" placeholderTextColor={Colors.textLight} />
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createBtn} onPress={handleCreateMaterial}>
              <Text style={styles.createBtnText}>Add Material</Text>
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
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, margin: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md, ...Shadows.sm },
  searchInput: { flex: 1, marginLeft: Spacing.sm, fontSize: FontSizes.md, color: Colors.text },
  listContent: { padding: Spacing.md, paddingBottom: 100 },
  materialCard: { marginBottom: Spacing.md },
  materialHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  materialIcon: { width: 48, height: 48, borderRadius: BorderRadius.md, backgroundColor: Colors.warning + '20', justifyContent: 'center', alignItems: 'center' },
  materialInfo: { flex: 1, marginLeft: Spacing.md },
  materialName: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.text },
  materialCode: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  priceColumn: { alignItems: 'flex-end' },
  materialPrice: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.warning },
  materialUnit: { fontSize: FontSizes.xs, color: Colors.textSecondary },
  stockRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  stockInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stockLabel: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  stockValue: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.text },
  lowStock: { color: Colors.danger },
  lowStockBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.danger + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.sm, gap: 4 },
  lowStockText: { fontSize: FontSizes.xs, color: Colors.danger, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyText: { fontSize: FontSizes.md, color: Colors.textSecondary, marginTop: Spacing.md },
  modal: { flex: 1, backgroundColor: Colors.surface },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: 'bold', color: Colors.text },
  modalContent: { flex: 1, padding: Spacing.lg },
  label: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm, marginTop: Spacing.md },
  input: { backgroundColor: Colors.background, padding: Spacing.md, borderRadius: BorderRadius.md, fontSize: FontSizes.md, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: Spacing.md },
  halfField: { flex: 1 },
  modalFooter: { flexDirection: 'row', padding: Spacing.lg, gap: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.background, alignItems: 'center' },
  cancelBtnText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textSecondary },
  createBtn: { flex: 2, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  createBtnText: { fontSize: FontSizes.md, fontWeight: '600', color: '#FFF' },
});
