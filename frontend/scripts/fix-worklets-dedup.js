/**
 * fix-worklets-dedup.js
 * 
 * Postinstall script to resolve react-native-worklets duplication.
 * 
 * The EAS deployment pipeline sometimes installs a conflicting version
 * of react-native-worklets at the top level (0.7.x) while
 * react-native-reanimated bundles a different version (0.8.x) as a
 * nested dependency. This causes iOS builds to fail because CocoaPods
 * picks up the wrong C++ headers ('worklets/Compat/StableApi.h' not found).
 * 
 * This script ensures only one version exists at the top level by
 * preferring the version bundled with react-native-reanimated.
 */

const fs = require('fs');
const path = require('path');

const nodeModules = path.join(__dirname, '..', 'node_modules');
const topLevelWorklets = path.join(nodeModules, 'react-native-worklets');
const nestedWorklets = path.join(nodeModules, 'react-native-reanimated', 'node_modules', 'react-native-worklets');

function getVersion(pkgPath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgPath, 'package.json'), 'utf8'));
    return pkg.version;
  } catch {
    return null;
  }
}

function run() {
  const topVersion = getVersion(topLevelWorklets);
  const nestedVersion = getVersion(nestedWorklets);

  console.log(`[fix-worklets-dedup] Top-level worklets: ${topVersion || 'not found'}`);
  console.log(`[fix-worklets-dedup] Nested worklets (reanimated): ${nestedVersion || 'not found'}`);

  // Case 1: Both exist and differ → duplicate problem
  if (topVersion && nestedVersion && topVersion !== nestedVersion) {
    console.log(`[fix-worklets-dedup] Duplicate detected! Replacing top-level ${topVersion} with ${nestedVersion}`);
    
    // Remove the incorrect top-level version
    fs.rmSync(topLevelWorklets, { recursive: true, force: true });
    
    // Copy the correct nested version to top level
    fs.cpSync(nestedWorklets, topLevelWorklets, { recursive: true });
    
    // Remove the nested copy (now redundant)
    fs.rmSync(nestedWorklets, { recursive: true, force: true });
    
    // Also remove the parent node_modules dir if it's empty
    const nestedNodeModules = path.join(nodeModules, 'react-native-reanimated', 'node_modules');
    try {
      const remaining = fs.readdirSync(nestedNodeModules);
      if (remaining.length === 0) {
        fs.rmSync(nestedNodeModules, { recursive: true, force: true });
      }
    } catch {}

    const finalVersion = getVersion(topLevelWorklets);
    console.log(`[fix-worklets-dedup] ✅ Deduplicated! react-native-worklets@${finalVersion} at top level`);
  }
  // Case 2: Only nested exists (top level missing)
  else if (!topVersion && nestedVersion) {
    console.log(`[fix-worklets-dedup] Top-level missing. Copying ${nestedVersion} from nested.`);
    fs.cpSync(nestedWorklets, topLevelWorklets, { recursive: true });
    fs.rmSync(nestedWorklets, { recursive: true, force: true });
    console.log(`[fix-worklets-dedup] ✅ Hoisted react-native-worklets@${nestedVersion} to top level`);
  }
  // Case 3: Same version or only top-level exists
  else if (topVersion && nestedVersion && topVersion === nestedVersion) {
    console.log(`[fix-worklets-dedup] Both are ${topVersion}. Removing nested duplicate.`);
    fs.rmSync(nestedWorklets, { recursive: true, force: true });
    console.log(`[fix-worklets-dedup] ✅ Removed redundant nested copy`);
  }
  else {
    console.log(`[fix-worklets-dedup] ✅ No deduplication needed`);
  }
}

try {
  run();
} catch (err) {
  console.error('[fix-worklets-dedup] Error during deduplication:', err.message);
  // Don't fail the install - this is a best-effort fix
  process.exit(0);
}
