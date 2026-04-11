import React from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_HEIGHT = 260;

interface Props {
  photos: string[];
}

export default function Garage3DCarousel({ photos }: Props) {
  const validPhotos = photos.filter(p => p && p.length > 0);

  if (validPhotos.length === 0) return null;

  return (
    <View style={styles.container}>
      <Image source={{ uri: validPhotos[0] }} style={styles.fullImage} resizeMode="cover" />
    </View>
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
  fullImage: {
    width: '100%',
    height: '100%',
  },
});
