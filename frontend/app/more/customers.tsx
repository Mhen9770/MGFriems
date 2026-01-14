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

export default function CustomersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [paymentTerms, setPaymentTerms] = useState<'cash' | 'credit'>('cash');
  const [creditLimit, setCreditLimit] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data } = await supabase.from('customers').select('*').eq('is_active', true).order('name');
      setCustomers(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSave = async () => {
    if (!name || !phone) return Alert.alert('Error', 'Name and phone required');
    setSaving(true);
    try {
      const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true });
      await supabase.from('customers').insert([{ customer_code: `CUST-${String((count || 0) + 1).padStart(5, '0')}`, name, phone, email: email || null, city: city || null, address: address || null, payment_terms: paymentTerms, credit_limit: paymentTerms === 'credit' ? parseFloat(creditLimit) || 0 : 0, created_by: user?.id }]);
      Alert.alert('Success', 'Customer added');
      setShowModal(false);
      loadData();
      setName('');
      setPhone('');
      setEmail('');
      setCity('');
      setAddress('');
      setCreditLimit('');
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
        <Text style={styles.headerTitle}>Customers</Text>
      </View>
      {customers.length === 0 ? (
        <EmptyState icon="people" title="No Customers" description="Add your customers" actionText="Add Customer" onAction={() => setShowModal(true)} />
      ) : (
        <FlatList data={customers} renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.phone}>{item.phone}</Text>
                {item.city && <Text style={styles.city}>{item.city}</Text>}
              </View>
              <View style={[styles.badge, item.payment_terms === 'cash' ? styles.badgeCash : styles.badgeCredit]}>
                <Text style={styles.badgeText}>{item.payment_terms.toUpperCase()}</Text>
              </View>
            </View>
            {item.current_outstanding > 0 && (
              <View style={styles.outstanding}>
                <Ionicons name="alert-circle" size={16} color={Colors.warning} />
                <Text style={styles.outstandingText}>Outstanding: ₹{item.current_outstanding.toLocaleString('en-IN')}</Text>
              </View>
            )}
          </Card>
        )} keyExtractor={item => item.id} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />} />
      )}
      <FAB icon="add" onPress={() => setShowModal(true)} />
      <Modal visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
        <SafeAreaView style={styles.modal} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Customer</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}><Ionicons name="close" size={28} /></TouchableOpacity>
          </View>
          <ScrollView style={styles.content}>
            <Text style={styles.label}>Name *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Customer name" />
            <Text style={styles.label}>Phone *</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" />
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email address" keyboardType="email-address" autoCapitalize="none" />
            <Text style={styles.label}>City</Text>
            <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" />
            <Text style={styles.label}>Address</Text>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={address} onChangeText={setAddress} placeholder="Full address" multiline />
            <Text style={styles.label}>Payment Terms *</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity style={[styles.radio, paymentTerms === 'cash' && styles.radioActive]} onPress={() => setPaymentTerms('cash')}>
                <Text style={[styles.radioText, paymentTerms === 'cash' && styles.radioTextActive]}>Cash</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.radio, paymentTerms === 'credit' && styles.radioActive]} onPress={() => setPaymentTerms('credit')}>
                <Text style={[styles.radioText, paymentTerms === 'credit' && styles.radioTextActive]}>Credit</Text>
              </TouchableOpacity>
            </View>
            {paymentTerms === 'credit' && (
              <>
                <Text style={styles.label}>Credit Limit</Text>
                <TextInput style={styles.input} value={creditLimit} onChangeText={setCreditLimit} placeholder="Credit limit amount" keyboardType="decimal-pad" />
              </>
            )}
            <Button title="Add Customer" onPress={handleSave} loading={saving} style={{ marginTop: 20, marginBottom: 40 }} />
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
  name: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text },
  phone: { fontSize: FontSizes.md, color: Colors.textSecondary, marginTop: 4 },
  city: { fontSize: FontSizes.sm, color: Colors.textLight, marginTop: 4 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: BorderRadius.sm },
  badgeCash: { backgroundColor: Colors.success + '20' },
  badgeCredit: { backgroundColor: Colors.warning + '20' },
  badgeText: { fontSize: FontSizes.xs, fontWeight: 'bold' },
  outstanding: { flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: Colors.warning + '10', padding: 8, borderRadius: BorderRadius.sm },
  outstandingText: { fontSize: FontSizes.sm, color: Colors.warning, fontWeight: '600', marginLeft: 8 },
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSizes.xxl, fontWeight: 'bold', color: Colors.text },
  content: { flex: 1, padding: Spacing.lg },
  label: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text, marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSizes.md, color: Colors.text },
  radioGroup: { flexDirection: 'row', gap: Spacing.md, marginTop: 8 },
  radio: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.surface },
  radioActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  radioText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textSecondary },
  radioTextActive: { color: Colors.primary },
});
