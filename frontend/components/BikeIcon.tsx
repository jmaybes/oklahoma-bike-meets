import React from 'react';
import { Image, StyleSheet } from 'react-native';

interface BikeIconProps {
  size?: number;
  style?: any;
}

// Small bike icon for use throughout the app
export const BikeIcon: React.FC<BikeIconProps> = ({ size = 24, style }) => {
  return (
    <Image 
      source={require('../assets/images/small-bike-icon.png')} 
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
};

// Large header logo with text
export const BikeHeaderLogo: React.FC<BikeIconProps> = ({ size = 120, style }) => {
  return (
    <Image 
      source={require('../assets/images/header-logo.png')} 
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
};

export default BikeIcon;
