/**
 * verify-themes-modal.cjs
 * Captures DashboardConfigModal screenshots across all 4 supported themes:
 * - idea-light
 * - darcula
 * - github-dark
 * - nord-frost
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9556;
const APP_URL = 'http://127.0.0.1:5345/?ws=ws_1789365574398';
const REPORTS_DIR = path.resolve(__dirname, '..', 'reports');
const TEMP_USER_DATA = path.join(os.tmpdir(), `omnigit_theme_test_${Date.now()}`);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('=== Verifying DashboardConfigModal across All 4 Themes ===');

  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

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

  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: APP_URL });
    await sleep(3000);

    // Switch to Dashboard mode and open modal
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const wb = window.__workbenchStore ? window.__workbenchStore.getState() : null;
          if (wb) wb.setWorkbenchMode('dashboard');
          const ds = window.__dashboardStore ? window.__dashboardStore.getState() : null;
          if (ds) ds.openConfigModal();
        })()
      `,
    });
    await sleep(1000);

    const themes = ['idea-light', 'darcula', 'github-dark', 'nord-frost'];

    for (const theme of themes) {
      console.log(`Testing theme: ${theme}...`);
      await send('Runtime.evaluate', {
        expression: `
          (async function() {
            const appStore = window.__appStore ? window.__appStore.getState() : null;
            if (appStore) appStore.setTheme('${theme}');
            document.documentElement.setAttribute('data-theme', '${theme}');
          })()
        `,
      });
      await sleep(1000);

      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const filename = `modal_${theme}.png`;
      const outPath = path.join(REPORTS_DIR, filename);
      fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
      console.log(`Saved screenshot: ${outPath}`);
    }

    console.log('✓ All theme screenshots captured successfully!');
  } finally {
    ws.close();
    chromeProcess.kill('SIGKILL');
    try {
      fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((err) => {
  console.error('Failed to verify themes:', err);
  process.exit(1);
});
