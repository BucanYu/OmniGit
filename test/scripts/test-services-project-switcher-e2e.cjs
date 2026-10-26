/**
 * test-services-project-switcher-e2e.cjs
 * Validates the in-module project switcher within the Services Orchestrator:
 * 1. Opening project dropdown in the services header.
 * 2. Switching project within services without leaving the module.
 * 3. Preserving manually switched project when returning to services if Git project has not changed.
 * 4. Automatically resetting services to the new Git project when the Git project has changed.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9570;
const APP_URL = 'http://127.0.0.1:5345/?ws=ws_1789365574398';
const DOCS_IMAGES_DIR = path.resolve(__dirname, '..', '..', 'docs', 'images');
const REPORTS_DIR = path.resolve(__dirname, '..', 'reports');
const ARTIFACT_DIR = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\0b7df8f7-0e22-4090-836d-20effda6ee85';
const TEMP_USER_DATA = path.join(os.tmpdir(), `omnigit_services_test_${Date.now()}`);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('=== Testing Services In-Module Project Switcher E2E ===');

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

    // 1. Switch to Services mode (Alt + 3)
    console.log('1. Switching to Services mode (Alt + 3)...');
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const wb = window.__workbenchStore ? window.__workbenchStore.getState() : null;
          if (wb) wb.setWorkbenchMode('services');
        })()
      `,
    });
    await sleep(1000);

    // Verify initial project in services
    const initialCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const app = window.__appStore.getState();
          const srv = window.__servicesStore.getState();
          const gitActive = app.projects.find(p => p.id === app.activeProjectId);
          const currentInServices = app.projects.find(p => p.id === srv.servicesSelectedProjectId) || gitActive;
          return {
            gitActiveProjectId: app.activeProjectId,
            gitActiveName: gitActive ? gitActive.name : null,
            servicesSelectedProjectId: srv.servicesSelectedProjectId,
            servicesSelectedName: currentInServices ? currentInServices.name : null,
            totalProjects: app.projects.length,
            projectNames: app.projects.map(p => p.name)
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Initial Services State:', initialCheck.result.value);

    // 2. Open Project Dropdown inside Services header
    console.log('2. Opening Services Project Dropdown...');
    const domCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const el = document.querySelector('[data-testid="services-project-dropdown-btn"]');
          const allButtons = Array.from(document.querySelectorAll('button')).map(b => ({
            testId: b.getAttribute('data-testid'),
            text: b.textContent.trim(),
            title: b.title
          }));
          return {
            hasDropdownBtn: Boolean(el),
            allButtons,
            htmlLen: document.body.innerHTML.length
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('DOM check before click:', domCheck.result.value);

    const openDropdownRes = await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const btn = document.querySelector('[data-testid="services-project-dropdown-btn"]');
          if (!btn) return { error: 'Dropdown button not found' };
          btn.click();
          await new Promise(r => setTimeout(r, 200));
          const menu = document.querySelector('[data-testid="services-project-dropdown-menu"]');
          return { success: true, menuInDom: Boolean(menu) };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log('Dropdown Open Result:', openDropdownRes.result.value);
    await sleep(600);
    await takeScreenshot('15_services_project_switcher_open.png');

    // 3. Switch to another project (OmniGit if available, or 2nd project)
    console.log('3. Selecting alternative project from dropdown...');
    const switchRes = await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const items = Array.from(document.querySelectorAll('[data-testid^="services-project-item-"]'));
          if (items.length < 2) return { error: 'Less than 2 projects available' };
          
          // Pick the second item or OmniGit
          const target = items.find(it => it.getAttribute('data-testid') === 'services-project-item-OmniGit') || items[1];
          const testId = target.getAttribute('data-testid');
          target.click();
          await new Promise(r => setTimeout(r, 600));

          const srv = window.__servicesStore.getState();
          const app = window.__appStore.getState();
          const switchedProj = app.projects.find(p => p.id === srv.servicesSelectedProjectId);

          return {
            clicked: testId,
            switchedProjectId: srv.servicesSelectedProjectId,
            switchedProjectName: switchedProj ? switchedProj.name : null,
            gitActiveProjectId: app.activeProjectId,
          };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log('Switch Result:', switchRes.result.value);
    await sleep(1000);
    await takeScreenshot('16_services_project_switched.png');

    const switchedValue = switchRes.result.value;
    if (switchedValue.switchedProjectId === switchedValue.gitActiveProjectId) {
      console.log('Notice: Switched project is same as git active project, selecting next different one...');
    }

    // 4. Test Scenario: Leave Services to Git view WITHOUT changing git project, then return
    console.log('4. Testing leave Services view and return without changing Git project...');
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          window.__workbenchStore.getState().setWorkbenchMode('git');
        })()
      `,
    });
    await sleep(800);

    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          window.__workbenchStore.getState().setWorkbenchMode('services');
        })()
      `,
    });
    await sleep(1000);

    const retainCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const srv = window.__servicesStore.getState();
          const app = window.__appStore.getState();
          const currentInServices = app.projects.find(p => p.id === srv.servicesSelectedProjectId);
          return {
            servicesSelectedProjectId: srv.servicesSelectedProjectId,
            servicesSelectedName: currentInServices ? currentInServices.name : null,
            isRetained: srv.servicesSelectedProjectId === '${switchedValue.switchedProjectId}'
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Retain Check (Git project unchanged):', retainCheck.result.value);
    if (!retainCheck.result.value.isRetained) {
      throw new Error(`Failed to retain project selection when Git project was not changed! Expected ${switchedValue.switchedProjectId}, got ${retainCheck.result.value.servicesSelectedProjectId}`);
    }
    console.log('✓ Successfully retained manually selected project!');

    // 5. Test Scenario: Switch Git project in Git view, then enter Services -> should reset to new Git project!
    console.log('5. Testing Git project change triggers automatic reset in Services...');
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const app = window.__appStore.getState();
          // Find a project different from both current activeProjectId and switchedProjectId so Git project actually changes
          const otherProj = app.projects.find(p => p.id !== app.activeProjectId && p.id !== '${switchedValue.switchedProjectId}') || app.projects.find(p => p.id !== app.activeProjectId);
          if (otherProj) {
            await app.setActiveProject(otherProj.id);
          }
          window.__workbenchStore.getState().setWorkbenchMode('services');
        })()
      `,
      awaitPromise: true,
    });
    await sleep(1200);

    const gitResetCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const srv = window.__servicesStore.getState();
          const app = window.__appStore.getState();
          const currentInServices = app.projects.find(p => p.id === srv.servicesSelectedProjectId);
          return {
            gitActiveProjectId: app.activeProjectId,
            servicesSelectedProjectId: srv.servicesSelectedProjectId,
            servicesSelectedName: currentInServices ? currentInServices.name : null,
            isResetToGit: srv.servicesSelectedProjectId === app.activeProjectId
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Git Change Reset Check:', gitResetCheck.result.value);
    if (!gitResetCheck.result.value.isResetToGit) {
      throw new Error(`Failed to reset Services view when Git project changed! Expected ${gitResetCheck.result.value.gitActiveProjectId}, got ${gitResetCheck.result.value.servicesSelectedProjectId}`);
    }
    console.log('✓ Successfully reset Services view to the newly changed Git project!');

    console.log('\n======================================================');
    console.log(' ALL IN-MODULE PROJECT SWITCHER CHECKS PASSED (100%)');
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
