import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  Easing,
  interpolate,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_SIZE = SCREEN_WIDTH;
const CAROUSEL_HEIGHT = 260;

interface Props {
  photos: string[];
}

export default function Garage3DCarousel({ photos }: Props) {
  const validPhotos = photos.filter(p => p && p.length > 0);
  const n = validPhotos.length;

  if (n === 0) return null;
  if (n === 1) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: validPhotos[0] }} style={styles.singleImage} resizeMode="cover" />
      </View>
    );
  }

  const progress = useSharedValue(0);
  const CYCLE_DURATION = 3000; // ms per image
  const TOTAL_DURATION = CYCLE_DURATION * n;

  useEffect(() => {
    // Build a sequence: for each image, hold then transition
    const steps: any[] = [];
    for (let i = 0; i < n; i++) {
      // Hold at current position
      steps.push(withTiming(i, { duration: 0 }));
      // Wait (hold)
      steps.push(withDelay(CYCLE_DURATION * 0.65, withTiming(i + 1, {
        duration: CYCLE_DURATION * 0.35,
        easing: Easing.bezier(0.5, -0.2, 0.5, 1.2),
      })));
    }

    progress.value = 0;
    progress.value = withRepeat(
      withSequence(...steps),
      -1,
      false
    );
  }, [n]);

  return (
    <View style={styles.container}>
      {validPhotos.map((photo, index) => (
        <CarouselFace
          key={`${photo}-${index}`}
          photo={photo}
          index={index}
          total={n}
          progress={progress}
        />
      ))}
    </View>
  );
}

interface FaceProps {
  photo: string;
  index: number;
  total: number;
  progress: Animated.SharedValue<number>;
}

function CarouselFace({ photo, index, total, progress }: FaceProps) {
  const animatedStyle = useAnimatedStyle(() => {
    // Each face occupies a 1-unit segment of the progress
    // Face i is "front" when progress mod total === i
    const p = progress.value % total;

    // Distance from this face's "front" position
    // We need to handle wrapping
    let diff = p - index;
    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;

    // Map diff to rotation angle (each face = 360/total degrees apart)
    const anglePerFace = 360 / total;
    const rotateX = diff * anglePerFace;

    // Only show faces that are roughly front-facing (-90 to 90 degrees)
    const opacity = interpolate(
      Math.abs(rotateX),
      [0, 60, 90, 180],
      [1, 0.6, 0, 0],
      'clamp'
    );

    // Translate based on rotation to create cylinder depth
    const radius = CAROUSEL_HEIGHT * 0.45;
    const translateY = Math.sin((rotateX * Math.PI) / 180) * radius;
    const scale = interpolate(
      Math.abs(rotateX),
      [0, 90, 180],
      [1, 0.7, 0.5],
      'clamp'
    );

    return {
      opacity,
      transform: [
        { perspective: 800 },
        { rotateX: `${-rotateX}deg` },
        { translateY: translateY * 0.3 },
        { scale },
      ],
      zIndex: opacity > 0.5 ? 10 : 1,
    };
  });

  return (
    <Animated.View style={[styles.face, animatedStyle]}>
      <Image source={{ uri: photo }} style={styles.faceImage} resizeMode="cover" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CAROUSEL_SIZE,
    height: CAROUSEL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  singleImage: {
    width: '100%',
    height: '100%',
  },
  face: {
    position: 'absolute',
    width: '100%',
    height: CAROUSEL_HEIGHT,
    backfaceVisibility: 'hidden',
  },
  faceImage: {
    width: '100%',
    height: '100%',
  },
});
