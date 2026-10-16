const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const scriptsDir = __dirname;
const rootDir = path.resolve(scriptsDir, '..');
const makensisExe = path.join(scriptsDir, 'tools', 'nsis', 'makensis.exe');
const installerNsi = path.join(scriptsDir, 'installer.nsi');
const productVersion = process.argv[2] || '0.5.0';

if (!fs.existsSync(makensisExe)) {
  console.error(`[ERROR] makensis.exe not found at: ${makensisExe}`);
  process.exit(1);
}
if (!fs.existsSync(installerNsi)) {
  console.error(`[ERROR] installer.nsi not found at: ${installerNsi}`);
  process.exit(1);
}

console.log('=======================================================');
console.log(` 正在生成 Windows 安装包 (OmniGit-Setup-${productVersion}.exe)...`);
console.log('=======================================================');
console.log('[1/3] 正在解析安装脚本与组件清单...');

const startTime = Date.now();
const child = spawn(makensisExe, [
  `/DPRODUCT_VERSION=${productVersion}`,
  installerNsi
], {
  cwd: scriptsDir,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let isCompressing = false;
let compressionStartTime = 0;
let installDataSize = '';
let lastReportedSec = 0;

// Update console title & output clean periodic heartbeat (every 10s)
const timer = setInterval(() => {
  const elapsedSec = Math.floor((Date.now() - startTime) / 1000);

  // Update window title
  try {
    const titleText = isCompressing
      ? `OmniGit 打包中: 固实压缩进行中 (${elapsedSec}s)...`
      : `OmniGit 打包中: 预处理组件清单 (${elapsedSec}s)...`;
    process.title = titleText;
    process.stdout.write(`\x1b]0;${titleText}\x07`);
  } catch (_) {}

  // Periodic heartbeat every 10 seconds (clean, elegant, never wraps or spams logs)
  if (isCompressing) {
    if (elapsedSec >= lastReportedSec + 10) {
      lastReportedSec = elapsedSec;
      const compElapsed = Math.floor((Date.now() - compressionStartTime) / 1000);
      console.log(`      ... 固实压缩进行中 (已耗时 ${compElapsed} 秒)`);
    }
  }
}, 1000);

let stdoutBuf = '';
let stderrBuf = '';

child.stdout.on('data', (d) => {
  const str = d.toString();
  stdoutBuf += str;

  // Detect install data size
  if (!isCompressing) {
    const dataMatch = str.match(/Install data:\s*\((\d+)\s*bytes\)/i);
    if (dataMatch) {
      const bytes = parseInt(dataMatch[1], 10);
      installDataSize = (bytes / 1024 / 1024).toFixed(1) + ' MB';
      isCompressing = true;
      compressionStartTime = Date.now();
      lastReportedSec = Math.floor((Date.now() - startTime) / 1000);
      console.log(`[2/3] 正在执行固实压缩 (源数据: ${installDataSize}，耗时约 50 秒)...`);
    }
  }

  if (str.includes('Compressed data:') && !isCompressing) {
    isCompressing = true;
    compressionStartTime = Date.now();
    lastReportedSec = Math.floor((Date.now() - startTime) / 1000);
    console.log(`[2/3] 正在执行固实压缩 (耗时约 50 秒)...`);
  }
});

child.stderr.on('data', (d) => {
  stderrBuf += d.toString();
});

child.on('close', (code) => {
  clearInterval(timer);

  const totalTimeSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const targetInstaller = path.join(rootDir, 'app', 'release', `OmniGit-Setup-${productVersion}.exe`);

  if (code === 0 && fs.existsSync(targetInstaller)) {
    const finalSizeMB = (fs.statSync(targetInstaller).size / 1024 / 1024).toFixed(1);
    console.log(`[3/3] 安装包封装与自解压头写入完成！`);
    console.log('');
    console.log('=======================================================');
    console.log(' [SUCCESS] OmniGit Windows 单文件安装程序编译成功！');
    console.log(` 安装包路径: ${targetInstaller}`);
    console.log(` 安装包大小: ${finalSizeMB} MB`);
    console.log(` 打包总耗时: ${totalTimeSec} 秒`);
    console.log('=======================================================');
    process.exit(0);
  } else {
    console.error('');
    console.error('=======================================================');
    console.error(' [ERROR] Windows NSIS 安装包编译失败！');
    console.error(` 退出代码: ${code}`);
    if (stderrBuf) console.error('错误输出:\n' + stderrBuf);
    console.error('=======================================================');
    process.exit(1);
  }
});
