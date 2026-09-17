const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Helper to determine HTTP or HTTPS client
function getClient(url) {
  return url.startsWith('https:') ? https : http;
}

// Resolve redirects and get Content-Length
function resolveUrlAndSize(targetUrl, maxRedirects = 6) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));

    const req = getClient(targetUrl).request(
      targetUrl,
      {
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let nextUrl = res.headers.location;
          if (!nextUrl.startsWith('http')) {
            const parsed = new URL(targetUrl);
            nextUrl = `${parsed.protocol}//${parsed.host}${nextUrl}`;
          }
          return resolve(resolveUrlAndSize(nextUrl, maxRedirects - 1));
        }

        if (res.statusCode !== 200 && res.statusCode !== 206) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        const size = parseInt(res.headers['content-length'] || '0', 10);
        const acceptRanges = (res.headers['accept-ranges'] || '').toLowerCase().includes('bytes');
        resolve({ directUrl: targetUrl, size, acceptRanges });
      }
    );

    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('HEAD request timeout'));
    });

    req.on('error', reject);
    req.end();
  });
}

// Download a single chunk with Range header
function downloadChunk(url, start, end, destFile, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destFile);
    let downloaded = 0;

    const req = getClient(url).get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Range: `bytes=${start}-${end}`,
        },
      },
      (res) => {
        if (res.statusCode !== 206 && res.statusCode !== 200) {
          file.close();
          return reject(new Error(`Chunk download failed with HTTP ${res.statusCode}`));
        }

        res.on('data', (chunk) => {
          downloaded += chunk.length;
          file.write(chunk);
          if (onProgress) onProgress(chunk.length);
        });

        res.on('end', () => {
          file.end(resolve);
        });

        res.on('error', (err) => {
          file.close();
          reject(err);
        });
      }
    );

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Chunk download timeout'));
    });

    req.on('error', (err) => {
      file.close();
      reject(err);
    });
  });
}

// Stream download fallback
function downloadSingleStream(url, destFile, totalExpectedSize) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destFile);
    let downloaded = 0;
    let lastLog = Date.now();

    const req = getClient(url).get(
      url,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      },
      (res) => {
        if (res.statusCode !== 200) {
          file.close();
          return reject(new Error(`Single stream failed with HTTP ${res.statusCode}`));
        }

        res.on('data', (chunk) => {
          downloaded += chunk.length;
          file.write(chunk);
          if (Date.now() - lastLog > 1000) {
            lastLog = Date.now();
            const pct = totalExpectedSize > 0 ? ((downloaded / totalExpectedSize) * 100).toFixed(1) : '?';
            console.log(`  -> 已下载: ${(downloaded / 1024 / 1024).toFixed(1)} MB (${pct}%)`);
          }
        });

        res.on('end', () => {
          file.end(resolve);
        });

        res.on('error', (err) => {
          file.close();
          reject(err);
        });
      }
    );

    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Single stream timeout'));
    });

    req.on('error', (err) => {
      file.close();
      reject(err);
    });
  });
}

// Main multi-connection accelerated downloader
async function fastDownloadElectronArchive(version, arch, destPath) {
  const fileName = `electron-v${version}-darwin-${arch}.zip`;

  // 1. Check local environment overrides
  if (process.env.ELECTRON_CUSTOM_DIR) {
    const localFile = path.join(process.env.ELECTRON_CUSTOM_DIR, fileName);
    if (fs.existsSync(localFile)) {
      console.log(`[Cache] 命中本地自定义目录安装包: ${localFile}`);
      fs.copyFileSync(localFile, destPath);
      return destPath;
    }
  }

  // 2. Build prioritized mirror URLs
  const candidateUrls = [];
  if (process.env.ELECTRON_MIRROR) {
    const customPrefix = process.env.ELECTRON_MIRROR.replace(/\/+$/, '');
    candidateUrls.push(`${customPrefix}/v${version}/${fileName}`);
  }
  // High-speed Huawei Cloud mirror
  candidateUrls.push(`https://repo.huaweicloud.com/electron/${version}/${fileName}`);
  // Fast GitHub proxy
  candidateUrls.push(`https://ghproxy.net/https://github.com/electron/electron/releases/download/v${version}/${fileName}`);
  // Npmmirror CDN
  candidateUrls.push(`https://cdn.npmmirror.com/binaries/electron/v${version}/${fileName}`);
  // GitHub official
  candidateUrls.push(`https://github.com/electron/electron/releases/download/v${version}/${fileName}`);

  let lastError = null;

  for (const candidate of candidateUrls) {
    try {
      console.log(`\n[下载器] 尝试加速节点: ${candidate.slice(0, 75)}...`);
      const info = await resolveUrlAndSize(candidate);
      console.log(`  -> 节点就绪！安装包大小: ${(info.size / 1024 / 1024).toFixed(1)} MB, 多线程加速: ${info.acceptRanges ? '支持' : '不支持'}`);

      if (info.size < 20000000) {
        throw new Error('下载文件大小异常 (小于 20MB)');
      }

      // If server supports multi-threaded range chunks, download with 8 parallel connections
      if (info.acceptRanges) {
        const concurrency = 8;
        const chunkSize = Math.ceil(info.size / concurrency);
        const partFiles = [];
        const tasks = [];
        let totalDownloaded = 0;
        const t0 = Date.now();
        let lastReport = Date.now();

        console.log(`  -> 启动 8 线程并行高速并发下载通道...`);

        for (let i = 0; i < concurrency; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize - 1, info.size - 1);
          const partPath = `${destPath}.part${i}`;
          partFiles.push(partPath);

          tasks.push(
            downloadChunk(info.directUrl, start, end, partPath, (bytes) => {
              totalDownloaded += bytes;
              const now = Date.now();
              if (now - lastReport > 1000) {
                lastReport = now;
                const elapsedSec = (now - t0) / 1000;
                const speedMB = elapsedSec > 0 ? (totalDownloaded / 1024 / 1024 / elapsedSec).toFixed(1) : '0';
                const pct = ((totalDownloaded / info.size) * 100).toFixed(1);
                const remainingMB = (info.size - totalDownloaded) / 1024 / 1024;
                const eta = parseFloat(speedMB) > 0 ? Math.ceil(remainingMB / parseFloat(speedMB)) : '?';
                console.log(`  -> 进度: ${(totalDownloaded / 1024 / 1024).toFixed(1)} MB / ${(info.size / 1024 / 1024).toFixed(1)} MB (${pct}%) | 速度: ${speedMB} MB/s | 剩余约: ${eta}s`);
              }
            })
          );
        }

        await Promise.all(tasks);

        console.log(`  -> 8 块数据下载完毕，快速合并中...`);
        const finalFile = fs.createWriteStream(destPath);
        for (const part of partFiles) {
          const buf = fs.readFileSync(part);
          finalFile.write(buf);
          fs.unlinkSync(part);
        }
        await new Promise((res) => finalFile.end(res));

        const totalSec = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`[成功] 下载完成！耗时仅 ${totalSec}s，平均速度 ${(info.size / 1024 / 1024 / totalSec).toFixed(1)} MB/s`);
        return destPath;
      } else {
        // Fallback to single stream
        await downloadSingleStream(info.directUrl, destPath, info.size);
        return destPath;
      }
    } catch (err) {
      console.warn(`  -> 当前节点异常: ${err.message}，自动无缝切换下一个优质源...`);
      lastError = err;
      // Cleanup any temp part files
      for (let i = 0; i < 8; i++) {
        const p = `${destPath}.part${i}`;
        if (fs.existsSync(p)) {
          try { fs.unlinkSync(p); } catch {}
        }
      }
    }
  }

  throw new Error(`所有加速节点均尝试失败: ${lastError?.message || '未知错误'}`);
}

module.exports = { fastDownloadElectronArchive };
