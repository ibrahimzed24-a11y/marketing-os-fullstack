/**
 * tests/e2e/harness.js
 * 
 * Shared Test Harness for Marketing OS E2E Testing Track:
 * - Dynamic ephemeral port discovery (never port 3000)
 * - Temporary SQLite database lifecycle with teardown
 * - Isolated server child process management
 * - Multi-role JWT authentication fixtures
 * - Programmatic Playwright Chromium headless launcher
 * - Mandatory Anti-Slop negative assertion engine
 */

const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const ROOT_DIR = path.resolve(__dirname, '../..');

// Authoritative ground truth file paths in /uploads
const GROUND_TRUTH_PATHS = {
  CLINIC_INTELLIGENCE_CSV: path.join(ROOT_DIR, 'uploads', 'Clinic Intelligence (138 leads, scored and verified).csv'),
  PRIORITY_A_CSV: path.join(ROOT_DIR, 'uploads', 'Priority_A_Outreach_Email_Merge_Fields.csv'),
  SVG_LOGOS_DIR: path.join(ROOT_DIR, 'public', 'exports', 'leads_logos_svg')
};

// Mandatory Anti-Slop Regex across all tiers
const FORBIDDEN_SLOP_REGEX = /Dr\. Marcus Vance|Elena Rostova|David Chen|Sophia Tremblay|555-01\d{2}|1-800-555|\$4\.2B (?:Global Market|TAM)|\$48,000 \/ Annual|from-indigo-700 via-purple-700 to-pink-600/i;

/**
 * Asserts that a text, JSON, or markdown string contains zero prohibited slop.
 */
function assertNoSlop(content, context = '') {
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  const match = FORBIDDEN_SLOP_REGEX.exec(text);
  assert.strictEqual(
    match,
    null,
    `Slop detected${context ? ` in ${context}` : ''}: found forbidden phrase "${match?.[0]}"`
  );
}

/**
 * Finds an available ephemeral port from the OS kernel.
 */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close((err) => {
        if (err) return reject(err);
        resolve(port);
      });
    });
    server.on('error', reject);
  });
}

/**
 * Removes SQLite database and write-ahead log files safely.
 */
function cleanDbFiles(dbPath) {
  if (!dbPath) return;
  const suffixes = ['', '-wal', '-shm'];
  for (const suffix of suffixes) {
    try {
      if (fs.existsSync(dbPath + suffix)) {
        fs.rmSync(dbPath + suffix, { force: true });
      }
    } catch (_) {}
  }
}

/**
 * Spawns an isolated Marketing OS server on an ephemeral port with an isolated temporary DB.
 *
 * @param {object} options
 * @param {number} [options.port] - Optional specific port; defaults to dynamic ephemeral port
 * @param {string} [options.dbPath] - Optional specific DB path; defaults to /tmp/marketing-os-e2e-...
 * @param {object} [options.env] - Additional environment variables
 * @returns {Promise<{ baseUrl: string, port: number, dbPath: string, serverProcess: ChildProcess, cleanup: Function }>}
 */
async function setupE2EServer(options = {}) {
  const port = options.port || (await getFreePort());
  const dbPath = options.dbPath || path.join('/tmp', `marketing-os-e2e-${process.pid}-${Date.now()}-${Math.floor(Math.random() * 10000)}.db`);
  
  // Clean up any stale files at dbPath
  cleanDbFiles(dbPath);

  const env = {
    ...process.env,
    PORT: String(port),
    DATABASE_PATH: dbPath,
    DB_PATH: dbPath,
    TURSO_DATABASE_URL: '',
    TURSO_AUTH_TOKEN: '',
    LIBSQL_URL: '',
    LIBSQL_AUTH_TOKEN: '',
    ALLOW_SIMULATED_FALLBACK: 'true',
    SKIP_LIVE_LLM: 'true',
    N8N_WEBHOOK_TASK: 'http://127.0.0.1:59999/offline',
    WATCHDOG_INTERVAL_MS: '60000',
    NODE_ENV: 'development',
    ...(options.env || {})
  };

  const serverProcess = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT_DIR,
    env,
    stdio: 'pipe'
  });

  let serverStderr = '';
  serverProcess.stderr.on('data', (chunk) => {
    serverStderr += chunk.toString();
  });

  let serverStdout = '';
  serverProcess.stdout.on('data', (chunk) => {
    serverStdout += chunk.toString();
  });

  const baseUrl = `http://127.0.0.1:${port}`;

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    try {
      serverProcess.kill('SIGKILL');
    } catch (_) {}
    cleanDbFiles(dbPath);
  };

  // Wait for GET /api/health to return 200 OK with fail-fast process monitoring
  let serverReady = false;
  const maxAttempts = 50; // up to ~20 seconds
  for (let i = 0; i < maxAttempts; i++) {
    // Fail immediately if the child process died or crashed on boot
    if (serverProcess.exitCode !== null) {
      break;
    }

    try {
      const res = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(1000)
      });
      if (res.ok) {
        serverReady = true;
        break;
      }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 400));
  }

  // Ensure process didn't exit right as health check resolved (e.g. port collision)
  if (serverProcess.exitCode !== null) {
    serverReady = false;
  }

  if (!serverReady) {
    cleanup();
    throw new Error(`Server failed to become healthy on ${baseUrl}. Stderr:\n${serverStderr}\nStdout:\n${serverStdout}`);
  }

  return {
    baseUrl,
    port,
    dbPath,
    serverProcess,
    cleanup
  };
}

/**
 * Standard test credentials mapped by role.
 */
const CREDENTIALS = {
  admin: { email: 'admin@marketingos.local', password: 'Admin123!' },
  manager: { email: 'manager@marketingos.local', password: 'Manager123!' },
  sales: { email: 'sales@marketingos.local', password: 'Admin123!' },
  member: { email: 'member@marketingos.local', password: 'Member123!' },
  creative: { email: 'creative@marketingos.local', password: 'Admin123!' },
  client: { email: 'client@marketingos.local', password: 'Client123!' }
};

/**
 * Logs in via POST /api/auth/login and returns the JWT token and user profile.
 */
async function loginAs(baseUrl, role = 'admin') {
  const creds = CREDENTIALS[role] || CREDENTIALS.admin;
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: creds.email, password: creds.password })
  });
  const data = await res.json();
  assert.strictEqual(res.status, 200, `Login failed for role "${role}" (${creds.email}): ${JSON.stringify(data)}`);
  assert.ok(data.token, `Login response missing token for role "${role}"`);
  return {
    token: data.token,
    user: data.user,
    headers: {
      Authorization: `Bearer ${data.token}`,
      'Content-Type': 'application/json'
    }
  };
}

/**
 * Programmatic Playwright Chromium browser launcher.
 */
async function launchBrowser(options = {}) {
  const browser = await chromium.launch({
    headless: true,
    ...(options.browserOptions || {})
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...(options.contextOptions || {})
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];

  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  return {
    browser,
    context,
    page,
    consoleErrors,
    pageErrors,
    close: async () => {
      try {
        await page.close();
      } catch (_) {}
      try {
        await context.close();
      } catch (_) {}
      try {
        await browser.close();
      } catch (_) {}
    }
  };
}

module.exports = {
  ROOT_DIR,
  GROUND_TRUTH_PATHS,
  FORBIDDEN_SLOP_REGEX,
  assertNoSlop,
  getFreePort,
  cleanDbFiles,
  setupE2EServer,
  loginAs,
  launchBrowser,
  CREDENTIALS
};
