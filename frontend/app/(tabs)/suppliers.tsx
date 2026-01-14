import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
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

interface Supplier {
  id: string;
  supplier_code: string;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  payment_terms: string;
  credit_limit: number;
  current_outstanding: number;
  total_purchases: number;
}

export default function SuppliersScreen() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [address, setAddress] = useState('');
  const [paymentTerms, setPaymentTerms] = useState<'cash' | 'credit'>('cash');
  const [creditDays, setCreditDays] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error loading suppliers:', error);
      Alert.alert('Error', 'Failed to load suppliers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadSuppliers();
  };

  const openAddModal = () => {
    resetForm();
    setEditingSupplier(null);
    setShowModal(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setName(supplier.name);
    setPhone(supplier.phone);
    setEmail(supplier.email || '');
    setCity(supplier.city || '');
    setPaymentTerms(supplier.payment_terms as 'cash' | 'credit');
    setCreditLimit(supplier.credit_limit.toString());
    setShowModal(true);
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setCity('');
    setContactPerson('');
    setAddress('');
    setPaymentTerms('cash');
    setCreditDays('');
    setCreditLimit('');
    setNotes('');
  };

  const handleSave = async () => {
    if (!name || !phone) {
      Alert.alert('Error', 'Please fill in required fields');
      return;
    }

    setSaving(true);
    try {
      if (editingSupplier) {
        // Update
        const { error } = await supabase
          .from('suppliers')
          .update({
            name,
            phone,
            email: email || null,
            city: city || null,
            contact_person: contactPerson || null,
            address: address || null,
            payment_terms: paymentTerms,
            credit_days: paymentTerms === 'credit' ? parseInt(creditDays) || 0 : 0,
            credit_limit: paymentTerms === 'credit' ? parseFloat(creditLimit) || 0 : 0,
            notes: notes || null,
          })
          .eq('id', editingSupplier.id);

        if (error) throw error;
        Alert.alert('Success', 'Supplier updated successfully');
      } else {
        // Create
        const supplierCode = await generateSupplierCode();
        const { error } = await supabase.from('suppliers').insert([{
          supplier_code: supplierCode,
          name,
          phone,
          email: email || null,
          city: city || null,
          contact_person: contactPerson || null,
          address: address || null,
          payment_terms: paymentTerms,
          credit_days: paymentTerms === 'credit' ? parseInt(creditDays) || 0 : 0,
          credit_limit: paymentTerms === 'credit' ? parseFloat(creditLimit) || 0 : 0,
          notes: notes || null,
          created_by: user?.id,
        }]);

        if (error) throw error;
        Alert.alert('Success', 'Supplier added successfully');
      }

      setShowModal(false);
      loadSuppliers();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  const generateSupplierCode = async () => {
    const { count } = await supabase.from('suppliers').select('*', { count: 'exact', head: true });
    return `SUP-${String((count || 0) + 1).padStart(5, '0')}`;
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone.includes(searchQuery)
  );

  const renderSupplier = ({ item }: { item: Supplier }) => (
    <Card style={styles.supplierCard} onPress={() => openEditModal(item)}>
      <View style={styles.supplierHeader}>
        <View style={styles.supplierIcon}>
          <Ionicons name="person" size={24} color={Colors.primary} />
        </View>
        <View style={styles.supplierInfo}>
          <Text style={styles.supplierName}>{item.name}</Text>
          <Text style={styles.supplierCode}>{item.supplier_code}</Text>
        </View>
        <View style={[styles.badge, item.payment_terms === 'cash' ? styles.badgeCash : styles.badgeCredit]}>
          <Text style={styles.badgeText}>{item.payment_terms.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.supplierDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="call" size={16} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{item.phone}</Text>
        </View>
        {item.city && (
          <View style={styles.detailRow}>
            <Ionicons name="location" size={16} color={Colors.textSecondary} />
            <Text style={styles.detailText}>{item.city}</Text>
          </View>
        )}
      </View>
      {item.payment_terms === 'credit' && item.current_outstanding > 0 && (
        <View style={styles.outstandingBanner}>
          <Ionicons name="alert-circle" size={16} color={Colors.warning} />
          <Text style={styles.outstandingText}>
            Outstanding: ₹{item.current_outstanding.toLocaleString('en-IN')}
          </Text>
        </View>
      )}
    </Card>
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Suppliers</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search suppliers..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={Colors.textLight}
        />
      </View>

      {filteredSuppliers.length === 0 ? (
        <EmptyState
          icon="people"
          title="No Suppliers Found"
          description="Add your first supplier to get started"
          actionText="Add Supplier"
          onAction={openAddModal}
        />
      ) : (
        <FlatList
          data={filteredSuppliers}
          renderItem={renderSupplier}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        />
      )}

      <FAB icon="add" onPress={openAddModal} />

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name *</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Supplier name" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone *</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone number"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email address"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>City</Text>
              <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contact Person</Text>
              <TextInput
                style={styles.input}
                value={contactPerson}
                onChangeText={setContactPerson}
                placeholder="Contact person name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={address}
                onChangeText={setAddress}
                placeholder="Full address"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Payment Terms *</Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={[styles.radioButton, paymentTerms === 'cash' && styles.radioButtonActive]}
                  onPress={() => setPaymentTerms('cash')}
                >
                  <Text style={[styles.radioText, paymentTerms === 'cash' && styles.radioTextActive]}>Cash</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.radioButton, paymentTerms === 'credit' && styles.radioButtonActive]}
                  onPress={() => setPaymentTerms('credit')}
                >
                  <Text style={[styles.radioText, paymentTerms === 'credit' && styles.radioTextActive]}>Credit</Text>
                </TouchableOpacity>
              </View>
            </View>

            {paymentTerms === 'credit' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Credit Days</Text>
                  <TextInput
                    style={styles.input}
                    value={creditDays}
                    onChangeText={setCreditDays}
                    placeholder="e.g., 30"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Credit Limit</Text>
                  <TextInput
                    style={styles.input}
                    value={creditLimit}
                    onChangeText={setCreditLimit}
                    placeholder="Maximum credit amount"
                    keyboardType="numeric"
                  />
                </View>
              </>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Additional notes"
                multiline
                numberOfLines={3}
              />
            </View>

            <Button
              title={editingSupplier ? 'Update Supplier' : 'Add Supplier'}
              onPress={handleSave}
              loading={saving}
              style={styles.saveButton}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    margin: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  supplierCard: {
    marginBottom: Spacing.md,
  },
  supplierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  supplierIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  supplierInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  supplierName: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
  },
  supplierCode: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  badgeCash: {
    backgroundColor: Colors.success + '20',
  },
  badgeCredit: {
    backgroundColor: Colors.warning + '20',
  },
  badgeText: {
    fontSize: FontSizes.xs,
    fontWeight: 'bold',
    color: Colors.text,
  },
  supplierDetails: {
    marginTop: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  detailText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
  },
  outstandingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning + '20',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  outstandingText: {
    fontSize: FontSizes.sm,
    color: Colors.warning,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  modalContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  radioGroup: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  radioButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  radioButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  radioText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  radioTextActive: {
    color: Colors.primary,
  },
  saveButton: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xxl,
  },
});
