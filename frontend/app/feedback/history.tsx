import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Feedback {
  id: string;
  type: string;
  subject: string;
  message: string;
  status: string;
  adminResponse?: string;
  createdAt: string;
  updatedAt?: string;
}

const statusColors: { [key: string]: string } = {
  new: '#2196F3',
  in_progress: '#FFC107',
  resolved: '#4CAF50',
  closed: '#666',
};

const typeIcons: { [key: string]: string } = {
  bug: 'bug',
  suggestion: 'bulb',
  other: 'mail',
};

export default function FeedbackHistoryScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchFeedback();
    }
  }, [user]);

  const fetchFeedback = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/feedback/user/${user?.id}`);
      setFeedbackList(response.data);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <LinearGradient
        colors={['#FF6B35', '#E91E63']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Feedback History</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : feedbackList.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-outline" size={64} color="#333" />
          <Text style={styles.emptyTitle}>No Feedback Yet</Text>
          <Text style={styles.emptyText}>
            You haven't submitted any feedback yet. Go to your Garage to report bugs or suggest features!
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {feedbackList.map((feedback) => (
            <View key={feedback.id} style={styles.feedbackCard}>
              <View style={styles.cardHeader}>
                <View style={styles.typeContainer}>
                  <Ionicons 
                    name={typeIcons[feedback.type] as any || 'chatbubble'} 
                    size={20} 
                    color="#FF6B35" 
                  />
                  <Text style={styles.typeText}>
                    {feedback.type.charAt(0).toUpperCase() + feedback.type.slice(1)}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColors[feedback.status] || '#666' }]}>
                  <Text style={styles.statusText}>
                    {feedback.status.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.feedbackSubject}>{feedback.subject}</Text>
              <Text style={styles.feedbackMessage} numberOfLines={3}>{feedback.message}</Text>
              
              <Text style={styles.dateText}>
                Submitted: {formatDate(feedback.createdAt)}
              </Text>

              {feedback.adminResponse ? (
                <View style={styles.adminResponseSection}>
                  <View style={styles.responseHeader}>
                    <Ionicons name="shield-checkmark" size={16} color="#FF6B35" />
                    <Text style={styles.responseLabel}>Admin Response</Text>
                  </View>
                  <Text style={styles.responseText}>{feedback.adminResponse}</Text>
                  {feedback.updatedAt ? (
                    <Text style={styles.responseDateText}>
                      Responded: {formatDate(feedback.updatedAt)}
                    </Text>
                  ) : null}
                </View>
              ) : null}
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
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
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  feedbackCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  feedbackSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  feedbackMessage: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 12,
    color: '#666',
  },
  adminResponseSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B35',
  },
  responseText: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
  },
  responseDateText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
});
