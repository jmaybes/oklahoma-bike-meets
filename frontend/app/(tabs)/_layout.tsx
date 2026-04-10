import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, View } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { useEffect } from 'react';

// Animated Tab Icon Component
const AnimatedTabIcon = ({ 
  name, 
  focused, 
  size 
}: { 
  name: string; 
  focused: boolean; 
  size: number;
}) => {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (focused) {
      // Bouncy pop animation when selected
      scale.value = withSequence(
        withSpring(1.3, { damping: 8, stiffness: 300 }),
        withSpring(1.15, { damping: 10, stiffness: 200 })
      );
      translateY.value = withSpring(-3, { damping: 10, stiffness: 200 });
    } else {
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      translateY.value = withSpring(0, { damping: 15, stiffness: 200 });
    }
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons 
        name={name as any} 
        size={size + 2} 
        color={focused ? '#E15500' : '#ccc'} 
      />
    </Animated.View>
  );
};

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  
  // Calculate bottom padding - ensure tab bar is well above system navigation
  const bottomPadding = Platform.OS === 'ios' 
    ? Math.max(insets.bottom, 12) 
    : Math.max(insets.bottom, 20);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#E15500',
        tabBarInactiveTintColor: '#ccc',
        tabBarStyle: {
          backgroundColor: '#1a1a1a',
          borderTopColor: '#444',
          borderTopWidth: 1,
          height: 64 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 10,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.4,
          shadowRadius: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.3,
          textShadow: '-1px 20px 20px #ff6',
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Events',
          tabBarIcon: ({ focused, size }) => (
            <AnimatedTabIcon 
              name={focused ? "car-sport" : "car-sport-outline"} 
              focused={focused}
              size={size} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="nearby"
        options={{
          title: 'Nearby',
          tabBarIcon: ({ focused, size }) => (
            <AnimatedTabIcon 
              name={focused ? "location" : "location-outline"} 
              focused={focused}
              size={size} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="clubs"
        options={{
          title: 'Clubs',
          tabBarIcon: ({ focused, size }) => (
            <AnimatedTabIcon 
              name={focused ? "people" : "people-outline"} 
              focused={focused}
              size={size} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add',
          tabBarIcon: ({ focused, size }) => (
            <AnimatedTabIcon 
              name={focused ? "add-circle" : "add-circle-outline"} 
              focused={focused}
              size={size} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Garage',
          tabBarIcon: ({ focused, size }) => (
            <AnimatedTabIcon 
              name={focused ? "car" : "car-outline"} 
              focused={focused}
              size={size} 
            />
          ),
        }}
      />
    </Tabs>
  );
}
