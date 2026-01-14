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
import { useRouter } from 'expo-router';

interface Manager {
  id: string;
  name: string;
  cash_balance: number;
}

interface Transfer {
  id: string;
  from_user_name: string;
  to_user_name: string;
  amount: number;
  reason: string;
  status: string;
  created_at: string;
}

export default function Profile() {
  const { user, signOut, refreshUser } = useAuth();
  const router = useRouter();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load managers
      const { data: managersData } = await supabase
        .from('users')
        .select('id, name, cash_balance')
        .eq('role', 'manager')
        .neq('id', user?.id || '');

      setManagers(managersData || []);

      // Load transfers
      if (user) {
        const { data: transfersData } = await supabase
          .from('transfer_requests')
          .select('*')
          .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
          .order('created_at', { ascending: false })
          .limit(10);

        setTransfers(transfersData || []);
      }

      await refreshUser();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleTransfer = async () => {
    if (!selectedManager || !amount || !reason || !user) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    const transferAmount = parseFloat(amount);
    if (transferAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (transferAmount > (user.cash_balance || 0)) {
      Alert.alert('Error', 'Insufficient cash balance');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('transfer_requests')
        .insert([{
          from_user_id: user.id,
          from_user_name: user.name,
          to_user_id: selectedManager.id,
          to_user_name: selectedManager.name,
          amount: transferAmount,
          reason,
          status: 'pending',
        }]);

      if (error) throw error;

      Alert.alert('Success', 'Transfer request sent! Waiting for approval.');
      setShowTransferModal(false);
      resetTransferForm();
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetTransferForm = () => {
    setSelectedManager(null);
    setAmount('');
    setReason('');
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* User Info Card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={48} color="#4F46E5" />
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <Text style={styles.userRole}>Manager</Text>
          
          <View style={styles.balanceSection}>
            <Text style={styles.balanceLabel}>Current Cash Balance</Text>
            <Text style={styles.balanceAmount}>
              ₹{user?.cash_balance?.toLocaleString('en-IN') || '0'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.transferButton}
            onPress={() => setShowTransferModal(true)}
          >
            <Ionicons name="swap-horizontal" size={20} color="#FFFFFF" />
            <Text style={styles.transferButtonText}>Transfer Cash</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Transfers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transfers</Text>
          {transfers.map((transfer) => (
            <View key={transfer.id} style={styles.transferCard}>
              <View style={styles.transferHeader}>
                <View>
                  <Text style={styles.transferDirection}>
                    {transfer.from_user_name} → {transfer.to_user_name}
                  </Text>
                  <Text style={styles.transferReason}>{transfer.reason}</Text>
                </View>
                <View style={[
                  styles.transferStatus,
                  transfer.status === 'approved' && styles.statusApproved,
                  transfer.status === 'pending' && styles.statusPending,
                  transfer.status === 'rejected' && styles.statusRejected,
                ]}>
                  <Text style={styles.transferStatusText}>
                    {transfer.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.transferAmount}>
                ₹{transfer.amount.toLocaleString('en-IN')}
              </Text>
            </View>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Transfer Modal */}
      <Modal
        visible={showTransferModal}
        animationType="slide"
        onRequestClose={() => setShowTransferModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Transfer Cash</Text>
            <TouchableOpacity onPress={() => setShowTransferModal(false)}>
              <Ionicons name="close" size={28} color="#111827" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.balanceInfo}>
              <Text style={styles.balanceInfoLabel}>Your Available Balance</Text>
              <Text style={styles.balanceInfoAmount}>
                ₹{user?.cash_balance?.toLocaleString('en-IN') || '0'}
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Transfer To *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.managersList}>
                  {managers.map((manager) => (
                    <TouchableOpacity
                      key={manager.id}
                      style={[
                        styles.managerChip,
                        selectedManager?.id === manager.id && styles.managerChipSelected
                      ]}
                      onPress={() => setSelectedManager(manager)}
                    >
                      <Ionicons 
                        name="person" 
                        size={16} 
                        color={selectedManager?.id === manager.id ? '#FFFFFF' : '#4F46E5'} 
                      />
                      <Text style={[
                        styles.managerChipText,
                        selectedManager?.id === manager.id && styles.managerChipTextSelected
                      ]}>
                        {manager.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Amount *</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="Enter amount"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Reason *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={reason}
                onChangeText={setReason}
                placeholder="Reason for transfer"
                multiline
                numberOfLines={4}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleTransfer}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Sending Request...' : 'Send Transfer Request'}
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
  content: {
    flex: 1,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    margin: 24,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  userRole: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '600',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
  },
  balanceSection: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4F46E5',
    marginTop: 8,
  },
  transferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  transferButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  transferCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  transferHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  transferDirection: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  transferReason: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  transferStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusApproved: {
    backgroundColor: '#D1FAE5',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusRejected: {
    backgroundColor: '#FEE2E2',
  },
  transferStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
  },
  transferAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
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
  balanceInfo: {
    backgroundColor: '#EEF2FF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  balanceInfoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  balanceInfoAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4F46E5',
    marginTop: 8,
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  managersList: {
    flexDirection: 'row',
    gap: 8,
  },
  managerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E0E7FF',
  },
  managerChipSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  managerChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
    marginLeft: 6,
  },
  managerChipTextSelected: {
    color: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: '#4F46E5',
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
