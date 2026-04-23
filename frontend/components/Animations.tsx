/**
 * Animation Components Library
 * Beautiful, performant animations for the OKC Car Events app
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  interpolate,
  Extrapolate,
  FadeIn,
  FadeOut,
  FadeInDown,
  FadeInUp,
  FadeInLeft,
  FadeInRight,
  SlideInDown,
  SlideInUp,
  SlideInLeft,
  SlideInRight,
  SlideOutDown,
  SlideOutUp,
  ZoomIn,
  ZoomOut,
  BounceIn,
  BounceInDown,
  FlipInXUp,
  LightSpeedInLeft,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

// ==================== Animation Presets ====================

export const springConfig = {
  damping: 15,
  stiffness: 150,
  mass: 1,
};

export const bouncySpring = {
  damping: 10,
  stiffness: 200,
  mass: 0.8,
};

export const gentleSpring = {
  damping: 20,
  stiffness: 100,
  mass: 1,
};

// ==================== Entering Animations ====================

export const enteringAnimations = {
  fadeIn: FadeIn.duration(400),
  fadeInDown: FadeInDown.duration(500).springify(),
  fadeInUp: FadeInUp.duration(500).springify(),
  fadeInLeft: FadeInLeft.duration(400),
  fadeInRight: FadeInRight.duration(400),
  slideInDown: SlideInDown.springify().damping(15),
  slideInUp: SlideInUp.springify().damping(15),
  slideInLeft: SlideInLeft.springify().damping(15),
  slideInRight: SlideInRight.springify().damping(15),
  zoomIn: ZoomIn.springify().damping(12),
  bounceIn: BounceIn.duration(600),
  bounceInDown: BounceInDown.duration(600),
  flipIn: FlipInXUp.duration(500),
  lightSpeed: LightSpeedInLeft.duration(400),
};

// ==================== Exiting Animations ====================

export const exitingAnimations = {
  fadeOut: FadeOut.duration(300),
  slideOutDown: SlideOutDown.springify().damping(15),
  slideOutUp: SlideOutUp.springify().damping(15),
  zoomOut: ZoomOut.duration(300),
};

// ==================== Animated Pressable Button ====================

interface AnimatedButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  scaleValue?: number;
  disabled?: boolean;
}

export const AnimatedPressable: React.FC<AnimatedButtonProps> = ({
  children,
  onPress,
  style,
  scaleValue = 0.95,
  disabled = false,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(scaleValue, bouncySpring);
    opacity.value = withTiming(0.8, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, bouncySpring);
    opacity.value = withTiming(1, { duration: 100 });
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// ==================== Staggered List Item ====================

interface StaggeredItemProps {
  children: React.ReactNode;
  index: number;
  style?: ViewStyle;
}

export const StaggeredItem: React.FC<StaggeredItemProps> = ({
  children,
  index,
  style,
}) => {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80).springify().damping(15)}
      style={style}
    >
      {children}
    </Animated.View>
  );
};

// ==================== Pulse Animation ====================

interface PulseProps {
  children: React.ReactNode;
  style?: ViewStyle;
  duration?: number;
}

export const PulseView: React.FC<PulseProps> = ({
  children,
  style,
  duration = 1500,
}) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: duration / 2 }),
        withTiming(1, { duration: duration / 2 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

// ==================== Shake Animation ====================

interface ShakeProps {
  children: React.ReactNode;
  style?: ViewStyle;
  trigger?: boolean;
}

export const ShakeView: React.FC<ShakeProps> = ({
  children,
  style,
  trigger,
}) => {
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (trigger) {
      translateX.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    }
  }, [trigger]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

// ==================== Floating Animation ====================

interface FloatingProps {
  children: React.ReactNode;
  style?: ViewStyle;
  amplitude?: number;
  duration?: number;
}

export const FloatingView: React.FC<FloatingProps> = ({
  children,
  style,
  amplitude = 8,
  duration = 2000,
}) => {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-amplitude, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(amplitude, { duration: duration / 2, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

// ==================== Glow Animation ====================

interface GlowProps {
  children: React.ReactNode;
  style?: ViewStyle;
  color?: string;
}

export const GlowView: React.FC<GlowProps> = ({
  children,
  style,
  color = '#E31837',
}) => {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0.5, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: opacity.value,
    shadowRadius: 15,
    elevation: 10,
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

// ==================== Slide In Card ====================

interface SlideInCardProps {
  children: React.ReactNode;
  index?: number;
  direction?: 'left' | 'right' | 'up' | 'down';
  style?: ViewStyle;
}

export const SlideInCard: React.FC<SlideInCardProps> = ({
  children,
  index = 0,
  direction = 'up',
  style,
}) => {
  const getEnteringAnimation = () => {
    const delay = index * 100;
    switch (direction) {
      case 'left':
        return FadeInLeft.delay(delay).springify().damping(15);
      case 'right':
        return FadeInRight.delay(delay).springify().damping(15);
      case 'down':
        return FadeInDown.delay(delay).springify().damping(15);
      case 'up':
      default:
        return FadeInUp.delay(delay).springify().damping(15);
    }
  };

  return (
    <Animated.View entering={getEnteringAnimation()} style={style}>
      {children}
    </Animated.View>
  );
};

// ==================== Animated Tab Icon ====================

interface AnimatedTabIconProps {
  children: React.ReactNode;
  focused: boolean;
  style?: ViewStyle;
}

export const AnimatedTabIcon: React.FC<AnimatedTabIconProps> = ({
  children,
  focused,
  style,
}) => {
  const scale = useSharedValue(focused ? 1.15 : 1);
  const translateY = useSharedValue(focused ? -4 : 0);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.15 : 1, bouncySpring);
    translateY.value = withSpring(focused ? -4 : 0, bouncySpring);
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

// ==================== Progress Bar Animation ====================

interface AnimatedProgressProps {
  progress: number;
  color?: string;
  height?: number;
  style?: ViewStyle;
}

export const AnimatedProgress: React.FC<AnimatedProgressProps> = ({
  progress,
  color = '#E31837',
  height = 4,
  style,
}) => {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withSpring(progress, springConfig);
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
    height,
    backgroundColor: color,
    borderRadius: height / 2,
  }));

  return (
    <View style={[{ backgroundColor: '#333', borderRadius: height / 2 }, style]}>
      <Animated.View style={animatedStyle} />
    </View>
  );
};

// ==================== Ripple Effect ====================

interface RippleProps {
  children: React.ReactNode;
  onPress?: () => void;
  color?: string;
  style?: ViewStyle;
}

export const RippleButton: React.FC<RippleProps> = ({
  children,
  onPress,
  color = 'rgba(225, 85, 0, 0.3)',
  style,
}) => {
  const rippleScale = useSharedValue(0);
  const rippleOpacity = useSharedValue(0);

  const rippleStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 200,
    height: 200,
    marginLeft: -100,
    marginTop: -100,
    borderRadius: 100,
    backgroundColor: color,
    transform: [{ scale: rippleScale.value }],
    opacity: rippleOpacity.value,
  }));

  const handlePress = () => {
    rippleScale.value = 0;
    rippleOpacity.value = 1;
    rippleScale.value = withTiming(1.5, { duration: 400 });
    rippleOpacity.value = withTiming(0, { duration: 400 });
    onPress?.();
  };

  return (
    <Pressable onPress={handlePress} style={[{ overflow: 'hidden' }, style]}>
      <Animated.View style={rippleStyle} />
      {children}
    </Pressable>
  );
};

// ==================== Card Flip Animation ====================

interface FlipCardProps {
  front: React.ReactNode;
  back: React.ReactNode;
  isFlipped: boolean;
  style?: ViewStyle;
}

export const FlipCard: React.FC<FlipCardProps> = ({
  front,
  back,
  isFlipped,
  style,
}) => {
  const rotateY = useSharedValue(0);

  useEffect(() => {
    rotateY.value = withSpring(isFlipped ? 180 : 0, springConfig);
  }, [isFlipped]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${rotateY.value}deg` }],
    backfaceVisibility: 'hidden',
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${rotateY.value + 180}deg` }],
    backfaceVisibility: 'hidden',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  }));

  return (
    <View style={style}>
      <Animated.View style={frontStyle}>{front}</Animated.View>
      <Animated.View style={backStyle}>{back}</Animated.View>
    </View>
  );
};

// ==================== Skeleton Loader ====================

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#333',
        },
        style,
        animatedStyle,
      ]}
    />
  );
};

// ==================== Success Checkmark Animation ====================

interface SuccessCheckProps {
  visible: boolean;
  size?: number;
  color?: string;
}

export const SuccessCheck: React.FC<SuccessCheckProps> = ({
  visible,
  size = 60,
  color = '#EFFF00',
}) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSequence(
        withSpring(1.2, bouncySpring),
        withSpring(1, gentleSpring)
      );
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withTiming(0, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          justifyContent: 'center',
          alignItems: 'center',
        },
        animatedStyle,
      ]}
    >
      <View style={{ width: size * 0.4, height: size * 0.2, borderLeftWidth: 3, borderBottomWidth: 3, borderColor: '#fff', transform: [{ rotate: '-45deg' }, { translateY: -3 }] }} />
    </Animated.View>
  );
};

export default {
  AnimatedPressable,
  StaggeredItem,
  PulseView,
  ShakeView,
  FloatingView,
  GlowView,
  SlideInCard,
  AnimatedTabIcon,
  AnimatedProgress,
  RippleButton,
  FlipCard,
  Skeleton,
  SuccessCheck,
  enteringAnimations,
  exitingAnimations,
  springConfig,
  bouncySpring,
  gentleSpring,
};
