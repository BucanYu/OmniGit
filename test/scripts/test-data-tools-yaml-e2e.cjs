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
const APP_URL = process.env.OMNIGIT_E2E_URL || 'http://127.0.0.1:5345/';
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

    // === Part 4: per-format document isolation (no cross-tab leakage) ===
    const switchToJson = await evaluate(`(function(){
      const dt = window.__dataToolsStore;
      dt.getState().setFormat('json');
      const s = dt.getState();
      let parsesAsJson = false;
      try { JSON.parse(s.formattedContent); parsesAsJson = true; } catch {}
      return {
        activeFormat: s.activeFormat,
        parsesAsJson,
        isValid: s.stats.isValid,
        hasTree: Boolean(s.treeRoot),
        startsWithBrace: s.formattedContent.trimStart().startsWith('{')
      };
    })()`);
    report('Isolation -> JSON tab shows its own JSON doc', switchToJson.parsesAsJson === true && switchToJson.startsWithBrace === true, switchToJson);
    report('Isolation -> JSON tab valid & tree rendered', switchToJson.isValid === true && switchToJson.hasTree === true);

    const backToYaml = await evaluate(`(function(){
      const dt = window.__dataToolsStore;
      dt.getState().setFormat('yaml');
      const s = dt.getState();
      return {
        activeFormat: s.activeFormat,
        preserved: s.formattedContent.replace(/\\s+$/,'') === ${JSON.stringify(SAMPLE_YAML.replace(/\s+$/, ''))},
        hasTree: Boolean(s.treeRoot),
        isValid: s.stats.isValid
      };
    })()`);
    report('Isolation -> YAML doc preserved after tab round-trip', backToYaml.preserved === true && backToYaml.activeFormat === 'yaml', backToYaml);
    report('Isolation -> YAML tree rebuilt on return', backToYaml.hasTree === true && backToYaml.isValid === true);

    // Clearing one tab must not wipe another tab's document
    const clearIsolation = await evaluate(`(function(){
      const dt = window.__dataToolsStore;
      dt.getState().setContent('');
      const yamlEmpty = dt.getState().formattedContent === '';
      dt.getState().setFormat('json');
      const jsonStillThere = dt.getState().formattedContent.trim().length > 0;
      dt.getState().setFormat('yaml');
      const yamlStillEmpty = dt.getState().formattedContent === '';
      return { yamlEmpty, jsonStillThere, yamlStillEmpty };
    })()`);
    report('Isolation -> clearing YAML keeps JSON doc intact', clearIsolation.yamlEmpty && clearIsolation.jsonStillThere, clearIsolation);
    report('Isolation -> cleared YAML stays empty (not re-seeded)', clearIsolation.yamlStillEmpty === true);

    // Restore a sample for subsequent checks
    await evaluate(`(function(){ window.__dataToolsStore.getState().loadSample('yaml'); })()`);
    await sleep(300);

    // Load YAML sample via menu flow (loadSample direct call)
    const loadSampleState = await evaluate(`(function(){
      const s = window.__dataToolsStore.getState();
      s.loadSample('yaml');
      return new Promise((resolve) => setTimeout(() => {
        const st = window.__dataToolsStore.getState();
        resolve({ hasContent: st.formattedContent.length > 0, hasTree: Boolean(st.treeRoot) });
      }, 400));
    })()`);
    report('loadSample(yaml) -> content + tree', loadSampleState.hasContent && loadSampleState.hasTree, loadSampleState);

    // === Part 5: Base64 must never be rewritten by beautify (source stays, decode is preview-only) ===
    const BASE64_SAMPLE = 'T21uaUdpdCBEYXRhIFRvb2xzIC0gQmFzZTY0IHNhbXBsZSBwYXlsb2Fk';
    const base64State = await evaluate(`(function(){
      const dt = window.__dataToolsStore;
      dt.getState().setFormat('base64');
      dt.getState().setContent('${BASE64_SAMPLE}');
      const before = window.__dataToolsStore.getState().formattedContent;
      dt.getState().formatCurrent();
      const afterFirst = window.__dataToolsStore.getState().formattedContent;
      dt.getState().formatCurrent();
      const afterSecond = window.__dataToolsStore.getState().formattedContent;
      dt.getState().formatCurrent();
      const afterThird = window.__dataToolsStore.getState().formattedContent;
      const st = window.__dataToolsStore.getState();
      const decodedNode = st.treeRoot && st.treeRoot.children
        ? st.treeRoot.children.find(c => c.key === 'decodedText')
        : null;
      return {
        before,
        afterFirst,
        afterSecond,
        afterThird,
        isBase64Charset: /^[A-Za-z0-9+/]+=*$/.test(afterThird),
        decodedText: decodedNode ? decodedNode.value : null,
        hasTree: Boolean(st.treeRoot)
      };
    })()`);
    report(
      'Base64 -> beautify is idempotent (no decode/re-encode toggling)',
      base64State.before === base64State.afterFirst &&
        base64State.afterFirst === base64State.afterSecond &&
        base64State.afterSecond === base64State.afterThird,
      { before: base64State.before.slice(0, 24), third: base64State.afterThird.slice(0, 24) }
    );
    report('Base64 -> editor keeps base64 source after beautify', base64State.isBase64Charset === true);
    report(
      'Base64 -> decoded text shown in tree preview only',
      base64State.hasTree === true && base64State.decodedText === 'OmniGit Data Tools - Base64 sample payload',
      { decodedText: base64State.decodedText }
    );

    // Switching tabs away and back must NOT transform the base64 document either
    const base64TabRoundTrip = await evaluate(`(function(){
      const dt = window.__dataToolsStore;
      dt.getState().setFormat('json');
      dt.getState().setFormat('base64');
      const after = dt.getState().formattedContent;
      return { after, unchanged: after === '${BASE64_SAMPLE}' };
    })()`);
    report('Base64 -> tab round-trip keeps source untouched', base64TabRoundTrip.unchanged === true, {
      head: base64TabRoundTrip.after.slice(0, 24),
    });

    // Minify only strips whitespace, never re-encodes
    const base64Minify = await evaluate(`(function(){
      const dt = window.__dataToolsStore;
      const wrapped = '${BASE64_SAMPLE}'.slice(0, 32) + '\\n  ' + '${BASE64_SAMPLE}'.slice(32);
      dt.getState().setContent(wrapped);
      dt.getState().minifyCurrent();
      const s = dt.getState().formattedContent;
      return { content: s, noWhitespace: !/\\s/.test(s) };
    })()`);
    report('Base64 -> minify strips whitespace only', base64Minify.noWhitespace === true, {
      len: base64Minify.content.length,
    });

    console.log(failures === 0 ? '\n=== ALL YAML/DROPDOWN/BASE64 TARGETED CHECKS PASSED ===' : `\n=== ${failures} CHECK(S) FAILED ===`);
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
