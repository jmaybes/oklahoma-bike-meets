import React from 'react';
import { Image, StyleSheet } from 'react-native';

interface HeaderLogoProps {
  height?: number;
}

export const HeaderLogo: React.FC<HeaderLogoProps> = ({ height = 28 }) => {
  return (
    <Image
      source={require('../assets/images/header-logo.png')}
      style={[styles.logo, { height }]}
      resizeMode="contain"
    />
  );
};

const styles = StyleSheet.create({
  logo: {
    width: 120,
    height: 28,
  },
});

export default HeaderLogo;
