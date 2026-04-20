import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';

export default function BroadcastScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    messagesSent: number;
    pushNotificationsSent: number;
    totalUsers: number;
  } | null>(null);

  const sendBroadcast = async () => {
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }

    Alert.alert(
      'Confirm Broadcast',
      'This will send your message to ALL users. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send to All',
          style: 'default',
          onPress: async () => {
            setSending(true);
            setResult(null);
            try {
              const res = await api.post(
                `/admin/broadcast?admin_id=${user?.id}`,
                { content: message.trim() }
              );
              setResult(res.data);
              Alert.alert(
                'Broadcast Sent!',
                `Message delivered to ${res.data.messagesSent} users.\n${res.data.pushNotificationsSent} push notifications sent.`
              );
            } catch (err: any) {
              const msg = err?.response?.data?.detail || 'Failed to send broadcast';
              Alert.alert('Error', msg);
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Broadcast Message</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Info Card */}
          <View style={styles.infoCard}>
            <Ionicons name="megaphone" size={24} color="#51fb00" />
            <Text style={styles.infoText}>
              Send a message to every user from your admin account. They'll see it in their Messages inbox and receive a push notification if enabled.
            </Text>
          </View>

          {/* Message Input */}
          <Text style={styles.label}>Message</Text>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            placeholder="Type your message to all users..."
            placeholderTextColor="#666"
            multiline
            maxLength={5000}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>
            {message.length} / 5000
          </Text>

          {/* Result Card */}
          {result && (
            <View style={styles.resultCard}>
              <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
              <View style={{ flex: 1 }}>
                <Text style={styles.resultTitle}>Broadcast Complete</Text>
                <Text style={styles.resultDetail}>
                  Messages sent: {result.messagesSent} / {result.totalUsers}
                </Text>
                <Text style={styles.resultDetail}>
                  Push notifications: {result.pushNotificationsSent}
                </Text>
              </View>
            </View>
          )}

          {/* Send Button */}
          <TouchableOpacity
            style={[styles.sendButton, (!message.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendBroadcast}
            disabled={!message.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={styles.sendButtonText}>Send to All Users</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#51fb0030',
  },
  infoText: {
    flex: 1,
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 16,
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    minHeight: 180,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  charCount: {
    color: '#555',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
    marginBottom: 20,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#1a2e1a',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#4CAF5040',
  },
  resultTitle: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  resultDetail: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 18,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#51fb00',
    borderRadius: 14,
    paddingVertical: 16,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
