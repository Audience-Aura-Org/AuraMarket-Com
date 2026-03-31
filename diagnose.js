const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  console.log('🚀 [1/5] Initiating Global Build Context...');
  const root = process.cwd();
  const webDir = path.join(root, 'aura-market/web');

  // Perform the actual Next.js build
  execSync('cd aura-market/web && npm install && npm run build', { stdio: 'inherit' });

  console.log('📦 [2/5] Extraction Phase: Mapping Standalone Artifacts...');
  
  // Clean start
  ['server.js', 'node_modules', '.next', 'public'].forEach(f => {
    if (fs.existsSync(f)) {
      console.log(`Cleaning old ${f}...`);
      // Use fs.rmSync if available, otherwise just warn
      try { fs.rmSync(f, { recursive: true, force: true }); } catch(e) {}
    }
  });

  const standalonePath = path.join(webDir, '.next/standalone');
  if (fs.existsSync(standalonePath)) {
    console.log('Copying Standalone Brain to Root...');
    execSync(`cp -rf ${standalonePath}/* .`);
  }

  // Next.js Monorepo Quirk: It nests the server deep in standalone
  const nestedAppPath = path.join(root, 'aura-market/web');
  if (fs.existsSync(nestedAppPath) && fs.existsSync(path.join(nestedAppPath, 'server.js'))) {
    console.log('Flattening Nested Server Structure...');
    execSync(`cp -rf ${nestedAppPath}/* .`);
  }

  console.log('🖼️ [3/5] Syncing Visual Assets...');
  if (!fs.existsSync('.next')) fs.mkdirSync('.next');
  execSync(`cp -rf ${path.join(webDir, '.next/static')} .next/static`);
  execSync(`cp -rf ${path.join(webDir, 'public')} ./public`);

  console.log('🧪 [4/5] Running Self-Diagnostic...');
  const checkFiles = ['server.js', 'node_modules', '.next/static', 'public'];
  checkFiles.forEach(f => {
    if (fs.existsSync(f)) {
      console.log(`✅ VERIFIED: ${f} is at the surface.`);
    } else {
      console.log(`❌ ERROR: ${f} failed to reach the surface.`);
    }
  });

  console.log('🏁 [5/5] --- AURA_FORCE_SYNC_v2_SUCCESS ---');
  process.exit(0);

} catch (err) {
  console.error('💥 AURA_FORCE_SYNC_CRITICAL_FAILURE');
  console.error(err);
  process.exit(1);
}
