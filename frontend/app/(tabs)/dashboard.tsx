import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import Card from '../../components/Card';
import GradientCard from '../../components/GradientCard';
import LoadingSpinner from '../../components/LoadingSpinner';

const { width } = Dimensions.get('window');

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalSales: 0,
    todaySales: 0,
    pendingPayments: 0,
    lowStockItems: 0,
    productionOrders: 0,
    customers: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Get stats
      const [salesData, customersData, productsData, productionData, transfersData] = await Promise.all([
        supabase.from('sales_orders').select('total_amount, order_date, payment_status'),
        supabase.from('customers').select('id'),
        supabase.from('products').select('current_stock, reorder_level'),
        supabase.from('production_orders').select('status'),
        user ? supabase.from('transfer_requests').select('*').eq('to_user_id', user.id).eq('status', 'pending') : null,
      ]);

      const today = new Date().toISOString().split('T')[0];
      const todaySalesAmount = salesData.data
        ?.filter(s => s.order_date === today)
        .reduce((sum, s) => sum + parseFloat(s.total_amount as any), 0) || 0;

      const totalSalesAmount = salesData.data
        ?.reduce((sum, s) => sum + parseFloat(s.total_amount as any), 0) || 0;

      const pendingPaymentsCount = salesData.data
        ?.filter(s => s.payment_status === 'pending' || s.payment_status === 'partial')
        .length || 0;

      const lowStockCount = productsData.data
        ?.filter(p => p.current_stock <= p.reorder_level)
        .length || 0;

      const productionCount = productionData.data
        ?.filter(p => p.status === 'planned' || p.status === 'in_progress')
        .length || 0;

      setStats({
        totalSales: totalSalesAmount,
        todaySales: todaySalesAmount,
        pendingPayments: pendingPaymentsCount,
        lowStockItems: lowStockCount,
        productionOrders: productionCount,
        customers: customersData.data?.length || 0,
      });

      if (transfersData?.data) {
        setPendingTransfers(transfersData.data);
      }

      // Get recent sales for activity
      const { data: recentSales } = await supabase
        .from('sales_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentActivity(recentSales || []);
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
      await supabase
        .from('transfer_requests')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', transferId);
      loadDashboardData();
    } catch (error) {
      console.error('Error approving transfer:', error);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>{user?.name}</Text>
        </View>
        <TouchableOpacity style={styles.notificationButton}>
          <Ionicons name="notifications-outline" size={24} color={Colors.text} />
          {pendingTransfers.length > 0 && <View style={styles.badge} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
        }
      >
        {/* Cash Balance Card */}
        <GradientCard colors={Colors.gradient1} style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Ionicons name="wallet" size={32} color="#FFF" />
            <Text style={styles.balanceLabel}>Your Cash Balance</Text>
          </View>
          <Text style={styles.balanceAmount}>₹{user?.cash_balance?.toLocaleString('en-IN') || '0'}</Text>
          <View style={styles.balanceFooter}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceItemLabel}>Today's Sales</Text>
              <Text style={styles.balanceItemValue}>₹{stats.todaySales.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceItem}>
              <Text style={styles.balanceItemLabel}>Total Sales</Text>
              <Text style={styles.balanceItemValue}>₹{stats.totalSales.toLocaleString('en-IN')}</Text>
            </View>
          </View>
        </GradientCard>

        {/* Pending Transfer Approvals */}
        {pendingTransfers.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pending Approvals</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{pendingTransfers.length}</Text>
              </View>
            </View>
            {pendingTransfers.map((transfer) => (
              <Card key={transfer.id} style={styles.transferCard}>
                <View style={styles.transferHeader}>
                  <View>
                    <Text style={styles.transferFrom}>{transfer.from_user_name}</Text>
                    <Text style={styles.transferAmount}>₹{transfer.amount.toLocaleString('en-IN')}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.approveButton}
                    onPress={() => handleApproveTransfer(transfer.id)}
                  >
                    <Ionicons name="checkmark-circle" size={32} color={Colors.success} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.transferReason}>{transfer.reason}</Text>
              </Card>
            ))}
          </View>
        )}

        {/* Quick Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Stats</Text>
          <View style={styles.statsGrid}>
            <Card style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: Colors.primary + '20' }]}>
                <Ionicons name="people" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.statValue}>{stats.customers}</Text>
              <Text style={styles.statLabel}>Customers</Text>
            </Card>
            <Card style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: Colors.warning + '20' }]}>
                <Ionicons name="alert-circle" size={24} color={Colors.warning} />
              </View>
              <Text style={styles.statValue}>{stats.pendingPayments}</Text>
              <Text style={styles.statLabel}>Pending Payments</Text>
            </Card>
            <Card style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: Colors.danger + '20' }]}>
                <Ionicons name="cube" size={24} color={Colors.danger} />
              </View>
              <Text style={styles.statValue}>{stats.lowStockItems}</Text>
              <Text style={styles.statLabel}>Low Stock</Text>
            </Card>
            <Card style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: Colors.success + '20' }]}>
                <Ionicons name="construct" size={24} color={Colors.success} />
              </View>
              <Text style={styles.statValue}>{stats.productionOrders}</Text>
              <Text style={styles.statLabel}>Production</Text>
            </Card>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Sales</Text>
          {recentActivity.map((sale) => (
            <Card key={sale.id} style={styles.activityCard}>
              <View style={styles.activityHeader}>
                <View style={styles.activityIcon}>
                  <Ionicons name="receipt" size={20} color={Colors.primary} />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>{sale.invoice_number}</Text>
                  <Text style={styles.activitySubtitle}>{sale.customer_name}</Text>
                </View>
                <View style={styles.activityRight}>
                  <Text style={styles.activityAmount}>₹{parseFloat(sale.total_amount).toLocaleString('en-IN')}</Text>
                  <Text style={[styles.activityStatus, sale.payment_type === 'cash' ? styles.statusCash : styles.statusCredit]}>
                    {sale.payment_type.toUpperCase()}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  greeting: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  name: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 4,
  },
  notificationButton: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
  },
  content: {
    flex: 1,
  },
  balanceCard: {
    margin: Spacing.lg,
    marginBottom: Spacing.md,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  balanceLabel: {
    fontSize: FontSizes.md,
    color: '#FFF',
    marginLeft: Spacing.sm,
    opacity: 0.9,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: Spacing.lg,
  },
  balanceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
  },
  balanceItem: {
    alignItems: 'center',
  },
  balanceItemLabel: {
    fontSize: FontSizes.xs,
    color: '#FFF',
    opacity: 0.8,
  },
  balanceItemValue: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 4,
  },
  balanceDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.text,
  },
  countBadge: {
    backgroundColor: Colors.danger,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: Spacing.sm,
  },
  countBadgeText: {
    color: Colors.surface,
    fontSize: FontSizes.xs,
    fontWeight: 'bold',
  },
  transferCard: {
    marginBottom: Spacing.sm,
  },
  transferHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  transferFrom: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  transferAmount: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: 4,
  },
  transferReason: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  approveButton: {
    padding: Spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.xs,
  },
  statCard: {
    width: (width - Spacing.lg * 2 - Spacing.xs * 2) / 2,
    margin: Spacing.xs,
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statValue: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  activityCard: {
    marginBottom: Spacing.sm,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  activityTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  activitySubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  activityAmount: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    color: Colors.text,
  },
  activityStatus: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  statusCash: {
    backgroundColor: Colors.success + '20',
    color: Colors.success,
  },
  statusCredit: {
    backgroundColor: Colors.warning + '20',
    color: Colors.warning,
  },
});
