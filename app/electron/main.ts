import { app, BrowserWindow, ipcMain, shell, dialog, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { execFile } from 'child_process';
import { handleGitApiRequest } from '../src/server/gitApiHandler';
import { setupAutoUpdater } from './updater';

let mainWindow: BrowserWindow | null = null;
const windows = new Set<BrowserWindow>();
let embeddedServer: http.Server | null = null;
let currentApiPort = 5345;

// 1. Smart Git Path Detector
function detectGitBinary(): Promise<{ found: boolean; path: string; version?: string }> {
  return new Promise((resolve) => {
    // A. Test default system PATH
    execFile('git', ['--version'], (error, stdout) => {
      if (!error && stdout) {
        return resolve({ found: true, path: 'git', version: stdout.trim() });
      }

      const isMac = process.platform === 'darwin';
      let candidates: string[] = [];

      if (isMac) {
        // Scan common macOS install locations (Apple Silicon Homebrew, Intel Homebrew, Xcode/System, MacPorts)
        candidates = [
          '/opt/homebrew/bin/git',
          '/usr/local/bin/git',
          '/usr/bin/git',
          '/opt/local/bin/git',
        ];
      } else {
        // Scan common Windows install locations
        const username = process.env.USERNAME || '';
        candidates = [
          'C:\\Program Files\\Git\\cmd\\git.exe',
          'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
          'D:\\Git\\cmd\\git.exe',
          `C:\\Users\\${username}\\AppData\\Local\\Programs\\Git\\cmd\\git.exe`,
          `C:\\Users\\${username}\\AppData\\Local\\Programs\\Git\\bin\\git.exe`,
          'D:\\tools\\Git\\cmd\\git.exe',
        ];
      }

      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          // Prepend candidate directory to process.env.PATH so all subsequent git invocations succeed
          const dir = path.dirname(candidate);
          const sep = path.delimiter || (isMac ? ':' : ';');
          process.env.PATH = `${dir}${sep}${process.env.PATH || ''}`;
          return resolve({ found: true, path: candidate, version: 'Detected custom path' });
        }
      }

      resolve({ found: false, path: '' });
    });
  });
}

const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

function getDistDir(): string {
  const candidates = [
    path.join(__dirname, '../../dist'),
    path.join(__dirname, '../dist'),
    path.join(app.getAppPath(), 'dist'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'index.html'))) {
      return c;
    }
  }
  return candidates[0];
}

function serveStatic(distDir: string, req: http.IncomingMessage, res: http.ServerResponse) {
  const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1');
  let safePath = path.normalize(decodeURIComponent(parsedUrl.pathname)).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(distDir, safePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    filePath = path.join(distDir, 'index.html');
  }

  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.statusCode = 404;
    res.end('Not found');
  }
}

// 2. Start Embedded Git API & Static Loopback Server
function startEmbeddedServer(): Promise<number> {
  return new Promise((resolve) => {
    const distDir = getDistDir();
    const isDev = !app.isPackaged && Boolean(process.env.VITE_DEV_SERVER_URL);

    embeddedServer = http.createServer(async (req, res) => {
      const handled = await handleGitApiRequest(req, res);
      if (handled) return;

      if (!isDev) {
        serveStatic(distDir, req, res);
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    embeddedServer.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[Electron] Port ${currentApiPort} is already in use, binding to random available port...`);
        embeddedServer!.listen(0, '127.0.0.1', () => {
          const addr = embeddedServer!.address() as any;
          currentApiPort = addr.port;
          console.log(`[Electron] Embedded API server running on http://127.0.0.1:${currentApiPort}`);
          resolve(currentApiPort);
        });
      } else {
        console.error('[Electron] Embedded server error:', err);
        resolve(currentApiPort);
      }
    });

    embeddedServer.listen(currentApiPort, '127.0.0.1', () => {
      console.log(`[Electron] Embedded API server successfully bound to http://127.0.0.1:${currentApiPort}`);
      resolve(currentApiPort);
    });
  });
}

function getAppIconPath(): string {
  const isMac = process.platform === 'darwin';
  const iconExt = isMac ? 'icon.icns' : 'icon.ico';
  const candidates = [
    path.join(__dirname, '../../' + iconExt),
    path.join(__dirname, '../' + iconExt),
    path.join(__dirname, '../../build/' + iconExt),
    path.join(__dirname, '../build/' + iconExt),
    path.join(process.resourcesPath || '', 'app/' + iconExt),
    path.join(app.getAppPath(), iconExt),
    path.join(path.dirname(process.execPath), iconExt),
    path.join(__dirname, '../../build/icon.png'),
    path.join(path.dirname(process.execPath), 'icon.png'),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return '';
}

// 3. Create Desktop Native Window
function createWindow(workspaceParam?: string): BrowserWindow {
  const isMac = process.platform === 'darwin';
  const iconPath = getAppIconPath();
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    frame: false, // Frameless on Windows & macOS (TopBar renders custom drag bar & controls)
    titleBarStyle: isMac ? 'hiddenInset' : undefined,
    trafficLightPosition: isMac ? { x: 14, y: 12 } : undefined,
    autoHideMenuBar: true,
    backgroundColor: '#1e1f22',
    title: 'OmniGit',
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Ensure native Windows menu bar (File/Edit/View/Window/Help) is completely removed
  if (!isMac) {
    win.setMenu(null);
    win.setMenuBarVisibility(false);
  }

  windows.add(win);

  const isDev = !app.isPackaged && Boolean(process.env.VITE_DEV_SERVER_URL);
  const targetUrl = isDev
    ? process.env.VITE_DEV_SERVER_URL || 'http://localhost:5345'
    : `http://127.0.0.1:${currentApiPort}`;

  let querySuffix = '';
  if (workspaceParam) {
    if (workspaceParam.startsWith('?') || workspaceParam.includes('=')) {
      querySuffix = workspaceParam.startsWith('?') ? workspaceParam : `?${workspaceParam}`;
    } else {
      querySuffix = `?ws=${encodeURIComponent(workspaceParam)}`;
    }
  }
  win.loadURL(`${targetUrl}/${querySuffix}`);

  // Open external URLs in default browser instead of Electron window
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.on('closed', () => {
    windows.delete(win);
    if (win === mainWindow) {
      mainWindow = windows.size > 0 ? Array.from(windows)[0] : null;
    }
  });

  return win;
}

// 4. Register Window Control IPCs
function setupIpcHandlers() {
  ipcMain.handle('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.minimize();
  });

  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.handle('window:isMaximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? win.isMaximized() : false;
  });

  ipcMain.handle('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.close();
  });

  ipcMain.handle('window:create-new', (_event, wsId) => {
    const newWin = createWindow(wsId);
    newWin.show();
  });

  ipcMain.handle('workspace:notify-changed', (event) => {
    for (const win of windows) {
      if (win && !win.isDestroyed() && win.webContents !== event.sender) {
        win.webContents.send('workspace:changed');
      }
    }
  });

  ipcMain.handle('app:version', () => {
    return app.getVersion();
  });

  ipcMain.handle('git:detect-path', async () => {
    return await detectGitBinary();
  });

  ipcMain.handle('git:set-custom-path', (_event, customPath: string) => {
    if (fs.existsSync(customPath)) {
      const dir = path.dirname(customPath);
      const sep = path.delimiter || (process.platform === 'darwin' ? ':' : ';');
      process.env.PATH = `${dir}${sep}${process.env.PATH || ''}`;
      return true;
    }
    return false;
  });

  ipcMain.handle('dialog:select-folder', async (_event, defaultPath?: string) => {
    const result = await dialog.showOpenDialog(mainWindow || undefined as any, {
      title: '选择本地仓库保存文件夹',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: defaultPath && fs.existsSync(defaultPath) ? defaultPath : undefined,
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });
}

// 5. Application Lifecycle
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    if (process.platform !== 'darwin') {
      Menu.setApplicationMenu(null);
    }
    await detectGitBinary();
    await startEmbeddedServer();
    setupIpcHandlers();
    mainWindow = createWindow();
    setupAutoUpdater(() => mainWindow);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      if (embeddedServer) {
        embeddedServer.close();
      }
      app.quit();
    }
  });
}
