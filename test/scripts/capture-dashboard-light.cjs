const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9557;
const APP_URL = 'http://127.0.0.1:5345/?ws=ws_1789365574398';
const TEMP_USER_DATA = path.join(os.tmpdir(), `omnigit_dash_light_${Date.now()}`);

async function run() {
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
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 400));
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
      const { resolve } = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      resolve(msg.result);
    }
  };

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      callbacks.set(msgId, { resolve });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: APP_URL });
  await new Promise((r) => setTimeout(r, 2500));

  await send('Runtime.evaluate', {
    expression: `
      (async function() {
        const appStore = window.__appStore ? window.__appStore.getState() : null;
        if (appStore) appStore.setTheme('idea-light');
        document.documentElement.setAttribute('data-theme', 'idea-light');
        const wb = window.__workbenchStore ? window.__workbenchStore.getState() : null;
        if (wb) wb.setWorkbenchMode('dashboard');
      })()
    `,
  });
  await new Promise((r) => setTimeout(r, 1500));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const outPath = 'C:/Users/admin/.gemini/antigravity/brain/0b7df8f7-0e22-4090-836d-20effda6ee85/dashboard_idea-light.png';
  fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
  ws.close();
  chromeProcess.kill('SIGKILL');
  try {
    fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
  } catch {}
  console.log('Saved dashboard_idea-light.png');
}

run().catch(console.error);
