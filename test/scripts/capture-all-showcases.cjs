/**
 * capture-all-showcases.cjs
 * Captures pixel-perfect screenshots of all major OmniGit features for documentation.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9555;
const APP_URL = 'http://127.0.0.1:5345/?ws=ws_1789365574398';
const DOCS_IMAGES_DIR = path.resolve(__dirname, '..', '..', 'docs', 'images');
const REPORTS_DIR = path.resolve(__dirname, '..', 'reports');
const TEMP_USER_DATA = path.join(os.tmpdir(), `omnigit_showcases_${Date.now()}`);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('=== Capturing OmniGit Full Feature Suite Showcases ===');

  if (!fs.existsSync(DOCS_IMAGES_DIR)) {
    fs.mkdirSync(DOCS_IMAGES_DIR, { recursive: true });
  }

  console.log('1. Launching Headless Chrome...');
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--disable-extensions',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
    'about:blank',
  ]);

  let wsUrl = null;
  for (let i = 0; i < 20; i++) {
    await sleep(400);
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) {
        wsUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch {}
  }

  if (!wsUrl) throw new Error('Chrome CDP endpoint not found');

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });

  let id = 1;
  const callbacks = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && callbacks.has(msg.id)) {
      const { resolve, reject } = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  };

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const reqId = id++;
      callbacks.set(reqId, { resolve, reject });
      ws.send(JSON.stringify({ id: reqId, method, params }));
    });
  }

  async function takeScreenshot(fileName) {
    const ss = await send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(ss.data, 'base64');
    const dest = path.join(DOCS_IMAGES_DIR, fileName);
    fs.writeFileSync(dest, buf);
    const reportDest = path.join(REPORTS_DIR, fileName);
    try {
      fs.writeFileSync(reportDest, buf);
    } catch {}
    console.log(`   ✓ Saved: ${dest} (${(buf.length / 1024).toFixed(1)} KB)`);
  }

  try {
    await send('Page.enable');
    await send('Runtime.enable');

    console.log('2. Navigating to OmniGit...');
    await send('Page.navigate', { url: APP_URL });
    await sleep(4000);

    // Initial setup: ensure zh-CN and Darcula theme
    await send('Runtime.evaluate', {
      expression: `
        (function() {
          const appStore = window.__appStore ? window.__appStore.getState() : null;
          if (appStore) {
            appStore.setLanguage('zh-CN');
            appStore.setTheme('darcula');
          }
        })()
      `,
    });
    await sleep(500);

    // 1. Git Workbench Mode
    console.log('3. Capturing Git Workbench Mode (01_omnigit_workbench.png)...');
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const wb = window.__workbenchStore ? window.__workbenchStore.getState() : null;
          if (wb) wb.setWorkbenchMode('git');
        })()
      `,
    });
    await sleep(1500);
    await takeScreenshot('01_omnigit_workbench.png');

    // 2. Selective Push Modal
    console.log('4. Capturing Push Commits Modal (08_selective_push_modal.png)...');
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const app = window.__appStore ? window.__appStore.getState() : null;
          if (app) app.openPushModal();
        })()
      `,
    });
    await sleep(1500);
    await takeScreenshot('08_selective_push_modal.png');

    // Close Push modal
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const app = window.__appStore ? window.__appStore.getState() : null;
          if (app) app.closePushModal();
        })()
      `,
    });
    await sleep(500);

    // 3. Services Orchestrator Mode
    console.log('5. Capturing Services Orchestrator (07_services_orchestrator.png)...');
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const wb = window.__workbenchStore ? window.__workbenchStore.getState() : null;
          if (wb) wb.setWorkbenchMode('services');
        })()
      `,
    });
    await sleep(2000);
    await takeScreenshot('07_services_orchestrator.png');

    // 4. Workspace Explorer & Monaco Code Editor
    console.log('6. Capturing Workspace Explorer & Editor (02_workspace_explorer_editor.png)...');
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const wb = window.__workbenchStore ? window.__workbenchStore.getState() : null;
          if (wb) wb.setWorkbenchMode('explorer');
        })()
      `,
    });
    await sleep(2000);
    await takeScreenshot('02_workspace_explorer_editor.png');

    // 5. English Mode UI
    console.log('7. Capturing English Mode UI (06_english_mode_ui.png)...');
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const appStore = window.__appStore ? window.__appStore.getState() : null;
          if (appStore) appStore.setLanguage('en-US');
          const wb = window.__workbenchStore ? window.__workbenchStore.getState() : null;
          if (wb) wb.setWorkbenchMode('git');
        })()
      `,
    });
    await sleep(1500);
    await takeScreenshot('06_english_mode_ui.png');

    // Restore to zh-CN
    await send('Runtime.evaluate', {
      expression: `
        (function() {
          const appStore = window.__appStore ? window.__appStore.getState() : null;
          if (appStore) appStore.setLanguage('zh-CN');
        })()
      `,
    });
    await sleep(500);

    // 6. Workspace Dashboard Mode
    console.log('8. Capturing Workspace Dashboard Mode (09_workspace_dashboard.png)...');
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const wb = window.__workbenchStore ? window.__workbenchStore.getState() : null;
          if (wb) wb.setWorkbenchMode('dashboard');
        })()
      `,
    });
    await sleep(2000);
    await takeScreenshot('09_workspace_dashboard.png');

    // 7. Dashboard Config Modal
    console.log('9. Capturing Dashboard Config Modal (10_dashboard_config_modal.png)...');
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const ds = window.__dashboardStore ? window.__dashboardStore.getState() : null;
          if (ds) ds.openConfigModal();
        })()
      `,
    });
    await sleep(1500);
    await takeScreenshot('10_dashboard_config_modal.png');

    // Close config modal
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const ds = window.__dashboardStore ? window.__dashboardStore.getState() : null;
          if (ds) ds.closeConfigModal();
        })()
      `,
    });
    await sleep(500);

    console.log('✓ All feature screenshots successfully updated!');
  } finally {
    ws.close();
    chromeProcess.kill('SIGKILL');
    try {
      fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((err) => {
  console.error('Failed to capture showcases:', err);
  process.exit(1);
});
