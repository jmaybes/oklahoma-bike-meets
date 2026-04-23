import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, RobotoCondensed_700Bold } from '@expo-google-fonts/roboto-condensed';
import axios from 'axios';

const { width, height } = Dimensions.get('window');
import { API_URL } from '../utils/api';

export default function LandingScreen() {
  const [fontsLoaded] = useFonts({
    RobotoCondensed_700Bold,
  });
  
  const [stats, setStats] = useState({ events: 0, clubs: 0 });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [eventsRes, clubsRes] = await Promise.all([
        axios.get(`${API_URL}/api/events`),
        axios.get(`${API_URL}/api/clubs`),
      ]);
      setStats({
        events: eventsRes.data?.length || 0,
        clubs: clubsRes.data?.length || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const markLandingSeen = async () => {
    try {
      await AsyncStorage.setItem('hasSeenLanding', 'true');
    } catch (error) {
      console.error('Error marking landing as seen:', error);
    }
  };

  const handleContinueAsGuest = async () => {
    await markLandingSeen();
    router.replace('/(tabs)/home');
  };

  const handleSignUp = async () => {
    await markLandingSeen();
    router.push('/auth/register');
  };

  const handleLogin = async () => {
    await markLandingSeen();
    router.push('/auth/login');
  };

  const features = [
    {
      icon: 'garage-custom',  // Custom image
      title: 'My Garage',
      description: 'Showcase your ride with photos and specs',
      color: '#E31837',
    },
    {
      icon: 'trophy',
      title: 'Leaderboards',
      description: 'Compete with 0-60, 0-100 & 1/4 mile times',
      color: '#FFD700',
    },
    {
      icon: 'notifications',
      title: 'Pop Up Events',
      description: 'Get instant alerts for last-minute meets',
      color: '#FF3B30',
    },
    {
      icon: 'people',
      title: 'Messaging',
      description: 'Connect with fellow riders',
      color: '#2196F3',
    },
    {
      icon: 'location',
      title: 'Location Sharing',
      description: 'Find bike meets and cruises near you',
      color: '#EFFF00',
    },
    {
      icon: 'heart',
      title: 'Save Favorites',
      description: 'Bookmark events and clubs you love',
      color: '#E31837',
    },
  ];

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E31837" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Hero Section with Sport Bikes */}
      <View style={styles.heroSection}>
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200&q=80' }}
          style={styles.heroBackground}
          resizeMode="cover"
        >
          <View style={styles.heroOverlay}>
            <View style={styles.heroContent}>
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../assets/images/sport-bike-logo.png')} 
                  style={styles.heroLogo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.heroTitle}>Oklahoma Bike Events</Text>
              <Text style={styles.heroTitleSub}>& Clubs</Text>
              <Text style={styles.heroSubtitle}>
                Your Ultimate Motorcycle Community Hub
              </Text>
              <View style={styles.taglineContainer}>
                <Ionicons name="flame" size={20} color="#E31837" />
                <Text style={styles.tagline}>
                  Meets • Shows • Cruises • Races
                </Text>
              </View>
            </View>
          </View>
        </ImageBackground>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Community Preview */}
        <View style={styles.communitySection}>
          <ImageBackground
            source={require('../assets/images/community-bikes.jpg')}
            style={styles.communityImage}
            imageStyle={styles.communityImageStyle}
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)']}
              style={styles.communityOverlay}
            >
              <Text style={styles.communityTitle}>Join 1000+ Enthusiasts</Text>
              <Text style={styles.communitySubtitle}>
                Oklahoma's largest motorcycle community
              </Text>
            </LinearGradient>
          </ImageBackground>
        </View>

        {/* Features Grid */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Unlock Premium Features</Text>
          <Text style={styles.sectionSubtitle}>
            Create a free account to access everything
          </Text>

          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureCard}>
                <View style={[styles.featureIcon, { backgroundColor: `${feature.color}20` }]}>
                  {feature.icon === 'garage-custom' ? (
                    <Image 
                      source={require('../assets/images/garage-icon.png')} 
                      style={{ width: 32, height: 32 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <Ionicons name={feature.icon as any} size={28} color={feature.color} />
                  )}
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.events}</Text>
            <Text style={styles.statLabel}>Events</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.clubs}</Text>
            <Text style={styles.statLabel}>Bike Clubs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>24/7</Text>
            <Text style={styles.statLabel}>Updates</Text>
          </View>
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1609630875171-b1321377ee65?w=800&q=80' }}
            style={styles.ctaBackground}
            imageStyle={styles.ctaImageStyle}
          >
            <LinearGradient
              colors={['rgba(255,107,53,0.9)', 'rgba(233,30,99,0.9)']}
              style={styles.ctaOverlay}
            >
              <Image 
                source={require('../assets/images/sport-bike-logo.png')} 
                style={styles.ctaLogo}
                resizeMode="contain"
              />
              <Text style={styles.ctaTitle}>Ready to Rev Up?</Text>
              <Text style={styles.ctaSubtitle}>
                Join Oklahoma's most active motorcycle community
              </Text>
            </LinearGradient>
          </ImageBackground>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.signUpButton}
            onPress={handleSignUp}
          >
            <LinearGradient
              colors={['#E31837', '#E31837']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <Text style={styles.signUpButtonText}>Create Account</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
          >
            <Text style={styles.loginButtonText}>Already have an account? Login</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleContinueAsGuest}
          >
            <Text style={styles.skipButtonText}>Continue as Guest</Text>
            <Ionicons name="chevron-forward" size={16} color="#666" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0c0c0c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroSection: {
    height: height * 0.42,
    width: width,
  },
  heroBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  logoContainer: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 10,
    marginBottom: 0,
  },
  heroLogo: {
    width: 140,
    height: 140,
  },
  heroTitle: {
    fontSize: 36,
    fontFamily: 'RobotoCondensed_700Bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 0,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  heroTitleSub: {
    fontSize: 32,
    fontFamily: 'RobotoCondensed_700Bold',
    color: '#E31837',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#ddd',
    textAlign: 'center',
    marginBottom: 12,
  },
  taglineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagline: {
    fontSize: 14,
    color: '#E31837',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  communitySection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  communityImage: {
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
  },
  communityImageStyle: {
    borderRadius: 16,
  },
  communityOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  communityTitle: {
    fontSize: 28,
    fontFamily: 'RobotoCondensed_700Bold',
    color: '#fff',
    marginBottom: 4,
  },
  communitySubtitle: {
    fontSize: 14,
    color: '#ddd',
  },
  featuresSection: {
    padding: 20,
    paddingTop: 32,
  },
  sectionTitle: {
    fontSize: 28,
    fontFamily: 'RobotoCondensed_700Bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: (width - 56) / 2,
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontFamily: 'RobotoCondensed_700Bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    lineHeight: 16,
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#141414',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 24,
    borderRadius: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 36,
    fontFamily: 'RobotoCondensed_700Bold',
    color: '#E31837',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#333',
  },
  ctaSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    height: 180,
  },
  ctaBackground: {
    flex: 1,
  },
  ctaImageStyle: {
    borderRadius: 20,
  },
  ctaOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  ctaLogo: {
    width: 80,
    height: 80,
    marginBottom: 4,
  },
  ctaTitle: {
    fontSize: 32,
    fontFamily: 'RobotoCondensed_700Bold',
    color: '#fff',
    marginTop: 12,
    marginBottom: 8,
  },
  ctaSubtitle: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
  },
  actionButtons: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  signUpButton: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 8,
  },
  signUpButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  loginButton: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#141414',
    alignItems: 'center',
    marginBottom: 12,
  },
  loginButtonText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 4,
  },
  skipButtonText: {
    fontSize: 14,
    color: '#666',
  },
});
