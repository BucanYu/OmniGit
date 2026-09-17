import { BrowserWindow, ipcMain, app } from 'electron';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

let autoUpdater: any = null;
try {
  const eu = require('electron-updater');
  autoUpdater = eu.autoUpdater;
} catch (e) {
  // Graceful fallback to built-in GitHub Releases updater
}

export function setupAutoUpdater(getMainWindow: () => BrowserWindow | null) {
  function broadcast(status: string, data: Record<string, any> = {}) {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('update:status', { status, ...data });
    }
  }

  if (autoUpdater) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;

    autoUpdater.on('checking-for-update', () => broadcast('checking'));
    autoUpdater.on('update-available', (info: any) => broadcast('available', { info }));
    autoUpdater.on('update-not-available', (info: any) => broadcast('not-available', { info }));
    autoUpdater.on('download-progress', (progress: any) => broadcast('downloading', { progress }));
    autoUpdater.on('update-downloaded', (info: any) => broadcast('downloaded', { info }));
    autoUpdater.on('error', (err: any) => broadcast('error', { error: err?.message || String(err) }));

    ipcMain.handle('update:check', async () => {
      try {
        return await autoUpdater.checkForUpdates();
      } catch (e: any) {
        broadcast('error', { error: e.message || String(e) });
        return null;
      }
    });

    ipcMain.handle('update:quit-and-install', () => {
      autoUpdater.quitAndInstall(false, true);
    });
    return;
  }

  // Built-in Native GitHub Releases Updater (Zero external dependencies)
  let downloadedInstallerPath: string | null = null;

  ipcMain.handle('update:check', async () => {
    broadcast('checking');

    const currentVersion = app.getVersion() || '0.1.0';
    const repo = 'omnigit/OmniGit';

    const req = https.get(
      `https://api.github.com/repos/${repo}/releases/latest`,
      {
        headers: {
          'User-Agent': `OmniGit-Desktop/${currentVersion}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          if (res.statusCode === 404) {
            broadcast('not-available', { info: { version: currentVersion } });
            return;
          }
          if (res.statusCode !== 200) {
            broadcast('error', { error: `服务器返回异常 (HTTP ${res.statusCode})` });
            return;
          }

          try {
            const release = JSON.parse(raw);
            const latestTag = (release.tag_name || '').replace(/^v/, '');

            if (!latestTag || latestTag === currentVersion) {
              broadcast('not-available', { info: { version: currentVersion } });
              return;
            }

            // Find platform-specific installer asset
            const isMac = process.platform === 'darwin';
            const exeAsset = release.assets?.find((a: any) => {
              const name = (a.name || '').toLowerCase();
              if (isMac) {
                return name.endsWith('.dmg') || name.endsWith('.zip');
              }
              return name.endsWith('.exe');
            });
            broadcast('available', {
              info: {
                version: latestTag,
                notes: release.body,
                downloadUrl: exeAsset?.browser_download_url,
              },
            });

            // If an installer asset is found, download it in background
            if (exeAsset?.browser_download_url) {
              const tempTarget = path.join(app.getPath('temp'), exeAsset.name);
              const fileStream = fs.createWriteStream(tempTarget);
              let receivedBytes = 0;
              const totalBytes = exeAsset.size || 0;
              const startTime = Date.now();

              https
                .get(exeAsset.browser_download_url, { headers: { 'User-Agent': 'OmniGit-Updater' } }, (downRes) => {
                  downRes.on('data', (c) => {
                    receivedBytes += c.length;
                    fileStream.write(c);
                    const elapsedSec = (Date.now() - startTime) / 1000;
                    const bytesPerSecond = elapsedSec > 0 ? receivedBytes / elapsedSec : 0;
                    const percent = totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : 0;

                    broadcast('downloading', {
                      progress: {
                        percent,
                        bytesPerSecond,
                        transferred: receivedBytes,
                        total: totalBytes,
                      },
                    });
                  });

                  downRes.on('end', () => {
                    fileStream.end();
                    downloadedInstallerPath = tempTarget;
                    broadcast('downloaded', { info: { version: latestTag, path: tempTarget } });
                  });
                })
                .on('error', (err) => {
                  broadcast('error', { error: `下载更新失败: ${err.message}` });
                });
            }
          } catch (e: any) {
            broadcast('error', { error: `解析更新数据失败: ${e.message}` });
          }
        });
      }
    );

    req.on('error', (err) => {
      broadcast('error', { error: `检查更新失败: ${err.message}` });
    });

    return null;
  });

  ipcMain.handle('update:quit-and-install', () => {
    if (downloadedInstallerPath && fs.existsSync(downloadedInstallerPath)) {
      if (process.platform === 'darwin') {
        spawn('open', [downloadedInstallerPath], { detached: true, stdio: 'ignore' }).unref();
      } else {
        spawn(downloadedInstallerPath, [], { detached: true, stdio: 'ignore' }).unref();
      }
      app.quit();
    } else {
      app.quit();
    }
  });
}
