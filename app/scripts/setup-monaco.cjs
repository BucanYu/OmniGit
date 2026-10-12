const fs = require('fs');
const path = require('path');

const appDir = path.resolve(__dirname, '..');
const publicVsDir = path.join(appDir, 'public', 'vs');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function findMonacoVsDir() {
  // 1. Check pnpm store first or direct path with loader.js
  const pnpmDir = path.join(appDir, 'node_modules', '.pnpm');
  if (fs.existsSync(pnpmDir)) {
    for (const item of fs.readdirSync(pnpmDir)) {
      if (item.startsWith('monaco-editor@')) {
        const candidate = path.join(pnpmDir, item, 'node_modules', 'monaco-editor', 'min', 'vs');
        if (fs.existsSync(path.join(candidate, 'loader.js'))) return candidate;
      }
    }
  }

  // 2. Direct node_modules
  const directPath = path.join(appDir, 'node_modules', 'monaco-editor', 'min', 'vs');
  if (fs.existsSync(path.join(directPath, 'loader.js'))) return directPath;

  // 3. Parent node_modules
  const parentNodeModules = path.join(appDir, '..', 'node_modules', 'monaco-editor', 'min', 'vs');
  if (fs.existsSync(path.join(parentNodeModules, 'loader.js'))) return parentNodeModules;

  return null;
}

const sourceVs = findMonacoVsDir();

if (!sourceVs) {
  console.warn('[setup-monaco] Warning: monaco-editor min/vs not found in node_modules.');
  process.exit(0);
}

// Check if destination is already populated with loader.js
if (fs.existsSync(path.join(publicVsDir, 'loader.js'))) {
  console.log('[setup-monaco] Local Monaco assets already verified at app/public/vs.');
  process.exit(0);
}

console.log(`[setup-monaco] Copying local Monaco runtime from ${sourceVs} to app/public/vs...`);
fs.mkdirSync(publicVsDir, { recursive: true });
copyRecursive(sourceVs, publicVsDir);
console.log('[setup-monaco] Successfully populated local Monaco static assets (100% offline).');
