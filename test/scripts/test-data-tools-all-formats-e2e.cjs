/**
 * test-data-tools-all-formats-e2e.cjs
 * Systematic verification for ALL data formats (json / yaml / xml / sql / jwt / url / base64):
 *   1. Beautify is idempotent (no toggling, no content corruption)
 *   2. Minify -> Beautify restores the beautified document (round-trip)
 *   3. No false syntax errors; tree renders where applicable
 *   4. Tab round-trip keeps each format's own document untouched
 *   5. JWT/URL: raw token/url converts to decoded view, then formats like JSON
 *
 * Prerequisites: vite dev server running. Override address with OMNIGIT_E2E_URL.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9583;
const APP_URL = process.env.OMNIGIT_E2E_URL || 'http://127.0.0.1:5345/';
const REPORT_FILE = path.resolve(__dirname, '..', 'reports', 'data-tools-all-formats.json');
const TEMP_USER_DATA = path.join(os.tmpdir(), `omnigit_allfmt_${Date.now()}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FORMATS = ['json', 'yaml', 'xml', 'sql', 'jwt', 'url', 'base64'];
const TREE_FORMATS = ['json', 'yaml', 'jwt', 'url', 'base64'];

let failures = 0;
function report(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail !== undefined ? ' :: ' + JSON.stringify(detail) : ''}`);
  if (!ok) failures++;
}

(async () => {
  const chrome = spawn(CHROME_PATH, [
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
      const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) { wsUrl = page.webSocketDebuggerUrl; break; }
    } catch {}
  }
  if (!wsUrl) throw new Error('Chrome CDP endpoint not found');

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 1;
  const cbs = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && cbs.has(m.id)) { const { resolve, reject } = cbs.get(m.id); cbs.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = id++; cbs.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
    return r.result.value;
  };

  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: APP_URL });

    let ready = false;
    for (let i = 0; i < 60; i++) {
      await sleep(1000);
      try { ready = await ev('Boolean(window.__dataToolsStore && window.__workbenchStore)'); if (ready) break; } catch {}
    }
    if (!ready) throw new Error('window.__dataToolsStore not available after 60s');

    await ev(`window.__workbenchStore.getState().setWorkbenchMode('data-tools')`);
    await sleep(800);

    const results = {};

    for (const fmt of FORMATS) {
      const r = await ev(`(async function(){
        const tick = () => new Promise(res => setTimeout(res, 120));
        const dt = window.__dataToolsStore;
        dt.getState().setFormat('${fmt}');
        await tick();
        dt.getState().loadSample('${fmt}');
        await tick();
        const s0 = dt.getState();
        const c0 = s0.formattedContent;

        s0.formatCurrent();
        await tick();
        const c1 = dt.getState().formattedContent;

        dt.getState().formatCurrent();
        await tick();
        const c2 = dt.getState().formattedContent;

        dt.getState().minifyCurrent();
        await tick();
        const m = dt.getState().formattedContent;
        const stM = dt.getState().stats;

        dt.getState().formatCurrent();
        await tick();
        const c3 = dt.getState().formattedContent;
        const st3 = dt.getState().stats;

        // tab round-trip: switch away and back
        dt.getState().setFormat('json');
        await tick();
        dt.getState().setFormat('${fmt}');
        await tick();
        const c4 = dt.getState().formattedContent;

        return {
          c0, c1, c2, m, c3, c4,
          idempotent: c1 === c2,
          roundtrip: c3 === c1,
          minifyChanged: m !== c1,
          validAfterBeautify: st3.isValid,
          errorMessage: st3.isValid ? null : st3.errorMessage,
          hasTree: Boolean(dt.getState().treeRoot),
          tabStable: c4 === c3,
          domTree: Boolean(document.querySelector('[data-testid^="tree-node-"]'))
        };
      })()`);
      results[fmt] = r;

      console.log(`\n--- ${fmt.toUpperCase()} ---`);
      report(`${fmt}: beautify returns content`, typeof r.c1 === 'string' && r.c1.length > 0);
      report(`${fmt}: beautify idempotent`, r.idempotent === true, { len: r.c1.length });
      if (fmt === 'yaml') {
        // YAML minify is intentionally a no-op: collapsing whitespace would break indentation.
        report(`${fmt}: minify keeps YAML intact (no whitespace collapse)`, r.m === r.c1, {
          before: r.c1.length,
          after: r.m.length,
        });
      } else if (fmt === 'base64') {
        // Base64 minify only strips whitespace; a clean sample therefore stays unchanged.
        report(
          `${fmt}: minify only strips whitespace`,
          r.m === r.c1.replace(/\s+/g, ''),
          { before: r.c1.length, after: r.m.length }
        );
      } else {
        report(`${fmt}: minify changes content`, r.minifyChanged === true, { before: r.c1.length, after: r.m.length });
      }
      report(`${fmt}: minify -> beautify restores`, r.roundtrip === true);
      report(`${fmt}: no syntax error after beautify`, r.validAfterBeautify === true, r.errorMessage);
      report(`${fmt}: tab round-trip keeps document`, r.tabStable === true);
      if (TREE_FORMATS.includes(fmt)) {
        report(`${fmt}: structure tree rendered`, r.hasTree === true && r.domTree === true);
      }
    }

    // JWT raw token -> decoded view -> minify -> beautify
    const jwtRaw = await ev(`(async function(){
      const tick = () => new Promise(res => setTimeout(res, 120));
      const dt = window.__dataToolsStore;
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFsZXggRGV2IiwiaWF0IjoxNTE2MjM5MDIyfQ.signature_placeholder';
      dt.getState().setFormat('jwt');
      await tick();
      dt.getState().setContent(token);
      await tick();
      dt.getState().formatCurrent();
      await tick();
      const view = dt.getState().formattedContent;
      dt.getState().minifyCurrent();
      await tick();
      const compact = dt.getState().formattedContent;
      dt.getState().formatCurrent();
      await tick();
      const restored = dt.getState().formattedContent;
      let isJson = false; try { JSON.parse(restored); isJson = true; } catch {}
      return {
        viewIsJson: (() => { try { JSON.parse(view); return true; } catch { return false; } })(),
        compactOneLine: !compact.includes('\\n'),
        restoredMatches: restored === view,
        isJson,
        hasTree: Boolean(dt.getState().treeRoot),
        valid: dt.getState().stats.isValid
      };
    })()`);
    console.log('\n--- JWT TOKEN -> VIEW ---');
    report('jwt: raw token converts to decoded JSON view', jwtRaw.viewIsJson === true);
    report('jwt: minify produces single-line JSON', jwtRaw.compactOneLine === true);
    report('jwt: beautify after minify restores view', jwtRaw.restoredMatches === true);
    report('jwt: tree + valid state after restore', jwtRaw.hasTree === true && jwtRaw.valid === true);

    // URL raw -> decoded view -> minify -> beautify
    const urlRaw = await ev(`(async function(){
      const tick = () => new Promise(res => setTimeout(res, 120));
      const dt = window.__dataToolsStore;
      dt.getState().setFormat('url');
      await tick();
      dt.getState().setContent('https://api.omnigit.dev/v1/repos?a=1&b=2&a=3');
      await tick();
      dt.getState().formatCurrent();
      await tick();
      const view = dt.getState().formattedContent;
      dt.getState().minifyCurrent();
      await tick();
      dt.getState().formatCurrent();
      await tick();
      return {
        viewIsJson: (() => { try { JSON.parse(view); return true; } catch { return false; } })(),
        restoredMatches: dt.getState().formattedContent === view,
        hasTree: Boolean(dt.getState().treeRoot)
      };
    })()`);
    console.log('\n--- URL -> VIEW ---');
    report('url: raw url converts to decoded JSON view', urlRaw.viewIsJson === true);
    report('url: beautify after minify restores view', urlRaw.restoredMatches === true);
    report('url: tree rendered', urlRaw.hasTree === true);

    if (!fs.existsSync(path.dirname(REPORT_FILE))) fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
    fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2));

    console.log(`\n=== ${failures === 0 ? 'ALL FORMAT CHECKS PASSED' : `${failures} CHECK(S) FAILED`} ===`);
    process.exitCode = failures === 0 ? 0 : 1;
  } finally {
    ws.close();
    chrome.kill();
  }
})().catch((e) => { console.error('E2E ERROR:', e.message); process.exitCode = 1; });
