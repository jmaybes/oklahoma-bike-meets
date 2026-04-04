import React, { useEffect, useState, useCallback } from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_HEIGHT = 260;
// Half the height = the "radius" of the cube face from center
const FACE_OFFSET = CAROUSEL_HEIGHT / 2;

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
        <Image source={{ uri: validPhotos[0] }} style={styles.fullImage} resizeMode="cover" />
      </View>
    );
  }

  const [currentIndex, setCurrentIndex] = useState(0);
  const rotation = useSharedValue(0);

  const advanceToNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % n);
    rotation.value = 0;
  }, [n]);

  useEffect(() => {
    const cycle = () => {
      // Hold for 2.5s, then rotate over 0.8s
      const holdTimer = setTimeout(() => {
        rotation.value = withTiming(
          -90,
          {
            duration: 800,
            easing: Easing.bezier(0.4, 0.0, 0.2, 1),
          },
          (finished) => {
            if (finished) {
              runOnJS(advanceToNext)();
            }
          }
        );
      }, 2500);

      return holdTimer;
    };

    const timer = cycle();
    const interval = setInterval(() => {
      // This will be managed by the animation callback
    }, 3300);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [currentIndex, n]);

  const nextIndex = (currentIndex + 1) % n;

  // Current face: starts at 0deg (front-facing), rotates to -90deg (top, going away)
  const currentFaceStyle = useAnimatedStyle(() => {
    const rotX = rotation.value; // 0 to -90
    // When at 0: fully visible, front-facing
    // When at -90: rotated up and away
    const opacity = rotX < -85 ? 0 : 1;

    return {
      transform: [
        { perspective: 600 },
        { rotateX: `${rotX}deg` },
        // Translate the face so it rotates around the bottom edge (like a cube)
        { translateY: -FACE_OFFSET * (1 - Math.cos((-rotX * Math.PI) / 180)) * 0.5 },
      ],
      opacity,
      zIndex: rotX > -45 ? 2 : 1,
    };
  });

  // Next face: starts at 90deg (below, hidden), rotates to 0deg (front-facing)
  const nextFaceStyle = useAnimatedStyle(() => {
    const rotX = rotation.value + 90; // starts at 90, ends at 0
    const opacity = rotX > 85 ? 0 : 1;

    return {
      transform: [
        { perspective: 600 },
        { rotateX: `${rotX}deg` },
        { translateY: FACE_OFFSET * (1 - Math.cos((rotX * Math.PI) / 180)) * 0.5 },
      ],
      opacity,
      zIndex: rotX < 45 ? 2 : 1,
    };
  });

  return (
    <View style={styles.container}>
      {/* Next face (behind/below, rotates in) */}
      <Animated.View style={[styles.face, nextFaceStyle]}>
        <Image
          source={{ uri: validPhotos[nextIndex] }}
          style={styles.fullImage}
          resizeMode="cover"
        />
      </Animated.View>

      {/* Current face (front, rotates out) */}
      <Animated.View style={[styles.face, currentFaceStyle]}>
        <Image
          source={{ uri: validPhotos[currentIndex] }}
          style={styles.fullImage}
          resizeMode="cover"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: CAROUSEL_HEIGHT,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: CAROUSEL_HEIGHT,
    backfaceVisibility: 'hidden',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
});
