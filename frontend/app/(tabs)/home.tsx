import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  ScrollView,
  Platform,
  Pressable,
  Dimensions,
  ViewToken,
  Alert,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { API_URL } from '../../utils/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BASE_HERO_HEIGHT = 300;
const COLLAPSED_HEADER_HEIGHT = 60;

// ==================== STEALTH VELOCITY THEME ====================
const THEME = {
  // Backgrounds
  bg: '#0A0A0A',
  bgCard: '#141414',
  bgSurface: '#1E1E1E',
  bgElevated: '#252525',
  
  // Primary - Crimson Red
  primary: '#E31837',
  primaryDark: '#B81430',
  primaryLight: '#FF2D4D',
  
  // Secondary - Burnt Orange  
  secondary: '#FF6B35',
  
  // Text
  text: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textMuted: '#6B6B6B',
  
  // Status
  success: '#00C853',
  warning: '#FFB300',
  error: '#FF3D3D',
  
  // Borders
  border: '#2A2A2A',
};

// Sport bike hero images - aggressive, fast, sleek
const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200&q=80',  // Sport bike lean
  'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1200&q=80',    // Sleek profile
  'https://images.unsplash.com/photo-1558980664-769d59546b3d?w=1200&q=80',    // Racing stance
  'https://images.unsplash.com/photo-1609630875171-b1321377ee65?w=1200&q=80',  // Night rider
];

// OKC center coordinates (for default 20-mile radius filter)
const OKC_LAT = 35.4676;
const OKC_LON = -97.5164;
const DEFAULT_RADIUS_MILES = 20;

// Format date string for display (handles both "2025-06-15" and "2025-06-15T00:00:00")
const formatEventDate = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    // Strip time portion if present
    const cleanDate = dateStr.split('T')[0];
    const [year, month, day] = cleanDate.split('-').map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const date = new Date(year, month - 1, day);
    return `${days[date.getDay()]}, ${months[month - 1]} ${day}, ${year}`;
  } catch {
    return dateStr.split('T')[0]; // fallback: at least strip the T00:00:00
  }
};

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  city: string;
  eventType: string;
  entryFee: string;
  attendeeCount: number;
  photos?: string[];
  latitude?: number;
  longitude?: number;
  distance?: number;
}

// Calculate distance between two coordinates in miles
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const HERO_HEIGHT = BASE_HERO_HEIGHT + insets.top;
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [selectedType, setSelectedType] = useState('All');
  const [freeOnly, setFreeOnly] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'distance'>('date');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [clubsCount, setClubsCount] = useState(0);
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);

  const scrollY = useSharedValue(0);

  const sortOptions = [
    { label: 'Date', value: 'date', icon: 'calendar' },
    { label: 'Distance', value: 'distance', icon: 'navigate' },
  ];

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  useEffect(() => {
    isMountedRef.current = true;
    getUserLocation();
    return () => { isMountedRef.current = false; };
  }, []);

  // Refetch events every time the tab comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchEvents();
      fetchClubsCount();
      if (user?.id) fetchFavorites();
    }, [user?.id])
  );

  const fetchClubsCount = async () => {
    try {
      const response = await api.get('/clubs');
      setClubsCount(Array.isArray(response.data) ? response.data.length : 0);
    } catch (error) {
      console.log('Error fetching clubs count:', error);
    }
  };

  const fetchFavorites = async () => {
    if (!user?.id) return;
    try {
      const response = await api.get(`/favorites/user/${user.id}`);
      const ids = new Set((response.data || []).map((e: any) => e.id || e._id));
      setFavoriteIds(ids);
    } catch (error) {
      console.log('Error fetching favorites:', error);
    }
  };

  const toggleFavorite = async (eventId: string) => {
    if (!user?.id) {
      Alert.alert('Login Required', 'Please log in to save event favorites.');
      return;
    }
    const isFav = favoriteIds.has(eventId);
    // Optimistic update
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (isFav) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
    try {
      if (isFav) {
        await api.delete(`/favorites/${user.id}/${eventId}`);
      } else {
        await api.post('/favorites', { userId: user.id, eventId });
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      // Revert on error
      setFavoriteIds(prev => {
        const next = new Set(prev);
        if (isFav) next.add(eventId);
        else next.delete(eventId);
        return next;
      });
    }
  };

  useEffect(() => {
    filterEvents();
  }, [events, selectedType, freeOnly, userLocation, sortBy, showAllEvents]);

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError(true);
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        lat: location.coords.latitude,
        lon: location.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError(true);
    }
  };

  const fetchEvents = useCallback(async (isRetry = false) => {
    try {
      if (!isRetry) setFetchError(false);
      const response = await api.get('/events');
      if (!isMountedRef.current) return;
      const eventsWithDistance = response.data.map((event: Event) => {
        const result = { ...event };
        // Calculate distance from user if available
        if (userLocation && event.latitude && event.longitude) {
          result.distance = calculateDistance(
            userLocation.lat,
            userLocation.lon,
            event.latitude,
            event.longitude
          );
        }
        // Always calculate distance from OKC center for radius filtering
        if (event.latitude && event.longitude) {
          (result as any).okcDistance = calculateDistance(
            OKC_LAT,
            OKC_LON,
            event.latitude,
            event.longitude
          );
        }
        return result;
      });
      setEvents(eventsWithDistance);
      setFetchError(false);
      retryCountRef.current = 0;
    } catch (error) {
      console.error('Error fetching events:', error);
      if (!isMountedRef.current) return;
      // Auto-retry up to 3 times with backoff
      if (retryCountRef.current < 3) {
        retryCountRef.current += 1;
        const delay = retryCountRef.current * 2000;
        setTimeout(() => {
          if (isMountedRef.current) fetchEvents(true);
        }, delay);
      } else {
        setFetchError(true);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [userLocation]);

  const filterEvents = () => {
    let filtered = events;

    const now = new Date();
    filtered = filtered.filter((event) => {
      if (!event.date) return true;
      try {
        // Combine date + time so events stay visible until after their scheduled time
        const eventDate = new Date(event.date);
        if (event.time) {
          // Parse time like "7:00 PM", "19:00", etc.
          const timeParts = event.time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
          if (timeParts) {
            let hours = parseInt(timeParts[1]);
            const minutes = parseInt(timeParts[2]);
            const ampm = timeParts[3];
            if (ampm) {
              if (ampm.toUpperCase() === 'PM' && hours !== 12) hours += 12;
              if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
            }
            eventDate.setHours(hours, minutes, 0, 0);
          } else {
            // If time can't be parsed, set to end of day
            eventDate.setHours(23, 59, 59, 0);
          }
        } else {
          // No time specified — keep visible until end of day
          eventDate.setHours(23, 59, 59, 0);
        }
        // Add 2 hour grace period after event time
        eventDate.setTime(eventDate.getTime() + 2 * 60 * 60 * 1000);
        return eventDate >= now;
      } catch {
        return true;
      }
    });

    // OKC radius filter (default: within 20 miles of OKC, unless "All Events" selected)
    if (!showAllEvents) {
      filtered = filtered.filter((event) => {
        // If event has coordinates, check distance from OKC center
        if ((event as any).okcDistance !== undefined) {
          return (event as any).okcDistance <= DEFAULT_RADIUS_MILES;
        }
        // If no coordinates, check city name for OKC references
        const city = (event.city || '').toLowerCase();
        return city.includes('oklahoma city') || city.includes('okc') || 
               city.includes('edmond') || city.includes('moore') || 
               city.includes('norman') || city.includes('midwest city') ||
               city.includes('del city') || city.includes('yukon') ||
               city.includes('mustang') || city.includes('bethany');
      });
    }

    if (selectedType !== 'All') {
      filtered = filtered.filter((event) => event.eventType === selectedType);
    }

    if (freeOnly) {
      filtered = filtered.filter((event) => {
        const fee = event.entryFee?.toLowerCase() || '';
        return fee === '' || fee === 'free' || fee === '$0' || fee === '0';
      });
    }

    switch (sortBy) {
      case 'date':
        filtered = filtered.sort((a, b) => {
          const dateA = a.date || '';
          const dateB = b.date || '';
          return dateA.localeCompare(dateB);
        });
        break;
      case 'distance':
        if (userLocation) {
          filtered = filtered.sort((a, b) => {
            if (a.distance === undefined) return 1;
            if (b.distance === undefined) return -1;
            return a.distance - b.distance;
          });
        }
        break;
    }

    setFilteredEvents(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    retryCountRef.current = 0;
    setFetchError(false);
    fetchEvents();
  };

  // ===== PARALLAX ANIMATED STYLES =====

  // Hero image parallax: moves at 50% scroll speed
  const heroImageStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [-100, 0, HERO_HEIGHT],
      [-50, 0, HERO_HEIGHT * 0.5],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      scrollY.value,
      [-200, 0],
      [1.5, 1],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateY }, { scale }],
    };
  });

  // Hero overlay fades in as user scrolls
  const heroOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, HERO_HEIGHT * 0.6],
      [0.3, 0.9],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  // Hero text content fades out and translates up
  const heroContentStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, HERO_HEIGHT * 0.4],
      [1, 0],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
      [0, HERO_HEIGHT * 0.4],
      [0, -40],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  // Sticky compact header appears as hero scrolls away
  const stickyHeaderStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [HERO_HEIGHT * 0.5, HERO_HEIGHT * 0.8],
      [0, 1],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
      [HERO_HEIGHT * 0.5, HERO_HEIGHT * 0.8],
      [-10, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  // ===== VIEWABILITY TRACKING =====
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Reset visibility when filtered events change (new filter applied)
  useEffect(() => {
    seenIdsRef.current = new Set();
    setVisibleIds(new Set());
  }, [selectedType, freeOnly, sortBy, showAllEvents]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 20,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const newIds = new Set(seenIdsRef.current);
    let changed = false;
    for (const item of viewableItems) {
      if (item.isViewable && item.item?.id && !seenIdsRef.current.has(item.item.id)) {
        newIds.add(item.item.id);
        changed = true;
      }
    }
    if (changed) {
      seenIdsRef.current = newIds;
      setVisibleIds(new Set(newIds));
    }
  }).current;

  // ===== DROPPING TEXT (Cycling Words) COMPONENT =====
  const DroppingText = () => {
    const words = ['Meets', 'Swap Meets', 'Cruises', 'Races', '& MORE!'];
    const [activeIndex, setActiveIndex] = useState(0);
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(-20);
    const rotate = useSharedValue(-15);
    const scale = useSharedValue(0.8);

    useEffect(() => {
      const animate = () => {
        // Slide in
        opacity.value = withTiming(1, { duration: 200 });
        translateY.value = withTiming(0, { duration: 250 });
        rotate.value = withTiming(0, { duration: 250 });
        scale.value = withTiming(1, { duration: 250 });

        // Hold, then slide out
        setTimeout(() => {
          opacity.value = withTiming(0, { duration: 300 });
          translateY.value = withTiming(40, { duration: 300 });
          scale.value = withTiming(0.5, { duration: 300 });
        }, 1200);
      };

      animate();
      const interval = setInterval(() => {
        setActiveIndex(prev => (prev + 1) % words.length);
      }, 1600);

      return () => clearInterval(interval);
    }, []);

    useEffect(() => {
      // Reset to entry position then animate in
      opacity.value = 0;
      translateY.value = -20;
      rotate.value = -15;
      scale.value = 0.8;

      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withTiming(0, { duration: 250 });
      rotate.value = withTiming(0, { duration: 250 });
      scale.value = withTiming(1, { duration: 250 });

      // Hold then exit
      const exitTimer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300 });
        translateY.value = withTiming(40, { duration: 300 });
        scale.value = withTiming(0.5, { duration: 300 });
      }, 1200);

      return () => clearTimeout(exitTimer);
    }, [activeIndex]);

    const animStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [
        { translateY: translateY.value },
        { rotate: `${rotate.value}deg` },
        { scale: scale.value },
      ],
    }));

    return (
      <View style={styles.droppingContainer}>
        <Animated.Text style={[styles.droppingWord, animStyle]}>
          {words[activeIndex]}
        </Animated.Text>
      </View>
    );
  };

  // ===== ANIMATED COUNTER COMPONENT =====
  const AnimatedCounter = ({ target, duration = 2000 }: { target: number; duration?: number }) => {
    const [display, setDisplay] = useState(0);
    const prevTarget = useRef(0);

    useEffect(() => {
      if (target === 0) { setDisplay(0); return; }
      const startVal = prevTarget.current;
      prevTarget.current = target;
      const startTime = Date.now();
      const step = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(startVal + (target - startVal) * eased);
        setDisplay(current);
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, [target]);

    return <Text style={styles.heroStatNumber}>{display}</Text>;
  };

  // ===== EVENT CARD COMPONENT (GSAP-style scroll animation) =====
  const DEFAULT_BIKE_IMAGE = 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&q=80';
  
  const AnimatedEventCard = ({ item, index, isVisible }: { item: Event; index: number; isVisible: boolean }) => {
    const pressScale = useSharedValue(1);
    const hasValidPhoto = item.photos && item.photos.length > 0 && item.photos[0] && item.photos[0].length > 5;
    const [eventImgUri, setEventImgUri] = React.useState(hasValidPhoto ? item.photos[0] : DEFAULT_BIKE_IMAGE);

    const handlePressIn = () => {
      pressScale.value = withSpring(0.97, { damping: 15, stiffness: 200 });
    };

    const handlePressOut = () => {
      pressScale.value = withSpring(1, { damping: 15, stiffness: 200 });
    };

    const cardAnimatedStyle = useAnimatedStyle(() => ({
      transform: [
        { scale: pressScale.value },
      ],
    }));

    return (
      <Animated.View style={cardAnimatedStyle}>
        <Pressable
          onPress={() => router.push(`/event/${item.id}`)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <View style={styles.eventCard}>
            <Image
              source={{ uri: eventImgUri }}
              style={styles.eventImage}
              resizeMode="cover"
              onError={() => setEventImgUri(DEFAULT_BIKE_IMAGE)}
            />
            <View style={styles.eventContent}>
              <View style={styles.eventHeader}>
                <View style={styles.eventTypeContainer}>
                  <Ionicons name="bicycle" size={16} color="#E31837" />
                  <Text style={styles.eventType}>{item.eventType}</Text>
                </View>
                <View style={styles.eventBadges}>
                  {item.distance !== undefined && (
                    <View style={styles.distanceBadge}>
                      <Ionicons name="navigate" size={12} color="#EFFF00" />
                      <Text style={styles.distanceText}>{item.distance.toFixed(1)} mi</Text>
                    </View>
                  )}
                  {item.entryFee && (
                    <Text
                      style={[
                        styles.entryFee,
                        (item.entryFee.toLowerCase() === 'free' || item.entryFee === '$0') && styles.freeBadge,
                      ]}
                    >
                      {item.entryFee}
                    </Text>
                  )}
                </View>
              </View>

              <View>
                <Text style={styles.eventTitle}>{item.title}</Text>
                <Text style={styles.eventDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              </View>

              <View style={styles.eventDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar" size={16} color="#E31837" />
                  <Text style={styles.detailText}>
                    {formatEventDate(item.date)} at {item.time}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="location" size={16} color="#FF5252" />
                  <Text style={styles.detailText}>{item.city}</Text>
                </View>
                <View style={styles.detailRowSpaced}>
                  <View style={styles.detailRow}>
                    <Ionicons name="people" size={16} color="#4FC3F7" />
                    <Text style={styles.detailText}>
                      {item.attendeeCount > 0 ? item.attendeeCount : '??'} attending
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      toggleFavorite(item.id);
                    }}
                    style={styles.favoriteButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={favoriteIds.has(item.id) ? 'heart' : 'heart-outline'}
                      size={24}
                      color={favoriteIds.has(item.id) ? '#E31837' : '#888'}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const renderEventCard = ({ item, index }: { item: Event; index: number }) => (
    <AnimatedEventCard item={item} index={index} isVisible={visibleIds.has(item.id)} />
  );

  // ===== LIST HEADER with parallax hero + filters =====
  const ListHeaderComponent = useCallback(() => (
    <View>
      {/* Parallax Hero Section */}
      <View style={[styles.heroContainer, { height: HERO_HEIGHT }]}>
        <Animated.Image
          source={{ uri: HERO_IMAGES[0] }}
          style={[styles.heroImage, { height: HERO_HEIGHT + 100 }, heroImageStyle]}
          resizeMode="cover"
          onLoad={() => setHeroImageLoaded(true)}
        />
        {/* Dark gradient overlay */}
        <Animated.View style={[styles.heroOverlay, heroOverlayStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(12,12,12,1)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
        {/* Always-visible bottom gradient for readability */}
        <LinearGradient
          colors={['transparent', 'rgba(12,12,12,0.8)', 'rgba(12,12,12,1)']}
          locations={[0.3, 0.7, 1]}
          style={styles.heroBottomGradient}
        />
        {/* Hero text content with parallax */}
        <Animated.View style={[styles.heroContent, heroContentStyle, { paddingTop: insets.top + 16 }]}>
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <Ionicons name="flame" size={14} color="#E31837" />
              <Text style={styles.heroBadgeText}>OKC's #1 Bike Community</Text>
            </View>
            <TouchableOpacity
              style={styles.facebookButton}
              onPress={() => {
                // Facebook link placeholder
              }}
              activeOpacity={0.7}
            >
              <Image
                source={require('../../assets/images/facebook-icon.png')}
                style={styles.facebookIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
          <View style={styles.heroTitleRow}>
            <View>
              <Text style={styles.heroTitle}>Oklahoma</Text>
              <View style={styles.droppingRow}>
                <Text style={styles.heroTitle}>Bike </Text>
                <DroppingText />
              </View>
            </View>
          </View>
          <Text style={styles.heroSubtitle}>Discover events near you!</Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStatItem}>
              <AnimatedCounter target={events.length} />
              <Text style={styles.heroStatLabel}>Events</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <AnimatedCounter target={filteredEvents.length} />
              <Text style={styles.heroStatLabel}>Upcoming</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <AnimatedCounter target={clubsCount} />
              <Text style={styles.heroStatLabel}>Clubs</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatNumber}>
                {`${new Date().getMonth() + 1}/${new Date().getDate()}/${new Date().getFullYear()}`}
              </Text>
              <Text style={styles.heroStatLabel}>
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()]}
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Sort & Calendar Row */}
      <View style={styles.filterRow2}>
        <TouchableOpacity
          style={styles.sortByButton}
          onPress={() => setShowSortMenu(!showSortMenu)}
        >
          <Ionicons name="options" size={16} color="#E31837" />
          <Text style={styles.sortByButtonText}>SORT / FILTER</Text>
          <Ionicons name={showSortMenu ? 'chevron-up' : 'chevron-down'} size={14} color="#E31837" />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={styles.calendarViewButton} onPress={() => router.push('/events/calendar')}>
          <Ionicons name="calendar" size={14} color="#E31837" />
          <Text style={styles.calendarViewButtonText}>CALENDAR VIEW</Text>
        </TouchableOpacity>
      </View>

      {/* Sort/Filter Dropdown Menu */}
      {showSortMenu && (
        <View style={styles.sortDropdown}>
          {/* All - shows all events, all types, all locations */}
          <TouchableOpacity
            style={[
              styles.sortDropdownItem,
              (showAllEvents && selectedType === 'All') && styles.sortDropdownItemActive,
            ]}
            onPress={() => {
              setShowAllEvents(true);
              setSelectedType('All');
              setShowSortMenu(false);
            }}
          >
            <Ionicons
              name="globe"
              size={18}
              color={(showAllEvents && selectedType === 'All') ? '#4FC3F7' : '#999'}
            />
            <Text
              style={[
                styles.sortDropdownText,
                (showAllEvents && selectedType === 'All') && { color: '#4FC3F7', fontWeight: '600' },
              ]}
            >
              All
            </Text>
            {(showAllEvents && selectedType === 'All') && (
              <Ionicons name="checkmark" size={18} color="#4FC3F7" style={{ marginLeft: 'auto' }} />
            )}
          </TouchableOpacity>

          {/* OKC Only - within 20 miles of OKC */}
          <TouchableOpacity
            style={[
              styles.sortDropdownItem,
              (!showAllEvents && selectedType === 'All') && styles.sortDropdownItemActive,
            ]}
            onPress={() => {
              setShowAllEvents(false);
              setSelectedType('All');
              setShowSortMenu(false);
            }}
          >
            <Ionicons
              name="location"
              size={18}
              color={(!showAllEvents && selectedType === 'All') ? '#E31837' : '#999'}
            />
            <Text
              style={[
                styles.sortDropdownText,
                (!showAllEvents && selectedType === 'All') && styles.sortDropdownTextActive,
              ]}
            >
              OKC Only
            </Text>
            {(!showAllEvents && selectedType === 'All') && (
              <Ionicons name="checkmark" size={18} color="#E31837" style={{ marginLeft: 'auto' }} />
            )}
          </TouchableOpacity>

          {/* Meets */}
          <TouchableOpacity
            style={[
              styles.sortDropdownItem,
              selectedType === 'Bike Meet' && styles.sortDropdownItemActive,
            ]}
            onPress={() => {
              setSelectedType(selectedType === 'Bike Meet' ? 'All' : 'Bike Meet');
              setShowSortMenu(false);
            }}
          >
            <Ionicons
              name="bicycle"
              size={18}
              color={selectedType === 'Bike Meet' ? '#E31837' : '#999'}
            />
            <Text
              style={[
                styles.sortDropdownText,
                selectedType === 'Bike Meet' && styles.sortDropdownTextActive,
              ]}
            >
              Meets
            </Text>
            {selectedType === 'Bike Meet' && (
              <Ionicons name="checkmark" size={18} color="#E31837" style={{ marginLeft: 'auto' }} />
            )}
          </TouchableOpacity>

          {/* Swap Meets */}
          <TouchableOpacity
            style={[
              styles.sortDropdownItem,
              selectedType === 'Swap Meet' && styles.sortDropdownItemActive,
            ]}
            onPress={() => {
              setSelectedType(selectedType === 'Swap Meet' ? 'All' : 'Swap Meet');
              setShowSortMenu(false);
            }}
          >
            <Ionicons
              name="swap-horizontal"
              size={18}
              color={selectedType === 'Swap Meet' ? '#E31837' : '#999'}
            />
            <Text
              style={[
                styles.sortDropdownText,
                selectedType === 'Swap Meet' && styles.sortDropdownTextActive,
              ]}
            >
              Swap Meets
            </Text>
            {selectedType === 'Swap Meet' && (
              <Ionicons name="checkmark" size={18} color="#E31837" style={{ marginLeft: 'auto' }} />
            )}
          </TouchableOpacity>

          {/* Cruises */}
          <TouchableOpacity
            style={[
              styles.sortDropdownItem,
              selectedType === 'Group Ride' && styles.sortDropdownItemActive,
            ]}
            onPress={() => {
              setSelectedType(selectedType === 'Group Ride' ? 'All' : 'Group Ride');
              setShowSortMenu(false);
            }}
          >
            <Ionicons
              name="speedometer"
              size={18}
              color={selectedType === 'Group Ride' ? '#E31837' : '#999'}
            />
            <Text
              style={[
                styles.sortDropdownText,
                selectedType === 'Group Ride' && styles.sortDropdownTextActive,
              ]}
            >
              Cruises
            </Text>
            {selectedType === 'Group Ride' && (
              <Ionicons name="checkmark" size={18} color="#E31837" style={{ marginLeft: 'auto' }} />
            )}
          </TouchableOpacity>

          {/* Distance sort */}
          <TouchableOpacity
            style={[
              styles.sortDropdownItem,
              sortBy === 'distance' && styles.sortDropdownItemActive,
            ]}
            onPress={() => {
              setSortBy(sortBy === 'distance' ? 'date' : 'distance');
              setShowSortMenu(false);
            }}
          >
            <Ionicons
              name="navigate"
              size={18}
              color={sortBy === 'distance' ? '#4FC3F7' : '#999'}
            />
            <Text
              style={[
                styles.sortDropdownText,
                sortBy === 'distance' && { color: '#4FC3F7', fontWeight: '600' },
              ]}
            >
              Distance
            </Text>
            {sortBy === 'distance' && (
              <Ionicons name="checkmark" size={18} color="#4FC3F7" style={{ marginLeft: 'auto' }} />
            )}
          </TouchableOpacity>

          {/* No Cost */}
          <TouchableOpacity
            style={[
              styles.sortDropdownItem,
              freeOnly && styles.sortDropdownItemActive,
            ]}
            onPress={() => {
              setFreeOnly(!freeOnly);
              setShowSortMenu(false);
            }}
          >
            <Ionicons
              name={freeOnly ? 'checkmark-circle' : 'pricetag-outline'}
              size={18}
              color={freeOnly ? '#EFFF00' : '#999'}
            />
            <Text
              style={[
                styles.sortDropdownText,
                freeOnly && { color: '#EFFF00', fontWeight: '600' },
              ]}
            >
              No Cost
            </Text>
            {freeOnly && (
              <Ionicons name="checkmark" size={18} color="#EFFF00" style={{ marginLeft: 'auto' }} />
            )}
          </TouchableOpacity>

          {/* Past Events */}
          <TouchableOpacity
            style={styles.sortDropdownItem}
            onPress={() => {
              setShowSortMenu(false);
              router.push('/events/past');
            }}
          >
            <Ionicons name="time" size={18} color="#D32F2F" />
            <Text style={styles.sortDropdownText}>Past Events</Text>
            <Ionicons name="chevron-forward" size={16} color="#666" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>
      )}

      {/* Results count with contextual info */}
      {(!showAllEvents && selectedType === 'All' && !freeOnly && sortBy === 'date') ? (
        <View style={styles.resultsRowHighlight}>
          <Text style={styles.resultsTextHighlight}>
            <Text style={{ color: '#E31837', fontWeight: '800' }}>{filteredEvents.length}</Text>
            {'  '}Events in or near OKC!  Use sort for options.
          </Text>
        </View>
      ) : (
        <View style={styles.resultsRow}>
          <Text style={styles.resultsText}>
            {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} found
          </Text>
        </View>
      )}
    </View>
  ), [events, filteredEvents, selectedType, freeOnly, sortBy, showSortMenu, showAllEvents, userLocation, insets.top, heroImageLoaded, heroImageStyle, heroOverlayStyle, heroContentStyle, favoriteIds, clubsCount]);

  if (loading) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#E31837" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Sticky compact header that appears on scroll */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top }, stickyHeaderStyle]}>
        <LinearGradient
          colors={['rgba(12,12,12,0.98)', 'rgba(12,12,12,0.95)']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.stickyHeaderContent}>
          <Ionicons name="bicycle" size={22} color="#E31837" />
          <Text style={styles.stickyHeaderTitle}>Oklahoma Bike Events</Text>
          <View style={styles.stickyHeaderBadge}>
            <Text style={styles.stickyHeaderCount}>{filteredEvents.length}</Text>
          </View>
        </View>
      </Animated.View>

      <Animated.FlatList
        data={filteredEvents}
        keyExtractor={(item) => item.id}
        renderItem={renderEventCard}
        contentContainerStyle={styles.eventsList}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        ListHeaderComponent={ListHeaderComponent}
        ItemSeparatorComponent={() => (
          <View style={{ height: 8, backgroundColor: 'rgba(255, 185, 0, 0.20)' }} />
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        snapToInterval={328}
        snapToAlignment="start"
        decelerationRate="fast"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E31837" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {fetchError ? (
              <>
                <Ionicons name="cloud-offline" size={64} color="#FF5252" />
                <Text style={styles.emptyText}>{"Couldn't load events"}</Text>
                <Text style={styles.emptySubtext}>Check your connection and try again</Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={() => { retryCountRef.current = 0; setFetchError(false); setLoading(true); fetchEvents(); }}
                >
                  <Ionicons name="refresh" size={18} color="#fff" />
                  <Text style={styles.retryButtonText}>Tap to Retry</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Ionicons name="bicycle" size={64} color="#333" />
                <Text style={styles.emptyText}>No events found</Text>
                <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
              </>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0c0c0c',
  },

  // ===== HERO / PARALLAX =====
  heroContainer: {
    height: BASE_HERO_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: BASE_HERO_HEIGHT + 100,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  heroBottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: BASE_HERO_HEIGHT * 0.6,
    zIndex: 2,
  },
  heroContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingRight: '7%',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,53,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.4)',
    gap: 6,
  },
  heroBadgeText: {
    color: '#D3D3D3',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 38,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 42,
    letterSpacing: -0.5,
    textShadow: '1px 5px #000',
  },
  droppingContainer: {
    height: 46,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  droppingWord: {
    fontSize: 38,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    textShadowColor: '#E31837',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  droppingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  facebookButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  facebookIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    boxShadow: 'inset 0px 1px 0px 3px #ffffff',
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.3,
    marginTop: 8,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 12,
    alignSelf: 'flex-start',
    gap: 16,
  },
  heroStatItem: {
    alignItems: 'center',
    gap: 2,
  },
  heroStatNumber: {
    color: '#E31837',
    fontSize: 18,
    fontWeight: '800',
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '500',
  },
  heroStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  // ===== STICKY HEADER =====
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  stickyHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  stickyHeaderTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  stickyHeaderBadge: {
    backgroundColor: '#E31837',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stickyHeaderCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  // ===== FILTERS =====
  // ===== FILTERS =====
  filterRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 45,
    marginBottom: 11,
    marginTop: -12,
    gap: 8,
  },
  sortByButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#141414',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E31837',
    gap: 6,
  },
  sortByButtonText: {
    color: '#D3D3D3',
    fontSize: 13,
    fontWeight: '600',
  },
  sortDropdown: {
    marginHorizontal: 0,
    marginBottom: 12,
    backgroundColor: '#222',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    overflow: 'hidden',
  },
  sortDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  sortDropdownItemActive: {
    backgroundColor: 'rgba(225, 85, 0, 0.1)',
  },
  sortDropdownText: {
    color: '#999',
    fontSize: 15,
    fontWeight: '500',
  },
  sortDropdownTextActive: {
    color: '#E31837',
    fontWeight: '600',
  },
  calendarViewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#141414',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E31837',
    gap: 6,
  },
  calendarViewButtonText: {
    color: '#D3D3D3',
    fontSize: 13,
    fontWeight: '600',
  },

  // ===== LOCATION WARNING =====
  locationWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
    marginBottom: 8,
  },
  locationWarningText: {
    color: '#FFC107',
    fontSize: 12,
  },

  // ===== RESULTS ROW =====
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 5,
    marginBottom: 8,
  },
  resultsRowHighlight: {
    backgroundColor: 'rgba(255, 185, 0, 0.2)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 185, 0, 0.4)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  resultsTextHighlight: {
    color: '#ccc',
    fontSize: 15,
    fontWeight: '500',
  },
  resultsText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '500',
  },
  resultsDate: {
    color: '#E31837',
    fontSize: 14,
    fontWeight: '700',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  // ===== EVENT CARDS =====
  eventsList: {
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  eventCard: {
    backgroundColor: '#141414',
    borderRadius: 0,
    marginBottom: 0,
    overflow: 'hidden',
  },
  eventImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#1E1E1E',
  },
  eventContent: {
    padding: 16,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventType: {
    color: '#E31837',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  entryFee: {
    color: '#EFFF00',
    fontSize: 12,
    fontWeight: '600',
  },
  freeBadge: {
    backgroundColor: '#EFFF00',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  eventBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 255, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  distanceText: {
    color: '#EFFF00',
    fontSize: 11,
    fontWeight: '600',
  },
  eventTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  eventDescription: {
    fontSize: 15,
    color: '#aaa',
    marginBottom: 12,
    lineHeight: 22,
  },
  eventDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailRowSpaced: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailText: {
    fontSize: 14,
    color: '#888',
    marginLeft: 8,
  },
  favoriteButton: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E31837',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
    gap: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
