import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BETA_NOTICE_KEY = '@okc_car_events_beta_notice_v1';

export default function BetaNoticeModal() {
  const [visible, setVisible] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    checkIfFirstLaunch();
  }, []);

  const checkIfFirstLaunch = async () => {
    try {
      const hasSeenNotice = await AsyncStorage.getItem(BETA_NOTICE_KEY);
      if (!hasSeenNotice) {
        setVisible(true);
      }
    } catch (error) {
      console.error('Error checking beta notice:', error);
    }
  };

  const handleDismiss = async () => {
    if (!acknowledged) return;
    
    try {
      await AsyncStorage.setItem(BETA_NOTICE_KEY, 'true');
      setVisible(false);
    } catch (error) {
      console.error('Error saving beta notice state:', error);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Gradient Border Wrapper */}
        <LinearGradient
          colors={['#FF6B35', '#E91E63', '#9C27B0', '#FF6B35']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBorder}
        >
          <View style={styles.container}>
            {/* Header */}
            <LinearGradient
              colors={['#FF6B35', '#E91E63']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.header}
            >
            <View style={styles.versionBadge}>
              <Text style={styles.versionText}>v1.0.0</Text>
            </View>
            <Ionicons name="rocket" size={48} color="#fff" />
            <Text style={styles.headerTitle}>Welcome to OKC Car Events!</Text>
            <Text style={styles.betaBadge}>BETA VERSION</Text>
          </LinearGradient>

          {/* Content */}
          <View style={styles.content}>
            <View style={styles.messageContainer}>
              <Ionicons name="information-circle" size={24} color="#FF6B35" style={styles.infoIcon} />
              <Text style={styles.messageText}>
                Thank you for being an early user of our app! This is a <Text style={styles.highlight}>beta version</Text>, which means you may encounter bugs or incomplete features as we continue to improve.
              </Text>
            </View>

            <View style={styles.featureBox}>
              <View style={styles.featureHeader}>
                <Ionicons name="chatbubble-ellipses" size={20} color="#FF6B35" />
                <Text style={styles.featureTitle}>Your Feedback Matters!</Text>
              </View>
              <Text style={styles.featureText}>
                Please use the <Text style={styles.highlight}>"Report Suggestions & Bugs"</Text> feature in your <Text style={styles.highlight}>My Garage</Text> to notify us of:
              </Text>
              <View style={styles.bulletList}>
                <View style={styles.bulletItem}>
                  <Ionicons name="bug" size={16} color="#F44336" />
                  <Text style={styles.bulletText}>Any bugs or issues you encounter</Text>
                </View>
                <View style={styles.bulletItem}>
                  <Ionicons name="bulb" size={16} color="#FFC107" />
                  <Text style={styles.bulletText}>Feature suggestions or improvements</Text>
                </View>
                <View style={styles.bulletItem}>
                  <Ionicons name="car-sport" size={16} color="#2196F3" />
                  <Text style={styles.bulletText}>Events or clubs we should add</Text>
                </View>
              </View>
            </View>

            {/* Checkbox */}
            <TouchableOpacity 
              style={styles.checkboxContainer}
              onPress={() => setAcknowledged(!acknowledged)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, acknowledged && styles.checkboxChecked]}>
                {acknowledged && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Text style={styles.checkboxLabel}>
                I understand this is a beta version and this notice will not appear again
              </Text>
            </TouchableOpacity>

            {/* Continue Button */}
            <TouchableOpacity
              style={[styles.continueButton, !acknowledged && styles.continueButtonDisabled]}
              onPress={handleDismiss}
              disabled={!acknowledged}
            >
              <Text style={[styles.continueButtonText, !acknowledged && styles.continueButtonTextDisabled]}>
                Continue to App
              </Text>
              <Ionicons 
                name="arrow-forward" 
                size={20} 
                color={acknowledged ? "#fff" : "#666"} 
              />
            </TouchableOpacity>
          </View>
        </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  gradientBorder: {
    borderRadius: 24,
    padding: 3,
    width: '100%',
    maxWidth: 400,
  },
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 21,
    overflow: 'hidden',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    padding: 24,
    paddingTop: 32,
  },
  versionBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  versionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
    textAlign: 'center',
  },
  betaBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
    letterSpacing: 1,
  },
  content: {
    padding: 20,
  },
  messageContainer: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  messageText: {
    flex: 1,
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
  highlight: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  featureBox: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  featureTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  featureText: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  bulletList: {
    gap: 8,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulletText: {
    color: '#ccc',
    fontSize: 13,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#555',
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  checkboxLabel: {
    flex: 1,
    color: '#aaa',
    fontSize: 13,
    lineHeight: 20,
  },
  continueButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueButtonDisabled: {
    backgroundColor: '#333',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  continueButtonTextDisabled: {
    color: '#666',
  },
});
