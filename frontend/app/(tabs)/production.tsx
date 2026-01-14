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

interface Production {
  id: string;
  production_number: string;
  product_name: string;
  quantity: number;
  unit: string;
  status: string;
  created_by_name: string;
  created_at: string;
}

export default function ProductionScreen() {
  const { user } = useAuth();
  const [productions, setProductions] = useState<Production[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [workers, setWorkers] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProductions();
  }, []);

  const loadProductions = async () => {
    try {
      const { data, error } = await supabase
        .from('production')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProductions(data || []);
    } catch (error) {
      console.error('Error loading productions:', error);
    }
  };

  const handleCreateProduction = async () => {
    if (!productName || !quantity || !unit || !user) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const productionNumber = await generateProductionNumber();
      const workersList = workers.split(',').map(w => w.trim()).filter(w => w);

      const { error } = await supabase
        .from('production')
        .insert([{
          production_number: productionNumber,
          product_name: productName,
          quantity: parseFloat(quantity),
          unit,
          raw_materials_used: [],
          workers: workersList,
          status: 'in_progress',
          created_by: user.id,
          created_by_name: user.name,
        }]);

      if (error) throw error;

      Alert.alert('Success', 'Production order created!');
      setShowModal(false);
      resetForm();
      loadProductions();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateProductionNumber = async () => {
    const { count } = await supabase
      .from('production')
      .select('*', { count: 'exact', head: true });
    
    const nextNum = (count || 0) + 1;
    return `PROD-${String(nextNum).padStart(6, '0')}`;
  };

  const handleCompleteProduction = async (id: string) => {
    try {
      const { error } = await supabase
        .from('production')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      loadProductions();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const resetForm = () => {
    setProductName('');
    setQuantity('');
    setUnit('');
    setWorkers('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Production</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowModal(true)}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {productions.map((production) => (
          <View key={production.id} style={styles.productionCard}>
            <View style={styles.productionHeader}>
              <View>
                <Text style={styles.productionNumber}>{production.production_number}</Text>
                <Text style={styles.productName}>{production.product_name}</Text>
              </View>
              <View style={[
                styles.statusBadge,
                production.status === 'completed' ? styles.statusCompleted : styles.statusInProgress
              ]}>
                <Text style={styles.statusText}>
                  {production.status === 'completed' ? 'COMPLETED' : 'IN PROGRESS'}
                </Text>
              </View>
            </View>
            <View style={styles.productionDetails}>
              <Text style={styles.detailText}>
                Quantity: {production.quantity} {production.unit}
              </Text>
              <Text style={styles.detailText}>By: {production.created_by_name}</Text>
            </View>
            {production.status === 'in_progress' && (
              <TouchableOpacity
                style={styles.completeButton}
                onPress={() => handleCompleteProduction(production.id)}
              >
                <Text style={styles.completeButtonText}>Mark as Completed</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Create Production Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Production Order</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={28} color="#111827" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Product Name *</Text>
              <TextInput
                style={styles.input}
                value={productName}
                onChangeText={setProductName}
                placeholder="Enter product name"
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
                placeholder="e.g., kg, pcs, liters"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Workers (comma separated)</Text>
              <TextInput
                style={styles.input}
                value={workers}
                onChangeText={setWorkers}
                placeholder="e.g., John, Mary, Peter"
                multiline
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleCreateProduction}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Creating...' : 'Create Production Order'}
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
    backgroundColor: '#10B981',
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
  productionCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  productionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productionNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusCompleted: {
    backgroundColor: '#D1FAE5',
  },
  statusInProgress: {
    backgroundColor: '#DBEAFE',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
  },
  productionDetails: {
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  completeButton: {
    backgroundColor: '#10B981',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: '#10B981',
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
