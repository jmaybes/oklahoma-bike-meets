/**
 * Expo config plugin to ensure the app is NOT flagged as a routing app by Apple.
 * 
 * This removes MKDirectionsApplicationSupportedModes from Info.plist,
 * which prevents Apple from requiring "routing app" declarations.
 * 
 * Without this, react-native-maps or other map libraries may cause
 * the key to be auto-added during prebuild, leading to App Store rejection.
 */
const { withInfoPlist } = require('expo/config-plugins');

const withNoRoutingApp = (config) => {
  return withInfoPlist(config, (config) => {
    // Remove MKDirectionsApplicationSupportedModes if any library added it
    if (config.modResults.MKDirectionsApplicationSupportedModes) {
      delete config.modResults.MKDirectionsApplicationSupportedModes;
    }
    
    // Also remove CFBundleDocumentTypes with MKDirectionsRequest if present
    if (config.modResults.CFBundleDocumentTypes) {
      config.modResults.CFBundleDocumentTypes = config.modResults.CFBundleDocumentTypes.filter(
        (docType) => {
          const lsItemContentTypes = docType.LSItemContentTypes || [];
          return !lsItemContentTypes.includes('com.apple.maps.directionsrequest');
        }
      );
      // Remove empty array
      if (config.modResults.CFBundleDocumentTypes.length === 0) {
        delete config.modResults.CFBundleDocumentTypes;
      }
    }
    
    return config;
  });
};

module.exports = withNoRoutingApp;
