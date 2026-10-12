/**
 * OmniGit Unified Automated Test Suite Runner
 * Executes both Backend API Benchmarks and Browser CDP E2E Automation.
 */

const { spawn } = require('child_process');
const path = require('path');

function runScript(scriptPath) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..', '..'),
    });

    child.on('close', (code) => {
      const duration = performance.now() - t0;
      resolve({ code, duration });
    });
  });
}

async function main() {
  console.log('\n######################################################################');
  console.log('            OmniGit Unified Automated Quality Verification');
  console.log('######################################################################\n');

  const scriptsDir = __dirname;
  const apiTestScript = path.join(scriptsDir, 'api-e2e-test.cjs');
  const browserTestScript = path.join(scriptsDir, 'cdp-browser-test.cjs');

  console.log('>>> [Phase 1/2] Executing API & Performance SLA Tests...');
  const apiResult = await runScript(apiTestScript);

  if (apiResult.code !== 0) {
    console.error(`\n✖ Phase 1 Failed with exit code ${apiResult.code} (${apiResult.duration.toFixed(0)}ms)`);
    process.exit(apiResult.code);
  }

  console.log(`\n✓ Phase 1 Completed Successfully in ${apiResult.duration.toFixed(0)}ms\n`);

  console.log('>>> [Phase 2/2] Executing Headless Chrome CDP Browser E2E Tests...');
  const browserResult = await runScript(browserTestScript);

  if (browserResult.code !== 0) {
    console.error(`\n✖ Phase 2 Failed with exit code ${browserResult.code} (${browserResult.duration.toFixed(0)}ms)`);
    process.exit(browserResult.code);
  }

  console.log(`\n✓ Phase 2 Completed Successfully in ${browserResult.duration.toFixed(0)}ms\n`);

  console.log('######################################################################');
  console.log('       ALL VERIFICATION GATES PASSED (100% SUCCESS)');
  console.log('       Reports & Screenshots: test/reports/');
  console.log('######################################################################\n');
}

main().catch((err) => {
  console.error('Unified runner fatal error:', err);
  process.exit(1);
});
