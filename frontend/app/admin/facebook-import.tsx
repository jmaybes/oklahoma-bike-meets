import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../utils/api';

interface ImportResult {
  title: string;
  date: string;
  id: string;
}

export default function FacebookImportScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [jsonInput, setJsonInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{
    message: string;
    eventsCreated: number;
    eventsSkipped: number;
    events: ImportResult[];
    totalPostsAnalyzed: number;
  } | null>(null);

  const isAdmin = (user as any)?.isAdmin === true;

  if (!isAdmin) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Access Denied</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={48} color="#666" />
          <Text style={styles.errorText}>Admin access required</Text>
        </View>
      </View>
    );
  }

  const handleImport = async () => {
    if (!jsonInput.trim()) {
      Alert.alert('Empty Input', 'Please paste your Apify JSON results first.');
      return;
    }

    let posts;
    try {
      posts = JSON.parse(jsonInput.trim());
      if (!Array.isArray(posts)) {
        Alert.alert('Invalid Format', 'The JSON must be an array of post objects.');
        return;
      }
    } catch (e) {
      Alert.alert('Invalid JSON', 'Could not parse the input. Make sure it\'s valid JSON.');
      return;
    }

    setImporting(true);
    setResults(null);

    try {
      const response = await axios.post(`${API_URL}/api/events/import-facebook-posts`, {
        posts: posts,
      }, { timeout: 120000 }); // 2 min timeout for GPT processing

      setResults(response.data);

      if (response.data.eventsCreated > 0) {
        Alert.alert(
          'Import Complete!',
          `${response.data.eventsCreated} events created from ${response.data.totalPostsAnalyzed} posts analyzed.\n\nEvents are pending admin approval.`
        );
      } else {
        Alert.alert(
          'No Events Found',
          `Analyzed ${response.data.totalPostsAnalyzed} posts but no bike events were identified. ${response.data.eventsSkipped} duplicates were skipped.`
        );
      }
    } catch (error: any) {
      console.error('Import error:', error);
      Alert.alert('Import Failed', error.response?.data?.detail || 'An error occurred during import.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Facebook Import</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Instructions */}
          <View style={styles.infoCard}>
            <LinearGradient
              colors={['#1877F2', '#0D47A1']}
              style={styles.infoGradient}
            >
              <Ionicons name="logo-facebook" size={32} color="#fff" />
              <Text style={styles.infoTitle}>Import Events from Facebook</Text>
              <Text style={styles.infoText}>
                Paste the JSON output from your Apify Facebook Groups Scraper below. GPT will analyze each post, identify bike event announcements, and create them automatically.
              </Text>
            </LinearGradient>
          </View>

          {/* Steps */}
          <View style={styles.stepsCard}>
            <Text style={styles.stepsTitle}>How it works</Text>
            <View style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
              <Text style={styles.stepText}>Run your Apify scraper on Facebook groups</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
              <Text style={styles.stepText}>Copy the JSON results from Apify</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
              <Text style={styles.stepText}>Paste it below and tap "Import"</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>4</Text></View>
              <Text style={styles.stepText}>GPT identifies events → appear in Pending Events for approval</Text>
            </View>
          </View>

          {/* JSON Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Apify JSON Output</Text>
            <TextInput
              style={styles.jsonInput}
              value={jsonInput}
              onChangeText={setJsonInput}
              placeholder={'[\n  {\n    "text": "Car meet this Saturday...",\n    "groupName": "Oklahoma Bike Meets",\n    "timestamp": "2026-04-10"\n  }\n]'}
              placeholderTextColor="#444"
              multiline
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.inputHint}>
              {jsonInput.trim() ? `${jsonInput.length.toLocaleString()} characters` : 'Paste your Apify results here'}
            </Text>
          </View>

          {/* Results */}
          {results && (
            <View style={styles.resultsCard}>
              <Text style={styles.resultsTitle}>Import Results</Text>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{results.totalPostsAnalyzed}</Text>
                  <Text style={styles.statLabel}>Posts Analyzed</Text>
                </View>
                <View style={[styles.statBox, { borderColor: '#4CAF50' }]}>
                  <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{results.eventsCreated}</Text>
                  <Text style={styles.statLabel}>Events Created</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{results.eventsSkipped}</Text>
                  <Text style={styles.statLabel}>Skipped</Text>
                </View>
              </View>

              {results.events && results.events.length > 0 && (
                <View style={styles.eventsList}>
                  <Text style={styles.eventsListTitle}>Created Events:</Text>
                  {results.events.map((ev, idx) => (
                    <View key={idx} style={styles.eventItem}>
                      <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.eventItemTitle}>{ev.title}</Text>
                        <Text style={styles.eventItemDate}>{ev.date}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Import Button */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={styles.importBtn}
            onPress={handleImport}
            disabled={importing || !jsonInput.trim()}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={importing ? ['#555', '#444'] : ['#1877F2', '#0D47A1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.importGradient}
            >
              {importing ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.importText}>Analyzing with GPT...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={22} color="#fff" />
                  <Text style={styles.importText}>Import & Analyze Posts</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#141414',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    color: '#999',
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },

  // Info card
  infoCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  infoGradient: {
    padding: 24,
    alignItems: 'center',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginTop: 12,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Steps
  stepsCard: {
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  stepsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1877F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  stepText: {
    flex: 1,
    color: '#ccc',
    fontSize: 14,
  },

  // Input
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#aaa',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  jsonInput: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    minHeight: 200,
    maxHeight: 400,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  inputHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#666',
  },

  // Results
  resultsCard: {
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginBottom: 16,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#222',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#E31837',
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  eventsList: {
    marginTop: 4,
  },
  eventsListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#aaa',
    marginBottom: 10,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#252525',
  },
  eventItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  eventItemDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  importBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  importGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  importText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});
