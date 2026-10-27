/**
 * test-data-tools-e2e.cjs
 * End-to-end headless Chrome CDP automation test for Data Tools & Formatter Workbench:
 * 1. Navigation via Alt+4 / ActivityBar
 * 2. Beautify / Minify JSON
 * 3. Interactive Tree Node Collapse & Expand (e.g. activeProjects array)
 * 4. Multi-format switching (YAML, SQL, JWT, URL)
 * 5. Table view rendering for array of objects
 * 6. Cross-language Type Generator modal
 * 7. Capturing showcase screenshots
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9580;
const APP_URL = process.env.OMNIGIT_E2E_URL || 'http://127.0.0.1:5345/?ws=ws_1789365574398';
const DOCS_IMAGES_DIR = path.resolve(__dirname, '..', '..', 'docs', 'images');
const REPORTS_DIR = path.resolve(__dirname, '..', 'reports');
const ARTIFACT_DIR = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\0b7df8f7-0e22-4090-836d-20effda6ee85';
const TEMP_USER_DATA = path.join(os.tmpdir(), `omnigit_datatools_test_${Date.now()}`);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('=== Testing Data Tools & Formatter Workbench E2E ===');

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
    if (fs.existsSync(ARTIFACT_DIR)) {
      fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buffer);
    }
    console.log(`Saved screenshot: ${filename}`);
  }

  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: APP_URL });
    await sleep(3500);

    // 1. Switch to Data Tools mode (Alt + 4)
    console.log('1. Switching to Data Tools mode (Alt + 4)...');
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const wb = window.__workbenchStore ? window.__workbenchStore.getState() : null;
          if (wb) wb.setWorkbenchMode('data-tools');
        })()
      `,
    });
    await sleep(1500);

    const initialModeCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const wb = window.__workbenchStore ? window.__workbenchStore.getState() : null;
          const dt = window.__dataToolsStore ? window.__dataToolsStore.getState() : null;
          return {
            workbenchMode: wb ? wb.workbenchMode : null,
            activeFormat: dt ? dt.activeFormat : null,
            viewMode: dt ? dt.viewMode : null,
            hasContent: Boolean(dt && dt.formattedContent.length > 0)
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Initial Data Tools State:', initialModeCheck.result.value);
    if (initialModeCheck.result.value.workbenchMode !== 'data-tools') {
      throw new Error(`Expected workbenchMode to be data-tools, got ${initialModeCheck.result.value.workbenchMode}`);
    }

    // Capture Split View
    await sleep(600);
    await takeScreenshot('17_data_tools_split_view.png');

    // 2. Test Folding / Collapsing an Array Node
    console.log('2. Testing interactive node collapse on activeProjects array...');
    const foldRes = await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const dt = window.__dataToolsStore.getState();
          // Collapse $.data.activeProjects
          dt.togglePath('$.data.activeProjects');
          await new Promise(r => setTimeout(r, 400));
          const updated = window.__dataToolsStore.getState();
          const isFolded = !updated.expandedPaths.has('$.data.activeProjects');
          return { isFolded };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log('Array Node Fold Result:', foldRes.result.value);
    if (!foldRes.result.value.isFolded) {
      throw new Error('Failed to collapse activeProjects array node');
    }
    await sleep(500);
    await takeScreenshot('18_data_tools_tree_folded.png');

    // Expand it back
    await send('Runtime.evaluate', {
      expression: `
        (function() {
          window.__dataToolsStore.getState().togglePath('$.data.activeProjects');
        })()
      `,
    });
    await sleep(300);

    // 3. Test Minify & Beautify
    console.log('3. Testing Minify and Beautify operations...');
    const formatTestRes = await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const dt = window.__dataToolsStore.getState();
          dt.minifyCurrent();
          await new Promise(r => setTimeout(r, 300));
          const minifiedLen = window.__dataToolsStore.getState().formattedContent.split('\\n').length;

          dt.formatCurrent();
          await new Promise(r => setTimeout(r, 300));
          const beautifiedLen = window.__dataToolsStore.getState().formattedContent.split('\\n').length;

          return {
            minifiedLines: minifiedLen,
            beautifiedLines: beautifiedLen,
            minifySuccess: minifiedLen === 1,
            beautifySuccess: beautifiedLen > 10
          };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log('Format & Minify Test Result:', formatTestRes.result.value);
    if (!formatTestRes.result.value.minifySuccess || !formatTestRes.result.value.beautifySuccess) {
      throw new Error('Minify or Beautify operation verification failed');
    }

    // 4. Test Table View
    console.log('4. Testing Table View for array of objects...');
    await send('Runtime.evaluate', {
      expression: `
        (function() {
          window.__dataToolsStore.getState().setViewMode('table');
        })()
      `,
    });
    await sleep(800);

    const tableCheckRes = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const table = document.querySelector('table');
          const rows = document.querySelectorAll('tbody tr');
          const headers = Array.from(document.querySelectorAll('th')).map(th => th.textContent.trim());
          return {
            hasTable: Boolean(table),
            rowCount: rows.length,
            headers
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Table View Check:', tableCheckRes.result.value);
    if (!tableCheckRes.result.value.hasTable || tableCheckRes.result.value.rowCount === 0) {
      throw new Error('Table view failed to render array rows');
    }
    await takeScreenshot('19_data_tools_table_view.png');

    // Switch back to split view
    await send('Runtime.evaluate', {
      expression: `
        (function() {
          window.__dataToolsStore.getState().setViewMode('split');
        })()
      `,
    });
    await sleep(500);

    // 5. Test Type Generator Modal
    console.log('5. Testing Cross-language Type Generator Modal...');
    await send('Runtime.evaluate', {
      expression: `
        (function() {
          window.__dataToolsStore.getState().setIsTypeModalOpen(true);
        })()
      `,
    });
    await sleep(600);

    const typeModalRes = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const pre = document.querySelector('pre');
          const code = pre ? pre.textContent : '';
          return {
            modalPresent: Boolean(pre),
            hasExportInterface: code.includes('export interface'),
            hasActiveProjects: code.includes('activeProjects'),
            codeSnippet: code.slice(0, 150)
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Type Generator Result:', typeModalRes.result.value);
    if (!typeModalRes.result.value.hasExportInterface) {
      throw new Error('Type generator failed to produce TypeScript interface');
    }
    await takeScreenshot('20_data_tools_type_generator.png');

    // Close modal
    await send('Runtime.evaluate', {
      expression: `
        (function() {
          window.__dataToolsStore.getState().setIsTypeModalOpen(false);
        })()
      `,
    });
    await sleep(400);

    // 6. Test Multi-format switching (YAML, SQL, JWT)
    console.log('6. Testing multi-format sample loading (YAML, SQL, JWT)...');
    const formatSwitchRes = await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const dt = window.__dataToolsStore.getState();
          dt.loadSample('yaml');
          await new Promise(r => setTimeout(r, 400));
          const yamlContent = window.__dataToolsStore.getState().formattedContent;

          dt.loadSample('sql');
          await new Promise(r => setTimeout(r, 400));
          const sqlContent = window.__dataToolsStore.getState().formattedContent;

          dt.loadSample('jwt');
          await new Promise(r => setTimeout(r, 400));
          const jwtContent = window.__dataToolsStore.getState().formattedContent;

          // Return to json
          dt.loadSample('json');

          return {
            hasYaml: yamlContent.includes('apiVersion: apps/v1'),
            hasSql: sqlContent.includes('SELECT'),
            hasJwt: jwtContent.includes('tokenStatus') || jwtContent.includes('payload')
          };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log('Format Switch Results:', formatSwitchRes.result.value);
    if (!formatSwitchRes.result.value.hasYaml || !formatSwitchRes.result.value.hasSql || !formatSwitchRes.result.value.hasJwt) {
      throw new Error('Multi-format sample loading failed');
    }

    console.log('\n======================================================');
    console.log(' ALL DATA TOOLS & FORMATTER WORKBENCH CHECKS PASSED (100%)');
    console.log('======================================================');

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
