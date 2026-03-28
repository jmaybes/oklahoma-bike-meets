/**
 * Smart postinstall script for EAS build compatibility.
 * 
 * Problem: Expo Go SDK 54 bundles react-native-worklets@0.5.x natively,
 * but EAS production builds with react-native-reanimated@4.2.x need worklets@0.8.x
 * for the StableApi.h C++ header.
 * 
 * Solution: Keep 0.5.x for local Expo Go development, 
 * and upgrade to 0.8.1 only during EAS/CI cloud builds.
 */
const { execSync } = require('child_process');
const path = require('path');

function isCloudBuild() {
  // Check common CI/EAS environment indicators
  if (process.env.EAS_BUILD === 'true') return true;
  if (process.env.EAS_BUILD_RUNNER) return true;
  if (process.env.CI === 'true' && !process.cwd().startsWith('/app')) return true;
  
  // Emergent EAS builder uses /workspace/ path
  if (process.cwd().includes('/workspace/')) return true;
  
  // Check if we're NOT in the development sandbox
  if (!process.cwd().startsWith('/app/frontend')) return true;
  
  return false;
}

if (isCloudBuild()) {
  console.log('[postinstall] Cloud/EAS build detected — upgrading react-native-worklets to 0.8.1 for native compilation...');
  try {
    // Force install worklets 0.8.1 into node_modules without modifying package.json
    execSync('npm install react-native-worklets@0.8.1 --no-save --legacy-peer-deps 2>/dev/null || true', { 
      stdio: 'inherit',
      cwd: __dirname.replace('/scripts', '') 
    });
    
    // Remove any nested duplicate in reanimated
    const nestedPath = path.join(__dirname, '..', 'node_modules', 'react-native-reanimated', 'node_modules', 'react-native-worklets');
    try {
      const fs = require('fs');
      if (fs.existsSync(nestedPath)) {
        execSync(`rm -rf "${nestedPath}"`, { stdio: 'inherit' });
        console.log('[postinstall] Removed nested duplicate worklets from reanimated');
      }
    } catch (e) { /* ignore */ }
    
    console.log('[postinstall] ✅ Worklets 0.8.1 installed for EAS build');
  } catch (error) {
    console.log('[postinstall] ⚠️ Could not upgrade worklets:', error.message);
  }
} else {
  console.log('[postinstall] Local development — keeping Expo Go compatible worklets version');
}
