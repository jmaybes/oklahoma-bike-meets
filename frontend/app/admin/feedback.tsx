import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Feedback {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: 'bug' | 'suggestion' | 'other';
  subject: string;
  message: string;
  status: 'new' | 'in_progress' | 'resolved' | 'closed';
  adminResponse: string | null;
  createdAt: string;
  updatedAt: string | null;
}

const statusColors: Record<string, string> = {
  new: '#FF6B35',
  in_progress: '#2196F3',
  resolved: '#4CAF50',
  closed: '#888',
};

const typeIcons: Record<string, { icon: string; color: string }> = {
  bug: { icon: 'bug', color: '#F44336' },
  suggestion: { icon: 'bulb', color: '#FFC107' },
  other: { icon: 'mail', color: '#2196F3' },
};

export default function AdminFeedbackScreen() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user?.isAdmin) {
      fetchFeedback();
    }
  }, [isAuthenticated, user]);

  const fetchFeedback = async () => {
    try {
      const statusParam = selectedFilter !== 'all' ? `?status=${selectedFilter}` : '';
      const response = await axios.get(`${API_URL}/api/feedback/admin${statusParam}`);
      setFeedbackList(response.data);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeedback();
  };

  const handleFilterChange = (filter: string) => {
    setSelectedFilter(filter);
    setLoading(true);
    setTimeout(() => fetchFeedback(), 100);
  };

  const openFeedbackDetail = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setResponseText(feedback.adminResponse || '');
    setShowDetailModal(true);
  };

  const updateStatus = async (feedbackId: string, newStatus: string) => {
    try {
      await axios.put(`${API_URL}/api/feedback/${feedbackId}/status?status=${newStatus}`);
      fetchFeedback();
      if (selectedFeedback?.id === feedbackId) {
        setSelectedFeedback({ ...selectedFeedback, status: newStatus as any });
      }
      Alert.alert('Success', `Status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const sendResponse = async () => {
    if (!selectedFeedback || !responseText.trim()) {
      Alert.alert('Error', 'Please enter a response');
      return;
    }

    setResponding(true);
    try {
      await axios.put(
        `${API_URL}/api/feedback/${selectedFeedback.id}/respond?response=${encodeURIComponent(responseText)}&status=in_progress`
      );
      fetchFeedback();
      Alert.alert('Success', 'Response sent to user');
      setShowDetailModal(false);
    } catch (error) {
      console.error('Error sending response:', error);
      Alert.alert('Error', 'Failed to send response');
    } finally {
      setResponding(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStats = () => {
    const stats = {
      total: feedbackList.length,
      new: feedbackList.filter(f => f.status === 'new').length,
      inProgress: feedbackList.filter(f => f.status === 'in_progress').length,
      resolved: feedbackList.filter(f => f.status === 'resolved').length,
    };
    return stats;
  };

  if (authLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (!isAuthenticated || !user?.isAdmin) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={64} color="#F44336" />
          <Text style={styles.errorText}>Admin Access Required</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const stats = getStats();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient
        colors={['#FF6B35', '#E91E63']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Feedback Manager</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Ionicons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, { borderColor: '#FF6B35' }]}>
          <Text style={[styles.statNumber, { color: '#FF6B35' }]}>{stats.new}</Text>
          <Text style={styles.statLabel}>New</Text>
        </View>
        <View style={[styles.statCard, { borderColor: '#2196F3' }]}>
          <Text style={[styles.statNumber, { color: '#2196F3' }]}>{stats.inProgress}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        <View style={[styles.statCard, { borderColor: '#4CAF50' }]}>
          <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{stats.resolved}</Text>
          <Text style={styles.statLabel}>Resolved</Text>
        </View>
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
        {['all', 'new', 'in_progress', 'resolved', 'closed'].map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterButton,
              selectedFilter === filter && styles.filterButtonActive,
            ]}
            onPress={() => handleFilterChange(filter)}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedFilter === filter && styles.filterButtonTextActive,
              ]}
            >
              {filter === 'in_progress' ? 'In Progress' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Feedback List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />
          }
        >
          {feedbackList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-ellipses-outline" size={64} color="#333" />
              <Text style={styles.emptyText}>No feedback found</Text>
            </View>
          ) : (
            feedbackList.map((feedback) => (
              <TouchableOpacity
                key={feedback.id}
                style={styles.feedbackCard}
                onPress={() => openFeedbackDetail(feedback)}
              >
                <View style={styles.feedbackHeader}>
                  <View style={styles.typeContainer}>
                    <Ionicons
                      name={typeIcons[feedback.type]?.icon as any || 'mail'}
                      size={20}
                      color={typeIcons[feedback.type]?.color || '#888'}
                    />
                    <Text style={styles.typeText}>
                      {feedback.type.charAt(0).toUpperCase() + feedback.type.slice(1)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColors[feedback.status] }]}>
                    <Text style={styles.statusText}>
                      {feedback.status === 'in_progress' ? 'In Progress' : feedback.status.charAt(0).toUpperCase() + feedback.status.slice(1)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.feedbackSubject}>{feedback.subject}</Text>
                <Text style={styles.feedbackMessage} numberOfLines={2}>
                  {feedback.message}
                </Text>

                <View style={styles.feedbackFooter}>
                  <Text style={styles.feedbackUser}>
                    {feedback.userName} ({feedback.userEmail})
                  </Text>
                  <Text style={styles.feedbackDate}>{formatDate(feedback.createdAt)}</Text>
                </View>

                {feedback.adminResponse && (
                  <View style={styles.responseIndicator}>
                    <Ionicons name="chatbubble-ellipses" size={14} color="#4CAF50" />
                    <Text style={styles.responseIndicatorText}>Response sent</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Feedback Details</Text>
            <View style={{ width: 28 }} />
          </View>

          {selectedFeedback && (
            <ScrollView style={styles.modalContent}>
              {/* Type & Status */}
              <View style={styles.detailRow}>
                <View style={styles.typeContainerLarge}>
                  <Ionicons
                    name={typeIcons[selectedFeedback.type]?.icon as any}
                    size={24}
                    color={typeIcons[selectedFeedback.type]?.color}
                  />
                  <Text style={styles.typeTextLarge}>
                    {selectedFeedback.type.charAt(0).toUpperCase() + selectedFeedback.type.slice(1)}
                  </Text>
                </View>
                <View style={[styles.statusBadgeLarge, { backgroundColor: statusColors[selectedFeedback.status] }]}>
                  <Text style={styles.statusTextLarge}>{selectedFeedback.status.replace('_', ' ')}</Text>
                </View>
              </View>

              {/* Subject */}
              <Text style={styles.detailLabel}>Subject</Text>
              <Text style={styles.detailSubject}>{selectedFeedback.subject}</Text>

              {/* Message */}
              <Text style={styles.detailLabel}>Message</Text>
              <View style={styles.messageBox}>
                <Text style={styles.detailMessage}>{selectedFeedback.message}</Text>
              </View>

              {/* User Info */}
              <Text style={styles.detailLabel}>From</Text>
              <View style={styles.userInfoBox}>
                <Ionicons name="person-circle" size={24} color="#FF6B35" />
                <View>
                  <Text style={styles.userName}>{selectedFeedback.userName}</Text>
                  <Text style={styles.userEmail}>{selectedFeedback.userEmail}</Text>
                </View>
              </View>

              {/* Date */}
              <Text style={styles.detailLabel}>Submitted</Text>
              <Text style={styles.detailDate}>{formatDate(selectedFeedback.createdAt)}</Text>

              {/* Existing Response */}
              {selectedFeedback.adminResponse && (
                <>
                  <Text style={styles.detailLabel}>Previous Response</Text>
                  <View style={styles.existingResponse}>
                    <Text style={styles.existingResponseText}>{selectedFeedback.adminResponse}</Text>
                  </View>
                </>
              )}

              {/* Status Actions */}
              <Text style={styles.detailLabel}>Update Status</Text>
              <View style={styles.statusActions}>
                {['new', 'in_progress', 'resolved', 'closed'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusActionButton,
                      selectedFeedback.status === status && styles.statusActionButtonActive,
                      { borderColor: statusColors[status] },
                    ]}
                    onPress={() => updateStatus(selectedFeedback.id, status)}
                  >
                    <Text
                      style={[
                        styles.statusActionText,
                        selectedFeedback.status === status && { color: '#fff' },
                        { color: statusColors[status] },
                      ]}
                    >
                      {status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Response Input */}
              <Text style={styles.detailLabel}>Send Response to User</Text>
              <TextInput
                style={styles.responseInput}
                placeholder="Type your response here..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={4}
                value={responseText}
                onChangeText={setResponseText}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.sendButton, responding && styles.sendButtonDisabled]}
                onPress={sendResponse}
                disabled={responding}
              >
                {responding ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={20} color="#fff" />
                    <Text style={styles.sendButtonText}>Send Response</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
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
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBackButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#FF6B35',
  },
  filterButtonText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    marginTop: 16,
  },
  feedbackCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeText: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  feedbackSubject: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  feedbackMessage: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
  },
  feedbackFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  feedbackUser: {
    fontSize: 12,
    color: '#666',
  },
  feedbackDate: {
    fontSize: 12,
    color: '#666',
  },
  responseIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  responseIndicatorText: {
    fontSize: 12,
    color: '#4CAF50',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
  },
  backButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalContent: {
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  typeContainerLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeTextLarge: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadgeLarge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusTextLarge: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  detailLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailSubject: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  messageBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  detailMessage: {
    color: '#ccc',
    fontSize: 15,
    lineHeight: 24,
  },
  userInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  userName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  userEmail: {
    color: '#888',
    fontSize: 13,
  },
  detailDate: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 16,
  },
  existingResponse: {
    backgroundColor: '#1a3a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  existingResponseText: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 22,
  },
  statusActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  statusActionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#1a1a1a',
  },
  statusActionButtonActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  statusActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  responseInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 15,
    minHeight: 120,
    marginBottom: 16,
  },
  sendButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 40,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
