/**
 * Script to capture a rich, populated Git Workbench screenshot.
 * Selects OmniGit, expands modified file or commit log, captures full workbench.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9444;
const APP_URL = 'http://127.0.0.1:5345/?ws=ws_1789365574398';
const REPORTS_DIR = path.resolve(__dirname, '..', 'reports');
const TEMP_USER_DATA = path.join(os.tmpdir(), `omnigit_perfect_wb_${Date.now()}`);

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
    '--window-size=1400,900',
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

    console.log('3. Selecting OmniGit project in Git Workbench mode...');
    const selectRes = await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const appStore = window.__appStore ? window.__appStore.getState() : null;
          const wbStore = window.__workbenchStore ? window.__workbenchStore.getState() : null;
          if (!appStore) return { success: false, reason: 'no_store' };

          if (wbStore) wbStore.setWorkbenchMode('git');

          // Find and click the OmniGit item in left sidebar
          const projectButtons = Array.from(document.querySelectorAll('div, button, span')).filter(el => {
            return el.textContent && el.textContent.trim() === 'OmniGit' && el.closest('aside, [class*="w-64"], [class*="w-60"]');
          });
          const target = projectButtons[0] || Array.from(document.querySelectorAll('*')).find(el => el.textContent && el.textContent.trim() === 'OmniGit');
          if (target) {
            target.click();
            await new Promise(r => setTimeout(r, 2000));
          }

          // Click on Changes or Log tab
          const tabBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && (b.textContent.includes('工作区改动') || b.textContent.includes('提交日志')));
          if (tabBtn) {
            tabBtn.click();
            await new Promise(r => setTimeout(r, 1500));
          }

          return {
            success: true,
            clickedTarget: Boolean(target),
            targetText: target ? target.textContent.trim() : null
          };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('   Selection result:', selectRes.result ? selectRes.result.value : selectRes);

    await sleep(1500);

    console.log('4. Capturing high-resolution Git Workbench screenshot...');
    const ss = await send('Page.captureScreenshot', { format: 'png' });
    const targetFile = path.join(REPORTS_DIR, '01_git_workbench.png');
    fs.writeFileSync(targetFile, Buffer.from(ss.data, 'base64'));
    console.log(`   ✓ Saved: ${targetFile}`);

  } finally {
    ws.close();
    chromeProcess.kill('SIGKILL');
    try {
      fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
    } catch {}
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
