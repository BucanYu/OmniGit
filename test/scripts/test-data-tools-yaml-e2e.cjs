/**
 * test-data-tools-yaml-e2e.cjs
 * Targeted CDP verification for the YAML tree-rendering fix and the
 * sample-selector dropdown positioning fix.
 * Prerequisites: vite dev server running at http://127.0.0.1:5345
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9581;
const APP_URL = 'http://127.0.0.1:5345/';
const REPORTS_DIR = path.resolve(__dirname, '..', 'reports');
const TEMP_USER_DATA = path.join(os.tmpdir(), `omnigit_yaml_test_${Date.now()}`);

const SAMPLE_YAML = `code: 200
message: success
data:
  workspace: OmniGit Production Hub
  version: 0.6.1
  activeProjects:
    - id: 101
      name: cloud-gateway-service
      status: running
      port: 8080
      tags:
        - microservice
        - gateway
        - spring-cloud
      metrics:
        cpu: 12.5
        memoryMb: 512
        qps: 1420
  featuresEnabled:
    autoSync: true
    antiRceSandbox: true
timestamp: 1793000000000
`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let failures = 0;
function report(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + JSON.stringify(detail) : ''}`);
  if (!ok) failures++;
}

async function main() {
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
  async function evaluate(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
    return r.result.value;
  }

  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: APP_URL });

    // Poll until the app exposes its zustand stores (dev-server first compile can be slow)
    let storeReady = false;
    for (let i = 0; i < 60; i++) {
      await sleep(1000);
      try {
        storeReady = await evaluate(`Boolean(window.__dataToolsStore && window.__workbenchStore)`);
        if (storeReady) break;
      } catch {}
    }
    if (!storeReady) throw new Error('window.__dataToolsStore not available after 60s');

    await evaluate(`(function(){ const wb = window.__workbenchStore; if (wb) wb.getState().setWorkbenchMode('data-tools'); })()`);
    await sleep(1200);

    // === Part 1: YAML content -> tree rendering ===
    await evaluate(`(function(){ const dt = window.__dataToolsStore; dt.getState().setFormat('yaml'); })()`);
    await sleep(400);
    // Simulate user deleting sample and pasting YAML: setContent
    await evaluate(`(function(){
      const dt = window.__dataToolsStore;
      dt.getState().setContent(${JSON.stringify(SAMPLE_YAML)});
    })()`);
    await sleep(600);

    const treeState = await evaluate(`(function(){
      const s = window.__dataToolsStore.getState();
      const domNode = document.querySelector('[data-testid="tree-node-$.data.activeProjects"]');
      return {
        hasTreeRoot: Boolean(s.treeRoot),
        rootKeys: s.treeRoot && s.treeRoot.children ? s.treeRoot.children.map(c => c.key) : null,
        hasParsedData: Boolean(s.parsedData && s.parsedData.data),
        domTreeRendered: Boolean(domNode),
        syntaxError: s.stats.isValid ? null : s.stats.errorMessage
      };
    })()`);
    report('YAML paste -> treeRoot built', treeState.hasTreeRoot === true, treeState.rootKeys);
    report('YAML paste -> parsedData populated', treeState.hasParsedData === true);
    report('YAML paste -> tree DOM rendered', treeState.domTreeRendered === true);
    report('YAML paste -> no syntax error banner', treeState.syntaxError === null, treeState.syntaxError);
    report('YAML paste -> expected root keys', JSON.stringify(treeState.rootKeys) === JSON.stringify(['code', 'message', 'data', 'timestamp']), treeState.rootKeys);

    // === Part 2: Beautify keeps tree and normalizes content ===
    await evaluate(`(function(){ window.__dataToolsStore.getState().formatCurrent(); })()`);
    await sleep(600);
    const beautifyState = await evaluate(`(function(){
      const s = window.__dataToolsStore.getState();
      return {
        hasTreeRoot: Boolean(s.treeRoot),
        formattedLines: s.formattedContent.split('\\n').length,
        roundtripOk: s.formattedContent.replace(/\\s+$/,'') === ${JSON.stringify(SAMPLE_YAML.replace(/\s+$/, ''))}
      };
    })()`);
    report('Beautify -> tree still rendered', beautifyState.hasTreeRoot === true);
    report('Beautify -> YAML normalized (roundtrip)', beautifyState.roundtripOk === true, { lines: beautifyState.formattedLines });

    // === Part 3: sample dropdown positioning ===
    const menuPos = await evaluate(`(function(){
      const btn = document.querySelector('[data-testid="data-tools-btn-samples"]');
      if (!btn) return { error: 'button not found' };
      btn.click();
      return new Promise((resolve) => setTimeout(() => {
        const btnRect = btn.getBoundingClientRect();
        const menu = Array.from(document.querySelectorAll('div')).find(d =>
          d.style && d.style.position === 'fixed' && d.className.includes('w-44'));
        if (!menu) { resolve({ error: 'menu not found' }); return; }
        const r = menu.getBoundingClientRect();
        resolve({
          btnBottom: btnRect.bottom,
          btnRight: btnRect.right,
          menuTop: r.top,
          menuRight: r.right,
          menuWidth: r.width,
          menuHeight: r.height,
          viewportW: window.innerWidth,
          viewportH: window.innerHeight,
          inViewport: r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
          anchoredUnderButton: Math.abs(r.top - (btnRect.bottom + 6)) <= 2 && Math.abs(r.right - btnRect.right) <= 2,
          itemCount: menu.querySelectorAll('button').length
        });
      }, 300));
    })()`);
    report('Dropdown -> rendered', !menuPos.error, menuPos.error);
    report('Dropdown -> anchored under button (fixed pos)', menuPos.anchoredUnderButton === true, {
      menuTop: menuPos.menuTop, btnBottom: menuPos.btnBottom, menuRight: menuPos.menuRight, btnRight: menuPos.btnRight,
    });
    report('Dropdown -> fully in viewport (no clipping)', menuPos.inViewport === true, {
      w: menuPos.menuWidth, h: menuPos.menuHeight, viewport: [menuPos.viewportW, menuPos.viewportH],
    });
    report('Dropdown -> 5 sample items', menuPos.itemCount === 5, menuPos.itemCount);

    // Outside click closes menu
    await evaluate(`(function(){
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    })()`);
    await sleep(300);
    const menuClosed = await evaluate(`(function(){
      const s = window.__dataToolsStore;
      const open = !!Array.from(document.querySelectorAll('div')).find(d => d.style && d.style.position === 'fixed' && d.className.includes('w-44'));
      return !open;
    })()`);
    report('Dropdown -> outside click closes', menuClosed === true);

    // Load YAML sample via menu flow (loadSample direct call)
    const loadSampleState = await evaluate(`(function(){
      const s = window.__dataToolsStore.getState();
      s.loadSample('yaml');
      return new Promise((resolve) => setTimeout(() => {
        const st = window.__dataToolsStore.getState();
        resolve({ hasContent: st.rawContent.length > 0, hasTree: Boolean(st.treeRoot) });
      }, 400));
    })()`);
    report('loadSample(yaml) -> content + tree', loadSampleState.hasContent && loadSampleState.hasTree, loadSampleState);

    console.log(failures === 0 ? '\n=== ALL YAML/DROPDOWN TARGETED CHECKS PASSED ===' : `\n=== ${failures} CHECK(S) FAILED ===`);
    process.exitCode = failures === 0 ? 0 : 1;
  } finally {
    ws.close();
    chromeProcess.kill();
  }
}

main().catch((err) => {
  console.error('E2E ERROR:', err.message);
  process.exitCode = 1;
});
