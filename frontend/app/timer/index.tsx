import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
  Platform,
  Image,
  Modal,
  TextInput,
  Share,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  Easing,
  interpolate,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';

const { width } = Dimensions.get('window');
const API_URL = 'https://event-hub-okc-1.preview.emergentagent.com';
const SPEEDO_SIZE = Math.min(width * 0.62, 260);
const QUARTER_MILE_METERS = 402.336;

type RunType = '0-60' | '0-100' | 'quarter-mile';

interface RunResult {
  type: RunType;
  time: number;
  topSpeed: number;
  distance?: number;
  quarterMileSpeed?: number;
  timestamp: Date;
}

interface PersonalBests {
  zeroToSixty: number | null;
  zeroToHundred: number | null;
  quarterMile: number | null;
  totalRuns: number;
}

interface GarageCar {
  id: string;
  year: string;
  make: string;
  model: string;
  trim?: string;
}

export default function TimerScreen() {
  const { user, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();

  // Run state
  const [selectedMode, setSelectedMode] = useState<RunType>('0-60');
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [topSpeed, setTopSpeed] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);
  const [locationPermission, setLocationPermission] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [distanceCovered, setDistanceCovered] = useState(0);

  // Car selection
  const [garageCars, setGarageCars] = useState<GarageCar[]>([]);
  const [selectedCar, setSelectedCar] = useState<string>('');
  const [showCarPicker, setShowCarPicker] = useState(false);

  // Personal bests
  const [personalBests, setPersonalBests] = useState<PersonalBests | null>(null);
  const [isNewPB, setIsNewPB] = useState(false);
  const [pbDelta, setPbDelta] = useState<number | null>(null);

  // Manual entry
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualForm, setManualForm] = useState({
    type: '0-60' as RunType,
    time: '',
    topSpeed: '',
    carInfo: '',
    location: 'Oklahoma City',
  });
  const [savingManual, setSavingManual] = useState(false);

  // Refs for closure-safe state access
  const isRunningRef = useRef(false);
  const waitingForStartRef = useRef(false);
  const selectedModeRef = useRef<RunType>('0-60');
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const startTime = useRef<number | null>(null);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const lastLocationRef = useRef<Location.LocationObject | null>(null);
  const distanceRef = useRef(0);
  const topSpeedRef = useRef(0);

  // Reanimated values
  const pulseScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.5);
  const speedGauge = useSharedValue(0);
  const pbBounce = useSharedValue(1);

  const modes: { type: RunType; label: string; target: number; icon: string; color: string }[] = [
    { type: '0-60', label: '0-60 MPH', target: 60, icon: 'speedometer', color: '#FF6B35' },
    { type: '0-100', label: '0-100 MPH', target: 100, icon: 'rocket', color: '#E91E63' },
    { type: 'quarter-mile', label: '1/4 Mile', target: 0, icon: 'flag', color: '#9C27B0' },
  ];

  // Keep ref in sync with state
  useEffect(() => {
    selectedModeRef.current = selectedMode;
  }, [selectedMode]);

  useEffect(() => {
    requestLocationPermission();
    if (isAuthenticated && user) {
      fetchGarageCars();
      fetchPersonalBests();
    }
    return () => {
      stopTracking();
    };
  }, []);

  // Pulse animation for active state
  useEffect(() => {
    if (waitingForStartRef.current || isRunningRef.current) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 500 }),
          withTiming(0.4, { duration: 500 })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(pulseScale);
      cancelAnimation(glowOpacity);
      pulseScale.value = withTiming(1);
      glowOpacity.value = withTiming(0.5);
    }
  }, [countdown, result]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const gaugeRotation = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(speedGauge.value, [0, 1], [0, 270])}deg` }],
  }));

  const pbBounceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pbBounce.value }],
  }));

  const fetchGarageCars = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/user-cars/user/${user?.id}`);
      if (res.data && Array.isArray(res.data)) {
        const cars = res.data.map((car: any) => ({
          id: car.id || car._id,
          year: car.year || '',
          make: car.make || '',
          model: car.model || '',
          trim: car.trim || '',
        }));
        setGarageCars(cars);
        if (cars.length > 0) {
          const firstCar = cars[0];
          setSelectedCar(`${firstCar.year} ${firstCar.make} ${firstCar.model}${firstCar.trim ? ' ' + firstCar.trim : ''}`);
        }
      }
    } catch (err) {
      console.log('No garage cars found');
    }
  };

  const fetchPersonalBests = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/performance-runs/user/${user?.id}/best`);
      setPersonalBests(res.data);
    } catch (err) {
      console.log('Error fetching personal bests');
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission(true);
      } else {
        Alert.alert(
          'Permission Required',
          'GPS permission is needed for the performance timer to track your speed.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  };

  const startCountdown = () => {
    if (!selectedCar && garageCars.length > 0) {
      setShowCarPicker(true);
      return;
    }
    setCountdown(3);
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownInterval);
          setCountdown(null);
          startWaitingForMovement();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleRunCompletion = useCallback((time: number, topSpd: number, dist: number, trapSpeed: number) => {
    const runResult: RunResult = {
      type: selectedModeRef.current,
      time,
      topSpeed: topSpd,
      distance: dist,
      quarterMileSpeed: selectedModeRef.current === 'quarter-mile' ? trapSpeed : undefined,
      timestamp: new Date(),
    };
    setResult(runResult);

    // Check personal best
    let previousBest: number | null = null;
    if (personalBests) {
      if (selectedModeRef.current === '0-60') previousBest = personalBests.zeroToSixty;
      else if (selectedModeRef.current === '0-100') previousBest = personalBests.zeroToHundred;
      else previousBest = personalBests.quarterMile;
    }

    if (previousBest === null || time < previousBest) {
      setIsNewPB(true);
      setPbDelta(previousBest !== null ? previousBest - time : null);
      pbBounce.value = withSequence(
        withSpring(1.4, { damping: 4, stiffness: 200 }),
        withSpring(1, { damping: 8, stiffness: 150 })
      );
    } else {
      setIsNewPB(false);
      setPbDelta(null);
    }

    // Save to backend
    if (isAuthenticated && user) {
      saveRunToBackend(time, topSpd, dist, trapSpeed);
    }
  }, [personalBests, isAuthenticated, user]);

  const startWaitingForMovement = async () => {
    waitingForStartRef.current = true;
    isRunningRef.current = false;
    setResult(null);
    setElapsedTime(0);
    setTopSpeed(0);
    setCurrentSpeed(0);
    setDistanceCovered(0);
    setIsNewPB(false);
    setPbDelta(null);
    distanceRef.current = 0;
    topSpeedRef.current = 0;
    lastLocationRef.current = null;

    // Force re-render to trigger animation effect
    setCountdown(null);

    try {
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 100,
          distanceInterval: 0,
        },
        (location) => {
          const speedMph = Math.max(0, (location.coords.speed || 0) * 2.237);
          setCurrentSpeed(speedMph);
          setGpsAccuracy(location.coords.accuracy);

          // Animate speed gauge
          const targetSpeed = selectedModeRef.current === 'quarter-mile' ? 150 : (selectedModeRef.current === '0-100' ? 100 : 60);
          const pct = Math.min(speedMph / targetSpeed, 1);
          speedGauge.value = withTiming(pct, { duration: 150 });

          // Detect movement start
          if (waitingForStartRef.current && !isRunningRef.current && speedMph > 1) {
            waitingForStartRef.current = false;
            isRunningRef.current = true;
            startTime.current = Date.now();
            lastLocationRef.current = location;

            timerInterval.current = setInterval(() => {
              if (startTime.current) {
                const elapsed = (Date.now() - startTime.current) / 1000;
                runOnJS(setElapsedTime)(elapsed);
              }
            }, 16);
          }

          // Active run tracking
          if (isRunningRef.current && startTime.current) {
            // Track top speed
            if (speedMph > topSpeedRef.current) {
              topSpeedRef.current = speedMph;
              runOnJS(setTopSpeed)(speedMph);
            }

            // Accumulate distance for quarter-mile
            if (lastLocationRef.current && selectedModeRef.current === 'quarter-mile') {
              const dist = haversineDistance(
                lastLocationRef.current.coords.latitude,
                lastLocationRef.current.coords.longitude,
                location.coords.latitude,
                location.coords.longitude
              );
              // Filter out GPS jumps (>50m per update at 100ms interval would be >1118mph)
              if (dist < 50) {
                distanceRef.current += dist;
                runOnJS(setDistanceCovered)(distanceRef.current);
              }
            }
            lastLocationRef.current = location;

            const mode = selectedModeRef.current;
            const finalTime = (Date.now() - startTime.current) / 1000;

            // Check completion conditions
            if (mode === 'quarter-mile' && distanceRef.current >= QUARTER_MILE_METERS) {
              stopTracking();
              runOnJS(handleRunCompletion)(finalTime, topSpeedRef.current, distanceRef.current, speedMph);
            } else if (mode === '0-60' && speedMph >= 60) {
              stopTracking();
              runOnJS(handleRunCompletion)(finalTime, topSpeedRef.current, 0, 0);
            } else if (mode === '0-100' && speedMph >= 100) {
              stopTracking();
              runOnJS(handleRunCompletion)(finalTime, topSpeedRef.current, 0, 0);
            }
          }
        }
      );
    } catch (error) {
      console.error('Error starting location tracking:', error);
      waitingForStartRef.current = false;
      Alert.alert('Error', 'Failed to start GPS tracking');
    }
  };

  const saveRunToBackend = async (time: number, topSpd: number, dist: number, trapSpeed: number) => {
    try {
      const carLabel = selectedCar || `${user?.name}'s Car`;
      const runData: any = {
        userId: user!.id,
        carInfo: carLabel,
        location: 'Oklahoma City',
        topSpeed: parseFloat(topSpd.toFixed(1)),
        isManualEntry: false,
      };

      if (selectedModeRef.current === '0-60') {
        runData.zeroToSixty = parseFloat(time.toFixed(2));
      } else if (selectedModeRef.current === '0-100') {
        runData.zeroToHundred = parseFloat(time.toFixed(2));
      } else {
        runData.quarterMile = parseFloat(time.toFixed(2));
        runData.quarterMileSpeed = parseFloat(trapSpeed.toFixed(1));
      }

      await axios.post(`${API_URL}/api/performance-runs`, runData);
      fetchPersonalBests(); // Refresh PBs
    } catch (error) {
      console.error('Error saving run:', error);
    }
  };

  const stopTracking = () => {
    isRunningRef.current = false;
    waitingForStartRef.current = false;

    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }
    startTime.current = null;
    cancelAnimation(pulseScale);
    cancelAnimation(glowOpacity);
    pulseScale.value = withTiming(1);
    glowOpacity.value = withTiming(0.5);
  };

  const resetTimer = () => {
    stopTracking();
    setCurrentSpeed(0);
    setTopSpeed(0);
    setElapsedTime(0);
    setResult(null);
    setGpsAccuracy(null);
    setDistanceCovered(0);
    setIsNewPB(false);
    setPbDelta(null);
    speedGauge.value = withTiming(0);
    distanceRef.current = 0;
    topSpeedRef.current = 0;
    lastLocationRef.current = null;
  };

  const handleAbort = () => {
    stopTracking();
    setCurrentSpeed(0);
    setTopSpeed(0);
    setElapsedTime(0);
    setDistanceCovered(0);
    speedGauge.value = withTiming(0);
    distanceRef.current = 0;
    topSpeedRef.current = 0;
    lastLocationRef.current = null;
    // Force re-render
    setCountdown(null);
    setResult(null);
  };

  const formatTime = (seconds: number) => seconds.toFixed(2);

  const getSpeedColor = () => {
    if (currentSpeed < 30) return '#4CAF50';
    if (currentSpeed < 60) return '#FF9800';
    if (currentSpeed < 100) return '#FF6B35';
    return '#E91E63';
  };

  const shareResult = async () => {
    if (!result) return;
    const modeLabel = result.type === '0-60' ? '0-60 MPH' : result.type === '0-100' ? '0-100 MPH' : '1/4 Mile';
    let message = `🏁 ${modeLabel}: ${result.time.toFixed(2)}s`;
    if (selectedCar) message += `\n🚗 ${selectedCar}`;
    message += `\n⚡ Top Speed: ${result.topSpeed.toFixed(1)} MPH`;
    if (result.type === 'quarter-mile' && result.quarterMileSpeed) {
      message += `\n💨 Trap Speed: ${result.quarterMileSpeed.toFixed(1)} MPH`;
    }
    if (isNewPB) message += `\n🏆 NEW PERSONAL BEST!`;
    message += `\n\n📱 Tracked with OKC Car Events`;

    try {
      await Share.share({ message, title: `My ${modeLabel} Run` });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualForm.time || isNaN(parseFloat(manualForm.time))) {
      Alert.alert('Invalid Time', 'Please enter a valid time in seconds.');
      return;
    }
    if (!isAuthenticated || !user) {
      Alert.alert('Login Required', 'You need to be logged in to save runs.');
      return;
    }

    setSavingManual(true);
    try {
      const time = parseFloat(manualForm.time);
      const runData: any = {
        userId: user.id,
        carInfo: manualForm.carInfo || selectedCar || `${user.name}'s Car`,
        location: manualForm.location || 'Oklahoma City',
        topSpeed: manualForm.topSpeed ? parseFloat(manualForm.topSpeed) : null,
        isManualEntry: true,
      };

      if (manualForm.type === '0-60') runData.zeroToSixty = time;
      else if (manualForm.type === '0-100') runData.zeroToHundred = time;
      else runData.quarterMile = time;

      await axios.post(`${API_URL}/api/performance-runs`, runData);
      setShowManualEntry(false);
      setManualForm({ type: '0-60', time: '', topSpeed: '', carInfo: '', location: 'Oklahoma City' });
      fetchPersonalBests();
      Alert.alert('✅ Run Saved!', 'Your manual entry has been added to the leaderboard.', [
        { text: 'View Leaderboard', onPress: () => router.push('/timer/leaderboard') },
        { text: 'OK' },
      ]);
    } catch (error) {
      console.error('Error saving manual entry:', error);
      Alert.alert('Error', 'Failed to save your run.');
    } finally {
      setSavingManual(false);
    }
  };

  const selectedModeColor = modes.find((m) => m.type === selectedMode)?.color || '#FF6B35';
  const isActive = waitingForStartRef.current || isRunningRef.current || countdown !== null;

  // Generate tick marks for speedometer
  const tickMarks = Array.from({ length: 24 }, (_, i) => {
    const angle = -135 + (i * 270) / 23;
    const isMajor = i % 4 === 0;
    return { angle, isMajor };
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
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
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.headerTitle}>Performance Timer</Text>
              <Text style={styles.headerSubtitle}>GPS-based acceleration testing</Text>
            </View>
            <TouchableOpacity onPress={() => setShowManualEntry(true)} style={styles.headerActionBtn}>
              <Ionicons name="create-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/timer/leaderboard')} style={styles.headerActionBtn}>
              <Ionicons name="trophy" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Car Selection */}
        {garageCars.length > 0 && (
          <TouchableOpacity style={styles.carSelector} onPress={() => setShowCarPicker(true)}>
            <Ionicons name="car-sport" size={18} color="#FF6B35" />
            <Text style={styles.carSelectorText} numberOfLines={1}>
              {selectedCar || 'Select your car'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#888" />
          </TouchableOpacity>
        )}

        {/* Mode Selector */}
        <View style={styles.modeSelector}>
          {modes.map((mode) => (
            <TouchableOpacity
              key={mode.type}
              style={[
                styles.modeButton,
                selectedMode === mode.type && { backgroundColor: mode.color },
              ]}
              onPress={() => {
                if (!isActive) {
                  setSelectedMode(mode.type);
                  resetTimer();
                }
              }}
              disabled={isActive}
            >
              <Ionicons
                name={mode.icon as any}
                size={18}
                color={selectedMode === mode.type ? '#fff' : '#888'}
              />
              <Text
                style={[
                  styles.modeButtonText,
                  selectedMode === mode.type && styles.modeButtonTextActive,
                ]}
              >
                {mode.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Personal Bests Strip */}
        {personalBests && (
          <View style={styles.pbStrip}>
            <View style={styles.pbItem}>
              <Text style={styles.pbLabel}>0-60 PB</Text>
              <Text style={[styles.pbValue, { color: '#FF6B35' }]}>
                {personalBests.zeroToSixty?.toFixed(2) || '--'}s
              </Text>
            </View>
            <View style={styles.pbDivider} />
            <View style={styles.pbItem}>
              <Text style={styles.pbLabel}>0-100 PB</Text>
              <Text style={[styles.pbValue, { color: '#E91E63' }]}>
                {personalBests.zeroToHundred?.toFixed(2) || '--'}s
              </Text>
            </View>
            <View style={styles.pbDivider} />
            <View style={styles.pbItem}>
              <Text style={styles.pbLabel}>1/4 Mi PB</Text>
              <Text style={[styles.pbValue, { color: '#9C27B0' }]}>
                {personalBests.quarterMile?.toFixed(2) || '--'}s
              </Text>
            </View>
          </View>
        )}

        {/* Speedometer Display */}
        <View style={styles.speedometerContainer}>
          <Animated.View style={[styles.speedometerOuter, { borderColor: selectedModeColor }, pulseStyle]}>
            {/* Tick marks */}
            {tickMarks.map((tick, i) => (
              <View
                key={i}
                style={[
                  styles.tickMark,
                  tick.isMajor ? styles.tickMajor : styles.tickMinor,
                  {
                    transform: [
                      { rotate: `${tick.angle}deg` },
                      { translateY: -(SPEEDO_SIZE / 2 - 4) },
                    ],
                  },
                ]}
              />
            ))}

            {/* Gauge needle */}
            <View style={styles.needleContainer}>
              <Animated.View style={[styles.needle, gaugeRotation, { backgroundColor: selectedModeColor }]} />
              <View style={[styles.needleCenter, { backgroundColor: selectedModeColor }]} />
            </View>

            {/* Center content */}
            <View style={styles.speedometerInner}>
              {countdown !== null ? (
                <Text style={[styles.countdownText, { color: selectedModeColor }]}>{countdown}</Text>
              ) : waitingForStartRef.current && !isRunningRef.current && !result ? (
                <View style={styles.waitingContainer}>
                  <Animated.Text style={[styles.waitingText, glowStyle]}>READY</Animated.Text>
                  <Text style={styles.waitingSubtext}>Accelerate to start</Text>
                </View>
              ) : (
                <View style={styles.speedDisplay}>
                  <Text style={[styles.currentSpeedText, { color: getSpeedColor() }]}>
                    {currentSpeed.toFixed(0)}
                  </Text>
                  <Text style={styles.speedUnit}>MPH</Text>
                </View>
              )}
            </View>
          </Animated.View>
        </View>

        {/* Quarter-mile distance indicator */}
        {selectedMode === 'quarter-mile' && (isRunningRef.current || result) && (
          <View style={styles.distanceBar}>
            <View style={styles.distanceBarTrack}>
              <View
                style={[
                  styles.distanceBarFill,
                  {
                    width: `${Math.min((distanceCovered / QUARTER_MILE_METERS) * 100, 100)}%`,
                    backgroundColor: distanceCovered >= QUARTER_MILE_METERS ? '#4CAF50' : '#9C27B0',
                  },
                ]}
              />
            </View>
            <Text style={styles.distanceText}>
              {(distanceCovered * 3.28084).toFixed(0)} / 1,320 ft
            </Text>
          </View>
        )}

        {/* Timer Display */}
        <View style={styles.timerDisplay}>
          <Text style={styles.timerLabel}>{selectedMode.toUpperCase()} TIME</Text>
          <View style={styles.timerRow}>
            <Text style={styles.timerValue}>
              {result ? formatTime(result.time) : formatTime(elapsedTime)}
            </Text>
            <Text style={styles.timerUnit}>s</Text>
          </View>

          {/* New PB indicator */}
          {result && isNewPB && (
            <Animated.View style={[styles.pbBadge, pbBounceStyle]}>
              <Ionicons name="trophy" size={16} color="#FFD700" />
              <Text style={styles.pbBadgeText}>NEW PERSONAL BEST!</Text>
              {pbDelta !== null && (
                <Text style={styles.pbDeltaText}>-{pbDelta.toFixed(2)}s faster</Text>
              )}
            </Animated.View>
          )}

          {(isRunningRef.current || result) && (
            <View style={styles.runStats}>
              <View style={styles.runStatItem}>
                <Ionicons name="flash" size={14} color="#FF6B35" />
                <Text style={styles.runStatText}>Top: {topSpeed.toFixed(1)} MPH</Text>
              </View>
              {result?.type === 'quarter-mile' && result.quarterMileSpeed && (
                <View style={styles.runStatItem}>
                  <Ionicons name="speedometer" size={14} color="#9C27B0" />
                  <Text style={styles.runStatText}>
                    Trap: {result.quarterMileSpeed.toFixed(1)} MPH
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* GPS Status */}
        <View style={styles.gpsStatus}>
          <Ionicons
            name={locationPermission ? 'navigate' : 'navigate-outline'}
            size={14}
            color={gpsAccuracy && gpsAccuracy < 10 ? '#4CAF50' : gpsAccuracy ? '#FF9800' : '#888'}
          />
          <Text style={styles.gpsText}>
            GPS: {gpsAccuracy ? `±${gpsAccuracy.toFixed(0)}m` : 'Waiting...'}
            {gpsAccuracy && gpsAccuracy < 5 && ' (Excellent)'}
            {gpsAccuracy && gpsAccuracy >= 5 && gpsAccuracy < 10 && ' (Good)'}
            {gpsAccuracy && gpsAccuracy >= 10 && ' (Fair)'}
          </Text>
        </View>

        {/* Control Buttons */}
        <View style={styles.controlButtons}>
          {!isActive && !result && (
            <TouchableOpacity
              style={styles.mainButton}
              onPress={startCountdown}
              disabled={!locationPermission}
            >
              <LinearGradient
                colors={locationPermission ? ['#4CAF50', '#2E7D32'] : ['#555', '#333']}
                style={styles.buttonGradient}
              >
                <Ionicons name="play" size={30} color="#fff" />
                <Text style={styles.buttonText}>START RUN</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {isActive && !result && (
            <TouchableOpacity style={styles.mainButton} onPress={handleAbort}>
              <LinearGradient colors={['#FF3B30', '#C62828']} style={styles.buttonGradient}>
                <Ionicons name="stop" size={30} color="#fff" />
                <Text style={styles.buttonText}>ABORT</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {result && (
            <View style={styles.resultButtons}>
              <TouchableOpacity style={[styles.resultBtn, { flex: 2 }]} onPress={resetTimer}>
                <LinearGradient colors={['#FF6B35', '#E91E63']} style={styles.resultBtnGradient}>
                  <Ionicons name="refresh" size={24} color="#fff" />
                  <Text style={styles.resultBtnText}>TRY AGAIN</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.resultBtn, { flex: 1 }]} onPress={shareResult}>
                <View style={styles.shareBtnInner}>
                  <Ionicons name="share-outline" size={22} color="#fff" />
                  <Text style={styles.shareBtnText}>Share</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/timer/leaderboard')}
          >
            <Ionicons name="trophy" size={22} color="#FFD700" />
            <Text style={styles.actionButtonText}>Leaderboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/timer/my-runs')}
          >
            <Ionicons name="time" size={22} color="#2196F3" />
            <Text style={styles.actionButtonText}>My Runs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowManualEntry(true)}
          >
            <Ionicons name="create" size={22} color="#4CAF50" />
            <Text style={styles.actionButtonText}>Manual</Text>
          </TouchableOpacity>
        </View>

        {/* Safety Warning */}
        <View style={styles.warningContainer}>
          <Ionicons name="warning" size={18} color="#FF9800" />
          <Text style={styles.warningText}>
            Only use on closed courses or private property. Always prioritize safety.
          </Text>
        </View>
      </ScrollView>

      {/* ===== CAR PICKER MODAL ===== */}
      <Modal visible={showCarPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Your Car</Text>
              <TouchableOpacity onPress={() => setShowCarPicker(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {garageCars.map((car) => {
                const label = `${car.year} ${car.make} ${car.model}${car.trim ? ' ' + car.trim : ''}`;
                const isSelected = selectedCar === label;
                return (
                  <TouchableOpacity
                    key={car.id}
                    style={[styles.carOption, isSelected && styles.carOptionSelected]}
                    onPress={() => {
                      setSelectedCar(label);
                      setShowCarPicker(false);
                    }}
                  >
                    <Ionicons name="car-sport" size={20} color={isSelected ? '#FF6B35' : '#888'} />
                    <Text style={[styles.carOptionText, isSelected && { color: '#FF6B35' }]}>{label}</Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#FF6B35" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.carCustomBtn}
              onPress={() => {
                Alert.prompt?.(
                  'Custom Car',
                  'Enter your car info:',
                  (text) => {
                    if (text) {
                      setSelectedCar(text);
                      setShowCarPicker(false);
                    }
                  }
                ) ||
                  (() => {
                    setSelectedCar('Custom Car');
                    setShowCarPicker(false);
                  })();
              }}
            >
              <Ionicons name="add-circle-outline" size={20} color="#4CAF50" />
              <Text style={styles.carCustomBtnText}>Enter Custom Car</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== MANUAL ENTRY MODAL ===== */}
      <Modal visible={showManualEntry} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContainer, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Manual Entry</Text>
                <Text style={styles.modalSubtitle}>Add a time from a dragstrip timeslip</Text>
              </View>
              <TouchableOpacity onPress={() => setShowManualEntry(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Run Type */}
              <Text style={styles.formLabel}>Run Type</Text>
              <View style={styles.manualModeRow}>
                {modes.map((mode) => (
                  <TouchableOpacity
                    key={mode.type}
                    style={[
                      styles.manualModeBtn,
                      manualForm.type === mode.type && { backgroundColor: mode.color },
                    ]}
                    onPress={() => setManualForm((p) => ({ ...p, type: mode.type }))}
                  >
                    <Text
                      style={[
                        styles.manualModeBtnText,
                        manualForm.type === mode.type && { color: '#fff' },
                      ]}
                    >
                      {mode.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Time */}
              <Text style={styles.formLabel}>Time (seconds) *</Text>
              <TextInput
                style={styles.formInput}
                value={manualForm.time}
                onChangeText={(t) => setManualForm((p) => ({ ...p, time: t }))}
                placeholder="e.g. 4.25"
                placeholderTextColor="#555"
                keyboardType="decimal-pad"
              />

              {/* Top Speed */}
              <Text style={styles.formLabel}>Top Speed (MPH)</Text>
              <TextInput
                style={styles.formInput}
                value={manualForm.topSpeed}
                onChangeText={(t) => setManualForm((p) => ({ ...p, topSpeed: t }))}
                placeholder="e.g. 130"
                placeholderTextColor="#555"
                keyboardType="decimal-pad"
              />

              {/* Car Info */}
              <Text style={styles.formLabel}>Car</Text>
              <TextInput
                style={styles.formInput}
                value={manualForm.carInfo || selectedCar}
                onChangeText={(t) => setManualForm((p) => ({ ...p, carInfo: t }))}
                placeholder="e.g. 2024 Ford Mustang GT"
                placeholderTextColor="#555"
              />

              {/* Location */}
              <Text style={styles.formLabel}>Location</Text>
              <TextInput
                style={styles.formInput}
                value={manualForm.location}
                onChangeText={(t) => setManualForm((p) => ({ ...p, location: t }))}
                placeholder="e.g. Thunder Valley Raceway"
                placeholderTextColor="#555"
              />

              <TouchableOpacity
                style={[styles.submitBtn, savingManual && { opacity: 0.6 }]}
                onPress={handleManualSubmit}
                disabled={savingManual}
              >
                {savingManual ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.submitBtnText}>Save to Leaderboard</Text>
                  </>
                )}
              </TouchableOpacity>
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
  scrollContent: {
    paddingBottom: 40,
  },
  headerGradient: {
    paddingTop: 10,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  headerActionBtn: {
    padding: 8,
    marginLeft: 4,
  },
  // Car selector
  carSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  carSelectorText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Mode selector
  modeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 12,
    gap: 6,
  },
  modeButtonText: {
    color: '#888',
    fontSize: 11,
    fontWeight: '700',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  // PB strip
  pbStrip: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pbItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  pbLabel: {
    fontSize: 10,
    color: '#888',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pbValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  pbDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#333',
  },
  // Speedometer
  speedometerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  speedometerOuter: {
    width: SPEEDO_SIZE,
    height: SPEEDO_SIZE,
    borderRadius: SPEEDO_SIZE / 2,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    overflow: 'hidden',
  },
  speedometerInner: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  speedDisplay: {
    alignItems: 'center',
  },
  currentSpeedText: {
    fontSize: 64,
    fontWeight: 'bold',
    lineHeight: 72,
  },
  speedUnit: {
    fontSize: 20,
    color: '#888',
    marginTop: -6,
    fontWeight: '600',
  },
  countdownText: {
    fontSize: 90,
    fontWeight: 'bold',
    lineHeight: 100,
  },
  waitingContainer: {
    alignItems: 'center',
  },
  waitingText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  waitingSubtext: {
    fontSize: 13,
    color: '#888',
    marginTop: 6,
  },
  // Tick marks
  tickMark: {
    position: 'absolute',
    width: 2,
    backgroundColor: '#555',
    left: SPEEDO_SIZE / 2 - 1,
    top: SPEEDO_SIZE / 2,
    transformOrigin: 'center top',
  },
  tickMajor: {
    height: 14,
    width: 3,
    backgroundColor: '#aaa',
    left: SPEEDO_SIZE / 2 - 1.5,
  },
  tickMinor: {
    height: 8,
  },
  // Needle
  needleContainer: {
    position: 'absolute',
    width: SPEEDO_SIZE,
    height: SPEEDO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  needle: {
    position: 'absolute',
    width: 3,
    height: SPEEDO_SIZE / 2 - 20,
    borderRadius: 2,
    bottom: SPEEDO_SIZE / 2,
    transformOrigin: 'center bottom',
  },
  needleCenter: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  // Distance bar
  distanceBar: {
    marginHorizontal: 16,
    marginTop: 8,
    alignItems: 'center',
    gap: 6,
  },
  distanceBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#2a2a2a',
    borderRadius: 3,
    overflow: 'hidden',
  },
  distanceBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  distanceText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
  },
  // Timer
  timerDisplay: {
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 16,
  },
  timerLabel: {
    fontSize: 12,
    color: '#888',
    letterSpacing: 2,
    marginBottom: 6,
    fontWeight: '600',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  timerValue: {
    fontSize: 52,
    fontWeight: 'bold',
    color: '#fff',
  },
  timerUnit: {
    fontSize: 26,
    color: '#888',
    marginLeft: 4,
  },
  // PB Badge
  pbBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  pbBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  pbDeltaText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  // Run stats
  runStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  runStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  runStatText: {
    fontSize: 13,
    color: '#ccc',
    fontWeight: '600',
  },
  // GPS
  gpsStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  gpsText: {
    fontSize: 11,
    color: '#888',
  },
  // Buttons
  controlButtons: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  mainButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  resultButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  resultBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  resultBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  resultBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  shareBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 6,
    backgroundColor: '#333',
    borderRadius: 16,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  // Warning
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 11,
    color: '#FF9800',
    lineHeight: 16,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
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
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  // Car picker
  carOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  carOptionSelected: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
  },
  carOptionText: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
  carCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    marginHorizontal: 20,
  },
  carCustomBtnText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  // Manual entry form
  formLabel: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 6,
    marginTop: 12,
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
  manualModeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  manualModeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#252525',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualModeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 20,
    gap: 8,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
