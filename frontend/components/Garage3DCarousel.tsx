import React, { useEffect, useCallback } from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
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
        <Image source={{ uri: validPhotos[0] }} style={styles.fullImage} resizeMode="cover" />
      </View>
    );
  }

  const currentFace = useSharedValue(0);
  const anglePerFace = 360 / n;

  const goToNextFace = useCallback(() => {
    const next = currentFace.value + 1;
    currentFace.value = withTiming(next, {
      duration: 1200,
      easing: Easing.bezier(0.5, -0.2, 0.5, 1.2),
    }, (finished) => {
      if (finished) {
        // If we've completed a full revolution, reset to avoid huge numbers
        if (currentFace.value >= n) {
          currentFace.value = 0;
        }
        runOnJS(scheduleNext)();
      }
    });
  }, [n]);

  const scheduleNext = useCallback(() => {
    // Hold for 1.5s, then rotate to next
    const timer = setTimeout(goToNextFace, 1500);
    return () => clearTimeout(timer);
  }, [goToNextFace]);

  useEffect(() => {
    const timer = setTimeout(goToNextFace, 2000); // Initial delay
    return () => clearTimeout(timer);
  }, [n]);

  return (
    <View style={styles.container}>
      {validPhotos.map((photo, index) => (
        <CylinderFace
          key={`face-${index}`}
          photo={photo}
          index={index}
          total={n}
          anglePerFace={anglePerFace}
          currentFace={currentFace}
        />
      ))}
    </View>
  );
}

interface FaceProps {
  photo: string;
  index: number;
  total: number;
  anglePerFace: number;
  currentFace: Animated.SharedValue<number>;
}

function CylinderFace({ photo, index, total, anglePerFace, currentFace }: FaceProps) {
  const animatedStyle = useAnimatedStyle(() => {
    // Current rotation angle of the cylinder
    const cylinderAngle = currentFace.value * anglePerFace;

    // This face's fixed position on the cylinder
    const faceAngle = index * anglePerFace;

    // Relative angle: how far this face is from facing the viewer
    let relAngle = faceAngle - cylinderAngle;

    // Normalize to -180..180
    relAngle = ((relAngle % 360) + 540) % 360 - 180;

    const absAngle = Math.abs(relAngle);

    // Opacity: visible when facing viewer, hidden when rotated away
    const opacity = interpolate(
      absAngle,
      [0, 50, 80, 180],
      [1, 0.9, 0, 0],
      'clamp'
    );

    // 3D cylinder radius (same math as CSS: 50%/tan(180deg/n))
    const tanVal = Math.tan((Math.PI) / total);
    const radius = (CAROUSEL_HEIGHT * 0.5) / tanVal;

    // Vertical displacement on the cylinder surface
    const translateY = -Math.sin((relAngle * Math.PI) / 180) * radius * 0.4;

    // Scale for depth
    const scale = interpolate(
      absAngle,
      [0, 90, 180],
      [1, 0.6, 0.4],
      'clamp'
    );

    return {
      opacity,
      transform: [
        { perspective: 400 },
        { rotateX: `${-relAngle * 0.8}deg` },
        { translateY },
        { scale },
      ],
      zIndex: absAngle < 90 ? Math.round(100 - absAngle) : 0,
    };
  });

  return (
    <Animated.View style={[styles.face, animatedStyle]}>
      <Image source={{ uri: photo }} style={styles.fullImage} resizeMode="cover" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: CAROUSEL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  face: {
    position: 'absolute',
    width: '100%',
    height: CAROUSEL_HEIGHT,
    backfaceVisibility: 'hidden',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
});
