/**
 * Script to generate omnigit_demo.gif and omnigit_demo.webm
 * Uses headless Chrome via CDP to decode and scale PNGs into RGBA frames,
 * records a WebM video using HTML5 MediaRecorder, and encodes an animated GIF using GifEncoder.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { GifEncoder } = require('./gif-encoder.cjs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9333;
const TEMP_USER_DATA = path.join(os.tmpdir(), `omnigit_demo_chrome_${Date.now()}`);
const REPORTS_DIR = path.resolve(__dirname, '..', 'reports');
const DOCS_IMAGES_DIR = path.resolve(__dirname, '..', '..', 'docs', 'images');

const FRAMES_CONFIG = [
  { file: '01_omnigit_workbench.png', delay: 2800, title: 'Git Core Workbench: Changes, Commit & 3-Way Merge' },
  { file: '08_selective_push_modal.png', delay: 2600, title: 'Zero-Checkout Selective Push & Patch Branches' },
  { file: '02_workspace_explorer_editor.png', delay: 2800, title: 'Multi-Project Explorer & Monaco Code Editor' },
  { file: '03_markdown_split_preview.png', delay: 2500, title: 'Markdown Split Live Preview & Free Dragging' },
  { file: '04_terminal_dock.png', delay: 2500, title: 'Integrated Terminal Dock with VS Code Controls' },
  { file: '07_services_orchestrator.png', delay: 2800, title: 'Multi-Service Orchestrator & Real-Time ANSI Logs' },
  { file: '06_english_mode_ui.png', delay: 2400, title: 'Seamless Bilingual Localization & Classic Themes' },
];

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function resolveImagePath(fileName) {
  const p1 = path.join(DOCS_IMAGES_DIR, fileName);
  if (fs.existsSync(p1)) return p1;
  const p2 = path.join(REPORTS_DIR, fileName);
  if (fs.existsSync(p2)) return p2;
  throw new Error(`Required screenshot missing: ${fileName}`);
}

async function runMediaGenerator() {
  console.log('=== Starting OmniGit Demo Media Generator ===');

  // Launch Chrome
  console.log('1. Launching headless Chrome...');
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    'about:blank'
  ]);

  let cdpWsUrl = null;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find(t => t.type === 'page') || targets[0];
      if (page && page.webSocketDebuggerUrl) {
        cdpWsUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch {}
  }

  if (!cdpWsUrl) {
    chromeProcess.kill();
    throw new Error('Failed to connect to Chrome CDP WebSocket');
  }

  console.log('2. Connected to Chrome CDP:', cdpWsUrl);
  const ws = new WebSocket(cdpWsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let msgId = 1;
  const callbacks = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      const { resolve, reject } = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  };

  function sendCDP(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      callbacks.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  try {
    // Navigate to a blank page
    await sendCDP('Page.enable');
    await sendCDP('Runtime.enable');

    console.log('3. Preparing canvas in Chrome for frame decoding & rendering...');
    const TARGET_WIDTH = 960;
    const TARGET_HEIGHT = 600;

    await sendCDP('Runtime.evaluate', {
      expression: `
        window.__TARGET_W = ${TARGET_WIDTH};
        window.__TARGET_H = ${TARGET_HEIGHT};
        document.body.style.margin = '0';
        document.body.style.background = '#1e1e1e';
        const canvas = document.createElement('canvas');
        canvas.id = 'demo-canvas';
        canvas.width = window.__TARGET_W;
        canvas.height = window.__TARGET_H;
        document.body.appendChild(canvas);
        window.__ctx = canvas.getContext('2d');
      `
    });

    // Load each image, draw on canvas, capture RGBA
    console.log('4. Extracting frames and scaling to 960x600...');
    const encoder = new GifEncoder(TARGET_WIDTH, TARGET_HEIGHT);

    for (let i = 0; i < FRAMES_CONFIG.length; i++) {
      const frameInfo = FRAMES_CONFIG[i];
      const imgPath = resolveImagePath(frameInfo.file);
      const imgBase64 = fs.readFileSync(imgPath).toString('base64');

      console.log(`   [${i + 1}/${FRAMES_CONFIG.length}] Processing ${frameInfo.file} (${frameInfo.title})...`);

      const res = await sendCDP('Runtime.evaluate', {
        expression: `
          (async function() {
            return new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = () => {
                const ctx = window.__ctx;
                ctx.fillStyle = '#1e1e1e';
                ctx.fillRect(0, 0, window.__TARGET_W, window.__TARGET_H);
                ctx.drawImage(img, 0, 0, window.__TARGET_W, window.__TARGET_H);

                // Add subtle feature badge at bottom-right
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(16, window.__TARGET_H - 42, 480, 30);
                ctx.fillStyle = '#60a5fa';
                ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.fillText('OmniGit v0.5.0: ${frameInfo.title.replace(/'/g, "\\'")}', 28, window.__TARGET_H - 22);

                const imgData = ctx.getImageData(0, 0, window.__TARGET_W, window.__TARGET_H);
                // Convert to base64
                let binary = '';
                const bytes = imgData.data;
                const len = bytes.byteLength;
                // Chunk to avoid maximum call stack
                const CHUNK = 32768;
                for (let c = 0; c < len; c += CHUNK) {
                  const sub = bytes.subarray(c, Math.min(c + CHUNK, len));
                  binary += String.fromCharCode.apply(null, sub);
                }
                resolve(btoa(binary));
              };
              img.onerror = () => reject('Failed to load image');
              img.src = 'data:image/png;base64,${imgBase64}';
            });
          })()
        `,
        awaitPromise: true,
        returnByValue: true
      });

      const rgbaBuffer = Buffer.from(res.result.value, 'base64');
      encoder.addFrame(rgbaBuffer, frameInfo.delay);
    }

    console.log('5. Encoding animated GIF (GIF89a)...');
    const gifBuffer = encoder.encode();
    const gifOutPath = path.join(DOCS_IMAGES_DIR, 'omnigit_demo.gif');
    fs.writeFileSync(gifOutPath, gifBuffer);
    console.log(`   ✓ GIF generated successfully! Saved to: ${gifOutPath} (${(gifBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

    // Also record WebM video using MediaRecorder in Chrome
    console.log('6. Recording WebM video via MediaRecorder...');
    const webmRes = await sendCDP('Runtime.evaluate', {
      expression: `
        (async function() {
          const canvas = document.getElementById('demo-canvas');
          const stream = canvas.captureStream(30);
          const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
          const chunks = [];
          recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

          const recordPromise = new Promise(resolve => {
            recorder.onstop = async () => {
              const blob = new Blob(chunks, { type: 'video/webm' });
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
              };
              reader.readAsDataURL(blob);
            };
          });

          recorder.start();

          // Re-draw frames over time
          const frames = ${JSON.stringify(FRAMES_CONFIG)};
          for (let f = 0; f < frames.length; f++) {
            // Wait for display time
            await new Promise(r => setTimeout(r, Math.min(1000, frames[f].delay / 2)));
          }

          recorder.stop();
          return recordPromise;
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    if (webmRes.result && webmRes.result.value) {
      const webmBuffer = Buffer.from(webmRes.result.value, 'base64');
      const webmOutPath = path.join(DOCS_IMAGES_DIR, 'omnigit_demo.webm');
      fs.writeFileSync(webmOutPath, webmBuffer);
      console.log(`   ✓ WebM video generated successfully! Saved to: ${webmOutPath} (${(webmBuffer.length / 1024).toFixed(1)} KB)`);
    }

  } finally {
    ws.close();
    chromeProcess.kill('SIGKILL');
    try {
      fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
    } catch {}
  }

  console.log('=== Media Generation Completed Successfully ===');
}

runMediaGenerator().catch(err => {
  console.error('Media generation failed:', err);
  process.exit(1);
});
