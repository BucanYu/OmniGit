/**
 * OmniGit Unified Automated Test Suite Runner
 * Executes both Backend API Benchmarks and Browser CDP E2E Automation.
 */

const { spawn } = require('child_process');
const path = require('path');

function runScript(scriptPath) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const child = spawn(process.execPath, ['--experimental-websocket', scriptPath], {
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
  const servicesSwitcherTestScript = path.join(scriptsDir, 'test-services-project-switcher-e2e.cjs');
  const builtinDocOpenTestScript = path.join(scriptsDir, 'test-builtin-doc-open-e2e.cjs');

  console.log('>>> [Phase 1/4] Executing API & Performance SLA Tests...');
  const apiResult = await runScript(apiTestScript);

  if (apiResult.code !== 0) {
    console.error(`\n✖ Phase 1 Failed with exit code ${apiResult.code} (${apiResult.duration.toFixed(0)}ms)`);
    process.exit(apiResult.code);
  }

  console.log(`\n✓ Phase 1 Completed Successfully in ${apiResult.duration.toFixed(0)}ms\n`);

  console.log('>>> [Phase 2/4] Executing Headless Chrome CDP Browser E2E Tests...');
  const browserResult = await runScript(browserTestScript);

  if (browserResult.code !== 0) {
    console.error(`\n✖ Phase 2 Failed with exit code ${browserResult.code} (${browserResult.duration.toFixed(0)}ms)`);
    process.exit(browserResult.code);
  }

  console.log(`\n✓ Phase 2 Completed Successfully in ${browserResult.duration.toFixed(0)}ms\n`);

  console.log('>>> [Phase 3/4] Executing Services In-Module Project Switcher E2E Tests...');
  const servicesResult = await runScript(servicesSwitcherTestScript);

  if (servicesResult.code !== 0) {
    console.error(`\n✖ Phase 3 Failed with exit code ${servicesResult.code} (${servicesResult.duration.toFixed(0)}ms)`);
    process.exit(servicesResult.code);
  }

  console.log(`\n✓ Phase 3 Completed Successfully in ${servicesResult.duration.toFixed(0)}ms\n`);

  console.log('>>> [Phase 4/4] Executing Built-in Doc Open in Editor E2E Tests...');
  const docOpenResult = await runScript(builtinDocOpenTestScript);

  if (docOpenResult.code !== 0) {
    console.error(`\n✖ Phase 4 Failed with exit code ${docOpenResult.code} (${docOpenResult.duration.toFixed(0)}ms)`);
    process.exit(docOpenResult.code);
  }

  console.log(`\n✓ Phase 4 Completed Successfully in ${docOpenResult.duration.toFixed(0)}ms\n`);

  console.log('######################################################################');
  console.log('       ALL VERIFICATION GATES PASSED (100% SUCCESS)');
  console.log('       Reports & Screenshots: test/reports/');
  console.log('######################################################################\n');
}

main().catch((err) => {
  console.error('Unified runner fatal error:', err);
  process.exit(1);
});
