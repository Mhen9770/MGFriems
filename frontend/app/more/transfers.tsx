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

export default function TransfersScreen() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedManager, setSelectedManager] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [transfersRes, managersRes] = await Promise.all([
        supabase.from('transfer_requests').select('*').or(`from_user_id.eq.${user?.id},to_user_id.eq.${user?.id}`).order('created_at', { ascending: false }),
        supabase.from('users').select('id, name, cash_balance').eq('role', 'manager').neq('id', user?.id || ''),
      ]);
      setTransfers(transfersRes.data || []);
      setManagers(managersRes.data || []);
      await refreshUser();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSave = async () => {
    if (!selectedManager || !amount || !reason) return Alert.alert('Error', 'Fill all fields');
    const amt = parseFloat(amount);
    if (amt <= 0) return Alert.alert('Error', 'Invalid amount');
    if (amt > (user?.cash_balance || 0)) return Alert.alert('Error', 'Insufficient balance');
    setSaving(true);
    try {
      await supabase.from('transfer_requests').insert([{ from_user_id: user?.id, from_user_name: user?.name, to_user_id: selectedManager.id, to_user_name: selectedManager.name, amount: amt, reason, status: 'pending' }]);
      Alert.alert('Success', 'Transfer request sent');
      setShowModal(false);
      loadData();
      setSelectedManager(null);
      setAmount('');
      setReason('');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await supabase.from('transfer_requests').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', id);
      Alert.alert('Success', 'Transfer approved');
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await supabase.from('transfer_requests').update({ status: 'rejected', approved_at: new Date().toISOString() }).eq('id', id);
      Alert.alert('Success', 'Transfer rejected');
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
        <Text style={styles.headerTitle}>Cash Transfers</Text>
      </View>
      {transfers.length === 0 ? (
        <EmptyState icon="swap-horizontal" title="No Transfers" description="Transfer cash between partners" actionText="New Transfer" onAction={() => setShowModal(true)} />
      ) : (
        <FlatList data={transfers} renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.direction}>{item.from_user_name} → {item.to_user_name}</Text>
                <Text style={styles.amount}>₹{item.amount.toLocaleString('en-IN')}</Text>
                <Text style={styles.reason}>{item.reason}</Text>
              </View>
              <View style={[styles.badge, item.status === 'approved' && styles.badgeApproved, item.status === 'pending' && styles.badgePending, item.status === 'rejected' && styles.badgeRejected]}>
                <Text style={styles.badgeText}>{item.status.toUpperCase()}</Text>
              </View>
            </View>
            {item.status === 'pending' && item.to_user_id === user?.id && (
              <View style={styles.actions}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.success }]} onPress={() => handleApprove(item.id)}>
                  <Ionicons name="checkmark" size={20} color="#FFF" />
                  <Text style={styles.btnText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.danger }]} onPress={() => handleReject(item.id)}>
                  <Ionicons name="close" size={20} color="#FFF" />
                  <Text style={styles.btnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        )} keyExtractor={item => item.id} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />} />
      )}
      <FAB icon="add" onPress={() => setShowModal(true)} />
      <Modal visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
        <SafeAreaView style={styles.modal} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Transfer</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}><Ionicons name="close" size={28} /></TouchableOpacity>
          </View>
          <ScrollView style={styles.content}>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <Text style={styles.balanceValue}>₹{user?.cash_balance?.toLocaleString('en-IN') || '0'}</Text>
            </View>
            <Text style={styles.label}>Transfer To *</Text>
            {selectedManager ? (
              <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: FontSizes.md, fontWeight: '600' }}>{selectedManager.name}</Text>
                <TouchableOpacity onPress={() => setSelectedManager(null)}><Ionicons name="close-circle" size={24} color={Colors.danger} /></TouchableOpacity>
              </Card>
            ) : (
              <ScrollView horizontal style={{ marginBottom: 16 }}>
                {managers.map(m => (
                  <TouchableOpacity key={m.id} style={styles.managerChip} onPress={() => setSelectedManager(m)}>
                    <Ionicons name="person" size={16} color={Colors.primary} />
                    <Text style={styles.chipText}>{m.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <Text style={styles.label}>Amount *</Text>
            <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="Enter amount" keyboardType="decimal-pad" />
            <Text style={styles.label}>Reason *</Text>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={reason} onChangeText={setReason} placeholder="Reason for transfer" multiline />
            <Button title="Send Request" onPress={handleSave} loading={saving} style={{ marginTop: 20, marginBottom: 40 }} />
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
  direction: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.text },
  amount: { fontSize: FontSizes.xl, fontWeight: 'bold', color: Colors.primary, marginTop: 4 },
  reason: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 4 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: BorderRadius.sm },
  badgeApproved: { backgroundColor: Colors.success + '20' },
  badgePending: { backgroundColor: Colors.warning + '20' },
  badgeRejected: { backgroundColor: Colors.danger + '20' },
  badgeText: { fontSize: FontSizes.xs, fontWeight: 'bold' },
  actions: { marginTop: 12, flexDirection: 'row', gap: 8 },
  btn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, padding: 12, borderRadius: BorderRadius.md },
  btnText: { color: '#FFF', fontSize: FontSizes.sm, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSizes.xxl, fontWeight: 'bold', color: Colors.text },
  content: { flex: 1, padding: Spacing.lg },
  balanceCard: { backgroundColor: Colors.primary + '10', padding: Spacing.lg, borderRadius: BorderRadius.md, alignItems: 'center', marginBottom: Spacing.lg },
  balanceLabel: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  balanceValue: { fontSize: FontSizes.xxxl, fontWeight: 'bold', color: Colors.primary, marginTop: 4 },
  label: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text, marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSizes.md, color: Colors.text },
  managerChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary + '20', paddingHorizontal: 16, paddingVertical: 10, borderRadius: BorderRadius.full, marginRight: 8 },
  chipText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.primary },
});
