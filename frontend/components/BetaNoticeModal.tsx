import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  FadeOut,
} from 'react-native-reanimated';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const BETA_NOTICE_KEY = '@okc_bike_meets_beta_notice_v1';

// For testing/development - set to true to auto-dismiss modal
const DEV_AUTO_DISMISS = false;

export default function BetaNoticeModal() {
  const [visible, setVisible] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(true);
  const insets = useSafeAreaInsets();

  // Bounce animation for scroll indicator
  const bounceY = useSharedValue(0);

  useEffect(() => {
    bounceY.value = withRepeat(
      withSequence(
        withTiming(8, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false
    );
  }, []);

  const bounceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bounceY.value }],
  }));

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    // Hide the hint once user scrolls past 30% of the hidden content
    const scrollableHeight = contentSize.height - layoutMeasurement.height;
    if (scrollableHeight > 0 && contentOffset.y > scrollableHeight * 0.3) {
      setShowScrollHint(false);
    }
  };

  useEffect(() => {
    checkIfFirstLaunch();
  }, []);

  const checkIfFirstLaunch = async () => {
    try {
      const hasSeenNotice = await AsyncStorage.getItem(BETA_NOTICE_KEY);
      if (!hasSeenNotice) {
        if (DEV_AUTO_DISMISS) {
          await AsyncStorage.setItem(BETA_NOTICE_KEY, 'true');
          setVisible(false);
        } else {
          setVisible(true);
        }
      }
    } catch (error) {
      console.error('Error checking beta notice:', error);
      setVisible(false);
    }
  };

  const handleDismiss = async () => {
    if (!acknowledged) return;
    try {
      await AsyncStorage.setItem(BETA_NOTICE_KEY, 'true');
      setVisible(false);
    } catch (error) {
      console.error('Error saving beta notice state:', error);
      setVisible(false);
    }
  };

  const forceDismiss = async () => {
    try {
      await AsyncStorage.setItem(BETA_NOTICE_KEY, 'true');
    } catch (error) {
      console.error('Error force dismissing:', error);
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={[styles.overlay, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <LinearGradient
          colors={['#51fb00', '#E91E63', '#9C27B0', '#51fb00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBorder}
        >
          <View style={styles.container}>
            <ScrollView 
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={styles.scrollContent}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              {/* Header */}
              <LinearGradient
                colors={['#51fb00', '#E91E63']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.header}
              >
                <View style={styles.versionBadge}>
                  <Text style={styles.versionText}>v1.0.0</Text>
                </View>
                <Image 
                  source={require('../assets/images/okc-logo.png')} 
                  style={styles.logoIcon}
                  resizeMode="contain"
                />
                <Text style={styles.headerTitle}>Welcome to Oklahoma Bike Meets</Text>
                <Text style={styles.headerSubtitle}>Meets, Cruises, Shows & More!</Text>
              </LinearGradient>

              {/* Content */}
              <View style={styles.content}>
                {/* Feedback Box */}
                <View style={styles.featureBox}>
                  <View style={styles.featureHeader}>
                    <Ionicons name="chatbubble-ellipses" size={18} color="#51fb00" />
                    <Text style={styles.featureTitle}>Your Feedback Matters!</Text>
                  </View>
                  <Text style={styles.featureText}>
                    Please use the <Text style={styles.highlight}>"Report Suggestions & Bugs"</Text> feature in your <Text style={styles.highlight}>My Garage</Text> to notify us of:
                  </Text>
                  <View style={styles.bulletList}>
                    <View style={styles.bulletItem}>
                      <Ionicons name="bug" size={14} color="#F44336" />
                      <Text style={styles.bulletText}>Any bugs or issues you encounter</Text>
                    </View>
                    <View style={styles.bulletItem}>
                      <Ionicons name="bulb" size={14} color="#FFC107" />
                      <Text style={styles.bulletText}>Feature suggestions or improvements</Text>
                    </View>
                  </View>
                </View>

                {/* Privacy Notice */}
                <View style={styles.privacyBox}>
                  <View style={styles.privacyHeader}>
                    <Ionicons name="shield-checkmark" size={18} color="#4CAF50" />
                    <Text style={styles.privacyTitle}>Your Privacy Matters!</Text>
                  </View>
                  <Text style={styles.privacyText}>
                    We do not share your information with anyone and tracking can be turned off at anytime within the app.
                  </Text>
                  <Text style={[styles.privacyText, { marginTop: 8 }]}>
                    Please note: location and tracking is necessary to share your location with other users as well as see theirs, however, this information is never stored.
                  </Text>
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
                    I understand and this notice will not appear again
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

                {/* Skip link */}
                <TouchableOpacity
                  style={styles.skipLink}
                  onPress={forceDismiss}
                >
                  <Text style={styles.skipLinkText}>Skip for now</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Scroll Down Indicator */}
            {showScrollHint && (
              <Animated.View 
                style={styles.scrollHintOverlay}
                exiting={FadeOut.duration(300)}
                pointerEvents="none"
              >
                <LinearGradient
                  colors={['transparent', 'rgba(26, 26, 26, 0.95)', '#1a1a1a']}
                  style={styles.scrollHintGradient}
                >
                  <Animated.View style={[styles.scrollHintContent, bounceStyle]}>
                    <Ionicons name="chevron-down" size={20} color="#51fb00" />
                    <Text style={styles.scrollHintText}>Scroll down for more</Text>
                    <Ionicons name="chevron-down" size={20} color="#51fb00" />
                  </Animated.View>
                </LinearGradient>
              </Animated.View>
            )}
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
    paddingHorizontal: 16,
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
    maxHeight: SCREEN_HEIGHT * 0.82,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
  },
  logoIcon: {
    width: 70,
    height: 70,
    marginBottom: 4,
  },
  versionBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  versionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 5,
    textAlign: 'center',
    fontWeight: '600',
  },
  content: {
    padding: 14,
  },
  highlight: {
    color: '#51fb00',
    fontWeight: '600',
  },
  featureBox: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  featureTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  featureText: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  bulletList: {
    gap: 6,
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
  privacyBox: {
    backgroundColor: '#1a2e1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  privacyTitle: {
    color: '#4CAF50',
    fontSize: 17,
    fontWeight: '700',
  },
  privacyText: {
    color: '#a5d6a7',
    fontSize: 13,
    lineHeight: 19,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
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
    backgroundColor: '#51fb00',
    borderColor: '#51fb00',
  },
  checkboxLabel: {
    flex: 1,
    color: '#aaa',
    fontSize: 13,
    lineHeight: 20,
  },
  continueButton: {
    backgroundColor: '#51fb00',
    borderRadius: 12,
    padding: 14,
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
  skipLink: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  skipLinkText: {
    color: '#888',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  scrollHintOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: 21,
    borderBottomRightRadius: 21,
    overflow: 'hidden',
  },
  scrollHintGradient: {
    paddingTop: 40,
    paddingBottom: 12,
    alignItems: 'center',
  },
  scrollHintContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(225, 85, 0, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  scrollHintText: {
    color: '#51fb00',
    fontSize: 13,
    fontWeight: '600',
  },
});
