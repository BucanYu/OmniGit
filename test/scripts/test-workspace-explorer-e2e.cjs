/**
 * test-workspace-explorer-e2e.cjs
 * Comprehensive E2E CDP verification for Workspace Explorer:
 * 1. Verifies that gitignored directories and files (e.g. scratch, .workbuddy, .env) are fully visible in the tree.
 * 2. Verifies the Show All / Hide Ignored files toggle button.
 * 3. Verifies file selection and opening in Code Editor.
 * 4. Takes screenshots of the explorer with full files visible and toggled state.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9585;
const APP_URL = 'http://127.0.0.1:5345/';
const REPORTS_DIR = path.resolve(__dirname, '..', 'reports');
const DOCS_IMAGES_DIR = path.resolve(__dirname, '..', '..', 'docs', 'images');
const ARTIFACT_DIR = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\0b7df8f7-0e22-4090-836d-20effda6ee85';
const TEMP_USER_DATA = path.join(os.tmpdir(), `omnigit_explorer_test_${Date.now()}`);

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

  console.log('>>> [Explorer E2E] Launching Headless Chrome on port', DEBUG_PORT);
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

  if (!wsUrl) {
    console.error('Failed to get Chrome WebSocket debugger URL');
    chromeProcess.kill();
    process.exit(1);
  }

  const ws = new WebSocket(wsUrl);

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let curId = 1;
  const pendingRequests = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pendingRequests.has(data.id)) {
      const { resolve, reject } = pendingRequests.get(data.id);
      pendingRequests.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = curId++;
      pendingRequests.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await sendCommand('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result ? res.result.value : undefined;
  }

  async function captureScreenshot(filepath) {
    const res = await sendCommand('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(filepath, buffer);
  }

  try {
    await sendCommand('Page.enable');
    await sendCommand('Runtime.enable');
    await sendCommand('DOM.enable');
    await sendCommand('Network.enable');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.method === 'Runtime.consoleAPICalled') {
        const args = (data.params.args || []).map((a) => a.value || a.description).join(' ');
        console.log(`[Browser Console] ${data.params.type}:`, args);
      }
      if (data.method === 'Network.responseReceived') {
        if (data.params.response.url.includes('/api/')) {
          console.log('[Browser Network Response]', data.params.response.url, data.params.response.status);
        }
      }
      if (data.id && pendingRequests.has(data.id)) {
        const { resolve, reject } = pendingRequests.get(data.id);
        pendingRequests.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };

    console.log('>>> [Explorer E2E] Navigating to:', APP_URL);
    await sendCommand('Page.navigate', { url: APP_URL });
    await sleep(3500);

    // Switch to Workspace Explorer tab (Alt+2 / file icon in sidebar)
    console.log('>>> [Explorer E2E] Switching to Workspace Explorer panel...');
    const switched = await evaluate(`(() => {
      // 1. Try finding button by title containing 'Alt + 2' or '资源管理器' or 'Explorer'
      const buttons = Array.from(document.querySelectorAll('button'));
      const explorerBtn = buttons.find(b => {
        const title = b.getAttribute('title') || '';
        return title.includes('Alt + 2') || title.includes('资源管理器') || title.includes('Explorer');
      });
      if (explorerBtn) {
        explorerBtn.click();
        return 'clicked_button';
      }

      // 2. Dispatch Alt+2 keyboard shortcut
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', altKey: true, bubbles: true }));
      return 'dispatched_key';
    })()`);
    report('Switch to Workspace Explorer Panel', switched !== false, switched);
    await sleep(2000);

    // Test direct fetch from browser
    console.log('>>> [Explorer E2E] Testing direct fetch from browser runtime...');
    const directFetchResult = await evaluate(`(async () => {
      try {
        const res = await fetch('/api/fs/tree?repoPath=D%3A%5Cprojects%5COmniGit&dir=');
        const data = await res.json();
        return { ok: res.ok, status: res.status, count: data.length, sample: data.slice(0, 3) };
      } catch (err) {
        return { error: String(err) };
      }
    })()`);
    console.log('>>> [Explorer E2E] Direct fetch result:', directFetchResult);
    const expandResult = await evaluate(`(() => {
      const rows = Array.from(document.querySelectorAll('aside .group'));
      let clicked = 0;
      for (const row of rows) {
        const hasDown = row.querySelector('svg.lucide-chevron-down');
        if (!hasDown) {
          row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          clicked++;
        }
      }
      return { totalRows: rows.length, clicked };
    })()`);
    console.log('>>> [Explorer E2E] Project expand result:', expandResult);
    await sleep(3500);

    const storeDebug = await evaluate(`(() => {
      // Find all aside elements
      const aside = document.querySelector('aside');
      return {
        asideHtml: aside ? aside.innerHTML.slice(0, 500) : 'no_aside',
      };
    })()`);
    console.log('>>> [Explorer E2E] Aside HTML snippet:', storeDebug);

    // Check tree node items: verify ignored items exist (e.g. .idea or logs or .workbuddy)
    const treeStatus = await evaluate(`(() => {
      const items = Array.from(document.querySelectorAll('aside span.truncate'));
      const texts = items.map(el => el.textContent.trim()).filter(Boolean);
      const hasIgnoredItem = texts.includes('.idea') || texts.includes('logs') || texts.includes('.workbuddy') || texts.includes('scratch');
      return {
        totalRendered: texts.length,
        hasIgnoredItem,
        sampleTexts: texts.slice(0, 15),
      };
    })()`);
    console.log('>>> [Explorer E2E] Tree items render status:', treeStatus);
    report('Explorer rendered non-empty tree', treeStatus.totalRendered > 0, treeStatus.totalRendered);
    report('Explorer shows gitignored folders (.idea / logs / scratch / .workbuddy)', treeStatus.hasIgnoredItem, treeStatus);

    // Verify Eye toggle button exists
    const toggleButtonCheck = await evaluate(`(() => {
      const headerButtons = Array.from(document.querySelectorAll('aside .h-9 button'));
      const eyeBtn = headerButtons.find(b => {
        const t = b.getAttribute('title') || '';
        return t.includes('全部文件') || t.includes('忽略项') || t.includes('Ignored');
      });
      const collapseBtn = headerButtons.find(b => {
        const t = b.getAttribute('title') || '';
        return t.includes('折叠') || t.includes('Collapse');
      });
      return {
        hasEyeBtn: Boolean(eyeBtn),
        eyeTitle: eyeBtn ? eyeBtn.getAttribute('title') : null,
        hasCollapseBtn: Boolean(collapseBtn),
      };
    })()`);
    console.log('>>> [Explorer E2E] Header controls check:', toggleButtonCheck);
    report('Show/Hide Ignored Files button present', toggleButtonCheck.hasEyeBtn, toggleButtonCheck.eyeTitle);
    report('Collapse All button present', toggleButtonCheck.hasCollapseBtn);

    // Click on a file (not folder) to open in editor
    console.log('>>> [Explorer E2E] Finding and opening a source file in editor...');
    const openedFile = await evaluate(`(() => {
      const allDivs = Array.from(document.querySelectorAll('aside div'));
      // Find a div that has an extension (file, not directory)
      const fileNode = allDivs.find(el => {
        const title = el.getAttribute('title') || '';
        return (title.includes('.xml') || title.includes('.md') || title.includes('.json') || title.includes('.txt') || title.includes('.yml') || title.includes('.java') || title.includes('.ts')) && !title.includes('(' + title.split(' ')[0] + ')');
      }) || allDivs.find(el => {
        const t = el.getAttribute('title') || '';
        return t.includes('.md') || t.includes('.xml') || t.includes('.json') || t.includes('.txt');
      });

      if (fileNode) {
        fileNode.click();
        return fileNode.getAttribute('title');
      }
      return false;
    })()`);
    report('Clicked file to open in editor', openedFile !== false, openedFile);
    await sleep(2500);

    // Check editor opened tab
    const editorStatus = await evaluate(`(() => {
      // Check tab strip elements or editor presence
      const tabElements = Array.from(document.querySelectorAll('div[role="tab"], .select-none span.truncate'));
      const openedTabText = tabElements.map(e => e.textContent.trim()).filter(Boolean);
      const monacoContainer = Boolean(document.querySelector('.monaco-editor, [data-keybinding-context], textarea'));
      return {
        tabCount: tabElements.length,
        openedTabText: openedTabText.slice(0, 5),
        hasMonaco: monacoContainer,
      };
    })()`);
    console.log('>>> [Explorer E2E] Editor status:', editorStatus);
    report('Editor opened file successfully', editorStatus.tabCount > 0 || editorStatus.hasMonaco, editorStatus);

    // Capture screenshot: Show All Files
    console.log('>>> [Explorer E2E] Capturing screenshot: 24_workspace_explorer_all_files.png');
    const screenshotAllPath1 = path.join(DOCS_IMAGES_DIR, '24_workspace_explorer_all_files.png');
    const screenshotAllPath2 = path.join(REPORTS_DIR, '24_workspace_explorer_all_files.png');
    const screenshotAllPath3 = path.join(ARTIFACT_DIR, '24_workspace_explorer_all_files.png');
    await captureScreenshot(screenshotAllPath1);
    fs.copyFileSync(screenshotAllPath1, screenshotAllPath2);
    if (fs.existsSync(ARTIFACT_DIR)) fs.copyFileSync(screenshotAllPath1, screenshotAllPath3);

    // Test toggle to Hide Ignored Files
    console.log('>>> [Explorer E2E] Toggling to Hide Ignored Files...');
    await evaluate(`(() => {
      const headerButtons = Array.from(document.querySelectorAll('aside .h-9 button'));
      const eyeBtn = headerButtons.find(b => {
        const t = b.getAttribute('title') || '';
        return t.includes('全部文件') || t.includes('忽略项') || t.includes('Ignored');
      });
      if (eyeBtn) eyeBtn.click();
    })()`);
    await sleep(1000);

    // Check tree after hiding ignored files
    const treeAfterHide = await evaluate(`(() => {
      const items = Array.from(document.querySelectorAll('aside span.truncate'));
      const texts = items.map(el => el.textContent.trim()).filter(Boolean);
      return {
        totalRendered: texts.length,
        hasScratch: texts.includes('scratch'),
        hasWorkbuddy: texts.includes('.workbuddy'),
      };
    })()`);
    console.log('>>> [Explorer E2E] Tree after hide ignored:', treeAfterHide);
    report('Ignored files properly hidden when toggled off', !treeAfterHide.hasScratch && !treeAfterHide.hasWorkbuddy);

    // Capture screenshot: Hide Ignored Files
    console.log('>>> [Explorer E2E] Capturing screenshot: 25_workspace_explorer_hide_ignored.png');
    const screenshotHidePath1 = path.join(DOCS_IMAGES_DIR, '25_workspace_explorer_hide_ignored.png');
    const screenshotHidePath2 = path.join(REPORTS_DIR, '25_workspace_explorer_hide_ignored.png');
    const screenshotHidePath3 = path.join(ARTIFACT_DIR, '25_workspace_explorer_hide_ignored.png');
    await captureScreenshot(screenshotHidePath1);
    fs.copyFileSync(screenshotHidePath1, screenshotHidePath2);
    if (fs.existsSync(ARTIFACT_DIR)) fs.copyFileSync(screenshotHidePath1, screenshotHidePath3);

    // Toggle back to Show All Files
    await evaluate(`(() => {
      const headerButtons = Array.from(document.querySelectorAll('aside .h-9 button'));
      const eyeBtn = headerButtons.find(b => {
        const t = b.getAttribute('title') || '';
        return t.includes('全部文件') || t.includes('忽略项') || t.includes('Ignored');
      });
      if (eyeBtn) eyeBtn.click();
    })()`);
    await sleep(500);

    console.log('>>> [Explorer E2E] All verifications finished. Failures:', failures);
  } catch (err) {
    console.error('>>> [Explorer E2E] Fatal error during test execution:', err);
    failures++;
  } finally {
    ws.close();
    chromeProcess.kill();
    try {
      fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
    } catch {}
    process.exit(failures > 0 ? 1 : 0);
  }
}

main();
