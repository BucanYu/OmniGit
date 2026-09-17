const fs = require('fs');
const path = require('path');

const appDir = path.resolve(__dirname, '..');
const distDir = path.join(appDir, 'dist');
const distElectronDir = path.join(appDir, 'dist-electron');
const electronDistDir = path.join(appDir, 'node_modules/electron/dist');
const releaseDir = path.join(appDir, 'release');
const outputAppDir = path.join(releaseDir, 'OmniGit-win32-x64');

console.log('=======================================================');
console.log('       OmniGit - Standalone Desktop Packager');
console.log('=======================================================');
console.log('');

// 1. Verify build artifacts
if (!fs.existsSync(distDir) || !fs.existsSync(distElectronDir)) {
  console.error('[ERROR] Missing build artifacts! Please run "npm run build:all" first.');
  process.exit(1);
}

// 2. Locate Electron runtime
let electronSource = electronDistDir;
if (!fs.existsSync(electronSource)) {
  const storePath = path.join(appDir, 'node_modules/.store/electron@30.0.0/node_modules/electron/dist');
  if (fs.existsSync(storePath)) {
    electronSource = storePath;
  } else {
    console.error('[ERROR] Electron runtime directory not found! Run npm run build:electron first.');
    process.exit(1);
  }
}

console.log(`[1/4] Found Electron runtime at: ${electronSource}`);

// 3. Prepare release directory
if (fs.existsSync(outputAppDir)) {
  console.log('[2/4] Cleaning previous release build...');
  fs.rmSync(outputAppDir, { recursive: true, force: true });
}
fs.mkdirSync(outputAppDir, { recursive: true });

// 4. Copy Electron runtime files
console.log('[3/4] Copying Electron standalone binaries to release directory...');
function copyRecursive(src, dest) {
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

copyRecursive(electronSource, outputAppDir);

// Rename electron.exe to OmniGit.exe
const oldExe = path.join(outputAppDir, 'electron.exe');
const newExe = path.join(outputAppDir, 'OmniGit.exe');
if (fs.existsSync(oldExe)) {
  fs.renameSync(oldExe, newExe);
}

// 5. Populate resources/app
console.log('[4/4] Bundling application source into resources/app...');
const resourcesDir = path.join(outputAppDir, 'resources');
fs.mkdirSync(resourcesDir, { recursive: true });

// Remove default_app.asar if exists
const defaultAppAsar = path.join(resourcesDir, 'default_app.asar');
if (fs.existsSync(defaultAppAsar)) {
  try {
    fs.unlinkSync(defaultAppAsar);
  } catch {}
}

const targetApp = path.join(resourcesDir, 'app');
fs.mkdirSync(targetApp, { recursive: true });

// Copy dist, dist-electron, and package.json
copyRecursive(distDir, path.join(targetApp, 'dist'));
copyRecursive(distElectronDir, path.join(targetApp, 'dist-electron'));

// Create production package.json
const pkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
const prodPkg = {
  name: pkg.name,
  version: pkg.version,
  main: 'dist-electron/electron/main.js',
};
fs.writeFileSync(path.join(targetApp, 'package.json'), JSON.stringify(prodPkg, null, 2));

// Copy brand icons to release root and resources/app
const buildIconIco = path.join(appDir, 'build', 'icon.ico');
const buildIconPng = path.join(appDir, 'build', 'icon.png');
if (fs.existsSync(buildIconIco)) {
  fs.copyFileSync(buildIconIco, path.join(outputAppDir, 'icon.ico'));
  fs.copyFileSync(buildIconIco, path.join(targetApp, 'icon.ico'));
}
if (fs.existsSync(buildIconPng)) {
  fs.copyFileSync(buildIconPng, path.join(outputAppDir, 'icon.png'));
  fs.copyFileSync(buildIconPng, path.join(targetApp, 'icon.png'));
}

console.log('');
console.log('=======================================================');
console.log(' [SUCCESS] OmniGit Windows 桌面端独立运行包打包完成！');
console.log(' 输出目录: ' + outputAppDir);
console.log(' 启动程序: ' + newExe);
console.log(' 说明: 该目录为全内置自闭环版本，在任何 Windows 电脑上');
console.log('       无需安装 Node.js 或任何依赖，直接双击 OmniGit.exe 即可运行！');
console.log('=======================================================');
