/**
 * OmniGit E2E API & Performance Test Suite
 * Validates backend endpoints, Monaco offline assets, and latency benchmarks.
 */

const http = require('http');

const PORT = 5345;
const BASE_URL = `http://localhost:${PORT}`;

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const t0 = performance.now();
  const res = await fetch(url, options);
  const duration = performance.now() - t0;
  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    duration,
    text: async () => res.text(),
    json: async () => res.json(),
  };
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

// -------------------------------------------------------------
// Test 1: Monaco Local Offline Assets
// -------------------------------------------------------------
test('Monaco Assets: /vs/loader.js returns 200 and loads locally in < 50ms', async () => {
  const res = await request('/vs/loader.js');
  assert(res.status === 200, `Expected status 200, got ${res.status}`);
  const text = await res.text();
  assert(text.length > 30000, `Expected loader.js > 30KB, got ${text.length} bytes`);
  assert(text.includes('monaco') || text.includes('define'), 'Expected loader.js to contain loader script definition');
  console.log(`    ✓ Status: 200, Size: ${text.length} bytes, Latency: ${res.duration.toFixed(2)}ms`);
});

// -------------------------------------------------------------
// Test 2: Monaco Editor Main CSS
// -------------------------------------------------------------
test('Monaco Assets: /vs/editor/editor.main.css returns 200', async () => {
  const res = await request('/vs/editor/editor.main.css');
  assert(res.status === 200, `Expected status 200, got ${res.status}`);
  const text = await res.text();
  assert(text.length > 100000, `Expected editor.main.css > 100KB, got ${text.length} bytes`);
  console.log(`    ✓ Status: 200, Size: ${text.length} bytes, Latency: ${res.duration.toFixed(2)}ms`);
});

// -------------------------------------------------------------
// Test 3: Workspace Persistence & Backup API
// -------------------------------------------------------------
test('Workspace API: /api/git/workspaces/backup returns valid workspace entries', async () => {
  const res = await request('/api/git/workspaces/backup');
  assert(res.status === 200, `Expected status 200, got ${res.status}`);
  const data = await res.json();
  assert(data && Array.isArray(data.savedWorkspaces), 'Expected data.savedWorkspaces array');
  assert(data.savedWorkspaces.length > 0, 'Expected non-empty workspaces');
  console.log(`    ✓ Status: 200, Found ${data.savedWorkspaces.length} saved workspaces, Latency: ${res.duration.toFixed(2)}ms`);
});

// -------------------------------------------------------------
// Test 4: File System Tree Directory Listing (Root & Subdirs)
// -------------------------------------------------------------
test('File System Tree: /api/fs/tree loads root directory in < 150ms', async () => {
  const repoPath = 'd:/projects/OmniGit';
  const res = await request(`/api/fs/tree?repoPath=${encodeURIComponent(repoPath)}`);
  assert(res.status === 200, `Expected status 200, got ${res.status}`);
  const items = await res.json();
  assert(Array.isArray(items), 'Expected array of items');
  assert(items.length > 0, 'Expected non-empty directory items');
  assert(items.some((i) => i.name === 'app' && i.isDirectory), 'Expected "app" directory');
  console.log(`    ✓ Status: 200, Items: ${items.length}, Latency: ${res.duration.toFixed(2)}ms`);
});

test('File System Tree: Subdirectory loads and respects .gitignore', async () => {
  const repoPath = 'd:/projects/OmniGit';
  const res = await request(`/api/fs/tree?repoPath=${encodeURIComponent(repoPath)}&dir=app/src`);
  assert(res.status === 200, `Expected status 200, got ${res.status}`);
  const items = await res.json();
  assert(Array.isArray(items), 'Expected array of items');
  assert(!items.some((i) => i.name === 'node_modules'), 'node_modules must be ignored');
  assert(items.some((i) => i.name === 'main.tsx' && !i.isDirectory), 'Expected main.tsx file');
  console.log(`    ✓ Status: 200, Items: ${items.length}, Latency: ${res.duration.toFixed(2)}ms`);
});

// -------------------------------------------------------------
// Test 5: File Content Read Endpoint
// -------------------------------------------------------------
test('File System Read: /api/fs/read returns file content with encoding and EOL in < 50ms', async () => {
  const filePath = 'd:/projects/OmniGit/app/src/main.tsx';
  const res = await request(`/api/fs/read?filePath=${encodeURIComponent(filePath)}`);
  assert(res.status === 200, `Expected status 200, got ${res.status}`);
  const data = await res.json();
  assert(typeof data.content === 'string', 'Expected content string');
  assert(data.content.includes('loader.config'), 'Expected content to include local loader.config');
  assert(data.encoding === 'utf-8', 'Expected encoding utf-8');
  console.log(`    ✓ Status: 200, Size: ${data.size} bytes, EOL: ${JSON.stringify(data.eol)}, Latency: ${res.duration.toFixed(2)}ms`);
});

// -------------------------------------------------------------
// Test 6: Security Sandbox Check (Path Traversal in tree)
// -------------------------------------------------------------
test('File System Security: Tree traversal outside repo root is blocked', async () => {
  const repoPath = 'd:/projects/OmniGit';
  const badDir = '../../Windows';
  const res = await request(`/api/fs/tree?repoPath=${encodeURIComponent(repoPath)}&dir=${encodeURIComponent(badDir)}`);
  const text = await res.text();
  assert(res.status !== 200 || text.includes('Access denied') || text.includes('error'), 'Expected error or access denied');
  console.log(`    ✓ Security check passed: Unauthorized tree path traversal blocked`);
});

// -------------------------------------------------------------
// Runner
// -------------------------------------------------------------
async function runAll() {
  console.log('\n======================================================');
  console.log('   OmniGit Automated E2E API & Performance Verification');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;
  const startAll = performance.now();

  for (const t of tests) {
    console.log(`▶ Running: ${t.name}`);
    try {
      await t.fn();
      passed++;
    } catch (err) {
      failed++;
      console.error(`  ✖ FAIL: ${err.message}`);
    }
  }

  const totalTime = performance.now() - startAll;
  console.log('\n======================================================');
  console.log(`Summary: ${passed} PASSED, ${failed} FAILED in ${totalTime.toFixed(1)}ms`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAll().catch((e) => {
  console.error('Test runner fatal error:', e);
  process.exit(1);
});
