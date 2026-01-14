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

interface RawMaterial {
  id: string;
  material_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  supplier_name: string;
  added_by_name: string;
}

export default function Materials() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [materialName, setMaterialName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('raw_materials')
        .select('*')
        .order('material_name');

      if (error) throw error;
      setMaterials(data || []);
    } catch (error) {
      console.error('Error loading materials:', error);
    }
  };

  const handleAddMaterial = async () => {
    if (!materialName || !quantity || !unit || !unitPrice || !supplierName || !user) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      // Check if material exists
      const { data: existing } = await supabase
        .from('raw_materials')
        .select('*')
        .eq('material_name', materialName)
        .single();

      if (existing) {
        // Update quantity
        const { error } = await supabase
          .from('raw_materials')
          .update({
            quantity: existing.quantity + parseFloat(quantity),
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) throw error;
        Alert.alert('Success', 'Material quantity updated!');
      } else {
        // Create new
        const { error } = await supabase
          .from('raw_materials')
          .insert([{
            material_name: materialName,
            quantity: parseFloat(quantity),
            unit,
            unit_price: parseFloat(unitPrice),
            supplier_name: supplierName,
            added_by: user.id,
            added_by_name: user.name,
          }]);

        if (error) throw error;
        Alert.alert('Success', 'Material added!');
      }

      setShowModal(false);
      resetForm();
      loadMaterials();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setMaterialName('');
    setQuantity('');
    setUnit('');
    setUnitPrice('');
    setSupplierName('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Raw Materials</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowModal(true)}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {materials.map((material) => (
          <View key={material.id} style={styles.materialCard}>
            <View style={styles.materialHeader}>
              <View style={styles.materialIcon}>
                <Ionicons name="cube" size={24} color="#F59E0B" />
              </View>
              <View style={styles.materialInfo}>
                <Text style={styles.materialName}>{material.material_name}</Text>
                <Text style={styles.supplierName}>Supplier: {material.supplier_name}</Text>
              </View>
            </View>
            <View style={styles.materialDetails}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Stock</Text>
                <Text style={styles.detailValue}>
                  {material.quantity} {material.unit}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Price</Text>
                <Text style={styles.detailValue}>
                  ₹{material.unit_price}/{material.unit}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Total Value</Text>
                <Text style={styles.detailValue}>
                  ₹{(material.quantity * material.unit_price).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
            {material.quantity < 10 && (
              <View style={styles.lowStockBanner}>
                <Ionicons name="warning" size={16} color="#DC2626" />
                <Text style={styles.lowStockText}>Low Stock Alert!</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Add Material Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Raw Material</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={28} color="#111827" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Material Name *</Text>
              <TextInput
                style={styles.input}
                value={materialName}
                onChangeText={setMaterialName}
                placeholder="Enter material name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Quantity *</Text>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                placeholder="Enter quantity"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Unit *</Text>
              <TextInput
                style={styles.input}
                value={unit}
                onChangeText={setUnit}
                placeholder="e.g., kg, liters, pcs"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Unit Price *</Text>
              <TextInput
                style={styles.input}
                value={unitPrice}
                onChangeText={setUnitPrice}
                placeholder="Price per unit"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Supplier Name *</Text>
              <TextInput
                style={styles.input}
                value={supplierName}
                onChangeText={setSupplierName}
                placeholder="Enter supplier name"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleAddMaterial}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Adding...' : 'Add Material'}
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
    backgroundColor: '#F59E0B',
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
  materialCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  materialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  materialIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  materialInfo: {
    flex: 1,
    marginLeft: 12,
  },
  materialName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  supplierName: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  materialDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginTop: 4,
  },
  lowStockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  lowStockText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
    marginLeft: 8,
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
  submitButton: {
    backgroundColor: '#F59E0B',
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
