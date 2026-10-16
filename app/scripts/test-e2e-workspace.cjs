const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const distDir = path.resolve(__dirname, '../dist');

// Create a local static server to serve dist/
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
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
});

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  console.log(`[E2E Test Server] Running at http://127.0.0.1:${port}`);

  await app.whenReady();

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false, // Allows easy store interaction in test
    },
  });

  const capturedErrors = [];

  win.webContents.on('console-message', (_event, level, message) => {
    if (level === 3 || message.includes('Minified React error') || message.includes('invariant') || message.includes('Rendered more hooks')) {
      console.error(`[Browser Console Error]`, message);
      capturedErrors.push(message);
    }
  });

  await win.loadURL(`http://127.0.0.1:${port}`);
  console.log('[E2E Test] Page loaded successfully.');

  // Wait for initial render
  await new Promise((r) => setTimeout(r, 1500));

  console.log('[E2E Test] Simulating workspace load and file selection state transitions...');
  const simulationResult = await win.webContents.executeJavaScript(`
    (async function() {
      try {
        const store = window.__appStore;
        if (!store) {
          return { ok: false, error: '__appStore not exposed on window' };
        }

        // Step 1: Simulate workspace without selected file (early return in DiffEditorPanel)
        store.setState({
          files: [
            { path: 'src/main.ts', status: 'modified', oldPath: '', staged: false },
            { path: 'README.md', status: 'modified', oldPath: '', staged: false }
          ],
          selectedFilePath: null,
          isRepoLoading: false,
        });
        await new Promise(r => setTimeout(r, 500));

        // Step 2: Simulate file selected (bypasses early return, runs to bottom of DiffEditorPanel)
        store.setState({
          selectedFilePath: 'src/main.ts',
          selectedFileDiff: { oldContent: 'console.log(1);', newContent: 'console.log(2);' },
        });
        await new Promise(r => setTimeout(r, 500));

        // Step 3: Switch back to no file selected
        store.setState({
          selectedFilePath: null,
        });
        await new Promise(r => setTimeout(r, 500));

        // Step 4: Switch to another file
        store.setState({
          selectedFilePath: 'README.md',
          selectedFileDiff: { oldContent: '# Hello', newContent: '# Hello World' },
        });
        await new Promise(r => setTimeout(r, 500));

        // Check DOM for crash / Error boundary modal
        const bodyText = document.body.innerText;
        if (bodyText.includes('Minified React error') || bodyText.includes('Rendered more hooks') || bodyText.includes('Something went wrong')) {
          return { ok: false, error: 'React Error Boundary or crash modal rendered!' };
        }

        return { ok: true };
      } catch (err) {
        return { ok: false, error: err.stack || err.message };
      }
    })()
  `);

  console.log('[E2E Test] Simulation result:', simulationResult);

  server.close();
  win.destroy();

  if (!simulationResult.ok || capturedErrors.length > 0) {
    console.error('❌ E2E Web test FAILED!');
    if (!simulationResult.ok) console.error('Reason:', simulationResult.error);
    if (capturedErrors.length > 0) console.error('Captured Errors:', capturedErrors);
    app.exit(1);
  } else {
    console.log('✅ E2E Web test PASSED: Workspace loading, file switching, and hook consistency verified with 0 errors!');
    app.exit(0);
  }
});
