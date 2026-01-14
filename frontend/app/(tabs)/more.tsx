import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../constants/theme';
import Card from '../../components/Card';
import GradientCard from '../../components/GradientCard';

export default function MoreScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => {
        await signOut();
        router.replace('/(auth)/login');
      }},
    ]);
  };

  const menuItems = [
    { icon: 'cube', title: 'Packaging Materials', subtitle: 'Manage packaging inventory', color: Colors.warning, route: '/more/packaging' },
    { icon: 'construct', title: 'Production Orders', subtitle: 'Track production', color: Colors.success, route: '/more/production' },
    { icon: 'people', title: 'Customers', subtitle: 'Manage customers', color: Colors.info, route: '/more/customers' },
    { icon: 'wallet', title: 'Cash Transactions', subtitle: 'View cash flow', color: Colors.primary, route: '/more/cash' },
    { icon: 'swap-horizontal', title: 'Cash Transfers', subtitle: 'Partner transfers', color: Colors.secondary, route: '/more/transfers' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>More</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Card */}
        <GradientCard colors={Colors.gradient1} style={styles.userCard}>
          <View style={styles.avatar}>
            <Ionicons name=\"person\" size={32} color=\"#FFF\" />
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Cash Balance</Text>
            <Text style={styles.balanceAmount}>\u20b9{user?.cash_balance?.toLocaleString('en-IN') || '0'}</Text>
          </View>
        </GradientCard>

        {/* Menu Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          {menuItems.map((item, index) => (
            <Card key={index} style={styles.menuCard} onPress={() => router.push(item.route as any)}>
              <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon as any} size={24} color={item.color} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name=\"chevron-forward\" size={24} color={Colors.textLight} />
            </Card>
          ))}
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <Card style={styles.menuCard} onPress={handleLogout}>
            <View style={[styles.menuIcon, { backgroundColor: Colors.danger + '20' }]}>
              <Ionicons name=\"log-out\" size={24} color={Colors.danger} />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: Colors.danger }]}>Logout</Text>
            </View>
          </Card>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: FontSizes.xxl, fontWeight: 'bold', color: Colors.text },
  content: { flex: 1 },
  userCard: { margin: Spacing.lg, alignItems: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  userName: { fontSize: FontSizes.xl, fontWeight: 'bold', color: '#FFF', marginBottom: 4 },
  userEmail: { fontSize: FontSizes.sm, color: '#FFF', opacity: 0.9, marginBottom: Spacing.lg },
  balanceRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.2)', padding: Spacing.md, borderRadius: BorderRadius.md },
  balanceLabel: { fontSize: FontSizes.sm, color: '#FFF', opacity: 0.9 },
  balanceAmount: { fontSize: FontSizes.lg, fontWeight: 'bold', color: '#FFF' },
  section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.md },
  menuCard: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, padding: Spacing.md },
  menuIcon: { width: 48, height: 48, borderRadius: BorderRadius.full, justifyContent: 'center', alignItems: 'center' },
  menuContent: { flex: 1, marginLeft: Spacing.md },
  menuTitle: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.text },
  menuSubtitle: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 2 },
});
"
