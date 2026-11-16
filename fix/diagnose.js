require('dotenv').config();
const http = require('http');
const db = require('../server/db');

function testHttp(url, method = 'GET', postData = null, timeoutMs = 3000) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const req = http.request({
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: method,
        timeout: timeoutMs,
        headers: postData ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } : {}
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ ok: res.statusCode < 500, status: res.statusCode, body: data }));
      });
      req.on('error', (err) => resolve({ ok: false, error: err.message }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Connection timed out' }); });
      if (postData) req.write(postData);
      req.end();
    } catch (e) {
      resolve({ ok: false, error: e.message });
    }
  });
}

(async () => {
  console.log('===============================================================');
  console.log('🔍 MARKETING OS — SYSTEM DIAGNOSTIC REPORT');
  console.log('===============================================================\n');

  // 1. Marketing OS Server Check
  const port = process.env.PORT || 3000;
  const osHealth = await testHttp(`http://127.0.0.1:${port}/`);
  if (osHealth.ok) {
    console.log(`[OK]   Marketing OS Server : Running on http://127.0.0.1:${port} (HTTP ${osHealth.status})`);
  } else {
    console.log(`[FAIL] Marketing OS Server : Unreachable on port ${port} (${osHealth.error || 'Connection refused'})`);
  }

  // 2. n8n Service Check
  const n8nUrl = process.env.N8N_BASE_URL || 'http://127.0.0.1:5678';
  const n8nStatus = await testHttp(n8nUrl);
  if (n8nStatus.ok) {
    console.log(`[OK]   n8n Service        : Running at ${n8nUrl} (HTTP ${n8nStatus.status})`);
  } else {
    console.log(`[FAIL] n8n Service        : Offline or unreachable at ${n8nUrl} (${n8nStatus.error || 'Connection refused'})`);
  }

  // 3. n8n Webhook Endpoint Check
  const webhookUrl = process.env.N8N_WEBHOOK_TASK || 'http://127.0.0.1:5678/webhook/marketing-os-task';
  const testPayload = JSON.stringify({ test: true, timestamp: new Date().toISOString() });
  const webhookCheck = await testHttp(webhookUrl, 'POST', testPayload);
  if (webhookCheck.ok && webhookCheck.status !== 404) {
    console.log(`[OK]   n8n Task Webhook   : Active at ${webhookUrl} (HTTP ${webhookCheck.status})`);
  } else if (webhookCheck.status === 404) {
    console.log(`[FAIL] n8n Task Webhook   : Returned 404 Not Found at ${webhookUrl} (Workflow 01 not active?)`);
  } else {
    console.log(`[FAIL] n8n Task Webhook   : Not reachable at ${webhookUrl} (${webhookCheck.error || 'Connection refused'})`);
  }

  // 4. SQLite Database Check
  try {
    const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const projectCount = db.prepare('SELECT COUNT(*) as c FROM projects').get().c;
    const taskCount = db.prepare('SELECT COUNT(*) as c FROM tasks').get().c;
    console.log(`[OK]   SQLite Database    : Connected (${process.env.DATABASE_PATH || './data/marketing-os.db'})`);
    console.log(`       -> Users: ${userCount} | Projects: ${projectCount} | Tasks: ${taskCount}`);
  } catch (e) {
    console.log(`[FAIL] SQLite Database    : Error - ${e.message}`);
  }

  // 5. Seed Users Verification
  console.log('\n--- Seed Users Authentication Status ---');
  const expected = [
    { email: 'admin@marketingos.local', role: 'super_admin' },
    { email: 'manager@marketingos.local', role: 'manager' },
    { email: 'member@marketingos.local', role: 'member' },
    { email: 'client@marketingos.local', role: 'client' },
  ];
  for (const u of expected) {
    const row = db.prepare('SELECT id, email, role, status FROM users WHERE email=?').get(u.email);
    if (row) {
      console.log(`[OK]   User: ${row.email.padEnd(28)} [${row.role}] (Status: ${row.status})`);
    } else {
      console.log(`[FAIL] User: ${u.email.padEnd(28)} MISSING in database!`);
    }
  }

  console.log('\n===============================================================');
  console.log('Diagnostic finished.');
  console.log('===============================================================\n');
})();
