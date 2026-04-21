/**
 * STEALTH VELOCITY THEME
 * A premium, aggressive theme for sport bike riders
 * 
 * Design Philosophy:
 * - Matte blacks and deep grays (stealth aesthetic)
 * - Crimson red accents (aggressive, like brake calipers)
 * - Burnt orange highlights (hot rotors, heat)
 * - Carbon fiber textures
 * - Clean typography with sharp edges
 */

export const theme = {
  // ==================== PRIMARY COLORS ====================
  colors: {
    // Backgrounds
    background: '#0A0A0A',           // Jet black - main background
    backgroundSecondary: '#141414',   // Slightly lighter for cards
    backgroundTertiary: '#1E1E1E',    // Card backgrounds
    surface: '#252525',               // Elevated surfaces
    surfaceLight: '#2D2D2D',          // Lighter surfaces
    
    // Primary accent - Crimson Red (aggressive, sporty)
    primary: '#E31837',               // Main red
    primaryDark: '#B81430',           // Darker shade
    primaryLight: '#FF2D4D',          // Lighter/hover state
    primaryMuted: 'rgba(227, 24, 55, 0.15)', // Subtle background
    
    // Secondary accent - Burnt Orange (heat, energy)
    secondary: '#FF6B35',             // Burnt orange
    secondaryDark: '#E55A2B',
    secondaryLight: '#FF8555',
    secondaryMuted: 'rgba(255, 107, 53, 0.15)',
    
    // Tertiary - Electric Blue (cool contrast)
    tertiary: '#0095FF',              // Electric blue
    tertiaryMuted: 'rgba(0, 149, 255, 0.15)',
    
    // Text colors
    text: '#FFFFFF',                  // Primary text
    textSecondary: '#B0B0B0',         // Secondary text
    textMuted: '#6B6B6B',             // Muted text
    textInverse: '#0A0A0A',           // Text on light backgrounds
    
    // Status colors
    success: '#00C853',               // Green
    successMuted: 'rgba(0, 200, 83, 0.15)',
    warning: '#FFB300',               // Amber
    warningMuted: 'rgba(255, 179, 0, 0.15)',
    error: '#FF3D3D',                 // Red
    errorMuted: 'rgba(255, 61, 61, 0.15)',
    info: '#0095FF',                  // Blue
    
    // UI elements
    border: '#2A2A2A',                // Default border
    borderLight: '#3A3A3A',           // Lighter border
    borderFocus: '#E31837',           // Focus state border
    divider: '#1E1E1E',               // Dividers
    
    // Gradients (as arrays for LinearGradient)
    gradientPrimary: ['#E31837', '#FF6B35'],      // Red to orange
    gradientDark: ['#141414', '#0A0A0A'],         // Dark fade
    gradientHero: ['rgba(10,10,10,0)', 'rgba(10,10,10,0.8)', '#0A0A0A'],
    gradientCard: ['#1E1E1E', '#141414'],
    gradientAccent: ['#E31837', '#B81430'],       // Red gradient
    gradientHot: ['#FF6B35', '#E31837'],          // Orange to red (heat)
    
    // Special
    overlay: 'rgba(0, 0, 0, 0.7)',
    overlayLight: 'rgba(0, 0, 0, 0.5)',
    shimmer: '#2A2A2A',
    
    // Carbon fiber pattern overlay
    carbonPattern: 'rgba(30, 30, 30, 0.5)',
  },
  
  // ==================== TYPOGRAPHY ====================
  typography: {
    // Font families (system fonts for now)
    fontFamily: {
      regular: 'System',
      medium: 'System',
      bold: 'System',
    },
    
    // Font sizes
    sizes: {
      xs: 10,
      sm: 12,
      md: 14,
      lg: 16,
      xl: 18,
      xxl: 22,
      xxxl: 28,
      hero: 36,
    },
    
    // Line heights
    lineHeights: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  
  // ==================== SPACING ====================
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  
  // ==================== BORDERS ====================
  borders: {
    radius: {
      none: 0,
      sm: 4,
      md: 8,
      lg: 12,
      xl: 16,
      full: 9999,
    },
    width: {
      thin: 1,
      medium: 2,
      thick: 3,
    },
  },
  
  // ==================== SHADOWS ====================
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 8,
    },
    glow: {
      shadowColor: '#E31837',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 12,
      elevation: 6,
    },
  },
  
  // ==================== HERO IMAGES ====================
  // Sport bike focused images
  heroImages: [
    'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200&q=80', // Sport bike action
    'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1200&q=80',   // Sleek motorcycle
    'https://images.unsplash.com/photo-1558980664-769d59546b3d?w=1200&q=80',   // Racing bike
    'https://images.unsplash.com/photo-1609630875171-b1321377ee65?w=1200&q=80', // Night rider
  ],
  
  // ==================== EVENT TYPE COLORS ====================
  eventTypeColors: {
    'Motorcycle Rally': '#E31837',
    'Bike Night': '#FF6B35',
    'Poker Run': '#00C853',
    'Group Ride': '#0095FF',
    'Bike Show': '#9C27B0',
    'Charity Ride': '#FFB300',
    'Swap Meet': '#607D8B',
    'Other': '#757575',
  },
};

// Export individual color constants for easy import
export const {
  colors,
  typography,
  spacing,
  borders,
  shadows,
  heroImages,
  eventTypeColors,
} = theme;

export default theme;
