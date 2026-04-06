import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = 'https://event-hub-okc-1.preview.emergentagent.com';

type LeaderboardType = '0-60' | '0-100' | 'quarter-mile';

interface LeaderboardEntry {
  id: string;
  userId: string;
  userName: string;
  nickname: string;
  carInfo: string;
  time: number;
  location: string;
  createdAt: string;
  zeroToSixty?: number;
  zeroToHundred?: number;
  quarterMile?: number;
  quarterMileSpeed?: number;
  topSpeed?: number;
  isManualEntry?: boolean;
}

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<LeaderboardType>('0-60');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isAdmin = user?.isAdmin === true;

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LeaderboardEntry | null>(null);
  const [editForm, setEditForm] = useState({
    carInfo: '',
    zeroToSixty: '',
    zeroToHundred: '',
    quarterMile: '',
    location: '',
  });
  const [saving, setSaving] = useState(false);

  const types: { type: LeaderboardType; label: string; icon: string; color: string }[] = [
    { type: '0-60', label: '0-60', icon: 'speedometer', color: '#FF6B35' },
    { type: '0-100', label: '0-100', icon: 'rocket', color: '#E91E63' },
    { type: 'quarter-mile', label: '1/4 Mile', icon: 'flag', color: '#9C27B0' },
  ];

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedType]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/leaderboard/${selectedType}`);
      setLeaderboard(response.data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaderboard();
  };

  const handleDeleteEntry = (entry: LeaderboardEntry) => {
    Alert.alert(
      'Delete Entry',
      `Remove ${entry.nickname || entry.userName}'s ${entry.time.toFixed(2)}s run from the leaderboard?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            axios.delete(
              `${API_URL}/api/admin/performance-runs/${entry.id}?admin_id=${user?.id}`
            ).then(() => {
              setLeaderboard(prev => prev.filter(e => e.id !== entry.id));
              fetchLeaderboard();
            }).catch((error: any) => {
              console.error('Error deleting entry:', error);
              Alert.alert('Error', error.response?.data?.detail || 'Failed to delete entry.');
            });
          },
        },
      ]
    );
  };

  const handleEditEntry = (entry: LeaderboardEntry) => {
    setEditingEntry(entry);
    // Fetch the full run details to populate all fields
    axios.get(`${API_URL}/api/performance-runs/user/${entry.userId}`)
      .then(response => {
        const fullRun = response.data.find((r: any) => r.id === entry.id);
        if (fullRun) {
          setEditForm({
            carInfo: fullRun.carInfo || '',
            zeroToSixty: fullRun.zeroToSixty != null ? String(fullRun.zeroToSixty) : '',
            zeroToHundred: fullRun.zeroToHundred != null ? String(fullRun.zeroToHundred) : '',
            quarterMile: fullRun.quarterMile != null ? String(fullRun.quarterMile) : '',
            location: fullRun.location || '',
          });
        } else {
          // Fallback to what we have from the leaderboard entry
          setEditForm({
            carInfo: entry.carInfo || '',
            zeroToSixty: '',
            zeroToHundred: '',
            quarterMile: '',
            location: entry.location || '',
          });
          // Set the time from the current leaderboard type
          if (selectedType === '0-60') setEditForm(prev => ({ ...prev, zeroToSixty: String(entry.time) }));
          if (selectedType === '0-100') setEditForm(prev => ({ ...prev, zeroToHundred: String(entry.time) }));
          if (selectedType === 'quarter-mile') setEditForm(prev => ({ ...prev, quarterMile: String(entry.time) }));
        }
        setShowEditModal(true);
      })
      .catch(() => {
        // Use what we have
        setEditForm({
          carInfo: entry.carInfo || '',
          zeroToSixty: selectedType === '0-60' ? String(entry.time) : '',
          zeroToHundred: selectedType === '0-100' ? String(entry.time) : '',
          quarterMile: selectedType === 'quarter-mile' ? String(entry.time) : '',
          location: entry.location || '',
        });
        setShowEditModal(true);
      });
  };

  const handleSaveEdit = async () => {
    if (!editingEntry || !user) return;
    setSaving(true);

    try {
      const updatePayload: any = {};
      if (editForm.carInfo) updatePayload.carInfo = editForm.carInfo;
      if (editForm.location) updatePayload.location = editForm.location;
      if (editForm.zeroToSixty) updatePayload.zeroToSixty = parseFloat(editForm.zeroToSixty);
      if (editForm.zeroToHundred) updatePayload.zeroToHundred = parseFloat(editForm.zeroToHundred);
      if (editForm.quarterMile) updatePayload.quarterMile = parseFloat(editForm.quarterMile);

      await axios.put(
        `${API_URL}/api/admin/performance-runs/${editingEntry.id}?admin_id=${user.id}`,
        updatePayload
      );

      setShowEditModal(false);
      setEditingEntry(null);
      fetchLeaderboard();
      Alert.alert('Success', 'Leaderboard entry updated.');
    } catch (error: any) {
      console.error('Error updating entry:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update entry.');
    } finally {
      setSaving(false);
    }
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return '#888';
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return 'trophy';
    if (rank === 2) return 'medal';
    if (rank === 3) return 'medal-outline';
    return null;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderLeaderboardItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const rank = index + 1;
    const rankIcon = getRankIcon(rank);
    const isTopThree = rank <= 3;

    return (
      <View style={[styles.leaderboardItem, isTopThree && styles.topThreeItem]}>
        <View style={[styles.rankContainer, { backgroundColor: `${getRankColor(rank)}20` }]}>
          {rankIcon ? (
            <Ionicons name={rankIcon as any} size={24} color={getRankColor(rank)} />
          ) : (
            <Text style={[styles.rankText, { color: getRankColor(rank) }]}>#{rank}</Text>
          )}
        </View>

        <View style={styles.entryDetails}>
          <Text style={styles.userName}>
            {item.nickname || item.userName}
            {item.isManualEntry ? ' 📝' : ''}
          </Text>
          <Text style={styles.carInfo}>{item.carInfo}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={12} color="#666" />
            <Text style={styles.metaText}>{item.location || 'Unknown'}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Ionicons name="calendar-outline" size={12} color="#666" />
            <Text style={styles.metaText}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.timeContainer}>
          <Text style={[styles.timeValue, isTopThree && { color: getRankColor(rank) }]}>
            {item.time.toFixed(2)}
          </Text>
          <Text style={styles.timeUnit}>sec</Text>
        </View>

        {isAdmin && (
          <View style={styles.adminActions}>
            <TouchableOpacity
              style={styles.adminEditButton}
              onPress={() => handleEditEntry(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="pencil" size={15} color="#2196F3" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.adminDeleteButton}
              onPress={() => handleDeleteEntry(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={15} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="trophy-outline" size={80} color="#333" />
      <Text style={styles.emptyTitle}>No Records Yet</Text>
      <Text style={styles.emptySubtitle}>
        Be the first to set a {selectedType} record!
      </Text>
      <TouchableOpacity
        style={styles.startRunButton}
        onPress={() => router.push('/timer')}
      >
        <LinearGradient
          colors={['#FF6B35', '#E91E63']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.startRunGradient}
        >
          <Ionicons name="play" size={20} color="#fff" />
          <Text style={styles.startRunText}>Start a Run</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <LinearGradient
        colors={['#FFD700', '#FF6B35']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Ionicons name="trophy" size={32} color="#fff" />
            <Text style={styles.headerTitle}>Leaderboard</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      {/* Type Selector */}
      <View style={styles.typeSelector}>
        {types.map((type) => (
          <TouchableOpacity
            key={type.type}
            style={[
              styles.typeButton,
              selectedType === type.type && { backgroundColor: type.color },
            ]}
            onPress={() => setSelectedType(type.type)}
          >
            <Ionicons name={type.icon as any} size={18} color={selectedType === type.type ? '#fff' : '#888'} />
            <Text
              style={[
                styles.typeButtonText,
                selectedType === type.type && styles.typeButtonTextActive,
              ]}
            >
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats Banner */}
      {leaderboard.length > 0 && (
        <View style={styles.statsBanner}>
          <View style={styles.statItem}>
            <Ionicons name="people" size={20} color="#FF6B35" />
            <Text style={styles.statValue}>{leaderboard.length}</Text>
            <Text style={styles.statLabel}>Entries</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="flash" size={20} color="#4CAF50" />
            <Text style={styles.statValue}>
              {leaderboard[0]?.time.toFixed(2)}s
            </Text>
            <Text style={styles.statLabel}>Best Time</Text>
          </View>
        </View>
      )}

      {/* Leaderboard List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading rankings...</Text>
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item.id}
          renderItem={renderLeaderboardItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF6B35"
            />
          }
        />
      )}

      {/* Admin Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContainer, { paddingBottom: insets.bottom + 20 }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Edit Run</Text>
                <Text style={styles.modalSubtitle}>
                  {editingEntry?.nickname || editingEntry?.userName}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {/* Car Info */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Car Info</Text>
                <TextInput
                  style={styles.formInput}
                  value={editForm.carInfo}
                  onChangeText={(t) => setEditForm(prev => ({ ...prev, carInfo: t }))}
                  placeholder="e.g. 2024 Ford Mustang GT"
                  placeholderTextColor="#555"
                />
              </View>

              {/* Location */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Location</Text>
                <TextInput
                  style={styles.formInput}
                  value={editForm.location}
                  onChangeText={(t) => setEditForm(prev => ({ ...prev, location: t }))}
                  placeholder="e.g. Thunder Valley Raceway"
                  placeholderTextColor="#555"
                />
              </View>

              {/* Times Section */}
              <Text style={styles.formSectionTitle}>Performance Times (seconds)</Text>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>0-60 mph</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editForm.zeroToSixty}
                    onChangeText={(t) => setEditForm(prev => ({ ...prev, zeroToSixty: t }))}
                    placeholder="e.g. 4.25"
                    placeholderTextColor="#555"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>0-100 mph</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editForm.zeroToHundred}
                    onChangeText={(t) => setEditForm(prev => ({ ...prev, zeroToHundred: t }))}
                    placeholder="e.g. 9.80"
                    placeholderTextColor="#555"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>1/4 Mile</Text>
                <TextInput
                  style={styles.formInput}
                  value={editForm.quarterMile}
                  onChangeText={(t) => setEditForm(prev => ({ ...prev, quarterMile: t }))}
                  placeholder="e.g. 12.50"
                  placeholderTextColor="#555"
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Save / Cancel */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setShowEditModal(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={handleSaveEdit}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color="#fff" />
                      <Text style={styles.saveBtnText}>Save Changes</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  headerGradient: {
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 10,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  typeButtonText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  statsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 20,
    borderRadius: 16,
    gap: 30,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: '#333',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#888',
  },
  listContent: {
    padding: 20,
    paddingTop: 20,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  topThreeItem: {
    borderWidth: 1,
    borderColor: '#333',
  },
  rankContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  entryDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  carInfo: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#666',
  },
  metaDot: {
    fontSize: 11,
    color: '#666',
    marginHorizontal: 4,
  },
  timeContainer: {
    alignItems: 'center',
    marginRight: 4,
  },
  timeValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  timeUnit: {
    fontSize: 12,
    color: '#888',
    marginTop: -4,
  },
  adminActions: {
    flexDirection: 'column',
    gap: 6,
    marginLeft: 6,
  },
  adminEditButton: {
    padding: 7,
    backgroundColor: 'rgba(33,150,243,0.12)',
    borderRadius: 8,
  },
  adminDeleteButton: {
    padding: 7,
    backgroundColor: 'rgba(255,59,48,0.12)',
    borderRadius: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  startRunButton: {
    marginTop: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  startRunGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    gap: 10,
  },
  startRunText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  formSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF6B35',
    marginTop: 16,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 6,
    fontWeight: '600',
  },
  formInput: {
    backgroundColor: '#252525',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#aaa',
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
