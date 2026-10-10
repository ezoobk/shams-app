/**
 * Shams App - Smart Build Script
 * - Auto-increments patch version on each build
 * - Clears old release files before building
 * - Outputs to a single fixed "release" folder
 */
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const pkgPath = path.join(__dirname, '..', 'package.json');
const releaseDir = path.join(__dirname, '..', 'release');
const winUnpackedDir = path.join(releaseDir, 'win-unpacked');

// 1. Kill any running Shams App instances that may lock files
console.log('\n🔍 Checking for running app instances...');
spawnSync('taskkill', ['/F', '/IM', 'Shams App.exe'], { shell: true });
spawnSync('taskkill', ['/F', '/IM', 'electron.exe'], { shell: true });

// Give OS time to release file locks
const wait = (ms) => { const end = Date.now() + ms; while (Date.now() < end) {} };
wait(1500);

// 2. Read current version and bump patch
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const parts = pkg.version.split('.').map(Number);
parts[2] += 1; // increment patch
pkg.version = parts.join('.');
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
console.log(`\n📦 Building version: ${pkg.version}\n`);

// 3. Clean old release files
if (fs.existsSync(releaseDir)) {
  // Remove old setup files
  const files = fs.readdirSync(releaseDir);
  for (const file of files) {
    const fullPath = path.join(releaseDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isFile() && ['.exe', '.yml', '.yaml', '.blockmap'].some(ext => file.endsWith(ext))) {
      try {
        fs.unlinkSync(fullPath);
        console.log(`🗑️  Removed old file: ${file}`);
      } catch (e) {
        console.warn(`⚠️  Could not remove ${file}: ${e.message}`);
      }
    }
  }

  // Remove win-unpacked directory to avoid asar lock issues
  if (fs.existsSync(winUnpackedDir)) {
    console.log('🗑️  Removing old win-unpacked directory...');
    try {
      spawnSync('rd', ['/s', '/q', winUnpackedDir], { shell: true });
      wait(1000);
      console.log('✅ win-unpacked removed successfully.');
    } catch (e) {
      console.warn(`⚠️  Could not remove win-unpacked: ${e.message}`);
    }
  }
}

// 4. Build
try {
  const dummySigntool = path.join(__dirname, 'signtool.bat');
  execSync(`set SIGNTOOL_PATH=${dummySigntool}&& set CSC_IDENTITY_AUTO_DISCOVERY=false&& npm run build && npx electron-builder`, {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    shell: true
  });
  console.log(`\n✅ Build complete! Version: ${pkg.version}`);
  console.log(`📂 Setup file is in the "release" folder.\n`);
} catch (err) {
  console.error('\n❌ Build failed!', err.message);
  // Rollback version on failure
  parts[2] -= 1;
  pkg.version = parts.join('.');
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  console.log(`↩️  Version rolled back to ${pkg.version}`);
  process.exit(1);
}
