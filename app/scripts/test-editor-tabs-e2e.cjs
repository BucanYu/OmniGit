const { app, BrowserWindow } = require('electron');

async function run() {
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
      message.includes('Minified React error') ||
      message.includes('Failed to read file')
    ) {
      console.error('[Browser Error]', message);
      errors.push(message);
    }
  });

  console.log('[E2E Test] Loading OmniGit at http://127.0.0.1:5345...');
  await win.loadURL('http://127.0.0.1:5345');
  await new Promise((r) => setTimeout(r, 2500));

  console.log('[E2E Test] Step 1: Open non-md file in editor (farmland path or App.tsx)...');
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
  if (!openRes.ok) throw new Error('Failed to open non-md file or content is empty: ' + JSON.stringify(openRes));

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
  if (!openEnvRes.ok) throw new Error('Failed to read farmland file: ' + JSON.stringify(openEnvRes));

  console.log('[E2E Test] Step 3: Testing workspace isolation and tabs persistence...');
  const wsIsolationRes = await win.webContents.executeJavaScript(`
    (async () => {
      try {
        const store = window.__editorTabsStore;
        const app = window.__appStore;
        
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
  if (!wsIsolationRes.ok) throw new Error('Workspace isolation failed: ' + JSON.stringify(wsIsolationRes));

  if (errors.length > 0) {
    throw new Error('Errors caught in browser: ' + errors.join('\n'));
  }

  console.log('🎉 ALL EDITOR & WORKSPACE TABS E2E TESTS PASSED WITH 0 ERRORS!');
  app.exit(0);
}

run().catch((err) => {
  console.error('❌ E2E Test Failed:', err);
  app.exit(1);
});
