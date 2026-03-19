import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type RunType = '0-60' | '0-100' | 'quarter-mile';

interface RunResult {
  type: RunType;
  time: number;
  topSpeed: number;
  timestamp: Date;
}

export default function TimerScreen() {
  const { user, isAuthenticated } = useAuth();
  const [selectedMode, setSelectedMode] = useState<RunType>('0-60');
  const [isRunning, setIsRunning] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [topSpeed, setTopSpeed] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);
  const [locationPermission, setLocationPermission] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [waitingForStart, setWaitingForStart] = useState(false);
  
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const startTime = useRef<number | null>(null);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);

  const modes = [
    { type: '0-60' as RunType, label: '0-60 MPH', target: 60, icon: 'speedometer', color: '#FF6B35' },
    { type: '0-100' as RunType, label: '0-100 MPH', target: 100, icon: 'rocket', color: '#E91E63' },
    { type: 'quarter-mile' as RunType, label: '1/4 Mile', target: 0, icon: 'flag', color: '#9C27B0' },
  ];

  useEffect(() => {
    requestLocationPermission();
    return () => {
      stopTracking();
    };
  }, []);

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

  const startWaitingForMovement = async () => {
    setWaitingForStart(true);
    setResult(null);
    setElapsedTime(0);
    setTopSpeed(0);
    setCurrentSpeed(0);

    try {
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 100,
          distanceInterval: 0,
        },
        (location) => {
          const speedMph = (location.coords.speed || 0) * 2.237;
          setCurrentSpeed(Math.max(0, speedMph));
          setGpsAccuracy(location.coords.accuracy);

          if (waitingForStart && speedMph > 1 && !isRunning) {
            actuallyStartRun();
          }

          if (isRunning) {
            handleSpeedUpdate(speedMph);
          }
        }
      );
    } catch (error) {
      console.error('Error starting location tracking:', error);
      setWaitingForStart(false);
      Alert.alert('Error', 'Failed to start GPS tracking');
    }
  };

  const actuallyStartRun = () => {
    setWaitingForStart(false);
    setIsRunning(true);
    startTime.current = Date.now();
    
    timerInterval.current = setInterval(() => {
      if (startTime.current) {
        setElapsedTime((Date.now() - startTime.current) / 1000);
      }
    }, 10);
  };

  const handleSpeedUpdate = (speedMph: number) => {
    if (!startTime.current) return;

    setTopSpeed((prev) => Math.max(prev, speedMph));

    const mode = modes.find((m) => m.type === selectedMode);
    if (!mode) return;

    if (selectedMode !== 'quarter-mile' && speedMph >= mode.target) {
      const finalTime = (Date.now() - startTime.current) / 1000;
      completeRun(finalTime, speedMph);
    }
  };

  const completeRun = async (time: number, topSpeedResult: number) => {
    stopTracking();
    
    const runResult: RunResult = {
      type: selectedMode,
      time: time,
      topSpeed: topSpeedResult,
      timestamp: new Date(),
    };
    setResult(runResult);

    if (isAuthenticated && user) {
      try {
        const runData: any = {
          userId: user.id,
          carInfo: `${user.name}'s Car`,
          location: 'Oklahoma City',
        };

        if (selectedMode === '0-60') {
          runData.zeroToSixty = parseFloat(time.toFixed(2));
        } else if (selectedMode === '0-100') {
          runData.zeroToHundred = parseFloat(time.toFixed(2));
        } else {
          runData.quarterMile = parseFloat(time.toFixed(2));
        }

        await axios.post(`${API_URL}/api/performance-runs`, runData);
        Alert.alert(
          'Run Recorded!',
          `Your ${selectedMode} time of ${time.toFixed(2)}s has been saved!`,
          [{ text: 'View Leaderboard', onPress: () => router.push('/timer/leaderboard') }, { text: 'OK' }]
        );
      } catch (error) {
        console.error('Error saving run:', error);
      }
    }
  };

  const stopTracking = () => {
    setIsRunning(false);
    setWaitingForStart(false);
    
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }
    startTime.current = null;
  };

  const resetTimer = () => {
    stopTracking();
    setCurrentSpeed(0);
    setTopSpeed(0);
    setElapsedTime(0);
    setResult(null);
    setGpsAccuracy(null);
  };

  const formatTime = (seconds: number) => {
    return seconds.toFixed(2);
  };

  const getSpeedColor = () => {
    if (currentSpeed < 30) return '#4CAF50';
    if (currentSpeed < 60) return '#FF9800';
    if (currentSpeed < 100) return '#FF6B35';
    return '#E91E63';
  };

  const selectedModeColor = modes.find(m => m.type === selectedMode)?.color || '#FF6B35';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#FF6B35', '#E91E63']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Performance Timer</Text>
              <Text style={styles.headerSubtitle}>Test your acceleration</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/timer/leaderboard')}>
              <Ionicons name="trophy" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Mode Selector */}
        <View style={styles.modeSelector}>
          {modes.map((mode) => (
            <TouchableOpacity
              key={mode.type}
              style={[
                styles.modeButton,
                selectedMode === mode.type && { backgroundColor: mode.color },
              ]}
              onPress={() => !isRunning && !waitingForStart && setSelectedMode(mode.type)}
              disabled={isRunning || waitingForStart}
            >
              <Ionicons
                name={mode.icon as any}
                size={20}
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

        {/* Speedometer Display */}
        <View style={styles.speedometerContainer}>
          <View style={[styles.speedometerOuter, { borderColor: selectedModeColor }]}>
            <View style={styles.speedometerInner}>
              {countdown !== null ? (
                <Text style={[styles.countdownText, { color: selectedModeColor }]}>{countdown}</Text>
              ) : waitingForStart ? (
                <View style={styles.waitingContainer}>
                  <Text style={styles.waitingText}>READY</Text>
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
          </View>
        </View>

        {/* Timer Display */}
        <View style={styles.timerDisplay}>
          <Text style={styles.timerLabel}>{selectedMode.toUpperCase()} TIME</Text>
          <View style={styles.timerRow}>
            <Text style={styles.timerValue}>
              {result ? formatTime(result.time) : formatTime(elapsedTime)}
            </Text>
            <Text style={styles.timerUnit}>s</Text>
          </View>
          {(isRunning || result) && (
            <Text style={styles.topSpeedText}>
              Top Speed: {topSpeed.toFixed(1)} MPH
            </Text>
          )}
        </View>

        {/* GPS Status */}
        <View style={styles.gpsStatus}>
          <Ionicons
            name={locationPermission ? 'navigate' : 'navigate-outline'}
            size={16}
            color={gpsAccuracy && gpsAccuracy < 10 ? '#4CAF50' : '#888'}
          />
          <Text style={styles.gpsText}>
            GPS: {gpsAccuracy ? `±${gpsAccuracy.toFixed(0)}m` : 'Waiting...'}
          </Text>
        </View>

        {/* Control Buttons */}
        <View style={styles.controlButtons}>
          {!isRunning && !waitingForStart && !result && (
            <TouchableOpacity
              style={styles.startButton}
              onPress={startCountdown}
              disabled={!locationPermission}
            >
              <LinearGradient
                colors={['#4CAF50', '#2E7D32']}
                style={styles.buttonGradient}
              >
                <Ionicons name="play" size={32} color="#fff" />
                <Text style={styles.buttonText}>START RUN</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {(isRunning || waitingForStart) && (
            <TouchableOpacity style={styles.stopButton} onPress={stopTracking}>
              <LinearGradient
                colors={['#FF3B30', '#C62828']}
                style={styles.buttonGradient}
              >
                <Ionicons name="stop" size={32} color="#fff" />
                <Text style={styles.buttonText}>ABORT</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {result && (
            <TouchableOpacity style={styles.resetButton} onPress={resetTimer}>
              <LinearGradient
                colors={['#FF6B35', '#E91E63']}
                style={styles.buttonGradient}
              >
                <Ionicons name="refresh" size={28} color="#fff" />
                <Text style={styles.buttonText}>TRY AGAIN</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/timer/leaderboard')}
          >
            <Ionicons name="trophy" size={24} color="#FFD700" />
            <Text style={styles.actionButtonText}>Leaderboard</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/timer/my-runs')}
          >
            <Ionicons name="time" size={24} color="#2196F3" />
            <Text style={styles.actionButtonText}>My Runs</Text>
          </TouchableOpacity>
        </View>

        {/* Safety Warning */}
        <View style={styles.warningContainer}>
          <Ionicons name="warning" size={20} color="#FF9800" />
          <Text style={styles.warningText}>
            Only use on closed courses or private property. Always prioritize safety.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const SPEEDO_SIZE = Math.min(width * 0.65, 260);

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
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  modeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 10,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 6,
  },
  modeButtonText: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  speedometerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  speedometerOuter: {
    width: SPEEDO_SIZE,
    height: SPEEDO_SIZE,
    borderRadius: SPEEDO_SIZE / 2,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
  },
  speedometerInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedDisplay: {
    alignItems: 'center',
  },
  currentSpeedText: {
    fontSize: 72,
    fontWeight: 'bold',
    lineHeight: 80,
  },
  speedUnit: {
    fontSize: 22,
    color: '#888',
    marginTop: -8,
  },
  countdownText: {
    fontSize: 100,
    fontWeight: 'bold',
    lineHeight: 110,
  },
  waitingContainer: {
    alignItems: 'center',
  },
  waitingText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  waitingSubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
  timerDisplay: {
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 20,
  },
  timerLabel: {
    fontSize: 14,
    color: '#888',
    letterSpacing: 2,
    marginBottom: 8,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  timerValue: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#fff',
  },
  timerUnit: {
    fontSize: 28,
    color: '#888',
    marginLeft: 4,
  },
  topSpeedText: {
    fontSize: 16,
    color: '#FF6B35',
    marginTop: 8,
  },
  gpsStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  gpsText: {
    fontSize: 12,
    color: '#888',
  },
  controlButtons: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  startButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  stopButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  resetButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 10,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#FF9800',
    lineHeight: 18,
  },
});
