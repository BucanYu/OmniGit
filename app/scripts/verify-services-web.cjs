const http = require('http');

async function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('[Test 1] Testing /api/services/running when empty...');
  const initial = await request({
    hostname: '127.0.0.1',
    port: 5345,
    path: '/api/services/running',
    method: 'GET',
  });
  console.log('Initial running services:', initial.body);
  if (!Array.isArray(initial.body) || initial.body.length !== 0) {
    throw new Error('Expected empty array initially');
  }

  console.log('\n[Test 2] Connecting to SSE stream (/api/services/stream)...');
  const logsReceived = [];
  let exitReceived = false;

  const sseReq = http.request(
    {
      hostname: '127.0.0.1',
      port: 5345,
      path: '/api/services/stream',
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
    },
    (res) => {
      res.on('data', (chunk) => {
        const text = chunk.toString();
        // Parse SSE events
        const lines = text.split('\n');
        let currentEvent = 'message';
        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.replace('event:', '').trim();
          } else if (line.startsWith('data:')) {
            const dataStr = line.replace('data:', '').trim();
            if (currentEvent === 'log') {
              try {
                const payload = JSON.parse(dataStr);
                logsReceived.push(payload);
                console.log(`[SSE Log Received]: [${payload.serviceId}] ${payload.data.trim()}`);
              } catch {}
            } else if (currentEvent === 'exit') {
              try {
                const payload = JSON.parse(dataStr);
                exitReceived = true;
                console.log(`[SSE Exit Received]: [${payload.serviceId}] exitCode=${payload.exitCode}`);
              } catch {}
            }
          }
        }
      });
    }
  );
  sseReq.end();

  // Wait 300ms for SSE connection
  await new Promise((r) => setTimeout(r, 300));

  console.log('\n[Test 3] Launching test service via POST /api/services/start...');
  const startRes = await request(
    {
      hostname: '127.0.0.1',
      port: 5345,
      path: '/api/services/start',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      serviceId: 'e2e-svc-web-test',
      serviceName: 'E2E Web Echo Service',
      projectId: 'test-project',
      command: 'node -e "console.log(12345); setInterval(() => {}, 1000);"',
      cwd: process.cwd(),
    }
  );
  console.log('Start response:', startRes.body);
  if (!startRes.body.success || !startRes.body.pid) {
    throw new Error('Failed to start service via Web API');
  }

  // Wait 1 second to verify running status and SSE log
  await new Promise((r) => setTimeout(r, 1200));

  console.log('\n[Test 4] Querying /api/services/running during execution...');
  const runningMid = await request({
    hostname: '127.0.0.1',
    port: 5345,
    path: '/api/services/running',
    method: 'GET',
  });
  console.log('Running services:', runningMid.body);
  const found = runningMid.body.find((s) => s.serviceId === 'e2e-svc-web-test');
  if (!found || found.pid !== startRes.body.pid) {
    throw new Error('Running services list did not contain expected service PID');
  }

  console.log('\n[Test 5] Stopping service via POST /api/services/stop...');
  const stopRes = await request(
    {
      hostname: '127.0.0.1',
      port: 5345,
      path: '/api/services/stop',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { serviceId: 'e2e-svc-web-test' }
  );
  console.log('Stop response:', stopRes.body);
  if (!stopRes.body.success) {
    throw new Error('Failed to stop service');
  }

  // Wait 800ms for exit event
  await new Promise((r) => setTimeout(r, 800));

  console.log('\n[Test 6] Verifying running list is clean...');
  const runningEnd = await request({
    hostname: '127.0.0.1',
    port: 5345,
    path: '/api/services/running',
    method: 'GET',
  });
  console.log('Final running services:', runningEnd.body);
  if (runningEnd.body.some((s) => s.serviceId === 'e2e-svc-web-test')) {
    throw new Error('Service is still reported as running after stop');
  }

  console.log('\n[Test 7] Checking SSE log outputs...');
  const hasTargetOutput = logsReceived.some((l) => l.data.includes('12345'));
  console.log('Captured target log output:', hasTargetOutput);
  console.log('Captured process exit event:', exitReceived);

  sseReq.destroy();

  if (!hasTargetOutput) {
    throw new Error('SSE log stream did not capture process output');
  }
  if (!exitReceived) {
    throw new Error('SSE exit event was not received');
  }

  console.log('\n🎉 ALL 7 WEB E2E PROCESS TESTS PASSED SUCCESSFULLY! 🎉\n');
}

run().catch((err) => {
  console.error('\n❌ E2E Test Failed:', err);
  process.exit(1);
});
