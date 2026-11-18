#!/usr/bin/env node
import { chromium } from 'playwright';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PORT = 3027;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TEST_DB_PATH = `/tmp/marketing-os-department-sync-test-${Date.now()}.db`;

// Clean up previous test database
for (const suffix of ['', '-wal', '-shm']) {
  try {
    fs.rmSync(TEST_DB_PATH + suffix, { force: true });
  } catch (_) {}
}

console.log('================================================================');
console.log('🧪 MARKETING OS: DEPARTMENT SCOPING, RELOCATION & SYNC E2E SUITE');
console.log(`Port: ${PORT} | Database: ${TEST_DB_PATH}`);
console.log('================================================================\n');

// Spawn isolated server
const serverEnv = {
  ...process.env,
  PORT: String(PORT),
  NODE_ENV: 'development',
  DATABASE_PATH: TEST_DB_PATH,
  DB_PATH: TEST_DB_PATH,
  TURSO_DATABASE_URL: '',
  TURSO_AUTH_TOKEN: '',
  LIBSQL_URL: '',
  LIBSQL_AUTH_TOKEN: '',
  N8N_WEBHOOK_TASK: 'http://127.0.0.1:59999/offline',
  SKIP_LIVE_LLM: 'true',
  ALLOW_SIMULATED_FALLBACK: 'true',
  WATCHDOG_INTERVAL_MS: '60000'
};

const serverProcess = spawn('node', ['server/index.js'], {
  cwd: ROOT_DIR,
  env: serverEnv,
  stdio: 'pipe'
});

let serverStderr = '';
serverProcess.stderr.on('data', chunk => {
  serverStderr += chunk.toString();
});

function cleanupServer() {
  try {
    serverProcess.kill('SIGKILL');
  } catch (_) {}
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.rmSync(TEST_DB_PATH + suffix, { force: true });
    } catch (_) {}
  }
}

process.on('exit', cleanupServer);
process.on('SIGINT', () => { cleanupServer(); process.exit(1); });
process.on('SIGTERM', () => { cleanupServer(); process.exit(1); });

// Wait for server ready
let serverReady = false;
for (let i = 0; i < 30; i++) {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    if (res.ok) {
      serverReady = true;
      break;
    }
  } catch (_) {}
  await new Promise(r => setTimeout(r, 400));
}

if (!serverReady) {
  cleanupServer();
  console.error('Server failed to start. Stderr:\n', serverStderr);
  process.exit(1);
}
console.log('✅ Server started and healthy on', BASE_URL);

let browser;

try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Monitor uncaught errors
  const pageErrors = [];
  page.on('pageerror', err => {
    console.error('[Browser PageError]', err.message);
    pageErrors.push(err.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('error') || msg.text().includes('Error')) {
      console.log('[Browser Console]', msg.text());
    }
  });

  // Step 1: Login as Admin
  console.log('\n--- Step 1: Authenticate as Super Admin ---');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.fill('#loginEmailInput', 'admin@marketingos.local');
  await page.fill('#loginPassInput', 'Admin123!');
  await page.click('#loginSubmitBtn');
  await page.waitForSelector('#authModal.hidden', { state: 'attached', timeout: 10000 });
  await page.waitForTimeout(1000);

  const roleChip = await page.locator('#headerRoleChip').innerText();
  assert.ok(roleChip.includes('SUPER ADMIN'), 'Logged in user must be SUPER ADMIN');
  console.log('✅ Logged in successfully as SUPER ADMIN');

  // Step 2: Verify UI Relocation (R1)
  console.log('\n--- Step 2: Verifying UI Relocation (R1) ---');
  // Navigate to Workbench
  await page.evaluate(() => window.switchMainView('workbench'));
  await page.waitForTimeout(500);

  // Assert #wbOutputViewport is absent from #view-workbench
  const wbViewportInWorkbench = await page.locator('#view-workbench #wbOutputViewport').count();
  assert.strictEqual(wbViewportInWorkbench, 0, '#wbOutputViewport must NOT be in #view-workbench');

  // Assert Email Sequence Campaign is excluded from #wbPipelineSelector in Workbench
  const wbPipelineButtons = await page.locator('#wbPipelineSelector button').allInnerTexts();
  assert.ok(
    !wbPipelineButtons.some(t => t.includes('Email Sequence Campaign')),
    'Email Sequence Campaign must be excluded from #wbPipelineSelector in Workbench'
  );
  console.log('✅ Verified: #wbOutputViewport and Email Sequence Campaign are absent from #view-workbench');

  // Navigate to Sales & CRM
  await page.evaluate(() => window.switchMainView('sales'));
  await page.waitForTimeout(500);

  // Assert Email Sequence Campaign controls and 5-Tab Live Deliverable Inspector exist in #view-sales
  const salesRelocatedSection = await page.locator('#view-sales #salesEmailCampaignRelocatedSection');
  assert.ok(await salesRelocatedSection.isVisible(), 'Relocated Email Sequence section must be visible in #view-sales');

  const salesRunBtn = await page.locator('#view-sales #salesRunBtn');
  assert.ok(await salesRunBtn.isVisible(), 'Launch Email Sequence button must be visible in #view-sales');

  const salesViewport = await page.locator('#view-sales #wbOutputViewport');
  assert.ok(await salesViewport.isVisible(), 'Live Deliverable Viewport #wbOutputViewport must be visible in #view-sales');

  // Verify all 5 output tabs in #view-sales
  for (const tab of ['Preview', 'Code', 'Data', 'RAG', 'Report']) {
    const tabBtn = await page.locator(`#view-sales #outTab-${tab}`);
    assert.ok(await tabBtn.isVisible(), `Output tab #${tab} must be visible in #view-sales`);
  }
  console.log('✅ Verified: Relocated Email Sequence Campaign & 5-Tab Deliverable Inspector render in #view-sales');

  // Execute Email Sequence Campaign directly inside #view-sales
  console.log('\n--- Step 3: Executing Email Sequence Campaign in #view-sales ---');
  await page.click('#salesRunBtn');
  // Wait for execution to reach 100% or report error
  try {
    await page.waitForFunction(() => {
      const el = document.getElementById('salesExecPct');
      const st = document.getElementById('salesExecStatusText');
      if (st && st.textContent.includes('Execution error')) {
        return true;
      }
      return el && el.textContent.includes('100%');
    }, { timeout: 15000 });
  } catch (timeoutErr) {
    const statusTxt = await page.locator('#salesExecStatusText').innerText().catch(() => '');
    const pctTxt = await page.locator('#salesExecPct').innerText().catch(() => '');
    const logTxt = await page.locator('#salesTelemetryLog').innerText().catch(() => '');
    console.error(`Timeout! status="${statusTxt}", pct="${pctTxt}", log="${logTxt}"`);
    throw timeoutErr;
  }
  const statusAfterRun = await page.locator('#salesExecStatusText').innerText();
  console.log('Status after run:', statusAfterRun);

  // Verify viewport renders output
  await page.waitForTimeout(1000);
  const viewportContent = await page.locator('#wbOutputViewport').innerText();
  assert.ok(viewportContent.length > 20, 'Deliverable Viewport must display generated output in #view-sales');
  console.log('✅ Verified: Email Sequence Campaign executes and displays live deliverable output inside #view-sales');

  // Step 4: Verify Department-Scoped Projects & Tasks (R2)
  console.log('\n--- Step 4: Verifying Department-Scoped Projects & Tasks (R2) ---');

  // A. Research Department
  await page.evaluate(() => window.switchMainView('research'));
  await page.waitForTimeout(500);

  const researchTasksSection = await page.locator('#researchProjectsTasksSection');
  assert.ok(await researchTasksSection.isVisible(), 'Research Projects & Tasks section must be visible');

  // Create Research Task
  await page.click('#researchProjectsTasksSection button:has-text("New Research Task")');
  await page.waitForSelector('#taskModal:not(.hidden)', { timeout: 5000 });

  const modalDeptResearch = await page.locator('#modalTaskDepartment').inputValue();
  assert.strictEqual(modalDeptResearch, 'research', 'Modal department must default to research in #view-research');

  await page.fill('#modalTaskTitle', 'Competitor Dental Price Audit');
  await page.fill('#modalTaskBrief', 'Analyze 10 Canadian dental clinic pricing models');
  await page.click('#taskModal button:has-text("Create & Launch")');
  await page.waitForSelector('#taskModal.hidden', { state: 'attached', timeout: 8000 });
  await page.waitForTimeout(1000);

  // Verify task appears in Research container
  const researchTasksText = await page.locator('#researchProjectsTasksContainer').innerText();
  assert.ok(researchTasksText.includes('Competitor Dental Price Audit'), 'Created task must appear in #researchProjectsTasksContainer');
  console.log('✅ Research Task created and scoped in #view-research');

  // B. Sales Department
  await page.evaluate(() => window.switchMainView('sales'));
  await page.waitForTimeout(500);

  const salesTasksSection = await page.locator('#salesProjectsTasksSection');
  assert.ok(await salesTasksSection.isVisible(), 'Sales Projects & Tasks section must be visible');

  // Create Sales Task
  await page.click('#salesProjectsTasksSection button:has-text("New Sales Task")');
  await page.waitForSelector('#taskModal:not(.hidden)', { timeout: 5000 });

  const modalDeptSales = await page.locator('#modalTaskDepartment').inputValue();
  assert.strictEqual(modalDeptSales, 'sales', 'Modal department must default to sales in #view-sales');

  await page.fill('#modalTaskTitle', 'Q4 High-Value Clinic Outreach');
  await page.fill('#modalTaskBrief', 'Deploy outreach sequence to verified clinic owners');
  await page.click('#taskModal button:has-text("Create & Launch")');
  await page.waitForSelector('#taskModal.hidden', { state: 'attached', timeout: 8000 });
  await page.waitForTimeout(1000);

  // Verify task appears in Sales container and does not contain Research task
  const salesTasksText = await page.locator('#salesProjectsTasksContainer').innerText();
  assert.ok(salesTasksText.includes('Q4 High-Value Clinic Outreach'), 'Created task must appear in #salesProjectsTasksContainer');
  assert.ok(!salesTasksText.includes('Competitor Dental Price Audit'), 'Sales container must NOT contain research tasks');
  console.log('✅ Sales Task created and scoped in #view-sales');

  // C. Creative Studio Department
  await page.evaluate(() => window.switchMainView('creative'));
  await page.waitForTimeout(500);

  const creativeTasksSection = await page.locator('#creativeProjectsTasksSection');
  assert.ok(await creativeTasksSection.isVisible(), 'Creative Projects & Tasks section must be visible');

  // Create Creative Task
  await page.click('#creativeProjectsTasksSection button:has-text("New Creative Task")');
  await page.waitForSelector('#taskModal:not(.hidden)', { timeout: 5000 });

  const modalDeptCreative = await page.locator('#modalTaskDepartment').inputValue();
  assert.strictEqual(modalDeptCreative, 'creative', 'Modal department must default to creative in #view-creative');

  await page.fill('#modalTaskTitle', 'Dental Studio Modern Visual Identity');
  await page.fill('#modalTaskBrief', 'Craft SVG brand elements and color schemes');
  await page.click('#taskModal button:has-text("Create & Launch")');
  await page.waitForSelector('#taskModal.hidden', { state: 'attached', timeout: 8000 });
  await page.waitForTimeout(1000);

  // Verify task appears in Creative container and does not contain research or sales tasks
  const creativeTasksText = await page.locator('#creativeProjectsTasksContainer').innerText();
  assert.ok(creativeTasksText.includes('Dental Studio Modern Visual Identity'), 'Created task must appear in #creativeProjectsTasksContainer');
  assert.ok(!creativeTasksText.includes('Competitor Dental Price Audit'), 'Creative container must NOT contain research tasks');
  assert.ok(!creativeTasksText.includes('Q4 High-Value Clinic Outreach'), 'Creative container must NOT contain sales tasks');
  console.log('✅ Creative Task created and scoped in #view-creative');

  // Step 5: Bi-directional Synchronization (R3)
  console.log('\n--- Step 5: Verifying Bi-directional Synchronization (R3) ---');
  // Check Workbench view reflects all department tasks
  await page.evaluate(() => window.switchMainView('workbench'));
  await page.waitForTimeout(500);

  const wbTasksText = await page.locator('#wbTasksListContainer').innerText();
  assert.ok(wbTasksText.includes('Competitor Dental Price Audit'), 'Workbench must include Research task');
  assert.ok(wbTasksText.includes('Q4 High-Value Clinic Outreach'), 'Workbench must include Sales task');
  assert.ok(wbTasksText.includes('Dental Studio Modern Visual Identity'), 'Workbench must include Creative task');
  console.log('✅ Workbench reflects all department tasks in real-time');

  // Status transition in Research Department -> verify reflection in Workbench
  console.log('\n--- Step 6: Status Transitions & Bi-directional Reflection ---');
  await page.evaluate(() => window.switchMainView('research'));
  await page.waitForTimeout(500);

  // Click "In Progress" on the research task
  const researchInProgressBtn = page.locator('#researchProjectsTasksContainer button:has-text("In Progress")').first();
  if (await researchInProgressBtn.isVisible()) {
    await researchInProgressBtn.click();
    await page.waitForTimeout(600);
  }

  // Switch to Workbench and verify status is "In Progress"
  await page.evaluate(() => window.switchMainView('workbench'));
  await page.waitForTimeout(500);

  const researchTaskCardInWb = page.locator('#wbTasksListContainer div:has-text("Competitor Dental Price Audit")').first();
  assert.ok((await researchTaskCardInWb.innerText()).includes('In Progress'), 'Workbench must reflect In Progress status transition');
  console.log('✅ Department status change (In Progress) immediately reflected in Workbench');

  // Status transition in Workbench -> verify reflection in Creative Studio
  const creativeDeliveredBtn = page.locator('#wbTasksListContainer div:has-text("Dental Studio Modern Visual Identity") button:has-text("Delivered")').first();
  if (await creativeDeliveredBtn.isVisible()) {
    await creativeDeliveredBtn.click();
    await page.waitForTimeout(600);
  }

  // Switch to Creative Studio and verify status is "Delivered"
  await page.evaluate(() => window.switchMainView('creative'));
  await page.waitForTimeout(500);

  const creativeTaskCardInDept = page.locator('#creativeProjectsTasksContainer div:has-text("Dental Studio Modern Visual Identity")').first();
  assert.ok((await creativeTaskCardInDept.innerText()).includes('Delivered'), 'Creative Department view must reflect Delivered status transition');
  console.log('✅ Workbench status change (Delivered) immediately reflected in Creative Studio view');

  // Step 7: Deletion Bi-directional Sync
  console.log('\n--- Step 7: Deletion Bi-directional Sync ---');
  // Delete research task from Research view
  await page.evaluate(() => window.switchMainView('research'));
  await page.waitForTimeout(500);

  const deleteBtnResearch = page.locator('#researchProjectsTasksContainer div:has-text("Competitor Dental Price Audit") button:has-text("Delete")').first();
  await deleteBtnResearch.click();
  await page.waitForTimeout(600);

  const researchContainerAfterDel = await page.locator('#researchProjectsTasksContainer').innerText();
  assert.ok(!researchContainerAfterDel.includes('Competitor Dental Price Audit'), 'Task must be removed from Research container');

  // Verify absent from Workbench
  await page.evaluate(() => window.switchMainView('workbench'));
  await page.waitForTimeout(500);
  const wbAfterDel = await page.locator('#wbTasksListContainer').innerText();
  assert.ok(!wbAfterDel.includes('Competitor Dental Price Audit'), 'Deleted task must be absent from Workbench');
  console.log('✅ Task deleted in Research view immediately disappears from Workbench');

  // Step 8: Persistence across page reload (page.reload())
  console.log('\n--- Step 8: Persistence across Page Reload ---');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Verify Sales task still persists in Sales view
  await page.evaluate(() => window.switchMainView('sales'));
  await page.waitForTimeout(500);
  const salesAfterReload = await page.locator('#salesProjectsTasksContainer').innerText();
  assert.ok(salesAfterReload.includes('Q4 High-Value Clinic Outreach'), 'Sales task must persist across page reload');

  // Verify Creative task still persists with Delivered status in Creative view
  await page.evaluate(() => window.switchMainView('creative'));
  await page.waitForTimeout(500);
  const creativeAfterReload = await page.locator('#creativeProjectsTasksContainer').innerText();
  assert.ok(creativeAfterReload.includes('Dental Studio Modern Visual Identity'), 'Creative task must persist across page reload');
  assert.ok(creativeAfterReload.includes('Delivered'), 'Creative task status Delivered must persist across reload');

  // Verify Workbench view after reload
  await page.evaluate(() => window.switchMainView('workbench'));
  await page.waitForTimeout(500);
  const wbAfterReload = await page.locator('#wbTasksListContainer').innerText();
  assert.ok(!wbAfterReload.includes('Competitor Dental Price Audit'), 'Deleted task must NOT reappear after page reload');
  assert.ok(wbAfterReload.includes('Q4 High-Value Clinic Outreach'), 'Sales task must be present in Workbench after reload');
  assert.ok(wbAfterReload.includes('Dental Studio Modern Visual Identity'), 'Creative task must be present in Workbench after reload');
  console.log('✅ State persistence across page reload verified in SQLite backend');

  assert.strictEqual(pageErrors.length, 0, `Page errors detected: ${JSON.stringify(pageErrors)}`);

  console.log('\n================================================================');
  console.log('🎉 ALL PLAYWRIGHT E2E UI RELOCATION & SYNC TESTS PASSED CLEANLY');
  console.log('================================================================');
} finally {
  if (browser) await browser.close();
  cleanupServer();
}
