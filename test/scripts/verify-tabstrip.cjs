/**
 * Verification script for Editor Tab Strip redesign:
 * - Opens multiple files
 * - Tests compact sizing & smart disambiguation
 * - Tests scroll chevrons and All Open Tabs dropdown
 * - Captures high-res screenshots
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9555;
const APP_URL = 'http://127.0.0.1:5345/?ws=ws_1789365574398';
const REPORTS_DIR = path.resolve(__dirname, '..', 'reports');
const ARTIFACTS_DIR = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\e5f33529-bc05-40e1-91f4-e3a6b0963835';
const TEMP_USER_DATA = path.join(os.tmpdir(), `omnigit_tabstrip_test_${Date.now()}`);

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('1. Launching Chrome...');
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--disable-extensions',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
    'about:blank'
  ]);

  let wsUrl = null;
  for (let i = 0; i < 20; i++) {
    await sleep(400);
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const list = await res.json();
      const page = list.find(t => t.type === 'page');
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

  try {
    await send('Page.enable');
    await send('Runtime.enable');

    console.log('2. Navigating to OmniGit...');
    await send('Page.navigate', { url: APP_URL });
    await sleep(3500);

    console.log('3. Switching to Workspace Explorer Mode...');
    await send('Runtime.evaluate', {
      expression: `
        (function() {
          if (window.__workbenchStore) {
            window.__workbenchStore.getState().setWorkbenchMode('explorer');
          }
        })()
      `
    });
    await sleep(1000);

    console.log('4. Opening multiple files to populate tab strip...');
    const filesToOpen = [
      { filePath: 'd:/projects/OmniGit/README.md', repoPath: 'd:/projects/OmniGit', relativePath: 'README.md', repoName: 'OmniGit' },
      { filePath: 'd:/projects/OmniGit/package.json', repoPath: 'd:/projects/OmniGit', relativePath: 'package.json', repoName: 'OmniGit' },
      { filePath: 'd:/projects/OmniGit/app/package.json', repoPath: 'd:/projects/OmniGit', relativePath: 'app/package.json', repoName: 'OmniGit' },
      { filePath: 'd:/projects/OmniGit/.gitignore', repoPath: 'd:/projects/OmniGit', relativePath: '.gitignore', repoName: 'OmniGit' },
      { filePath: 'd:/projects/farmland-engineer-quality-inspect/.gitignore', repoPath: 'd:/projects/farmland-engineer-quality-inspect', relativePath: '.gitignore', repoName: 'farmland' },
      { filePath: 'd:/projects/farmland-engineer-quality-inspect/pom.xml', repoPath: 'd:/projects/farmland-engineer-quality-inspect', relativePath: 'pom.xml', repoName: 'farmland' },
      { filePath: 'd:/projects/OmniGit/app/src/App.tsx', repoPath: 'd:/projects/OmniGit', relativePath: 'app/src/App.tsx', repoName: 'OmniGit' },
      { filePath: 'd:/projects/OmniGit/app/src/features/code-editor/EditorTabStrip.tsx', repoPath: 'd:/projects/OmniGit', relativePath: 'app/src/features/code-editor/EditorTabStrip.tsx', repoName: 'OmniGit' },
      { filePath: 'd:/projects/OmniGit/app/src/features/code-editor/useEditorTabsStore.ts', repoPath: 'd:/projects/OmniGit', relativePath: 'app/src/features/code-editor/useEditorTabsStore.ts', repoName: 'OmniGit' },
      { filePath: 'd:/projects/OmniGit/app/src/locales/zh-CN.ts', repoPath: 'd:/projects/OmniGit', relativePath: 'app/src/locales/zh-CN.ts', repoName: 'OmniGit' },
      { filePath: 'd:/projects/OmniGit/app/src/locales/en-US.ts', repoPath: 'd:/projects/OmniGit', relativePath: 'app/src/locales/en-US.ts', repoName: 'OmniGit' },
      { filePath: 'd:/projects/OmniGit/app/src/server/gitApiHandler.ts', repoPath: 'd:/projects/OmniGit', relativePath: 'app/src/server/gitApiHandler.ts', repoName: 'OmniGit' },
    ];

    const openResult = await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const files = ${JSON.stringify(filesToOpen)};
          const store = window.__editorTabsStore.getState();
          const openedTabs = [];
          for (const f of files) {
            const id = await store.openFileTab(f);
            openedTabs.push(id);
          }
          const latestStore = window.__editorTabsStore.getState();
          return {
            count: latestStore.tabs.length,
            tabIds: openedTabs,
            activeTabId: latestStore.activeTabId
          };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Opened tabs status:', openResult.result.value);
    await sleep(2000);

    // Verify DOM state of tabs
    const domCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const tabElements = Array.from(document.querySelectorAll('[data-tab-id]'));
          const overflowDropdownBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('12'));
          const scrollButtons = Array.from(document.querySelectorAll('button[title*="滚动"], button[title*="Scroll"]'));
          const repoBadges = Array.from(document.querySelectorAll('[data-tab-id] span.font-mono'));
          
          return {
            tabCount: tabElements.length,
            hasOverflowDropdownBtn: !!overflowDropdownBtn,
            overflowBtnText: overflowDropdownBtn ? overflowDropdownBtn.textContent.trim() : null,
            scrollButtonsCount: scrollButtons.length,
            repoBadgesCount: repoBadges.length, // Should only be duplicate file names
            repoBadgesTexts: repoBadges.map(b => b.textContent.trim()),
          };
        })()
      `,
      returnByValue: true
    });
    console.log('DOM Check result:', domCheck.result.value);

    // Capture Multi-Tab Strip Screenshot
    console.log('5. Capturing 08_multi_tabs_redesign.png...');
    const ss1 = await send('Page.captureScreenshot', { format: 'png' });
    const img1Path = path.join(REPORTS_DIR, '08_multi_tabs_redesign.png');
    const artifact1Path = path.join(ARTIFACTS_DIR, '08_multi_tabs_redesign.png');
    fs.writeFileSync(img1Path, Buffer.from(ss1.data, 'base64'));
    fs.writeFileSync(artifact1Path, Buffer.from(ss1.data, 'base64'));
    console.log(`Saved screenshot to ${img1Path}`);

    // Click "All Open Tabs" dropdown to open drawer menu
    console.log('6. Opening "All Open Tabs" dropdown...');
    await send('Runtime.evaluate', {
      expression: `
        (function() {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('12'));
          if (btn) btn.click();
        })()
      `
    });
    await sleep(500);

    // Capture Dropdown Menu Screenshot
    console.log('7. Capturing 09_tab_overflow_menu.png...');
    const ss2 = await send('Page.captureScreenshot', { format: 'png' });
    const img2Path = path.join(REPORTS_DIR, '09_tab_overflow_menu.png');
    const artifact2Path = path.join(ARTIFACTS_DIR, '09_tab_overflow_menu.png');
    fs.writeFileSync(img2Path, Buffer.from(ss2.data, 'base64'));
    fs.writeFileSync(artifact2Path, Buffer.from(ss2.data, 'base64'));
    console.log(`Saved screenshot to ${img2Path}`);

  } finally {
    ws.close();
    chromeProcess.kill();
    try {
      fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
    } catch {}
  }
  console.log('Verification complete successfully!');
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
