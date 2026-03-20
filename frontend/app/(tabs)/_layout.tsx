import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  
  // Calculate bottom padding - ensure tab bar is above system navigation
  const bottomPadding = Platform.OS === 'ios' 
    ? Math.max(insets.bottom, 10) 
    : Math.max(insets.bottom, 16);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: '#aaa',
        tabBarStyle: {
          backgroundColor: '#1a1a1a',
          borderTopColor: '#333',
          borderTopWidth: 1,
          height: 60 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
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
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons 
              name={focused ? "car-sport" : "car-sport-outline"} 
              size={size} 
              color={focused ? '#FF6B35' : '#aaa'} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="nearby"
        options={{
          title: 'Nearby',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons 
              name={focused ? "location" : "location-outline"} 
              size={size} 
              color={focused ? '#FF6B35' : '#aaa'} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="clubs"
        options={{
          title: 'Clubs',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons 
              name={focused ? "people" : "people-outline"} 
              size={size} 
              color={focused ? '#FF6B35' : '#aaa'} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons 
              name={focused ? "add-circle" : "add-circle-outline"} 
              size={size} 
              color={focused ? '#FF6B35' : '#aaa'} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Garage',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons 
              name={focused ? "car" : "car-outline"} 
              size={size} 
              color={focused ? '#FF6B35' : '#aaa'} 
            />
          ),
        }}
      />
    </Tabs>
  );
}
