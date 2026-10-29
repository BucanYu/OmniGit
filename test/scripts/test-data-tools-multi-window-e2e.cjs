/**
 * test-data-tools-multi-window-e2e.cjs
 * Comprehensive CDP verification for Data Tools Multi-Window Tabs and
 * Side-by-Side Split Comparison Mode.
 *
 * Prerequisites: vite dev server running at http://127.0.0.1:5345
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9582;
const APP_URL = process.env.OMNIGIT_E2E_URL || 'http://127.0.0.1:5345/';
const REPORTS_DIR = path.resolve(__dirname, '..', 'reports');
const DOCS_IMAGES_DIR = path.resolve(__dirname, '..', '..', 'docs', 'images');
const ARTIFACT_DIR = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\0b7df8f7-0e22-4090-836d-20effda6ee85';
const TEMP_USER_DATA = path.join(os.tmpdir(), `omnigit_multiwin_test_${Date.now()}`);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let failures = 0;
function report(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail !== undefined ? ' :: ' + JSON.stringify(detail) : ''}`);
  if (!ok) failures++;
}

async function main() {
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  if (!fs.existsSync(DOCS_IMAGES_DIR)) fs.mkdirSync(DOCS_IMAGES_DIR, { recursive: true });

  console.log('>>> [Multi-Window E2E] Launching Headless Chrome...');
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

  async function evalJs(expr) {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
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

    console.log('Waiting for stores initialization...');
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      try {
        const ready = await evalJs(`Boolean(window.__dataToolsStore && window.__workbenchStore)`);
        if (ready) break;
      } catch {}
    }
    await sleep(800);

    // 1. Switch to Data Tools mode
    console.log('1. Switching to Data Tools workbench mode...');
    await evalJs(`
      (function() {
        if (window.__workbenchStore) {
          window.__workbenchStore.getState().setWorkbenchMode('data-tools');
        }
      })()
    `);
    await sleep(1200);

    // 2. Verify Initial Window State
    console.log('2. Inspecting Data Tools Store state...');
    const initState = await evalJs(`
      (function() {
        const dt = window.__dataToolsStore ? window.__dataToolsStore.getState() : null;
        if (!dt || !dt.tabs) return { ok: false, dt: Boolean(dt) };
        return {
          ok: true,
          tabsCount: dt.tabs.length,
          activeTabId: dt.activeTabId,
          activeFormat: dt.activeFormat,
          tabTitle: dt.tabs[0]?.title,
          splitCompareEnabled: dt.splitCompareEnabled
        };
      })()
    `);
    console.log('Initial Window State:', initState);

    report('Initial Tab Exists and Default to JSON 1',
      initState.ok && initState.tabsCount === 1 && initState.activeFormat === 'json',
      initState
    );

    // 3. Test Clicking "+ New Window" to open format picker
    console.log('2. Clicking + New Window button to open format picker...');
    await evalJs(`
      (function() {
        const addBtn = document.querySelector('[data-testid="data-tools-add-tab-btn"]');
        if (addBtn) addBtn.click();
      })()
    `);
    await sleep(200);
    const dropdownOpened = await evalJs(`
      (function() {
        const dropdown = document.querySelector('[data-testid="data-tools-format-dropdown"]');
        return Boolean(dropdown);
      })()
    `);
    report('Format Picker Dropdown Opened on + Click', dropdownOpened);

    // 4. Select YAML from dropdown to create YAML window
    console.log('3. Selecting YAML format to create YAML window...');
    const yamlTabAdded = await evalJs(`
      (function() {
        const yamlOpt = document.querySelector('[data-testid="data-tools-format-opt-yaml"]');
        if (!yamlOpt) return { ok: false, reason: 'opt not found' };
        yamlOpt.click();
        const dt = window.__dataToolsStore.getState();
        const activeTab = dt.tabs.find(t => t.id === dt.activeTabId);
        return {
          ok: dt.tabs.length === 2 && activeTab?.format === 'yaml',
          tabsCount: dt.tabs.length,
          activeFormat: dt.activeFormat,
          activeTabTitle: activeTab?.title
        };
      })()
    `);
    report('Created YAML Tab and Auto Switched', yamlTabAdded.ok, yamlTabAdded);

    // 5. Open dropdown again and select JSON to create JSON 2 window
    console.log('4. Selecting JSON format to create second JSON window...');
    await evalJs(`document.querySelector('[data-testid="data-tools-add-tab-btn"]').click()`);
    await sleep(300);
    const jsonTabAdded = await evalJs(`
      (function() {
        const jsonOpt = document.querySelector('[data-testid="data-tools-format-opt-json"]');
        if (!jsonOpt) return { ok: false, reason: 'opt not found' };
        jsonOpt.click();
        const dt = window.__dataToolsStore.getState();
        const activeTab = dt.tabs.find(t => t.id === dt.activeTabId);
        return {
          ok: dt.tabs.length === 3 && activeTab?.format === 'json',
          tabsCount: dt.tabs.length,
          activeTabTitle: activeTab?.title
        };
      })()
    `);
    report('Created JSON 2 Tab and Auto Switched', jsonTabAdded.ok, jsonTabAdded);

    // 6. Test Data Isolation between Windows
    console.log('5. Testing content isolation between tabs...');
    const isolationTest = await evalJs(`
      (function() {
        const dt = window.__dataToolsStore.getState();
        const tab3Id = dt.activeTabId;
        const tab1Id = dt.tabs[0].id;

        // Set unique content in tab 3
        const uniquePayload = JSON.stringify({
          source: "Window 2 Remote API",
          recordCount: 42,
          uniqueKey: "TOKEN_COMPARE_XYZ"
        }, null, 2);
        dt.setContent(uniquePayload, tab3Id);

        // Switch to Tab 1
        dt.setActiveTabId(tab1Id);
        const state1 = window.__dataToolsStore.getState();
        const tab1Content = state1.formattedContent;
        const tab1HasToken = tab1Content.includes("TOKEN_COMPARE_XYZ");

        // Switch back to Tab 3
        state1.setActiveTabId(tab3Id);
        const state3 = window.__dataToolsStore.getState();
        const tab3Content = state3.formattedContent;
        const tab3HasToken = tab3Content.includes("TOKEN_COMPARE_XYZ");

        return {
          ok: !tab1HasToken && tab3HasToken,
          tab1HasToken,
          tab3HasToken
        };
      })()
    `);
    report('Tabs Content Data Isolation Verified', isolationTest.ok, isolationTest);

    // 7. Test Tab Renaming
    console.log('6. Renaming active tab...');
    const renameResult = await evalJs(`
      (function() {
        const dt = window.__dataToolsStore.getState();
        const activeId = dt.activeTabId;
        dt.renameTab(activeId, '远程对比数据');
        const updated = window.__dataToolsStore.getState().tabs.find(t => t.id === activeId);
        return {
          ok: updated?.title === '远程对比数据',
          title: updated?.title
        };
      })()
    `);
    report('Tab Renamed Successfully to 远程对比数据', renameResult.ok, renameResult);

    // 8. Test Side-by-Side Split Compare Mode
    console.log('7. Toggling Side-by-Side Split Comparison Mode...');
    const splitResult = await evalJs(`
      (function() {
        const splitBtn = document.querySelector('[data-testid="data-tools-split-compare-btn"]');
        if (!splitBtn) return { ok: false, reason: 'btn not found' };
        splitBtn.click();
        const dt = window.__dataToolsStore.getState();
        return {
          ok: dt.splitCompareEnabled === true,
          splitCompareEnabled: dt.splitCompareEnabled,
          activeTabId: dt.activeTabId,
          secondaryTabId: dt.secondaryTabId
        };
      })()
    `);
    report('Split Compare Enabled Side-by-Side', splitResult.ok, splitResult);

    await sleep(800);

    // 9. Verify DOM contains both Left and Right window panels in Split Mode
    const panelsRendered = await evalJs(`
      (function() {
        const headers = document.querySelectorAll('.data-tools-split-pane-header');
        return {
          ok: headers.length >= 2,
          count: headers.length
        };
      })()
    `);
    report('Both Left and Right Compare Panels Rendered in DOM', panelsRendered.ok, panelsRendered);

    // 10. Capture Full High-Res Screenshot of Multi-Window Split Compare
    console.log('8. Capturing 22_data_tools_multi_window.png...');
    await takeScreenshot('22_data_tools_multi_window.png');

    // 11. Test Closing a Tab
    console.log('9. Testing closing YAML tab...');
    const closeResult = await evalJs(`
      (function() {
        const dt = window.__dataToolsStore.getState();
        const yamlTab = dt.tabs.find(t => t.format === 'yaml');
        if (!yamlTab) return { ok: false, reason: 'yaml tab not found' };
        const closeBtn = document.querySelector('[data-testid="data-tools-close-tab-' + yamlTab.id + '"]');
        if (!closeBtn) {
          dt.closeTab(yamlTab.id);
        } else {
          closeBtn.click();
        }
        const nextDt = window.__dataToolsStore.getState();
        const yamlStillExists = nextDt.tabs.some(t => t.id === yamlTab.id);
        return {
          ok: !yamlStillExists && nextDt.tabs.length === 2,
          remainingTabs: nextDt.tabs.length
        };
      })()
    `);
    report('Tab Closed and Remaining Tabs Count Correct', closeResult.ok, closeResult);

  } catch (err) {
    console.error('Test Execution Error:', err);
    failures++;
  } finally {
    try {
      ws.close();
      chromeProcess.kill();
    } catch {}
  }

  console.log('\n======================================================');
  console.log(`Multi-Window E2E Test Finished with ${failures} failure(s).`);
  console.log('======================================================\n');

  process.exit(failures > 0 ? 1 : 0);
}

main();
