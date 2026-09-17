const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { fastDownloadElectronArchive } = require('./fast-download.cjs');

const appDir = path.resolve(__dirname, '..');
const distDir = path.join(appDir, 'dist');
const distElectronDir = path.join(appDir, 'dist-electron');
const buildDir = path.join(appDir, 'build');
const releaseDir = path.join(appDir, 'release');
const cacheDir = path.join(appDir, '.cache', 'electron');

// 1. Parse target architecture (--arch=arm64 | --arch=x64 | --arch=all)
const args = process.argv.slice(2);
let targetArchArg = 'arm64';
for (const arg of args) {
  if (arg.startsWith('--arch=')) {
    targetArchArg = arg.split('=')[1];
  }
}

const architectures = targetArchArg === 'all' ? ['arm64', 'x64'] : [targetArchArg];

console.log('=======================================================');
console.log('       OmniGit - macOS Desktop App Packager');
console.log('=======================================================');
console.log('');

// 2. Verify build artifacts
if (!fs.existsSync(distDir) || !fs.existsSync(distElectronDir)) {
  console.error('[ERROR] Missing build artifacts! Please run "npm run build:all" first.');
  process.exit(1);
}

// 3. Locate 7-Zip executable
function get7zPath() {
  const candidates = [
    'D:\\tools\\7-Zip\\7z.exe',
    'C:\\Program Files\\7-Zip\\7z.exe',
    'C:\\Program Files (x86)\\7-Zip\\7z.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try {
    execSync('7z', { stdio: 'ignore' });
    return '7z';
  } catch {}
  return null;
}

const sevenZip = get7zPath();
if (!sevenZip) {
  console.error('[ERROR] 7-Zip (7z.exe) not found! Please install 7-Zip.');
  process.exit(1);
}

// 4. Ensure icon.icns exists
const iconIcnsPath = path.join(buildDir, 'icon.icns');
if (!fs.existsSync(iconIcnsPath)) {
  console.log('[Setup] Generating macOS icon.icns from icons...');
  try {
    execSync(`node "${path.join(__dirname, 'generate-icns.cjs')}"`, { stdio: 'inherit' });
  } catch (e) {
    console.warn('[WARN] Failed to auto-generate icon.icns:', e.message);
  }
}

// Read version from package.json
const pkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
const appVersion = pkg.version || '0.3.0';

// Read Electron version from installed node_modules/electron
let electronVersion = '30.0.0';
try {
  const electronPkg = JSON.parse(fs.readFileSync(path.join(appDir, 'node_modules', 'electron', 'package.json'), 'utf8'));
  electronVersion = electronPkg.version || electronVersion;
} catch {}

fs.mkdirSync(cacheDir, { recursive: true });
fs.mkdirSync(releaseDir, { recursive: true });

// Copy directory recursively
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

// Update Info.plist
function updatePlist(plistPath, replacements) {
  if (!fs.existsSync(plistPath)) return;
  let content = fs.readFileSync(plistPath, 'utf8');
  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(`(<key>${key}</key>\\s*<string>)[^<]*(</string>)`, 'g');
    if (regex.test(content)) {
      content = content.replace(regex, `$1${value}$2`);
    } else {
      // Append if not present
      content = content.replace('</dict>', `\t<key>${key}</key>\n\t<string>${value}</string>\n</dict>`);
    }
  }
  fs.writeFileSync(plistPath, content, 'utf8');
}

// Ensure Darwin zip is ready
async function getDarwinZip(arch) {
  const fileName = `electron-v${electronVersion}-darwin-${arch}.zip`;
  const cachedPath = path.join(cacheDir, fileName);

  if (fs.existsSync(cachedPath) && fs.statSync(cachedPath).size > 20000000) {
    console.log(`[Cache] 命中本地 Electron Darwin 缓存包: ${fileName} (${(fs.statSync(cachedPath).size / 1024 / 1024).toFixed(1)} MB)`);
    return cachedPath;
  }

  console.log(`[1/4] 启动高速多线程并发下载器 (${arch})...`);
  await fastDownloadElectronArchive(electronVersion, arch, cachedPath);
  return cachedPath;
}

// Package single architecture
async function packageArch(arch) {
  console.log('');
  console.log(`-------------------------------------------------------`);
  console.log(` 打包 macOS 安装运行包: 目标架构 [${arch}]`);
  console.log(`-------------------------------------------------------`);

  const cachedZip = await getDarwinZip(arch);
  const targetZipName = `OmniGit-v${appVersion}-mac-${arch}.zip`;
  const targetZipPath = path.join(releaseDir, targetZipName);

  console.log(`[2/4] 初始化 macOS 运行包母版 (${targetZipName})...`);
  if (fs.existsSync(targetZipPath)) {
    fs.unlinkSync(targetZipPath);
  }
  fs.copyFileSync(cachedZip, targetZipPath);

  // In-place renames inside ZIP (preserves all Unix symlinks intact)
  console.log('[3/4] 规范化 macOS 应用 Bundle 结构与执行文件...');
  try {
    // 1. Rename root Electron.app -> OmniGit.app
    execSync(`"${sevenZip}" rn "${targetZipPath}" "Electron.app" "OmniGit.app"`, { stdio: 'ignore' });
    // 2. Rename executable
    execSync(`"${sevenZip}" rn "${targetZipPath}" "OmniGit.app/Contents/MacOS/Electron" "OmniGit.app/Contents/MacOS/OmniGit"`, { stdio: 'ignore' });
    // 3. Remove default_app.asar
    execSync(`"${sevenZip}" d "${targetZipPath}" "OmniGit.app/Contents/Resources/default_app.asar"`, { stdio: 'ignore' });
  } catch (e) {
    console.error('[ERROR] 7-Zip internal transformation failed:', e.message);
    process.exit(1);
  }

  // 4. Prepare staged application files
  console.log('[4/4] 注入 OmniGit 应用程序源文件、高清图标与元数据...');
  const stagingDir = path.join(releaseDir, `staging-mac-${arch}`);
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }

  const bundleContents = path.join(stagingDir, 'OmniGit.app', 'Contents');
  const bundleResources = path.join(bundleContents, 'Resources');
  const bundleApp = path.join(bundleResources, 'app');
  fs.mkdirSync(bundleContents, { recursive: true });
  fs.mkdirSync(bundleResources, { recursive: true });
  fs.mkdirSync(bundleApp, { recursive: true });

  // Extract original Info.plist from zip
  execSync(`"${sevenZip}" e "${targetZipPath}" "OmniGit.app/Contents/Info.plist" -o"${bundleContents}" -y`, { stdio: 'ignore' });
  const plistPath = path.join(bundleContents, 'Info.plist');
  updatePlist(plistPath, {
    CFBundleDisplayName: 'OmniGit',
    CFBundleName: 'OmniGit',
    CFBundleIdentifier: 'com.omnigit.desktop',
    CFBundleExecutable: 'OmniGit',
    CFBundleIconFile: 'icon.icns',
    CFBundleVersion: appVersion,
    CFBundleShortVersionString: appVersion,
    LSMinimumSystemVersion: '10.15.0',
    NSHighResolutionCapable: 'true',
  });

  // Inject Icons
  if (fs.existsSync(iconIcnsPath)) {
    fs.copyFileSync(iconIcnsPath, path.join(bundleResources, 'icon.icns'));
    fs.copyFileSync(iconIcnsPath, path.join(bundleResources, 'electron.icns'));
    fs.copyFileSync(iconIcnsPath, path.join(bundleApp, 'icon.icns'));
  }
  const iconPng = path.join(buildDir, 'icon.png');
  const iconIco = path.join(buildDir, 'icon.ico');
  if (fs.existsSync(iconPng)) fs.copyFileSync(iconPng, path.join(bundleApp, 'icon.png'));
  if (fs.existsSync(iconIco)) fs.copyFileSync(iconIco, path.join(bundleApp, 'icon.ico'));

  // Inject dist and dist-electron
  copyRecursive(distDir, path.join(bundleApp, 'dist'));
  copyRecursive(distElectronDir, path.join(bundleApp, 'dist-electron'));

  // Write production package.json
  const prodPkg = {
    name: pkg.name,
    version: pkg.version,
    main: 'dist-electron/electron/main.js',
  };
  fs.writeFileSync(path.join(bundleApp, 'package.json'), JSON.stringify(prodPkg, null, 2));

  // Update zip with staged files using 7z (running from stagingDir ensures OmniGit.app relative path prefix)
  execSync(`"${sevenZip}" u "${targetZipPath}" "OmniGit.app" -y -r`, { cwd: stagingDir, stdio: 'ignore' });

  // Clean staging directory
  fs.rmSync(stagingDir, { recursive: true, force: true });

  const finalSizeMB = (fs.statSync(targetZipPath).size / 1024 / 1024).toFixed(1);

  console.log('');
  console.log(`=======================================================`);
  console.log(` [SUCCESS] OmniGit macOS [${arch}] 打包圆满成功！`);
  console.log(` 安装分发包: ${targetZipPath}`);
  console.log(` 压缩包大小: ${finalSizeMB} MB`);
  console.log(` 说明: 该包完整保留了 macOS 原生符号链接与红绿灯规范，`);
  console.log(`       在 Mac 电脑上解压后直接拖入 /Applications 即可运行！`);
  console.log(`=======================================================`);
}

// Main execution
(async () => {
  for (const arch of architectures) {
    await packageArch(arch);
  }

  console.log('');
  console.log('=======================================================');
  console.log(' 苹果系统（macOS）安装使用温馨提示：');
  console.log(' 1. 在 Mac 电脑上双击解压该 ZIP 包，将 OmniGit.app 拖入 Applications');
  console.log(' 2. 若系统提示“软件已损坏，无法打开”，在 Mac 终端中运行一行命令放行即可：');
  console.log('      xattr -cr /Applications/OmniGit.app');
  console.log('=======================================================');
})();
