const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const distDir = path.resolve(__dirname, '../dist');
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

// Built-in resilient HTTP server with /api/fs/read support
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1');

  if (parsedUrl.pathname === '/api/fs/read') {
    const filePath = parsedUrl.searchParams.get('filePath');
    if (!filePath) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Missing filePath' }));
      return;
    }
    const resolved = path.resolve(filePath);
    if (fs.existsSync(resolved)) {
      const content = fs.readFileSync(resolved, 'utf8');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ content, encoding: 'utf-8', eol: 'LF', size: content.length }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: `File not found: ${resolved}` }));
    }
    return;
  }

  if (
    (req.headers.accept && req.headers.accept.includes('text/event-stream')) ||
    parsedUrl.pathname.includes('/stream') ||
    parsedUrl.pathname.includes('/watch-repo')
  ) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write(':\n\n');
    return;
  }

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
});

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  console.log(`[E2E Test Server] Running at http://127.0.0.1:${port}`);

  await app.whenReady();

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false,
    },
  });

  const errors = [];
  win.webContents.on('console-message', (_event, level, message) => {
    if (
      level === 3 ||
      message.includes('Uncaught') ||
      message.includes('Minified React error')
    ) {
      console.error('[Browser Error]', message);
      errors.push(message);
    }
  });

  console.log(`[E2E Test] Loading OmniGit at http://127.0.0.1:${port}...`);
  await win.loadURL(`http://127.0.0.1:${port}`);
  await new Promise((r) => setTimeout(r, 2500));

  console.log('[E2E Test] Step 1: Open non-md file in editor (App.tsx)...');
  const openRes = await win.webContents.executeJavaScript(`
    (async () => {
      try {
        const store = window.__editorTabsStore;
        if (!store) return { ok: false, error: '__editorTabsStore not found' };
        
        // Open App.tsx (contains \\app path segment)
        const tabId = await store.getState().openFileTab({
          filePath: 'D:\\\\projects\\\\OmniGit\\\\app\\\\src\\\\App.tsx',
          repoPath: 'D:\\\\projects\\\\OmniGit',
          relativePath: 'app/src/App.tsx',
          repoName: 'OmniGit'
        });

        await new Promise(r => setTimeout(r, 800));
        const activeTab = store.getState().tabs.find(t => t.id === tabId);
        
        return {
          ok: Boolean(activeTab && activeTab.content && activeTab.content.length > 500),
          tabId,
          contentLength: activeTab?.content?.length || 0,
          readError: activeTab?.readError,
          fileName: activeTab?.fileName
        };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    })()
  `);
  console.log('[E2E Test] Open non-md file result:', openRes);
  if (!openRes.ok) {
    server.close();
    throw new Error('Failed to open non-md file or content is empty: ' + JSON.stringify(openRes));
  }

  console.log('[E2E Test] Step 2: Open farmland .env.development file...');
  const openEnvRes = await win.webContents.executeJavaScript(`
    (async () => {
      try {
        const store = window.__editorTabsStore;
        const tabId = await store.getState().openFileTab({
          filePath: 'D:\\\\projects\\\\farmland-engineer-quality-inspect\\\\land-quality-sys\\\\.env.development',
          repoPath: 'D:\\\\projects\\\\farmland-engineer-quality-inspect\\\\land-quality-sys',
          relativePath: '.env.development',
          repoName: 'land-quality-sys'
        });

        await new Promise(r => setTimeout(r, 800));
        const activeTab = store.getState().tabs.find(t => t.id === tabId);
        return {
          ok: Boolean(activeTab && activeTab.content && activeTab.content.includes('VITE_USERNAME')),
          contentLength: activeTab?.content?.length || 0,
          readError: activeTab?.readError,
          fileName: activeTab?.fileName
        };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    })()
  `);
  console.log('[E2E Test] Open farmland env file result:', openEnvRes);
  if (!openEnvRes.ok) {
    server.close();
    throw new Error('Failed to read farmland file: ' + JSON.stringify(openEnvRes));
  }

  console.log('[E2E Test] Step 3: Testing workspace isolation and tabs persistence...');
  const wsIsolationRes = await win.webContents.executeJavaScript(`
    (async () => {
      try {
        const store = window.__editorTabsStore;
        
        // Save tabs for workspace 1
        const ws1 = 'ws_test_isolation_1';
        const ws2 = 'ws_test_isolation_2';
        
        store.getState().savePersistedTabs(ws1);
        
        // Switch to empty workspace 2
        await store.getState().restorePersistedTabs(ws2);
        const tabsInWs2 = store.getState().tabs;
        
        // Switch back to workspace 1
        await store.getState().restorePersistedTabs(ws1);
        const tabsInWs1 = store.getState().tabs;
        
        return {
          ok: tabsInWs2.length === 0 && tabsInWs1.length >= 2,
          tabsInWs2Count: tabsInWs2.length,
          tabsInWs1Count: tabsInWs1.length
        };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    })()
  `);
  console.log('[E2E Test] Workspace isolation result:', wsIsolationRes);
  if (!wsIsolationRes.ok) {
    server.close();
    throw new Error('Workspace isolation failed: ' + JSON.stringify(wsIsolationRes));
  }

  if (errors.length > 0) {
    server.close();
    throw new Error('Errors caught in browser: ' + errors.join('\n'));
  }

  console.log('🎉 ALL EDITOR & WORKSPACE TABS E2E TESTS PASSED WITH 0 ERRORS!');
  server.close();
  app.exit(0);
});
