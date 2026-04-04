import React, { useEffect, useState } from 'react';
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

  // Total rotation goes from 0 to 360 degrees (one full cylinder revolution)
  // Each face sits at angle = (i/n) * 360
  const rotation = useSharedValue(0);
  const anglePerFace = 360 / n;

  useEffect(() => {
    // Build keyframes: pause at each face, then rotate to next with elastic easing
    // CSS: 12s total, cubic-bezier(.5,-0.2,.5,1.2)
    // Each face gets ~(1/n) of the total duration
    // Within that segment: 3% pause at start, transition, 3% pause at end
    const TOTAL_DURATION = 12000; // 12 seconds for full revolution
    const SEGMENT = TOTAL_DURATION / n;
    const PAUSE = SEGMENT * 0.3;   // 30% pause (hold)
    const TRANSITION = SEGMENT * 0.7; // 70% transition

    const steps: any[] = [];
    for (let i = 0; i < n; i++) {
      const targetAngle = (i + 1) * anglePerFace;
      // Hold at current position
      steps.push(
        withDelay(PAUSE, withTiming(targetAngle, {
          duration: TRANSITION,
          easing: Easing.bezier(0.5, -0.2, 0.5, 1.2),
        }))
      );
    }

    rotation.value = 0;
    rotation.value = withRepeat(
      withSequence(...steps),
      -1,
      false,
    );
  }, [n]);

  return (
    <View style={styles.container}>
      {validPhotos.map((photo, index) => (
        <CylinderFace
          key={`face-${index}`}
          photo={photo}
          index={index}
          total={n}
          rotation={rotation}
        />
      ))}
    </View>
  );
}

interface FaceProps {
  photo: string;
  index: number;
  total: number;
  rotation: Animated.SharedValue<number>;
}

function CylinderFace({ photo, index, total, rotation }: FaceProps) {
  const faceAngle = (index / total) * 360; // This face's position on the cylinder

  const animatedStyle = useAnimatedStyle(() => {
    // The face's angle relative to the viewer
    // As the cylinder rotates, each face's apparent angle changes
    let relativeAngle = faceAngle - rotation.value;

    // Normalize to -180..180
    relativeAngle = ((relativeAngle % 360) + 540) % 360 - 180;

    // Face is visible when its relative angle is near 0 (facing viewer)
    // At ±90 degrees it's edge-on (invisible)
    const absAngle = Math.abs(relativeAngle);

    // Opacity: fully visible at 0°, fading from 40-80°, invisible at 80°+
    const opacity = interpolate(
      absAngle,
      [0, 40, 80, 180],
      [1, 1, 0, 0],
      'clamp'
    );

    // Scale: slight shrink as face rotates away
    const scale = interpolate(
      absAngle,
      [0, 90, 180],
      [1, 0.65, 0.5],
      'clamp'
    );

    // The cylinder radius - translateY to push face outward
    // In the CSS: translateY(50%/tan(180deg/n)) 
    const radiusAngle = (180 / total) * (Math.PI / 180);
    const radius = (CAROUSEL_HEIGHT * 0.5) / Math.tan(radiusAngle);

    // Vertical position on the cylinder
    const translateY = Math.sin((relativeAngle * Math.PI) / 180) * radius * 0.35;

    return {
      opacity,
      transform: [
        { perspective: 500 },
        { rotateX: `${-relativeAngle}deg` },
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
