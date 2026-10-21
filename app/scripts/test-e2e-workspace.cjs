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

        // Step 5: Test StatusPanel tabs (commit, shelf, log)
        store.setState({ activeTab: 'shelf' });
        await new Promise(r => setTimeout(r, 300));
        store.setState({ activeTab: 'log' });
        await new Promise(r => setTimeout(r, 300));
        store.setState({ activeTab: 'commit' });
        await new Promise(r => setTimeout(r, 300));

        // Step 6: Test opening refactored PushCommitsModal with tree/flat files
        store.setState({
          isPushModalOpen: true,
          pushModalSourceBranch: 'main',
          pushModalTargetBranch: 'main',
          outgoingCommitsData: {
            sourceBranch: 'main',
            targetBranch: 'main',
            remote: 'origin',
            commits: [
              {
                hash: '1a2b3c4d5e6f7a8b9c0d',
                shortHash: '1a2b3c4',
                subject: 'feat: modularize oversized files and components',
                authorName: 'Developer',
                date: new Date().toISOString(),
                files: [
                  { path: 'src/features/git-push/PushCommitsModal.tsx', fileName: 'PushCommitsModal.tsx', dirPath: 'src/features/git-push', status: 'modified', statusCode: 'M' },
                  { path: 'src/features/git-status/StatusPanel.tsx', fileName: 'StatusPanel.tsx', dirPath: 'src/features/git-status', status: 'modified', statusCode: 'M' }
                ]
              }
            ],
            allFiles: [
              { path: 'src/features/git-push/PushCommitsModal.tsx', fileName: 'PushCommitsModal.tsx', dirPath: 'src/features/git-push', status: 'modified', statusCode: 'M' },
              { path: 'src/features/git-status/StatusPanel.tsx', fileName: 'StatusPanel.tsx', dirPath: 'src/features/git-status', status: 'modified', statusCode: 'M' }
            ]
          }
        });
        await new Promise(r => setTimeout(r, 600));

        // Step 7: Close PushCommitsModal
        store.setState({ isPushModalOpen: false });
        await new Promise(r => setTimeout(r, 300));

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
