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
import GradientCard from '../../components/GradientCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import FAB from '../../components/FAB';

interface Worker {
  id: string;
  worker_code: string;
  name: string;
  phone: string;
  pay_type: string;
  base_rate: number;
  pending_amount: number;
  total_paid: number;
  is_active: boolean;
}

interface WorkEntry {
  id: string;
  entry_number: string;
  worker_name: string;
  work_date: string;
  work_description: string;
  quantity: number;
  amount_earned: number;
  is_paid: boolean;
}

export default function LaborScreen() {
  const { user, refreshUser } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'workers' | 'entries' | 'payments' | 'analysis'>('workers');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [workerModalVisible, setWorkerModalVisible] = useState(false);
  const [entryModalVisible, setEntryModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  
  // Worker Form
  const [workerName, setWorkerName] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');
  const [workerAddress, setWorkerAddress] = useState('');
  const [payType, setPayType] = useState<'daily' | 'weekly' | 'monthly' | 'incentive'>('daily');
  const [baseRate, setBaseRate] = useState('');
  
  // Entry Form
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [workDate, setWorkDate] = useState(new Date().toISOString().split('T')[0]);
  const [workDescription, setWorkDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  
  // Payment Form
  const [paymentWorker, setPaymentWorker] = useState<Worker | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  
  // Analysis
  const [analysisFilter, setAnalysisFilter] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [analysisData, setAnalysisData] = useState({ totalLabor: 0, totalPaid: 0, totalPending: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [workersRes, entriesRes] = await Promise.all([
        supabase.from('workers').select('*').order('name'),
        supabase.from('work_entries').select('*').order('work_date', { ascending: false }).limit(50),
      ]);

      if (workersRes.data) {
        setWorkers(workersRes.data);
        const totalPending = workersRes.data.reduce((sum, w) => sum + parseFloat(w.pending_amount as any || '0'), 0);
        const totalPaid = workersRes.data.reduce((sum, w) => sum + parseFloat(w.total_paid as any || '0'), 0);
        setAnalysisData(prev => ({ ...prev, totalPending, totalPaid, totalLabor: totalPending + totalPaid }));
      }
      if (entriesRes.data) setWorkEntries(entriesRes.data);
    } catch (error) {
      console.error('Error loading labor data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCreateWorker = async () => {
    if (!workerName.trim()) {
      Alert.alert('Error', 'Please enter worker name');
      return;
    }
    if (!baseRate || parseFloat(baseRate) <= 0) {
      Alert.alert('Error', 'Please enter valid base rate');
      return;
    }

    try {
      const { data: workerCode } = await supabase.rpc('generate_worker_code');
      
      const { error } = await supabase.from('workers').insert([{
        worker_code: workerCode || `WRK-${Date.now()}`,
        name: workerName.trim(),
        phone: workerPhone,
        address: workerAddress,
        pay_type: payType,
        base_rate: parseFloat(baseRate),
        created_by: user?.id,
      }]);

      if (error) throw error;

      Alert.alert('Success', 'Worker added successfully!');
      setWorkerModalVisible(false);
      resetWorkerForm();
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleCreateEntry = async () => {
    if (!selectedWorker) {
      Alert.alert('Error', 'Please select a worker');
      return;
    }
    if (!workDescription.trim()) {
      Alert.alert('Error', 'Please enter work description');
      return;
    }

    try {
      const qty = parseFloat(quantity) || 1;
      let amountEarned = 0;
      
      if (selectedWorker.pay_type === 'incentive') {
        amountEarned = qty * selectedWorker.base_rate;
      } else {
        amountEarned = selectedWorker.base_rate; // Daily/Weekly/Monthly rate
      }

      const { data: entryNum } = await supabase.rpc('generate_work_entry_number');
      
      const { error } = await supabase.from('work_entries').insert([{
        entry_number: entryNum || `WE-${Date.now()}`,
        worker_id: selectedWorker.id,
        worker_name: selectedWorker.name,
        work_date: workDate,
        work_description: workDescription.trim(),
        quantity: qty,
        amount_earned: amountEarned,
        created_by: user?.id,
      }]);

      if (error) throw error;

      Alert.alert('Success', `Work entry added! Amount: ₹${amountEarned.toLocaleString('en-IN')}`);
      setEntryModalVisible(false);
      resetEntryForm();
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handlePayWorker = async () => {
    if (!paymentWorker) {
      Alert.alert('Error', 'Please select a worker');
      return;
    }
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      Alert.alert('Error', 'Please enter valid amount');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (amount > (user?.cash_balance || 0)) {
      Alert.alert('Error', 'Insufficient cash balance');
      return;
    }

    try {
      const { data: payNum } = await supabase.rpc('generate_labor_payment_number');
      
      const { error } = await supabase.from('labor_payments').insert([{
        payment_number: payNum || `LP-${Date.now()}`,
        worker_id: paymentWorker.id,
        worker_name: paymentWorker.name,
        amount,
        paid_by: user?.id,
        paid_by_name: user?.name,
      }]);

      if (error) throw error;

      Alert.alert('Success', `Paid ₹${amount.toLocaleString('en-IN')} to ${paymentWorker.name}`);
      setPaymentModalVisible(false);
      resetPaymentForm();
      loadData();
      refreshUser();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const resetWorkerForm = () => {
    setWorkerName('');
    setWorkerPhone('');
    setWorkerAddress('');
    setPayType('daily');
    setBaseRate('');
  };

  const resetEntryForm = () => {
    setSelectedWorker(null);
    setWorkDate(new Date().toISOString().split('T')[0]);
    setWorkDescription('');
    setQuantity('1');
  };

  const resetPaymentForm = () => {
    setPaymentWorker(null);
    setPaymentAmount('');
  };

  const getPayTypeLabel = (type: string) => {
    switch (type) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      case 'incentive': return 'Per Packet';
      default: return type;
    }
  };

  const getPayTypeColor = (type: string) => {
    switch (type) {
      case 'daily': return Colors.primary;
      case 'weekly': return Colors.info;
      case 'monthly': return Colors.success;
      case 'incentive': return Colors.warning;
      default: return Colors.textSecondary;
    }
  };

  const filteredWorkers = workers.filter(w =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.worker_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <LoadingSpinner />;

  const renderWorkers = () => (
    <FlatList
      data={filteredWorkers}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
      }
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search workers..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={Colors.textLight}
          />
        </View>
      }
      renderItem={({ item }) => (
        <Card style={styles.workerCard}>
          <View style={styles.workerHeader}>
            <View style={styles.workerAvatar}>
              <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.workerInfo}>
              <Text style={styles.workerName}>{item.name}</Text>
              <Text style={styles.workerCode}>{item.worker_code}</Text>
            </View>
            <View style={[styles.payTypeBadge, { backgroundColor: getPayTypeColor(item.pay_type) + '20' }]}>
              <Text style={[styles.payTypeText, { color: getPayTypeColor(item.pay_type) }]}>
                {getPayTypeLabel(item.pay_type)}
              </Text>
            </View>
          </View>
          <View style={styles.workerStats}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Rate</Text>
              <Text style={styles.statValue}>₹{item.base_rate}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Pending</Text>
              <Text style={[styles.statValue, { color: Colors.warning }]}>₹{parseFloat(item.pending_amount as any || '0').toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Total Paid</Text>
              <Text style={[styles.statValue, { color: Colors.success }]}>₹{parseFloat(item.total_paid as any || '0').toLocaleString('en-IN')}</Text>
            </View>
          </View>
          {parseFloat(item.pending_amount as any) > 0 && (
            <TouchableOpacity
              style={styles.payButton}
              onPress={() => {
                setPaymentWorker(item);
                setPaymentAmount(item.pending_amount.toString());
                setPaymentModalVisible(true);
              }}
            >
              <Ionicons name="cash" size={16} color="#FFF" />
              <Text style={styles.payButtonText}>Pay Now</Text>
            </TouchableOpacity>
          )}
        </Card>
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={64} color={Colors.textLight} />
          <Text style={styles.emptyText}>No workers added yet</Text>
        </View>
      }
    />
  );

  const renderEntries = () => (
    <FlatList
      data={workEntries}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
      }
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => (
        <Card style={styles.entryCard}>
          <View style={styles.entryHeader}>
            <View>
              <Text style={styles.entryWorker}>{item.worker_name}</Text>
              <Text style={styles.entryDesc}>{item.work_description}</Text>
            </View>
            <View style={styles.entryRight}>
              <Text style={styles.entryAmount}>₹{parseFloat(item.amount_earned as any).toLocaleString('en-IN')}</Text>
              <Text style={[styles.entryStatus, item.is_paid ? styles.paid : styles.unpaid]}>
                {item.is_paid ? 'PAID' : 'PENDING'}
              </Text>
            </View>
          </View>
          <View style={styles.entryFooter}>
            <Text style={styles.entryDate}>{new Date(item.work_date).toLocaleDateString()}</Text>
            {item.quantity > 1 && <Text style={styles.entryQty}>Qty: {item.quantity}</Text>}
          </View>
        </Card>
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={64} color={Colors.textLight} />
          <Text style={styles.emptyText}>No work entries yet</Text>
        </View>
      }
    />
  );

  const renderAnalysis = () => (
    <ScrollView style={styles.analysisContainer} refreshControl={
      <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
    }>
      <GradientCard colors={Colors.gradient1} style={styles.analysisCard}>
        <Text style={styles.analysisTitle}>Labor Overview</Text>
        <Text style={styles.analysisTotal}>₹{analysisData.totalLabor.toLocaleString('en-IN')}</Text>
        <Text style={styles.analysisSubtitle}>Total Labor Cost</Text>
      </GradientCard>

      <View style={styles.analysisRow}>
        <Card style={[styles.analysisStat, { backgroundColor: Colors.warning + '15' }]}>
          <Ionicons name="time" size={32} color={Colors.warning} />
          <Text style={styles.analysisStatValue}>₹{analysisData.totalPending.toLocaleString('en-IN')}</Text>
          <Text style={styles.analysisStatLabel}>Pending</Text>
        </Card>
        <Card style={[styles.analysisStat, { backgroundColor: Colors.success + '15' }]}>
          <Ionicons name="checkmark-circle" size={32} color={Colors.success} />
          <Text style={styles.analysisStatValue}>₹{analysisData.totalPaid.toLocaleString('en-IN')}</Text>
          <Text style={styles.analysisStatLabel}>Paid</Text>
        </Card>
      </View>

      <Card style={styles.workersOverview}>
        <Text style={styles.overviewTitle}>Workers Summary</Text>
        {workers.slice(0, 5).map((worker) => (
          <View key={worker.id} style={styles.overviewRow}>
            <Text style={styles.overviewName}>{worker.name}</Text>
            <Text style={styles.overviewPending}>₹{parseFloat(worker.pending_amount as any || '0').toLocaleString('en-IN')}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
          <Ionicons name="menu" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Labor Management</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {(['workers', 'entries', 'analysis'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'workers' && renderWorkers()}
      {activeTab === 'entries' && renderEntries()}
      {activeTab === 'analysis' && renderAnalysis()}

      {/* FAB */}
      {activeTab === 'workers' && (
        <FAB icon="person-add" onPress={() => setWorkerModalVisible(true)} />
      )}
      {activeTab === 'entries' && (
        <FAB icon="add" onPress={() => setEntryModalVisible(true)} />
      )}

      {/* Add Worker Modal */}
      <Modal visible={workerModalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Worker</Text>
            <TouchableOpacity onPress={() => setWorkerModalVisible(false)}>
              <Ionicons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={workerName}
              onChangeText={setWorkerName}
              placeholder="Enter worker name"
              placeholderTextColor={Colors.textLight}
            />

            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={workerPhone}
              onChangeText={setWorkerPhone}
              placeholder="Phone number"
              keyboardType="phone-pad"
              placeholderTextColor={Colors.textLight}
            />

            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={workerAddress}
              onChangeText={setWorkerAddress}
              placeholder="Address"
              multiline
              placeholderTextColor={Colors.textLight}
            />

            <Text style={styles.label}>Pay Type *</Text>
            <View style={styles.payTypeGrid}>
              {(['daily', 'weekly', 'monthly', 'incentive'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.payTypeBtn, payType === type && { backgroundColor: getPayTypeColor(type) }]}
                  onPress={() => setPayType(type)}
                >
                  <Text style={[styles.payTypeBtnText, payType === type && { color: '#FFF' }]}>
                    {getPayTypeLabel(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>
              {payType === 'incentive' ? 'Rate per Packet (₹) *' : `${getPayTypeLabel(payType)} Rate (₹) *`}
            </Text>
            <TextInput
              style={styles.input}
              value={baseRate}
              onChangeText={setBaseRate}
              placeholder="Enter rate"
              keyboardType="numeric"
              placeholderTextColor={Colors.textLight}
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setWorkerModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createBtn} onPress={handleCreateWorker}>
              <Text style={styles.createBtnText}>Add Worker</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Work Entry Modal */}
      <Modal visible={entryModalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Work Entry</Text>
            <TouchableOpacity onPress={() => setEntryModalVisible(false)}>
              <Ionicons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Select Worker *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.workerScroll}>
              {workers.filter(w => w.is_active).map((worker) => (
                <TouchableOpacity
                  key={worker.id}
                  style={[styles.workerChip, selectedWorker?.id === worker.id && styles.workerChipActive]}
                  onPress={() => setSelectedWorker(worker)}
                >
                  <Text style={[styles.workerChipText, selectedWorker?.id === worker.id && styles.workerChipTextActive]}>
                    {worker.name}
                  </Text>
                  <Text style={[styles.workerChipRate, selectedWorker?.id === worker.id && { color: '#FFF' }]}>
                    ₹{worker.base_rate}/{worker.pay_type === 'incentive' ? 'pkt' : worker.pay_type.substring(0, 3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Work Date</Text>
            <TextInput
              style={styles.input}
              value={workDate}
              onChangeText={setWorkDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textLight}
            />

            <Text style={styles.label}>Work Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={workDescription}
              onChangeText={setWorkDescription}
              placeholder="What work was done?"
              multiline
              placeholderTextColor={Colors.textLight}
            />

            {selectedWorker?.pay_type === 'incentive' && (
              <>
                <Text style={styles.label}>Quantity (Packets)</Text>
                <TextInput
                  style={styles.input}
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder="Number of packets"
                  keyboardType="numeric"
                  placeholderTextColor={Colors.textLight}
                />
              </>
            )}

            {selectedWorker && (
              <View style={styles.calculatedAmount}>
                <Text style={styles.calculatedLabel}>Amount to be earned:</Text>
                <Text style={styles.calculatedValue}>
                  ₹{(selectedWorker.pay_type === 'incentive'
                    ? (parseFloat(quantity) || 1) * selectedWorker.base_rate
                    : selectedWorker.base_rate
                  ).toLocaleString('en-IN')}
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEntryModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createBtn} onPress={handleCreateEntry}>
              <Text style={styles.createBtnText}>Add Entry</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Payment Modal */}
      <Modal visible={paymentModalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pay Worker</Text>
            <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
              <Ionicons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {paymentWorker && (
              <Card style={styles.paymentWorkerCard}>
                <Text style={styles.paymentWorkerName}>{paymentWorker.name}</Text>
                <Text style={styles.paymentWorkerPending}>
                  Pending: ₹{parseFloat(paymentWorker.pending_amount as any).toLocaleString('en-IN')}
                </Text>
              </Card>
            )}

            <Text style={styles.label}>Amount to Pay (₹) *</Text>
            <TextInput
              style={styles.input}
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              placeholder="Enter amount"
              keyboardType="numeric"
              placeholderTextColor={Colors.textLight}
            />

            <View style={styles.paymentNote}>
              <Ionicons name="information-circle" size={20} color={Colors.info} />
              <Text style={styles.paymentNoteText}>
                This amount will be deducted from your cash balance (₹{user?.cash_balance?.toLocaleString('en-IN')})
              </Text>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setPaymentModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.createBtn, { backgroundColor: Colors.success }]} onPress={handlePayWorker}>
              <Text style={styles.createBtnText}>Pay Now</Text>
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
  tabsContainer: { flexDirection: 'row', backgroundColor: Colors.surface, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  tab: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: FontSizes.md, color: Colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: Colors.primary, fontWeight: '600' },
  listContent: { padding: Spacing.md, paddingBottom: 100 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.md, ...Shadows.sm },
  searchInput: { flex: 1, marginLeft: Spacing.sm, fontSize: FontSizes.md, color: Colors.text },
  workerCard: { marginBottom: Spacing.md },
  workerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  workerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: FontSizes.xl, fontWeight: 'bold', color: '#FFF' },
  workerInfo: { flex: 1, marginLeft: Spacing.md },
  workerName: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.text },
  workerCode: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  payTypeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.sm },
  payTypeText: { fontSize: FontSizes.xs, fontWeight: '600' },
  workerStats: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  statItem: { alignItems: 'center' },
  statLabel: { fontSize: FontSizes.xs, color: Colors.textSecondary },
  statValue: { fontSize: FontSizes.md, fontWeight: 'bold', color: Colors.text, marginTop: 2 },
  payButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.success, padding: Spacing.sm, borderRadius: BorderRadius.md, marginTop: Spacing.md, gap: Spacing.xs },
  payButtonText: { color: '#FFF', fontWeight: '600', fontSize: FontSizes.sm },
  entryCard: { marginBottom: Spacing.sm },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  entryWorker: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.text },
  entryDesc: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 2 },
  entryRight: { alignItems: 'flex-end' },
  entryAmount: { fontSize: FontSizes.md, fontWeight: 'bold', color: Colors.text },
  entryStatus: { fontSize: FontSizes.xs, fontWeight: '600', marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  paid: { backgroundColor: Colors.success + '20', color: Colors.success },
  unpaid: { backgroundColor: Colors.warning + '20', color: Colors.warning },
  entryFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  entryDate: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  entryQty: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  analysisContainer: { flex: 1, padding: Spacing.md },
  analysisCard: { marginBottom: Spacing.md, alignItems: 'center' },
  analysisTitle: { fontSize: FontSizes.md, color: '#FFF', opacity: 0.9 },
  analysisTotal: { fontSize: 36, fontWeight: 'bold', color: '#FFF', marginVertical: Spacing.sm },
  analysisSubtitle: { fontSize: FontSizes.sm, color: '#FFF', opacity: 0.8 },
  analysisRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  analysisStat: { flex: 1, alignItems: 'center', paddingVertical: Spacing.lg },
  analysisStatValue: { fontSize: FontSizes.xl, fontWeight: 'bold', color: Colors.text, marginTop: Spacing.sm },
  analysisStatLabel: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  workersOverview: { padding: Spacing.md },
  overviewTitle: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.text, marginBottom: Spacing.md },
  overviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  overviewName: { fontSize: FontSizes.md, color: Colors.text },
  overviewPending: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.warning },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyText: { fontSize: FontSizes.md, color: Colors.textSecondary, marginTop: Spacing.md },
  modal: { flex: 1, backgroundColor: Colors.surface },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: 'bold', color: Colors.text },
  modalContent: { flex: 1, padding: Spacing.lg },
  label: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm, marginTop: Spacing.md },
  input: { backgroundColor: Colors.background, padding: Spacing.md, borderRadius: BorderRadius.md, fontSize: FontSizes.md, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  payTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  payTypeBtn: { flex: 1, minWidth: '45%', padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.background, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  payTypeBtnText: { fontSize: FontSizes.sm, fontWeight: '500', color: Colors.text },
  workerScroll: { marginBottom: Spacing.sm },
  workerChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.background, borderRadius: BorderRadius.md, marginRight: Spacing.sm, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  workerChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  workerChipText: { fontSize: FontSizes.sm, color: Colors.text, fontWeight: '500' },
  workerChipTextActive: { color: '#FFF' },
  workerChipRate: { fontSize: FontSizes.xs, color: Colors.textSecondary, marginTop: 2 },
  calculatedAmount: { backgroundColor: Colors.primary + '15', padding: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.lg, alignItems: 'center' },
  calculatedLabel: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  calculatedValue: { fontSize: FontSizes.xxl, fontWeight: 'bold', color: Colors.primary, marginTop: Spacing.xs },
  paymentWorkerCard: { alignItems: 'center', marginBottom: Spacing.lg },
  paymentWorkerName: { fontSize: FontSizes.xl, fontWeight: 'bold', color: Colors.text },
  paymentWorkerPending: { fontSize: FontSizes.md, color: Colors.warning, marginTop: Spacing.xs },
  paymentNote: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.info + '15', padding: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.md, gap: Spacing.sm },
  paymentNoteText: { flex: 1, fontSize: FontSizes.sm, color: Colors.info },
  modalFooter: { flexDirection: 'row', padding: Spacing.lg, gap: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.background, alignItems: 'center' },
  cancelBtnText: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textSecondary },
  createBtn: { flex: 2, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  createBtnText: { fontSize: FontSizes.md, fontWeight: '600', color: '#FFF' },
});
