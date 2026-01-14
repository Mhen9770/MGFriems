import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
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
import { Colors, Spacing, FontSizes, BorderRadius } from '../../constants/theme';
import Card from '../../components/Card';
import GradientCard from '../../components/GradientCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import FAB from '../../components/FAB';

export default function TransfersScreen() {
  const { user, refreshUser } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [filter, setFilter] = useState('all');

  // Form state
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [transfersRes, partnersRes] = await Promise.all([
        supabase.from('transfer_requests').select('*').or(`from_user_id.eq.${user?.id},to_user_id.eq.${user?.id}`).order('created_at', { ascending: false }),
        supabase.from('users').select('*').neq('id', user?.id),
      ]);

      if (transfersRes.data) setTransfers(transfersRes.data);
      if (partnersRes.data) setPartners(partnersRes.data);
      await refreshUser();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCreateTransfer = async () => {
    if (!selectedPartner) {
      Alert.alert('Error', 'Please select a partner');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter valid amount');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Error', 'Please enter a reason');
      return;
    }

    try {
      const { error } = await supabase.from('transfer_requests').insert([{
        from_user_id: user?.id,
        from_user_name: user?.name,
        to_user_id: selectedPartner.id,
        to_user_name: selectedPartner.name,
        amount: parseFloat(amount),
        reason: reason.trim(),
      }]);

      if (error) throw error;

      Alert.alert('Success', 'Transfer request sent!');
      setModalVisible(false);
      setSelectedPartner(null);
      setAmount('');
      setReason('');
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase.from('transfer_requests').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      Alert.alert('Success', 'Transfer approved!');
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleReject = async (id: string) => {
    try {
      const { error } = await supabase.from('transfer_requests').update({ status: 'rejected' }).eq('id', id);
      if (error) throw error;
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return Colors.success;
      case 'rejected': return Colors.danger;
      default: return Colors.warning;
    }
  };

  const filteredTransfers = filter === 'all' ? transfers : 
    filter === 'sent' ? transfers.filter(t => t.from_user_id === user?.id) :
    filter === 'received' ? transfers.filter(t => t.to_user_id === user?.id) :
    transfers.filter(t => t.status === 'pending' && t.to_user_id === user?.id);

  const pendingCount = transfers.filter(t => t.status === 'pending' && t.to_user_id === user?.id).length;

  if (loading) return <LoadingSpinner />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
          <Ionicons name="menu" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cash Transfers</Text>
        <View style={{ width: 28 }} />
      </View>

      <GradientCard colors={Colors.gradient2 as [string, string]} style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Your Cash Balance</Text>
        <Text style={styles.balanceAmount}>₹{user?.cash_balance?.toLocaleString('en-IN') || '0'}</Text>
        {pendingCount > 0 && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>{pendingCount} pending approval{pendingCount > 1 ? 's' : ''}</Text>
          </View>
        )}
      </GradientCard>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {[{ id: 'all', label: 'All' }, { id: 'pending', label: 'Pending' }, { id: 'sent', label: 'Sent' }, { id: 'received', label: 'Received' }].map((f) => (
          <TouchableOpacity key={f.id} style={[styles.filterTab, filter === f.id && styles.filterTabActive]} onPress={() => setFilter(f.id)}>
            <Text style={[styles.filterText, filter === f.id && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filteredTransfers}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isSent = item.from_user_id === user?.id;
          const isPending = item.status === 'pending';
          const canApprove = !isSent && isPending;

          return (
            <Card style={styles.transferCard}>
              <View style={styles.transferHeader}>
                <View style={[styles.directionIcon, { backgroundColor: isSent ? Colors.danger + '20' : Colors.success + '20' }]}>
                  <Ionicons name={isSent ? 'arrow-up' : 'arrow-down'} size={20} color={isSent ? Colors.danger : Colors.success} />
                </View>
                <View style={styles.transferInfo}>
                  <Text style={styles.transferName}>{isSent ? `To: ${item.to_user_name}` : `From: ${item.from_user_name}`}</Text>
                  <Text style={styles.transferReason}>{item.reason}</Text>
                </View>
                <View style={styles.transferRight}>
                  <Text style={[styles.transferAmount, { color: isSent ? Colors.danger : Colors.success }]}>
                    {isSent ? '-' : '+'}₹{parseFloat(item.amount).toLocaleString('en-IN')}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
              
              {canApprove && (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item.id)}>
                    <Ionicons name="close" size={18} color={Colors.danger} />
                    <Text style={styles.rejectText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item.id)}>
                    <Ionicons name="checkmark" size={18} color="#FFF" />
                    <Text style={styles.approveText}>Approve</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="swap-horizontal-outline" size={64} color={Colors.textLight} />
            <Text style={styles.emptyText}>No transfers</Text>
          </View>
        }
      />

      <FAB icon="send" onPress={() => setModalVisible(true)} />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request Transfer</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Select Partner *</Text>
            <View style={styles.partnerGrid}>
              {partners.map((p) => (
                <TouchableOpacity key={p.id} style={[styles.partnerBtn, selectedPartner?.id === p.id && styles.partnerBtnActive]} onPress={() => setSelectedPartner(p)}>
                  <View style={styles.partnerAvatar}>
                    <Text style={styles.avatarText}>{p.name.charAt(0)}</Text>
                  </View>
                  <Text style={[styles.partnerName, selectedPartner?.id === p.id && { color: '#FFF' }]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Amount (₹) *</Text>
            <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="Enter amount" keyboardType="numeric" placeholderTextColor={Colors.textLight} />

            <Text style={styles.label}>Reason *</Text>
            <TextInput style={[styles.input, styles.textArea]} value={reason} onChangeText={setReason} placeholder="Why are you requesting this transfer?" multiline placeholderTextColor={Colors.textLight} />

            <View style={styles.noteCard}>
              <Ionicons name="information-circle" size={20} color={Colors.info} />
              <Text style={styles.noteText}>The receiving partner must approve this transfer for it to complete.</Text>
            </View>
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createBtn} onPress={handleCreateTransfer}>
              <Text style={styles.createBtnText}>Request Transfer</Text>
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
  balanceCard: { margin: Spacing.md, alignItems: 'center' },
  balanceLabel: { fontSize: FontSizes.sm, color: '#FFF', opacity: 0.9 },
  balanceAmount: { fontSize: 32, fontWeight: 'bold', color: '#FFF', marginVertical: Spacing.sm },
  pendingBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  pendingText: { color: '#FFF', fontSize: FontSizes.sm, fontWeight: '500' },
  filterScroll: { paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  filterTab: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginRight: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: Colors.surface },
  filterTabActive: { backgroundColor: Colors.primary },
  filterText: { fontSize: FontSizes.sm, color: Colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: '#FFF' },
  listContent: { paddingHorizontal: Spacing.md, paddingBottom: 100 },
  transferCard: { marginBottom: Spacing.md },
  transferHeader: { flexDirection: 'row', alignItems: 'center' },
  directionIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  transferInfo: { flex: 1, marginLeft: Spacing.md },
  transferName: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.text },
  transferReason: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 2 },
  transferRight: { alignItems: 'flex-end' },
  transferAmount: { fontSize: FontSizes.md, fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.sm, marginTop: 4 },
  statusText: { fontSize: FontSizes.xs, fontWeight: '600' },
  actionRow: { flexDirection: 'row', marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.md },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.danger + '15', gap: Spacing.xs },
  rejectText: { color: Colors.danger, fontWeight: '600', fontSize: FontSizes.sm },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.success, gap: Spacing.xs },
  approveText: { color: '#FFF', fontWeight: '600', fontSize: FontSizes.sm },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyText: { fontSize: FontSizes.md, color: Colors.textSecondary, marginTop: Spacing.md },
  modal: { flex: 1, backgroundColor: Colors.surface },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: 'bold', color: Colors.text },
  modalContent: { flex: 1, padding: Spacing.lg },
  label: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm, marginTop: Spacing.md },
  partnerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  partnerBtn: { alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, minWidth: 100 },
  partnerBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  partnerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.xs },
  avatarText: { fontSize: FontSizes.xl, fontWeight: 'bold', color: '#FFF' },
  partnerName: { fontSize: FontSizes.sm, color: Colors.text, fontWeight: '500' },
  input: { backgroundColor: Colors.background, padding: Spacing.md, borderRadius: BorderRadius.md, fontSize: FontSizes.md, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  noteCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.info + '15', padding: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.lg, gap: Spacing.sm },
  noteText: { flex: 1, fontSize: FontSizes.sm, color: Colors.info },
  modalFooter: { flexDirection: 'row', padding: Spacing.lg, gap: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.background, alignItems: 'center' },
  cancelBtnText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textSecondary },
  createBtn: { flex: 2, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  createBtnText: { fontSize: FontSizes.md, fontWeight: '600', color: '#FFF' },
});
