import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
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

interface PendingTransfer {
  id: string;
  from_user_name: string;
  amount: number;
  reason: string;
  created_at: string;
}

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    try {
      // Load all managers
      const { data: managersData, error: managersError } = await supabase
        .from('users')
        .select('id, name, cash_balance')
        .eq('role', 'manager')
        .order('name');

      if (managersError) throw managersError;
      setManagers(managersData || []);

      // Load pending transfers for current user
      if (user) {
        const { data: transfersData, error: transfersError } = await supabase
          .from('transfer_requests')
          .select('*')
          .eq('to_user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (transfersError) throw transfersError;
        setPendingTransfers(transfersData || []);
      }

      await refreshUser();
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handleApproveTransfer = async (transferId: string) => {
    try {
      const { error } = await supabase
        .from('transfer_requests')
        .update({ 
          status: 'approved', 
          approved_at: new Date().toISOString() 
        })
        .eq('id', transferId);

      if (error) throw error;
      loadDashboardData();
    } catch (error) {
      console.error('Error approving transfer:', error);
    }
  };

  const handleRejectTransfer = async (transferId: string) => {
    try {
      const { error } = await supabase
        .from('transfer_requests')
        .update({ 
          status: 'rejected', 
          approved_at: new Date().toISOString() 
        })
        .eq('id', transferId);

      if (error) throw error;
      loadDashboardData();
    } catch (error) {
      console.error('Error rejecting transfer:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>{user?.name || 'Manager'}</Text>
        </View>
        <Ionicons name="notifications-outline" size={28} color="#111827" />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* My Cash Balance */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Ionicons name="wallet" size={32} color="#FFFFFF" />
            <Text style={styles.balanceLabel}>My Cash Balance</Text>
          </View>
          <Text style={styles.balanceAmount}>
            ₹{user?.cash_balance?.toLocaleString('en-IN') || '0'}
          </Text>
        </View>

        {/* Pending Approvals */}
        {pendingTransfers.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pending Approvals</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingTransfers.length}</Text>
              </View>
            </View>

            {pendingTransfers.map((transfer) => (
              <View key={transfer.id} style={styles.transferCard}>
                <View style={styles.transferInfo}>
                  <Text style={styles.transferFrom}>{transfer.from_user_name}</Text>
                  <Text style={styles.transferAmount}>
                    ₹{transfer.amount.toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.transferReason}>{transfer.reason}</Text>
                </View>
                <View style={styles.transferActions}>
                  <TouchableOpacity
                    style={styles.approveButton}
                    onPress={() => handleApproveTransfer(transfer.id)}
                  >
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => handleRejectTransfer(transfer.id)}
                  >
                    <Ionicons name="close" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* All Managers Cash Positions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Partners Cash Position</Text>
          {managers.map((manager) => (
            <View key={manager.id} style={styles.managerCard}>
              <View style={styles.managerAvatar}>
                <Ionicons name="person" size={24} color="#4F46E5" />
              </View>
              <View style={styles.managerInfo}>
                <Text style={styles.managerName}>{manager.name}</Text>
                <Text style={styles.managerRole}>Manager</Text>
              </View>
              <Text style={styles.managerBalance}>
                ₹{manager.cash_balance?.toLocaleString('en-IN') || '0'}
              </Text>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/sales')}
            >
              <Ionicons name="add-circle" size={32} color="#4F46E5" />
              <Text style={styles.actionText}>New Sale</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/production')}
            >
              <Ionicons name="construct" size={32} color="#10B981" />
              <Text style={styles.actionText}>Production</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
  greeting: {
    fontSize: 14,
    color: '#6B7280',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  balanceCard: {
    backgroundColor: '#4F46E5',
    margin: 24,
    padding: 24,
    borderRadius: 16,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 12,
    opacity: 0.9,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  transferCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  transferInfo: {
    flex: 1,
  },
  transferFrom: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  transferAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4F46E5',
    marginTop: 4,
  },
  transferReason: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  transferActions: {
    flexDirection: 'row',
    gap: 8,
  },
  approveButton: {
    backgroundColor: '#10B981',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  managerCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  managerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  managerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  managerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  managerRole: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  managerBalance: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginTop: 8,
  },
});
