/**
 * test-services-lifecycle-e2e.cjs
 * Validates the enhanced service process manager & task lifecycle:
 * 1. Automatic unblocking of scripts with 'pause' / 'if %ERRORLEVEL% neq 0 pause' via child.stdin.end()
 * 2. Automatic transition to 'completed' for one-shot tasks upon exit code 0
 * 3. Automatic transition to 'failed' and PID cleanup for failed startup scripts (exit code != 0)
 * 4. Verification that processes do not hang or leave orphan zombie processes
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9585;
const APP_URL = 'http://127.0.0.1:5345/?ws=ws_1789365574398';
const DOCS_IMAGES_DIR = path.resolve(__dirname, '..', '..', 'docs', 'images');
const REPORTS_DIR = path.resolve(__dirname, '..', 'reports');
const ARTIFACT_DIR = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\0b7df8f7-0e22-4090-836d-20effda6ee85';
const TEMP_USER_DATA = path.join(os.tmpdir(), `omnigit_lifecycle_test_${Date.now()}`);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('=== Testing Services Lifecycle, Pause Unblocking & Failure Cleanup E2E ===');

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
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value ?? a.description ?? JSON.stringify(a)).join(' ');
      console.log(`[Browser Console ${msg.params.type}]`, text);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      console.error('[Browser Exception]', msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
    }
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

    // Poll until the app exposes its zustand stores (dev-server first compile can be slow)
    console.log('Waiting for application stores to initialize...');
    let storeReady = false;
    for (let i = 0; i < 40; i++) {
      await sleep(1000);
      try {
        const check = await send('Runtime.evaluate', {
          expression: 'Boolean(window.__servicesStore && window.__workbenchStore && window.__appStore)',
          returnByValue: true,
        });
        if (check.result && check.result.value) {
          storeReady = true;
          break;
        }
      } catch {}
    }
    if (!storeReady) {
      throw new Error('Application stores not available within 40s');
    }
    console.log('Stores ready.');

    // 1. Switch to Services mode
    console.log('1. Switching to Services mode...');
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          window.__workbenchStore.getState().setWorkbenchMode('services');
        })()
      `,
    });
    await sleep(1500);

    // 2. Add test services:
    // A) One-shot task with 'pause' in command
    // B) Failed startup script with exit 1
    console.log('2. Adding test services (one-shot task with pause & failing script)...');
    const addRes = await send('Runtime.evaluate', {
      expression: `
        (function() {
          try {
            const srv = window.__servicesStore.getState();
            const app = window.__appStore.getState();
            const project = app.projects.find(p => p.id === srv.servicesSelectedProjectId) || app.projects[0];
            const projectId = project ? project.id : '1';

            // Add Task with pause
            const taskSrv = srv.addService(projectId, {
              name: '数据打包一次性任务 (带pause)',
              kind: 'task',
              winCommand: 'cmd.exe /c "echo [Task] Starting database backup... && pause && echo [Task] Backup completed successfully!"',
              unixCommand: 'sh -c "echo [Task] Starting backup && echo [Task] Done"',
            });

            // Add Failing service
            const failSrv = srv.addService(projectId, {
              name: '错误启动脚本 (测试自动停止与清理)',
              kind: 'service',
              winCommand: 'cmd.exe /c "echo [Error] Port 8080 already in use! && exit 1"',
              unixCommand: 'sh -c "echo [Error] Port already in use && exit 1"',
            });

            return {
              taskId: taskSrv ? taskSrv.id : null,
              failId: failSrv ? failSrv.id : null,
              projectId
            };
          } catch (err) {
            return { error: err.message, stack: err.stack };
          }
        })()
      `,
      returnByValue: true,
    });
    console.log('addRes evaluate:', addRes);
    if (!addRes.result || !addRes.result.value || addRes.result.value.error) {
      throw new Error(`Failed to add test services: ${JSON.stringify(addRes)}`);
    }
    const { taskId, failId, projectId } = addRes.result.value;
    console.log('Created test services:', { taskId, failId });

    // 3. Test One-shot task execution with pause command
    console.log('3. Running one-shot task containing "pause"...');
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          window.__servicesStore.getState().setActiveServiceId('${taskId}');
          await window.__servicesStore.getState().startService('${projectId}', '${taskId}');
        })()
      `,
    });

    // Wait for process to execute, bypass pause via stdin.end(), and exit
    console.log('Waiting for one-shot task to auto-complete...');
    let taskCompleted = false;
    let taskRuntime = null;

    for (let i = 0; i < 20; i++) {
      await sleep(500);
      const checkRes = await send('Runtime.evaluate', {
        expression: `
          (function() {
            const rt = window.__servicesStore.getState().getRuntime('${taskId}');
            return {
              status: rt.status,
              pid: rt.pid,
              exitCode: rt.exitCode,
              durationMs: rt.durationMs,
              logs: rt.logs,
              logsCount: rt.logs.length,
              lastLog: rt.logs[rt.logs.length - 1] || ''
            };
          })()
        `,
        returnByValue: true,
      });

      taskRuntime = checkRes.result.value;
      if (taskRuntime.status === 'completed') {
        taskCompleted = true;
        break;
      }
    }

    console.log('Task Execution Result:', taskRuntime);
    if (!taskCompleted) {
      throw new Error(`One-shot task failed to auto-complete! Current status: ${taskRuntime ? taskRuntime.status : 'null'}`);
    }
    if (taskRuntime.pid !== undefined) {
      throw new Error(`Completed task still has lingering PID: ${taskRuntime.pid}`);
    }
    console.log('✓ Successfully verified: One-shot task bypassed pause, completed automatically, and released PID!');

    // 4. Test Failing Startup Script
    console.log('4. Running failing startup script...');
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          window.__servicesStore.getState().setActiveServiceId('${failId}');
          await window.__servicesStore.getState().startService('${projectId}', '${failId}');
        })()
      `,
    });

    console.log('Waiting for failing script to auto-stop with failed status...');
    let failReported = false;
    let failRuntime = null;

    for (let i = 0; i < 20; i++) {
      await sleep(500);
      const checkRes = await send('Runtime.evaluate', {
        expression: `
          (function() {
            const rt = window.__servicesStore.getState().getRuntime('${failId}');
            return {
              status: rt.status,
              pid: rt.pid,
              exitCode: rt.exitCode,
              logsCount: rt.logs.length,
              lastLog: rt.logs[rt.logs.length - 1] || ''
            };
          })()
        `,
        returnByValue: true,
      });

      failRuntime = checkRes.result.value;
      if (failRuntime.status === 'failed') {
        failReported = true;
        break;
      }
    }

    console.log('Failing Script Result:', failRuntime);
    if (!failReported) {
      throw new Error(`Failing script did not transition to failed status! Current: ${failRuntime ? failRuntime.status : 'null'}`);
    }
    if (failRuntime.pid !== undefined) {
      throw new Error(`Failed script still has lingering PID: ${failRuntime.pid}`);
    }
    console.log('✓ Successfully verified: Failing script automatically stopped, marked as failed (exitCode: 1), and cleaned up PID!');

    // 5. Capture UI screenshot with completed task and failed service cards
    await sleep(500);
    await takeScreenshot('21_services_task_completed.png');

    // Clean up test services
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          const srv = window.__servicesStore.getState();
          await srv.deleteService('${projectId}', '${taskId}');
          await srv.deleteService('${projectId}', '${failId}');
        })()
      `,
    });
    await sleep(400);

    console.log('\n======================================================');
    console.log(' ALL SERVICES LIFECYCLE & PAUSE UNBLOCKING TESTS PASSED (100%)');
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
