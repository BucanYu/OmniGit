/**
 * test-builtin-doc-open-e2e.cjs
 * Validates opening built-in application documentation from the custom portal guide modal
 * even when the active workspace root is an unrelated project path.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9565;
const APP_URL = 'http://127.0.0.1:5345/?ws=ws_1789365574398';
const DOCS_IMAGES_DIR = path.resolve(__dirname, '..', '..', 'docs', 'images');
const REPORTS_DIR = path.resolve(__dirname, '..', 'reports');
const ARTIFACT_DIR = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\0b7df8f7-0e22-4090-836d-20effda6ee85';
const TEMP_USER_DATA = path.join(os.tmpdir(), `omnigit_doc_test_${Date.now()}`);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('=== Testing Built-in Doc Open in Editor E2E ===');

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
    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = (msg.params.args || []).map((a) => (a.value !== undefined ? a.value : (a.description || ''))).join(' ');
      console.log(`[Browser Console ${msg.params.type}]`, args);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      console.error('[Browser Uncaught Exception]', msg.params.exceptionDetails);
    }
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
    if (fs.existsSync(ARTIFACT_DIR)) {
      fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buffer);
    }
    console.log(`Saved screenshot: ${filename}`);
  }

  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: APP_URL });
    await sleep(2000);

    // Wait until workspaceId is loaded by initApp
    console.log('Waiting for workspace hydration and stores initialization...');
    for (let i = 0; i < 30; i++) {
      const ready = await send('Runtime.evaluate', {
        expression: `Boolean(
          window.__appStore &&
          window.__appStore.getState().workspaceId &&
          window.__dashboardStore &&
          window.__editorTabsStore
        )`,
        returnByValue: true,
      });
      if (ready.result && ready.result.value) break;
      await sleep(300);
    }
    await sleep(2000); // Allow initial restorePersistedTabs to settle

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
    await sleep(1000);

    // 2. Open Portal Guide Modal from dashboard
    console.log('2. Opening Portal Guide Modal...');
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const ds = window.__dashboardStore ? window.__dashboardStore.getState() : null;
          if (ds) ds.openGuideModal();
        })()
      `,
    });
    await sleep(1000);

    // 3. Click "在内置编辑器中阅读完整指南"
    console.log('3. Clicking "在内置编辑器中阅读完整指南" button...');
    const clickRes = await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const btn = document.querySelector('[data-testid="guide-open-editor-btn"]');
          if (!btn) {
            return { clicked: false, error: 'Button not found in DOM' };
          }
          const propKey = Object.keys(btn).find(k => k.startsWith('__reactProps'));
          const props = propKey ? btn[propKey] : null;
          if (props && props.onClick) {
            await props.onClick({ stopPropagation: () => {}, preventDefault: () => {} });
            return { clicked: true, method: 'reactProps.onClick' };
          }
          btn.click();
          return { clicked: true, method: 'native' };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log('Click result:', clickRes.result.value);

    // 4. Wait for editor tab to open and switch workbench mode to explorer
    await sleep(2000);

    // 5. Validate editor state
    console.log('4. Validating Editor tab state...');
    const evalRes = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const ets = window.__editorTabsStore ? window.__editorTabsStore.getState() : null;
          const wb = window.__workbenchStore ? window.__workbenchStore.getState() : null;
          if (!ets) return { error: 'No editorTabsStore found' };
          const activeTab = ets.tabs.find(t => t.id === ets.activeTabId);
          return {
            workbenchMode: wb ? wb.workbenchMode : null,
            tabCount: ets.tabs.length,
            activeTabId: ets.activeTabId,
            fileName: activeTab ? activeTab.fileName : null,
            filePath: activeTab ? activeTab.filePath : null,
            repoName: activeTab ? activeTab.repoName : null,
            contentLength: activeTab ? activeTab.content.length : 0,
            hasError: Boolean(activeTab && activeTab.readError),
            readError: activeTab ? activeTab.readError : null,
          };
        })()
      `,
      returnByValue: true,
    });

    const val = evalRes.result.value;
    console.log('Editor Active Tab Verification:', val);

    if (val.error) throw new Error(val.error);
    if (val.workbenchMode !== 'explorer') {
      throw new Error(`Expected workbenchMode to be explorer, got ${val.workbenchMode}`);
    }
    if (val.fileName !== 'CUSTOM_DASHBOARD_GUIDE.md') {
      throw new Error(`Expected fileName to be CUSTOM_DASHBOARD_GUIDE.md, got ${val.fileName}`);
    }
    if (val.hasError) {
      throw new Error(`Editor tab has read error: ${val.readError}`);
    }
    if (val.contentLength < 5000) {
      throw new Error(`Expected content length > 5000, got ${val.contentLength}`);
    }

    console.log('✓ Verification PASSED: Built-in document opened and rendered perfectly without 404!');

    // 6. Capture screenshot of opened document in Monaco Editor
    await takeScreenshot('14_builtin_guide_opened_in_editor.png');

  } finally {
    ws.close();
    chromeProcess.kill('SIGKILL');
    try {
      fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
