import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../../constants/theme';
import Card from '../../../components/Card';
import GradientCard from '../../../components/GradientCard';
import LoadingSpinner from '../../../components/LoadingSpinner';

interface Transaction {
  id: string;
  transaction_number: string;
  type: string;
  amount: number;
  description: string;
  user_name: string;
  created_at: string;
}

export default function CashScreen() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({ totalIn: 0, totalOut: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data } = await supabase
        .from('cash_transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        setTransactions(data);
        
        const totalIn = data
          .filter(t => ['sale', 'payment_received', 'transfer_in'].includes(t.type))
          .reduce((sum, t) => sum + parseFloat(t.amount as any), 0);
        
        const totalOut = data
          .filter(t => ['purchase', 'expense', 'transfer_out'].includes(t.type))
          .reduce((sum, t) => sum + parseFloat(t.amount as any), 0);
        
        setStats({ totalIn, totalOut });
      }
      
      await refreshUser();
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sale': return 'cart';
      case 'payment_received': return 'cash';
      case 'purchase': return 'bag';
      case 'expense': return 'wallet';
      case 'transfer_in': return 'arrow-down';
      case 'transfer_out': return 'arrow-up';
      default: return 'swap-horizontal';
    }
  };

  const getTypeColor = (type: string) => {
    if (['sale', 'payment_received', 'transfer_in'].includes(type)) {
      return Colors.success;
    }
    return Colors.danger;
  };

  const isIncome = (type: string) => ['sale', 'payment_received', 'transfer_in'].includes(type);

  const filteredTransactions = transactions.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'in') return isIncome(t.type);
    return !isIncome(t.type);
  });

  if (loading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      {/* Summary Card */}
      <GradientCard colors={Colors.gradient1} style={styles.summaryCard}>
        <Text style={styles.balanceLabel}>Current Balance</Text>
        <Text style={styles.balanceAmount}>₹{user?.cash_balance?.toLocaleString('en-IN') || '0'}</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <View style={[styles.summaryIcon, { backgroundColor: 'rgba(16, 185, 129, 0.3)' }]}>
              <Ionicons name="arrow-down" size={16} color="#10B981" />
            </View>
            <View>
              <Text style={styles.summaryLabel}>Income</Text>
              <Text style={styles.summaryValue}>₹{stats.totalIn.toLocaleString('en-IN')}</Text>
            </View>
          </View>
          <View style={styles.summaryItem}>
            <View style={[styles.summaryIcon, { backgroundColor: 'rgba(239, 68, 68, 0.3)' }]}>
              <Ionicons name="arrow-up" size={16} color="#EF4444" />
            </View>
            <View>
              <Text style={styles.summaryLabel}>Expense</Text>
              <Text style={styles.summaryValue}>₹{stats.totalOut.toLocaleString('en-IN')}</Text>
            </View>
          </View>
        </View>
      </GradientCard>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {['all', 'in', 'out'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f === 'in' ? 'Income' : 'Expense'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transactions List */}
      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Card style={styles.transactionCard}>
            <View style={styles.transactionRow}>
              <View style={[styles.typeIcon, { backgroundColor: getTypeColor(item.type) + '20' }]}>
                <Ionicons name={getTypeIcon(item.type) as any} size={20} color={getTypeColor(item.type)} />
              </View>
              <View style={styles.transactionContent}>
                <Text style={styles.transactionDesc} numberOfLines={1}>{item.description}</Text>
                <Text style={styles.transactionMeta}>
                  {item.user_name} • {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>
              <Text style={[styles.transactionAmount, { color: getTypeColor(item.type) }]}>
                {isIncome(item.type) ? '+' : '-'}₹{parseFloat(item.amount as any).toLocaleString('en-IN')}
              </Text>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="wallet-outline" size={64} color={Colors.textLight} />
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  summaryCard: { margin: Spacing.md },
  balanceLabel: { fontSize: FontSizes.sm, color: '#FFF', opacity: 0.9 },
  balanceAmount: { fontSize: 32, fontWeight: 'bold', color: '#FFF', marginVertical: Spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  summaryIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  summaryLabel: { fontSize: FontSizes.xs, color: '#FFF', opacity: 0.8 },
  summaryValue: { fontSize: FontSizes.md, fontWeight: 'bold', color: '#FFF' },
  filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, marginBottom: Spacing.md, gap: Spacing.sm },
  filterTab: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.surface, alignItems: 'center' },
  filterTabActive: { backgroundColor: Colors.primary },
  filterText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: '#FFF' },
  listContent: { paddingHorizontal: Spacing.md, paddingBottom: 100 },
  transactionCard: { marginBottom: Spacing.sm },
  transactionRow: { flexDirection: 'row', alignItems: 'center' },
  typeIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  transactionContent: { flex: 1, marginLeft: Spacing.md },
  transactionDesc: { fontSize: FontSizes.md, fontWeight: '500', color: Colors.text },
  transactionMeta: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 2 },
  transactionAmount: { fontSize: FontSizes.md, fontWeight: 'bold' },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyText: { fontSize: FontSizes.md, color: Colors.textSecondary, marginTop: Spacing.md },
});
