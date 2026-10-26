/**
 * capture-dev-guide-showcases.cjs
 * Captures pixel-perfect screenshots of the new Custom Portal Dev & AI Guide modal,
 * as well as the updated Workspace Dashboard banner.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9558;
const APP_URL = 'http://127.0.0.1:5345/?ws=ws_1789365574398';
const DOCS_IMAGES_DIR = path.resolve(__dirname, '..', '..', 'docs', 'images');
const REPORTS_DIR = path.resolve(__dirname, '..', 'reports');
const TEMP_USER_DATA = path.join(os.tmpdir(), `omnigit_guide_test_${Date.now()}`);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('=== Capturing Custom Portal Dev Guide Showcases ===');

  if (!fs.existsSync(DOCS_IMAGES_DIR)) fs.mkdirSync(DOCS_IMAGES_DIR, { recursive: true });
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--disable-extensions',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--disable-gpu',
    '--window-size=1440,900',
    'about:blank',
  ]);

  let wsUrl = null;
  for (let i = 0; i < 25; i++) {
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
      const msgId = id++;
      callbacks.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async function takeScreenshot(filename) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(shot.data, 'base64');
    fs.writeFileSync(path.join(DOCS_IMAGES_DIR, filename), buffer);
    fs.writeFileSync(path.join(REPORTS_DIR, filename), buffer);
    console.log(`Saved screenshot: ${filename}`);
  }

  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: APP_URL });
    await sleep(2500);

    // 1. Switch to dashboard view
    console.log('1. Switching to Dashboard mode...');
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const wb = window.__workbenchStore ? window.__workbenchStore.getState() : null;
          if (wb) wb.setWorkbenchMode('dashboard');
        })()
      `,
    });
    await sleep(1500);

    // Capture updated dashboard view with guide button
    await takeScreenshot('09_workspace_dashboard.png');

    // 2. Open Guide Modal
    console.log('2. Opening Portal Dev Guide Modal...');
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const ds = window.__dashboardStore ? window.__dashboardStore.getState() : null;
          if (ds) ds.openGuideModal();
        })()
      `,
    });
    await sleep(1000);
    await takeScreenshot('11_portal_guide_scenarios.png');

    // 3. Switch Guide Tab to AI Prompt
    console.log('3. Switching to AI Prompt Tab...');
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const aiBtn = document.querySelector('[data-testid="guide-tab-ai-prompt"]');
          if (aiBtn) aiBtn.click();
        })()
      `,
    });
    await sleep(1000);
    await takeScreenshot('12_portal_guide_ai_prompt.png');

    // 4. Switch Guide Tab to Bridge Interaction
    console.log('4. Switching to Bridge Protocol Tab...');
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const bridgeBtn = document.querySelector('[data-testid="guide-tab-bridge"]');
          if (bridgeBtn) bridgeBtn.click();
        })()
      `,
    });
    await sleep(1000);
    await takeScreenshot('13_portal_guide_bridge.png');

    console.log('✓ All guide showcases captured successfully!');
  } finally {
    ws.close();
    chromeProcess.kill('SIGKILL');
    try {
      fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((err) => {
  console.error('Failed to capture guide showcases:', err);
  process.exit(1);
});
