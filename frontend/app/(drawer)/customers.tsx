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

export default function CustomersScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [paymentTerms, setPaymentTerms] = useState<'cash' | 'credit'>('cash');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data } = await supabase.from('customers').select('*').order('name');
      if (data) setCustomers(data);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCreateCustomer = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter customer name');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Error', 'Please enter phone number');
      return;
    }

    try {
      const { data: customerCode } = await supabase.rpc('generate_customer_code');
      
      const { error } = await supabase.from('customers').insert([{
        customer_code: customerCode || `CUST-${Date.now()}`,
        name: name.trim(),
        phone: phone.trim(),
        email,
        address,
        city,
        payment_terms: paymentTerms,
        created_by: user?.id,
      }]);

      if (error) throw error;

      Alert.alert('Success', 'Customer added successfully!');
      setModalVisible(false);
      resetForm();
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setCity('');
    setPaymentTerms('cash');
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery) ||
    c.customer_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <LoadingSpinner />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
          <Ionicons name="menu" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customers</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search customers..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={Colors.textLight}
        />
      </View>

      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Card style={styles.customerCard}>
            <View style={styles.customerHeader}>
              <View style={styles.customerAvatar}>
                <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.customerInfo}>
                <Text style={styles.customerName}>{item.name}</Text>
                <Text style={styles.customerCode}>{item.customer_code}</Text>
              </View>
              <View style={[styles.termsBadge, item.payment_terms === 'credit' ? styles.credit : styles.cash]}>
                <Text style={styles.termsText}>{item.payment_terms.toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.customerDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="call" size={14} color={Colors.textSecondary} />
                <Text style={styles.detailText}>{item.phone}</Text>
              </View>
              {item.city && (
                <View style={styles.detailRow}>
                  <Ionicons name="location" size={14} color={Colors.textSecondary} />
                  <Text style={styles.detailText}>{item.city}</Text>
                </View>
              )}
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Total Sales</Text>
                <Text style={styles.statValue}>₹{parseFloat(item.total_sales || 0).toLocaleString('en-IN')}</Text>
              </View>
              {parseFloat(item.current_outstanding) > 0 && (
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Outstanding</Text>
                  <Text style={[styles.statValue, { color: Colors.warning }]}>₹{parseFloat(item.current_outstanding).toLocaleString('en-IN')}</Text>
                </View>
              )}
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={64} color={Colors.textLight} />
            <Text style={styles.emptyText}>No customers added yet</Text>
          </View>
        }
      />

      <FAB icon="person-add" onPress={() => setModalVisible(true)} />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Customer</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Name *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Customer name" placeholderTextColor={Colors.textLight} />

            <Text style={styles.label}>Phone *</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" placeholderTextColor={Colors.textLight} />

            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email address" keyboardType="email-address" placeholderTextColor={Colors.textLight} />

            <Text style={styles.label}>City</Text>
            <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" placeholderTextColor={Colors.textLight} />

            <Text style={styles.label}>Address</Text>
            <TextInput style={[styles.input, styles.textArea]} value={address} onChangeText={setAddress} placeholder="Full address" multiline placeholderTextColor={Colors.textLight} />

            <Text style={styles.label}>Payment Terms</Text>
            <View style={styles.termsRow}>
              <TouchableOpacity style={[styles.termsBtn, paymentTerms === 'cash' && styles.termsBtnActive]} onPress={() => setPaymentTerms('cash')}>
                <Ionicons name="cash" size={20} color={paymentTerms === 'cash' ? '#FFF' : Colors.success} />
                <Text style={[styles.termsBtnText, paymentTerms === 'cash' && styles.termsBtnTextActive]}>Cash</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.termsBtn, paymentTerms === 'credit' && styles.termsBtnActiveCredit]} onPress={() => setPaymentTerms('credit')}>
                <Ionicons name="card" size={20} color={paymentTerms === 'credit' ? '#FFF' : Colors.warning} />
                <Text style={[styles.termsBtnText, paymentTerms === 'credit' && styles.termsBtnTextActive]}>Credit</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createBtn} onPress={handleCreateCustomer}>
              <Text style={styles.createBtnText}>Add Customer</Text>
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
  customerCard: { marginBottom: Spacing.md },
  customerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  customerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.info, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: FontSizes.xl, fontWeight: 'bold', color: '#FFF' },
  customerInfo: { flex: 1, marginLeft: Spacing.md },
  customerName: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.text },
  customerCode: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  termsBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.sm },
  termsText: { fontSize: FontSizes.xs, fontWeight: '600' },
  cash: { backgroundColor: Colors.success + '20', color: Colors.success },
  credit: { backgroundColor: Colors.warning + '20', color: Colors.warning },
  customerDetails: { marginBottom: Spacing.sm },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: Spacing.xs },
  detailText: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  statItem: {},
  statLabel: { fontSize: FontSizes.xs, color: Colors.textSecondary },
  statValue: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.text },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyText: { fontSize: FontSizes.md, color: Colors.textSecondary, marginTop: Spacing.md },
  modal: { flex: 1, backgroundColor: Colors.surface },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: 'bold', color: Colors.text },
  modalContent: { flex: 1, padding: Spacing.lg },
  label: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm, marginTop: Spacing.md },
  input: { backgroundColor: Colors.background, padding: Spacing.md, borderRadius: BorderRadius.md, fontSize: FontSizes.md, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  termsRow: { flexDirection: 'row', gap: Spacing.md },
  termsBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.background, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  termsBtnActive: { backgroundColor: Colors.success, borderColor: Colors.success },
  termsBtnActiveCredit: { backgroundColor: Colors.warning, borderColor: Colors.warning },
  termsBtnText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.text },
  termsBtnTextActive: { color: '#FFF' },
  modalFooter: { flexDirection: 'row', padding: Spacing.lg, gap: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.background, alignItems: 'center' },
  cancelBtnText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textSecondary },
  createBtn: { flex: 2, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  createBtnText: { fontSize: FontSizes.md, fontWeight: '600', color: '#FFF' },
});
