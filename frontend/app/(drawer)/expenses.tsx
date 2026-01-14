import React, { useState, useEffect, useMemo } from 'react';
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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import Card from '../../components/Card';
import GradientCard from '../../components/GradientCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import FAB from '../../components/FAB';

const { width } = Dimensions.get('window');

interface Expense {
  id: string;
  expense_number: string;
  category: string;
  amount: number;
  description: string;
  expense_date: string;
  paid_by_name: string;
  created_at: string;
}

const CATEGORIES = [
  { id: 'utilities', label: 'Utilities', icon: 'flash', color: Colors.warning },
  { id: 'raw_materials', label: 'Raw Materials', icon: 'cube', color: Colors.primary },
  { id: 'maintenance', label: 'Maintenance', icon: 'construct', color: Colors.info },
  { id: 'transport', label: 'Transport', icon: 'car', color: Colors.success },
  { id: 'miscellaneous', label: 'Miscellaneous', icon: 'ellipsis-horizontal', color: Colors.secondary },
];

export default function ExpensesScreen() {
  const { user, refreshUser } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'analysis'>('list');
  const [filterCategory, setFilterCategory] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [analysisFilter, setAnalysisFilter] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Form state
  const [category, setCategory] = useState<string>('utilities');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false });

      if (data) setExpenses(data);
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCreateExpense = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter valid amount');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter description');
      return;
    }

    const expenseAmount = parseFloat(amount);
    if (expenseAmount > (user?.cash_balance || 0)) {
      Alert.alert('Error', 'Insufficient cash balance');
      return;
    }

    try {
      const { data: expNum } = await supabase.rpc('generate_expense_number');
      
      const { error } = await supabase.from('expenses').insert([{
        expense_number: expNum || `EXP-${Date.now()}`,
        category,
        amount: expenseAmount,
        description: description.trim(),
        expense_date: expenseDate,
        paid_by: user?.id,
        paid_by_name: user?.name,
      }]);

      if (error) throw error;

      Alert.alert('Success', 'Expense recorded successfully!');
      setModalVisible(false);
      resetForm();
      loadData();
      refreshUser();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const resetForm = () => {
    setCategory('utilities');
    setAmount('');
    setDescription('');
    setExpenseDate(new Date().toISOString().split('T')[0]);
  };

  const getCategoryInfo = (categoryId: string) => {
    return CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[4];
  };

  const filteredExpenses = expenses.filter(e => {
    if (filterCategory === 'all') return true;
    return e.category === filterCategory;
  });

  // Analysis calculations
  const analysisData = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Calculate date ranges
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    let filteredData = expenses;
    if (analysisFilter === 'daily') {
      filteredData = expenses.filter(e => e.expense_date === todayStr);
    } else if (analysisFilter === 'weekly') {
      filteredData = expenses.filter(e => new Date(e.expense_date) >= weekAgo);
    } else {
      filteredData = expenses.filter(e => new Date(e.expense_date) >= monthAgo);
    }

    const total = filteredData.reduce((sum, e) => sum + parseFloat(e.amount as any), 0);
    
    const byCategory = CATEGORIES.map(cat => ({
      ...cat,
      amount: filteredData.filter(e => e.category === cat.id).reduce((sum, e) => sum + parseFloat(e.amount as any), 0),
    })).sort((a, b) => b.amount - a.amount);

    return { total, byCategory, count: filteredData.length };
  }, [expenses, analysisFilter]);

  if (loading) return <LoadingSpinner />;

  const renderList = () => (
    <>
      {/* Category Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <TouchableOpacity
          style={[styles.filterChip, filterCategory === 'all' && styles.filterChipActive]}
          onPress={() => setFilterCategory('all')}
        >
          <Text style={[styles.filterChipText, filterCategory === 'all' && styles.filterChipTextActive]}>All</Text>
        </TouchableOpacity>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.filterChip, filterCategory === cat.id && { backgroundColor: cat.color }]}
            onPress={() => setFilterCategory(cat.id)}
          >
            <Ionicons name={cat.icon as any} size={14} color={filterCategory === cat.id ? '#FFF' : cat.color} />
            <Text style={[styles.filterChipText, filterCategory === cat.id && styles.filterChipTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Expenses List */}
      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const catInfo = getCategoryInfo(item.category);
          return (
            <Card style={styles.expenseCard}>
              <View style={styles.expenseRow}>
                <View style={[styles.expenseIcon, { backgroundColor: catInfo.color + '20' }]}>
                  <Ionicons name={catInfo.icon as any} size={20} color={catInfo.color} />
                </View>
                <View style={styles.expenseContent}>
                  <Text style={styles.expenseDesc}>{item.description}</Text>
                  <Text style={styles.expenseMeta}>
                    {catInfo.label} • {item.paid_by_name}
                  </Text>
                </View>
                <View style={styles.expenseRight}>
                  <Text style={styles.expenseAmount}>-₹{parseFloat(item.amount as any).toLocaleString('en-IN')}</Text>
                  <Text style={styles.expenseDate}>{new Date(item.expense_date).toLocaleDateString()}</Text>
                </View>
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={64} color={Colors.textLight} />
            <Text style={styles.emptyText}>No expenses recorded</Text>
          </View>
        }
      />
    </>
  );

  const renderAnalysis = () => (
    <ScrollView
      style={styles.analysisContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
      }
    >
      {/* Period Filter */}
      <View style={styles.periodFilter}>
        {(['daily', 'weekly', 'monthly'] as const).map((period) => (
          <TouchableOpacity
            key={period}
            style={[styles.periodBtn, analysisFilter === period && styles.periodBtnActive]}
            onPress={() => setAnalysisFilter(period)}
          >
            <Text style={[styles.periodBtnText, analysisFilter === period && styles.periodBtnTextActive]}>
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Total Card */}
      <GradientCard colors={Colors.gradient4 as [string, string]} style={styles.totalCard}>
        <Text style={styles.totalLabel}>
          {analysisFilter === 'daily' ? "Today's" : analysisFilter === 'weekly' ? 'This Week\'s' : 'This Month\'s'} Expenses
        </Text>
        <Text style={styles.totalAmount}>₹{analysisData.total.toLocaleString('en-IN')}</Text>
        <Text style={styles.totalCount}>{analysisData.count} transactions</Text>
      </GradientCard>

      {/* Category Breakdown */}
      <Text style={styles.sectionTitle}>Category Breakdown</Text>
      {analysisData.byCategory.map((cat) => (
        <Card key={cat.id} style={styles.categoryCard}>
          <View style={styles.categoryRow}>
            <View style={[styles.categoryIcon, { backgroundColor: cat.color + '20' }]}>
              <Ionicons name={cat.icon as any} size={20} color={cat.color} />
            </View>
            <View style={styles.categoryContent}>
              <Text style={styles.categoryLabel}>{cat.label}</Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${analysisData.total > 0 ? (cat.amount / analysisData.total) * 100 : 0}%`,
                      backgroundColor: cat.color,
                    },
                  ]}
                />
              </View>
            </View>
            <Text style={styles.categoryAmount}>₹{cat.amount.toLocaleString('en-IN')}</Text>
          </View>
        </Card>
      ))}

      <View style={{ height: 100 }} />
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
          <Ionicons name="menu" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Expenses</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'list' && styles.tabActive]}
          onPress={() => setActiveTab('list')}
        >
          <Ionicons name="list" size={18} color={activeTab === 'list' ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'list' && styles.tabTextActive]}>Expenses</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'analysis' && styles.tabActive]}
          onPress={() => setActiveTab('analysis')}
        >
          <Ionicons name="analytics" size={18} color={activeTab === 'analysis' ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'analysis' && styles.tabTextActive]}>Analysis</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'list' ? renderList() : renderAnalysis()}

      <FAB icon="add" onPress={() => setModalVisible(true)} />

      {/* Add Expense Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Expense</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Category *</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryBtn,
                    category === cat.id && { backgroundColor: cat.color, borderColor: cat.color },
                  ]}
                  onPress={() => setCategory(cat.id)}
                >
                  <Ionicons name={cat.icon as any} size={24} color={category === cat.id ? '#FFF' : cat.color} />
                  <Text style={[styles.categoryBtnText, category === cat.id && { color: '#FFF' }]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Amount (₹) *</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="Enter amount"
              keyboardType="numeric"
              placeholderTextColor={Colors.textLight}
            />

            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="What was this expense for?"
              multiline
              placeholderTextColor={Colors.textLight}
            />

            <Text style={styles.label}>Date</Text>
            <TextInput
              style={styles.input}
              value={expenseDate}
              onChangeText={setExpenseDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textLight}
            />

            <View style={styles.balanceNote}>
              <Ionicons name="wallet" size={20} color={Colors.primary} />
              <Text style={styles.balanceNoteText}>
                Your balance: ₹{user?.cash_balance?.toLocaleString('en-IN') || '0'}
              </Text>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.createBtn, { backgroundColor: Colors.danger }]} onPress={handleCreateExpense}>
              <Text style={styles.createBtnText}>Add Expense</Text>
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
  tabsContainer: { flexDirection: 'row', backgroundColor: Colors.surface, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.sm, gap: Spacing.xs, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: FontSizes.md, color: Colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: Colors.primary, fontWeight: '600' },
  filterScroll: { backgroundColor: Colors.surface, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.background, borderRadius: BorderRadius.full, marginRight: Spacing.sm, gap: 4 },
  filterChipActive: { backgroundColor: Colors.primary },
  filterChipText: { fontSize: FontSizes.sm, color: Colors.text, fontWeight: '500' },
  filterChipTextActive: { color: '#FFF' },
  listContent: { padding: Spacing.md, paddingBottom: 100 },
  expenseCard: { marginBottom: Spacing.sm },
  expenseRow: { flexDirection: 'row', alignItems: 'center' },
  expenseIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  expenseContent: { flex: 1, marginLeft: Spacing.md },
  expenseDesc: { fontSize: FontSizes.md, fontWeight: '500', color: Colors.text },
  expenseMeta: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 2 },
  expenseRight: { alignItems: 'flex-end' },
  expenseAmount: { fontSize: FontSizes.md, fontWeight: 'bold', color: Colors.danger },
  expenseDate: { fontSize: FontSizes.xs, color: Colors.textSecondary, marginTop: 2 },
  analysisContainer: { flex: 1, padding: Spacing.md },
  periodFilter: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: 4, marginBottom: Spacing.md },
  periodBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: BorderRadius.sm },
  periodBtnActive: { backgroundColor: Colors.primary },
  periodBtnText: { fontSize: FontSizes.sm, fontWeight: '500', color: Colors.textSecondary },
  periodBtnTextActive: { color: '#FFF' },
  totalCard: { marginBottom: Spacing.lg, alignItems: 'center' },
  totalLabel: { fontSize: FontSizes.md, color: '#FFF', opacity: 0.9 },
  totalAmount: { fontSize: 36, fontWeight: 'bold', color: '#FFF', marginVertical: Spacing.sm },
  totalCount: { fontSize: FontSizes.sm, color: '#FFF', opacity: 0.8 },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.md },
  categoryCard: { marginBottom: Spacing.sm },
  categoryRow: { flexDirection: 'row', alignItems: 'center' },
  categoryIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  categoryContent: { flex: 1, marginLeft: Spacing.md },
  categoryLabel: { fontSize: FontSizes.sm, color: Colors.text, fontWeight: '500', marginBottom: 4 },
  progressBar: { height: 6, backgroundColor: Colors.background, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  categoryAmount: { fontSize: FontSizes.md, fontWeight: 'bold', color: Colors.text, marginLeft: Spacing.md },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyText: { fontSize: FontSizes.md, color: Colors.textSecondary, marginTop: Spacing.md },
  modal: { flex: 1, backgroundColor: Colors.surface },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: 'bold', color: Colors.text },
  modalContent: { flex: 1, padding: Spacing.lg },
  label: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm, marginTop: Spacing.md },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  categoryBtn: { width: (width - Spacing.lg * 2 - Spacing.sm * 2) / 3, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.background, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  categoryBtnText: { fontSize: FontSizes.xs, color: Colors.text, marginTop: 4, textAlign: 'center' },
  input: { backgroundColor: Colors.background, padding: Spacing.md, borderRadius: BorderRadius.md, fontSize: FontSizes.md, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  balanceNote: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary + '15', padding: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.lg, gap: Spacing.sm },
  balanceNoteText: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: '500' },
  modalFooter: { flexDirection: 'row', padding: Spacing.lg, gap: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.background, alignItems: 'center' },
  cancelBtnText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textSecondary },
  createBtn: { flex: 2, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  createBtnText: { fontSize: FontSizes.md, fontWeight: '600', color: '#FFF' },
});
