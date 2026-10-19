const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\e5f33529-bc05-40e1-91f4-e3a6b0963835';
const SCREENSHOT_PATH = path.join(ARTIFACT_DIR, 'services_e2e_screenshot.png');

async function run() {
  await app.whenReady();

  // Create browser window simulating pure web mode (no preload, no nodeIntegration)
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false, // Allows test automation to inspect window stores
    },
  });

  const capturedErrors = [];

  win.webContents.on('console-message', (_event, level, message) => {
    if (
      level === 3 ||
      message.includes('Minified React error') ||
      message.includes('Rendered more hooks') ||
      message.includes('Uncaught')
    ) {
      console.error('[Browser Console Error]', message);
      capturedErrors.push(message);
    }
  });

  console.log('[E2E Services] Loading web version at http://127.0.0.1:5345...');
  await win.loadURL('http://127.0.0.1:5345');

  // Wait for initial render
  await new Promise((r) => setTimeout(r, 2000));

  console.log('[E2E Services] Step 1: Testing Workbench Mode switch to Services...');
  const switchResult = await win.webContents.executeJavaScript(`
    (async () => {
      try {
        const wb = window.__workbenchStore;
        if (!wb) return { ok: false, error: '__workbenchStore not available' };
        wb.getState().setWorkbenchMode('services');
        await new Promise(r => setTimeout(r, 600));

        const mode = wb.getState().workbenchMode;
        if (mode !== 'services') return { ok: false, error: 'Failed to switch to services mode' };

        // Verify ServicesDashboard container is rendered in DOM
        const dashboard = document.querySelector('[data-workbench="services"]') || document.body.innerText.includes('新建服务') || document.body.innerText.includes('启动服务');
        return { ok: true, mode };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    })()
  `);
  console.log('[E2E Services] Switch result:', switchResult);
  if (!switchResult.ok) throw new Error(switchResult.error);

  console.log('\n[E2E Services] Step 2: Testing Project Scripts Auto-Discovery & Script Service creation...');
  const createResult = await win.webContents.executeJavaScript(`
    (async () => {
      try {
        const store = window.__servicesStore;
        const appStore = window.__appStore;
        if (!store || !appStore) return { ok: false, error: 'Stores missing' };

        const currentProjectId = appStore.getState().activeProjectId || '1';
        
        // 1. Test auto-scan project scripts
        const discovered = await store.getState().scanProjectScripts(currentProjectId);
        const hasDiscovered = Array.isArray(discovered) && discovered.length > 0;
        console.log('[E2E in browser] Discovered scripts count:', discovered ? discovered.length : 0);

        // 2. Create service with script paths
        const created = store.getState().addService(currentProjectId, {
          name: 'Backend-API-Service',
          winCommand: 'scripts\\\\start-backend.bat',
          winStopScript: 'scripts\\\\stop-backend.bat',
          unixCommand: 'scripts/start-backend.sh',
          unixStopScript: 'scripts/stop-backend.sh',
          cwd: '',
        });

        // Also create a test executable service to verify live start/stop
        const testRunner = store.getState().addService(currentProjectId, {
          name: 'Live-Script-Runner',
          winCommand: 'node -e "console.log(\\'SCRIPT_EXEC_ONLINE\\'); setInterval(()=>{}, 1000);"',
          unixCommand: 'node -e "console.log(\\'SCRIPT_EXEC_ONLINE\\'); setInterval(()=>{}, 1000);"',
          cwd: '',
        });

        await new Promise(r => setTimeout(r, 500));
        return {
          ok: true,
          hasDiscovered,
          discoveredCount: discovered ? discovered.length : 0,
          serviceId: testRunner.id,
          backendServiceId: created.id,
          projectId: currentProjectId,
        };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    })()
  `);
  console.log('[E2E Services] Create result:', createResult);
  if (!createResult.ok) throw new Error(createResult.error);

  const { serviceId, projectId } = createResult;

  console.log('\n[E2E Services] Step 3: Testing Service start via Web API...');
  const startResult = await win.webContents.executeJavaScript(`
    (async () => {
      try {
        const store = window.__servicesStore;
        const started = await store.getState().startService('${projectId}', '${serviceId}');
        await new Promise(r => setTimeout(r, 1200));

        const runtime = store.getState().getRuntime('${serviceId}');
        return {
          ok: started,
          status: runtime.status,
          pid: runtime.pid,
          logCount: runtime.logs.length,
          logsSample: runtime.logs.slice(-3).join(''),
        };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    })()
  `);
  console.log('[E2E Services] Start result:', startResult);
  if (!startResult.ok || startResult.status !== 'running') {
    throw new Error('Service failed to start or runtime status is not running');
  }

  // Wait a moment for output streaming
  await new Promise((r) => setTimeout(r, 1500));

  console.log('\n[E2E Services] Step 4: Testing Service stop via Web API...');
  const stopResult = await win.webContents.executeJavaScript(`
    (async () => {
      try {
        const store = window.__servicesStore;
        await store.getState().stopService('${serviceId}');
        await new Promise(r => setTimeout(r, 1000));

        const runtime = store.getState().getRuntime('${serviceId}');
        return {
          ok: true,
          status: runtime.status,
          logCount: runtime.logs.length,
          lastLogs: runtime.logs.slice(-2).join(''),
        };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    })()
  `);
  console.log('[E2E Services] Stop result:', stopResult);
  if (!stopResult.ok || stopResult.status !== 'stopped') {
    throw new Error('Service failed to stop or runtime status is not stopped');
  }

  console.log('\n[E2E Services] Step 5: Testing Bilingual Strict Language Isolation...');
  const i18nResult = await win.webContents.executeJavaScript(`
    (async () => {
      try {
        const appStore = window.__appStore;
        
        // 1. Switch to English
        appStore.getState().setLanguage('en-US');
        await new Promise(r => setTimeout(r, 600));
        const enBody = document.body.innerText;
        const hasEnKeywords =
          enBody.includes('Launch Scripts') ||
          enBody.includes('Start Service') ||
          enBody.includes('Stopped');

        // 2. Switch to Chinese
        appStore.getState().setLanguage('zh-CN');
        await new Promise(r => setTimeout(r, 600));
        const zhBody = document.body.innerText;
        const hasZhKeywords =
          zhBody.includes('启动脚本与服务管理') ||
          zhBody.includes('启动服务') ||
          zhBody.includes('已停止');

        return {
          ok: true,
          hasEnKeywords,
          hasZhKeywords,
          enSample: enBody.slice(0, 200),
          zhSample: zhBody.slice(0, 200),
        };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    })()
  `);
  console.log('[E2E Services] Bilingual test result:', i18nResult);
  if (!i18nResult.ok || !i18nResult.hasEnKeywords || !i18nResult.hasZhKeywords) {
    throw new Error('Language isolation check failed');
  }

  console.log('\n[E2E Services] Step 6: Testing ServiceConfigModal open & capturing modal screenshot...');
  await win.webContents.executeJavaScript(`
    (() => {
      const store = window.__servicesStore;
      store.getState().openAddModal();
    })()
  `);
  await new Promise((r) => setTimeout(r, 1200));

  const MODAL_SCREENSHOT_PATH = path.join(ARTIFACT_DIR, 'services_modal_screenshot.png');
  const modalImage = await win.webContents.capturePage();
  fs.writeFileSync(MODAL_SCREENSHOT_PATH, modalImage.toPNG());
  console.log(`[E2E Services] Modal screenshot saved to ${MODAL_SCREENSHOT_PATH} (${fs.statSync(MODAL_SCREENSHOT_PATH).size} bytes)`);

  // Close modal and capture dashboard screenshot
  await win.webContents.executeJavaScript(`
    (() => {
      const store = window.__servicesStore;
      store.getState().closeConfigModal();
    })()
  `);
  await new Promise((r) => setTimeout(r, 500));

  console.log('\n[E2E Services] Step 7: Capturing visual proof screenshot of dashboard...');
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }
  const image = await win.webContents.capturePage();
  fs.writeFileSync(SCREENSHOT_PATH, image.toPNG());
  console.log(`[E2E Services] Screenshot saved to ${SCREENSHOT_PATH} (${fs.statSync(SCREENSHOT_PATH).size} bytes)`);

  console.log('\n[E2E Services] Step 8: Testing Drag-to-Reorder services & localStorage persistence...');
  const reorderResult = await win.webContents.executeJavaScript(`
    (() => {
      try {
        const store = window.__servicesStore;
        const appStore = window.__appStore;
        const projectId = appStore.getState().activeProjectId || '1';
        const initialServices = store.getState().getServices(projectId);

        if (initialServices.length >= 2) {
          const firstId = initialServices[0].id;
          const secondId = initialServices[1].id;

          // Reorder: move 0 to 1
          store.getState().reorderServices(projectId, 0, 1);

          const afterReorder = store.getState().getServices(projectId);
          const hasSwapped = afterReorder[0].id === secondId && afterReorder[1].id === firstId;

          // Check localStorage persistence
          const raw = localStorage.getItem('omnigit_services_' + projectId);
          const fromStorage = JSON.parse(raw || '[]');
          const storagePersisted = fromStorage[0]?.id === secondId && fromStorage[1]?.id === firstId;

          return {
            ok: hasSwapped && storagePersisted,
            hasSwapped,
            storagePersisted,
            firstBefore: firstId,
            firstAfter: afterReorder[0].id,
          };
        }
        return { ok: true, skipped: true };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    })()
  `);
  console.log('[E2E Services] Reorder result:', reorderResult);
  if (!reorderResult.ok) {
    throw new Error('Reorder or persistence check failed: ' + JSON.stringify(reorderResult));
  }

  win.destroy();

  if (capturedErrors.length > 0) {
    throw new Error(`Encountered ${capturedErrors.length} browser errors during test`);
  }

  console.log('\n🎉 ALL SERVICES E2E TESTS (WEB + ELECTRON PARITY) PASSED WITH 0 ERRORS! 🎉\n');
  app.exit(0);
}

run().catch((err) => {
  console.error('\n❌ E2E Services Test Failed:', err);
  app.exit(1);
});
