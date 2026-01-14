import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../constants/theme';
import Card from '../../components/Card';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';

export default function CashScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data } = await supabase.from('cash_transactions').select('*').order('created_at', { ascending: false }).limit(50);
      setTransactions(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'sale': return 'cart';
      case 'payment_received': return 'arrow-down';
      case 'purchase': return 'arrow-up';
      case 'expense': return 'remove-circle';
      case 'transfer_in': return 'arrow-forward';
      case 'transfer_out': return 'arrow-back';
      default: return 'cash';
    }
  };

  const getColor = (type: string) => {
    const inflows = ['sale', 'payment_received', 'transfer_in'];
    return inflows.includes(type) ? Colors.success : Colors.danger;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cash Transactions</Text>
      </View>
      {transactions.length === 0 ? (
        <EmptyState icon="wallet" title="No Transactions" description="Your cash transactions will appear here" />
      ) : (
        <FlatList data={transactions} renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.icon, { backgroundColor: getColor(item.type) + '20' }]}>
                <Ionicons name={getIcon(item.type)} size={24} color={getColor(item.type)} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.desc}>{item.description}</Text>
                <Text style={styles.date}>{new Date(item.created_at).toLocaleString('en-IN')}</Text>
                {item.user_name && <Text style={styles.user}>By: {item.user_name}</Text>}
              </View>
              <Text style={[styles.amount, { color: getColor(item.type) }]}>
                {item.type.includes('out') || item.type === 'purchase' || item.type === 'expense' ? '-' : '+'}₹{item.amount.toLocaleString('en-IN')}
              </Text>
            </View>
          </Card>
        )} keyExtractor={item => item.id} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: FontSizes.xxl, fontWeight: 'bold', color: Colors.text },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  card: { marginBottom: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 48, height: 48, borderRadius: BorderRadius.full, justifyContent: 'center', alignItems: 'center' },
  desc: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.text },
  date: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 4 },
  user: { fontSize: FontSizes.xs, color: Colors.textLight, marginTop: 2 },
  amount: { fontSize: FontSizes.lg, fontWeight: 'bold' },
});
