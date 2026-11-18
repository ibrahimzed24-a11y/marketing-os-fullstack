#!/usr/bin/env node
/**
 * Marketing OS — Comprehensive Playwright E2E Test & QA Suite
 *
 * Launches an isolated local Marketing OS server on PORT 3020 using a fresh
 * temp SQLite DB (/tmp/marketing-os-pw.db) with ALL Turso env vars cleared so
 * production Turso Cloud is NEVER touched.
 */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PORT = 3020;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_PATH = '/tmp/marketing-os-pw.db';

// Clean up any stale temp DB files before booting
for (const suffix of ['', '-wal', '-shm', '-journal']) {
  const f = DB_PATH + suffix;
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

// Tracking structures
const results = [];
const globalDiagnostics = {
  pageErrors: [],
  consoleErrors: [],
  failedApiResponses: [],
  dialogs: [],
  serverStderr: []
};

let currentStepTag = 'startup';
// Allowed expected HTTP error statuses per step (e.g. intentional invalid login 401)
let allowedErrorMatcher = null;

function record(suite, name, passed, details = '') {
  results.push({ suite, name, passed, details });
  const icon = passed ? 'PASS' : 'FAIL';
  console.log(`[${icon}] [${suite}] ${name}${details ? ' — ' + details : ''}`);
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms`);
}

function startIsolatedServer() {
  const env = { ...process.env };
  // CRITICAL SAFETY: Blank out ALL Turso/LibSQL vars and force isolated temp SQLite
  env.TURSO_DATABASE_URL = '';
  env.TURSO_AUTH_TOKEN = '';
  env.LIBSQL_URL = '';
  env.LIBSQL_AUTH_TOKEN = '';
  env.DATABASE_PATH = DB_PATH;
  env.DB_PATH = DB_PATH;
  env.PORT = String(PORT);
  delete env.NODE_ENV;
  delete env.VERCEL;

  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (chunk) => {
    const txt = chunk.toString();
    if (process.env.PW_VERBOSE) process.stdout.write('[server] ' + txt);
  });
  child.stderr.on('data', (chunk) => {
    const txt = chunk.toString().trim();
    if (txt) {
      globalDiagnostics.serverStderr.push(txt);
      if (process.env.PW_VERBOSE) process.stderr.write('[server-err] ' + txt + '\n');
    }
  });

  return child;
}

async function stopServer(child) {
  if (!child || child.killed) return;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (_) {}
      resolve();
    }, 3000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    try { child.kill('SIGTERM'); } catch (_) {
      clearTimeout(timer);
      resolve();
    }
  });
}

function attachListeners(page) {
  page.on('pageerror', (err) => {
    globalDiagnostics.pageErrors.push({
      step: currentStepTag,
      message: err.message,
      stack: (err.stack || '').split('\n').slice(0, 4).join(' | ')
    });
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (allowedErrorMatcher && allowedErrorMatcher({ type: 'console', text })) {
        return;
      }
      globalDiagnostics.consoleErrors.push({
        step: currentStepTag,
        text
      });
    }
  });

  page.on('response', async (res) => {
    const url = res.url();
    const status = res.status();
    if (status >= 400 && url.startsWith(BASE_URL)) {
      const req = res.request();
      const pathname = new URL(url).pathname + new URL(url).search;
      if (allowedErrorMatcher && allowedErrorMatcher({ type: 'response', status, pathname, method: req.method() })) {
        return;
      }
      let bodySnippet = '';
      try {
        bodySnippet = (await res.text()).slice(0, 220);
      } catch (_) {}
      globalDiagnostics.failedApiResponses.push({
        step: currentStepTag,
        method: req.method(),
        url: pathname,
        status,
        body: bodySnippet
      });
    }
  });

  page.on('dialog', async (dialog) => {
    globalDiagnostics.dialogs.push({
      step: currentStepTag,
      type: dialog.type(),
      message: dialog.message()
    });
    if (dialog.type() === 'prompt') {
      await dialog.accept('Acme Dental Studio');
    } else {
      await dialog.accept();
    }
  });
}

function snapshotErrors() {
  return {
    pageErrors: globalDiagnostics.pageErrors.length,
    consoleErrors: globalDiagnostics.consoleErrors.length,
    failedApi: globalDiagnostics.failedApiResponses.length
  };
}

function diffErrors(snap) {
  return {
    pageErrors: globalDiagnostics.pageErrors.slice(snap.pageErrors),
    consoleErrors: globalDiagnostics.consoleErrors.slice(snap.consoleErrors),
    failedApi: globalDiagnostics.failedApiResponses.slice(snap.failedApi)
  };
}

async function waitShort(page, ms = 500) {
  await page.waitForTimeout(ms);
}

async function runSuite() {
  const server = startIsolatedServer();
  let browser = null;

  try {
    await waitForServer(`${BASE_URL}/api/health`);
    console.log(`Server ready at ${BASE_URL} with isolated DB ${DB_PATH}`);

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();
    attachListeners(page);

    // =========================================================================
    // SUITE 1: AUTH FLOW
    // =========================================================================
    currentStepTag = 'auth:initial-load';
    let snap = snapshotErrors();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await waitShort(page, 600);
    let errDiff = diffErrors(snap);

    const authModalVisible = await page.locator('#authModal').isVisible();
    const emailVal = await page.locator('#loginEmailInput').inputValue();
    const passVal = await page.locator('#loginPassInput').inputValue();
    const authModalText = await page.locator('#authModal').innerText();
    const leakedPass = ['Admin123!', 'Client123!', 'Manager123!', 'Member123!'].find((p) => authModalText.includes(p));

    record(
      'Auth',
      'Login modal renders cleanly with empty inputs & zero exposed default passwords',
      authModalVisible && emailVal === '' && passVal === '' && !leakedPass && errDiff.pageErrors.length === 0,
      `visible=${authModalVisible}, email="${emailVal}", passLen=${passVal.length}, leaked=${leakedPass || 'none'}, pageErrors=${errDiff.pageErrors.length}`
    );

    if (errDiff.pageErrors.length > 0 || errDiff.consoleErrors.length > 0 || errDiff.failedApi.length > 0) {
      record(
        'Auth',
        'Zero JS/console/API errors on unauthenticated load',
        false,
        `pageErrors=${JSON.stringify(errDiff.pageErrors)}, consoleErrors=${JSON.stringify(errDiff.consoleErrors)}, failedApi=${JSON.stringify(errDiff.failedApi)}`
      );
    } else {
      record('Auth', 'Zero JS/console/API errors on unauthenticated load', true);
    }

    // Invalid login test
    currentStepTag = 'auth:invalid-login';
    allowedErrorMatcher = (e) =>
      (e.type === 'response' && e.pathname === '/api/auth/login' && e.status === 401) ||
      (e.type === 'console' && e.text.includes('401'));
    await page.fill('#loginEmailInput', 'admin@marketingos.local');
    await page.fill('#loginPassInput', 'WrongPassword999!');
    await page.click('#loginSubmitBtn');
    await page.waitForSelector('#authErrorMessage:not(.hidden)', { timeout: 5000 }).catch(() => {});
    allowedErrorMatcher = null;

    const errVisible = await page.locator('#authErrorMessage').isVisible();
    const errText = errVisible ? (await page.locator('#authErrorMessage').innerText()).trim() : '';
    const stillOpen = await page.locator('#authModal').isVisible();
    record(
      'Auth',
      'Invalid login shows error message and keeps login modal open',
      errVisible && errText.length > 0 && stillOpen,
      `errVisible=${errVisible}, errText="${errText}", modalOpen=${stillOpen}`
    );

    // Valid Admin login
    currentStepTag = 'auth:admin-login';
    snap = snapshotErrors();
    await page.fill('#loginEmailInput', 'admin@marketingos.local');
    await page.fill('#loginPassInput', 'Admin123!');
    const [loginRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/login'), { timeout: 10000 }),
      page.click('#loginSubmitBtn')
    ]);
    if (loginRes.status() !== 200) {
      throw new Error(`Admin login failed with HTTP ${loginRes.status()}: ${await loginRes.text()}`);
    }
    await page.waitForSelector('#authModal.hidden', { state: 'attached', timeout: 8000 }).catch(() => {});
    await waitShort(page, 1000);
    errDiff = diffErrors(snap);

    const modalHiddenAfterLogin = !(await page.locator('#authModal').isVisible());
    const roleChip = (await page.locator('#headerRoleChip').innerText()).trim();
    const userBadge = (await page.locator('#headerUserBadge').innerText()).trim();
    record(
      'Auth',
      'Valid admin login loads app cleanly without errors',
      modalHiddenAfterLogin && roleChip.includes('SUPER ADMIN') && errDiff.pageErrors.length === 0 && errDiff.failedApi.length === 0,
      `modalHidden=${modalHiddenAfterLogin}, user="${userBadge}", role="${roleChip}", pageErrors=${errDiff.pageErrors.length}, failedApi=${errDiff.failedApi.length}`
    );

    // Session persistence on reload
    currentStepTag = 'auth:session-reload';
    snap = snapshotErrors();
    await page.reload({ waitUntil: 'networkidle' });
    await waitShort(page, 800);
    errDiff = diffErrors(snap);

    const modalHiddenAfterReload = !(await page.locator('#authModal').isVisible());
    const roleAfterReload = (await page.locator('#headerRoleChip').innerText()).trim();
    record(
      'Auth',
      'Session persists across page reload with zero errors',
      modalHiddenAfterReload && roleAfterReload.includes('SUPER ADMIN') && errDiff.pageErrors.length === 0 && errDiff.failedApi.length === 0,
      `modalHidden=${modalHiddenAfterReload}, role="${roleAfterReload}", pageErrors=${errDiff.pageErrors.length}, failedApi=${errDiff.failedApi.length}`
    );

    // =========================================================================
    // SUITE 2: ALL 9 CORE NAVIGATION VIEWS
    // =========================================================================
    const navViews = [
      { tab: 'navTab-overview', view: 'view-overview', label: 'Overview' },
      { tab: 'navTab-research', view: 'view-research', label: 'Research' },
      { tab: 'navTab-sales', view: 'view-sales', label: 'Sales CRM' },
      { tab: 'navTab-creative', view: 'view-creative', label: 'Creative Studio' },
      { tab: 'navTab-workbench', view: 'view-workbench', label: 'Projects & Tasks (Workbench)' },
      { tab: 'navTab-approvals', view: 'view-approvals', label: 'Approvals' },
      { tab: 'navTab-team', view: 'view-team', label: 'Team' },
      { tab: 'navTab-rag', view: 'view-rag', label: 'Knowledge Base' },
      { tab: 'navTab-adminSettings', view: 'view-adminSettings', label: 'Settings' }
    ];

    for (const nv of navViews) {
      currentStepTag = `nav:${nv.label}`;
      snap = snapshotErrors();
      const tabLoc = page.locator(`#${nv.tab}`);
      const tabVisible = await tabLoc.isVisible();
      if (!tabVisible) {
        record('Navigation', `Tab "${nv.label}" (#${nv.tab}) visible and opens #${nv.view}`, false, 'Tab button is not visible');
        continue;
      }
      await tabLoc.click();
      await waitShort(page, 700);
      errDiff = diffErrors(snap);

      const viewVisible = await page.locator(`#${nv.view}`).isVisible();
      const textLen = (await page.locator(`#${nv.view}`).innerText()).trim().length;
      const noErrors = errDiff.pageErrors.length === 0 && errDiff.consoleErrors.length === 0 && errDiff.failedApi.length === 0;
      record(
        'Navigation',
        `Tab "${nv.label}" opens #${nv.view} cleanly`,
        viewVisible && textLen > 20 && noErrors,
        `visible=${viewVisible}, textLen=${textLen}, pageErrors=${errDiff.pageErrors.length}, consoleErrors=${errDiff.consoleErrors.length}, failedApi=${errDiff.failedApi.length}`
      );
    }

    // =========================================================================
    // SUITE 3A: CREATE A NEW PROJECT VIA UI & VERIFY PERSISTENCE
    // =========================================================================
    currentStepTag = 'flow:create-project';
    snap = snapshotErrors();
    await page.click('#navTab-workbench');
    await waitShort(page, 300);
    await page.click('#headerNewProjectBtn');
    await waitShort(page, 200);

    const drawerVisible = await page.locator('#newProjectDrawer').isVisible();
    await page.fill('#npName', 'Playwright E2E Growth Campaign');
    await page.fill('#npClient', 'Acme Dental Group');
    await page.selectOption('#npDeliverable', 'Lead Pack');
    await page.selectOption('#npPipeline', 'lead-research');
    await page.fill('#npGoal', 'Discover verified B2B dental buyers and convert to Sales CRM.');
    await page.click('#newProjectDrawer button:has-text("Save Marketing Project")');
    await waitShort(page, 800);
    errDiff = diffErrors(snap);

    const drawerClosed = !(await page.locator('#newProjectDrawer').isVisible());
    const cardsText = await page.locator('#projectCardsList').innerText();
    const wbTitle = (await page.locator('#wbProjectTitle').innerText()).trim();

    // Check if the project actually persisted to the backend SQLite DB!
    const apiProjects = await page.evaluate(async () => {
      const token = localStorage.getItem('marketing_os_token');
      const r = await fetch('/api/projects', { headers: { Authorization: 'Bearer ' + token } });
      return r.ok ? await r.json() : { error: r.status };
    });
    const persistedInDb = Array.isArray(apiProjects.projects) && apiProjects.projects.some((p) => p.name === 'Playwright E2E Growth Campaign');

    record(
      'Flow-Project',
      'Create new project via UI drawer appears in Workbench',
      drawerVisible && drawerClosed && cardsText.includes('Playwright E2E Growth Campaign') && wbTitle.includes('Playwright E2E Growth Campaign'),
      `drawerOpened=${drawerVisible}, drawerClosed=${drawerClosed}, wbTitle="${wbTitle}", inList=${cardsText.includes('Playwright E2E Growth Campaign')}`
    );

    record(
      'Flow-Project',
      'Created project persists in backend DB (/api/projects)',
      persistedInDb && errDiff.failedApi.length === 0,
      `persistedInDb=${persistedInDb}, dbProjectCount=${apiProjects.projects?.length ?? 'err'}, failedApi=${errDiff.failedApi.length}`
    );

    // Reload test: does project still exist after reload?
    currentStepTag = 'flow:create-project-reload';
    await page.reload({ waitUntil: 'networkidle' });
    await waitShort(page, 600);
    await page.click('#navTab-workbench');
    await waitShort(page, 400);
    const cardsAfterReload = await page.locator('#projectCardsList').innerText();
    record(
      'Flow-Project',
      'Created project survives page reload (backend sync)',
      cardsAfterReload.includes('Playwright E2E Growth Campaign'),
      `presentAfterReload=${cardsAfterReload.includes('Playwright E2E Growth Campaign')}`
    );

    // If UI project creation failed to persist to DB, create one via API ONLY as a fallback so we can still test downstream flows 3b-3e and uncover all remaining bugs in one pass!
    let activeProjectId = null;
    if (!persistedInDb) {
      const fallbackProj = await page.evaluate(async () => {
        const token = localStorage.getItem('marketing_os_token');
        const r = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({
            name: 'Playwright Fallback DB Project',
            client_name: 'Acme Dental Group',
            type: 'lead-research',
            goal: 'Discover verified B2B dental buyers and convert to Sales CRM.'
          })
        });
        return r.ok ? await r.json() : null;
      });
      activeProjectId = fallbackProj?.id || fallbackProj?.project?.id || null;
      await page.reload({ waitUntil: 'networkidle' });
      await waitShort(page, 500);
      await page.click('#navTab-workbench');
      await waitShort(page, 400);
    }

    // =========================================================================
    // SUITE 3B: RUN RESEARCH AGENT TASK (lead-research)
    // =========================================================================
    currentStepTag = 'flow:research-agent';
    snap = snapshotErrors();
    await page.click('#navTab-workbench');
    await waitShort(page, 300);

    // Click Lead-to-Deal Machine (lead-research) pipeline pill
    await page.locator('#wbPipelineSelector button:has-text("Lead-to-Deal Machine")').click();
    await waitShort(page, 200);
    await page.click('#wbRunBtn');

    // Wait for execution to finish (look for toast or output viewport updating)
    await page.waitForFunction(() => {
      const vp = document.getElementById('wbOutputViewport');
      const toast = document.getElementById('toastMessage')?.textContent || '';
      const hasError = toast.toLowerCase().includes('error');
      const hasComplete = toast.toLowerCase().includes('complete');
      const hasLeadsOutput = vp && (vp.innerText.includes('Verified Accounts') || vp.innerText.includes('ICP Score') || vp.innerText.includes('Lead'));
      return hasComplete || hasError || hasLeadsOutput;
    }, { timeout: 25000 }).catch(() => {});
    await waitShort(page, 800);
    errDiff = diffErrors(snap);

    const toastAfterResearch = (await page.locator('#toastMessage').innerText()).trim();
    const vpTextResearch = (await page.locator('#wbOutputViewport').innerText()).trim();
    const researchSucceeded =
      !toastAfterResearch.toLowerCase().includes('error') &&
      (vpTextResearch.includes('Verified Accounts') || vpTextResearch.includes('ICP Score') || vpTextResearch.length > 100) &&
      errDiff.failedApi.length === 0 &&
      errDiff.pageErrors.length === 0;

    record(
      'Flow-Research',
      'Run Research Agent (lead-research) renders deliverable output in Workbench',
      researchSucceeded,
      `toast="${toastAfterResearch}", vpLen=${vpTextResearch.length}, failedApi=${errDiff.failedApi.length}`
    );

    // Check Report tab
    await page.click('#outTab-Report');
    await waitShort(page, 300);
    const reportTabText = (await page.locator('#wbOutputViewport').innerText()).trim();
    record(
      'Flow-Research',
      'Executive Report tab renders deliverable report',
      reportTabText.length > 60 && !reportTabText.includes('No active report'),
      `reportLen=${reportTabText.length}, snippet="${reportTabText.slice(0, 90).replace(/\n/g, ' ')}"`
    );

    // Navigate to Research view and verify #researchLeadsContainer populated
    currentStepTag = 'flow:research-leads-view';
    snap = snapshotErrors();
    await page.click('#navTab-research');
    await waitShort(page, 800);
    errDiff = diffErrors(snap);

    const researchLeadsText = (await page.locator('#researchLeadsContainer').innerText()).trim();
    const hasDiscoveredLeads =
      researchLeadsText.length > 20 &&
      !researchLeadsText.includes('No discovered leads in database yet') &&
      !researchLeadsText.includes('Loading discovered leads');

    record(
      'Flow-Research',
      'Discovered leads populate in #view-research (#researchLeadsContainer)',
      hasDiscoveredLeads && errDiff.failedApi.length === 0,
      `hasLeads=${hasDiscoveredLeads}, snippet="${researchLeadsText.slice(0, 120).replace(/\n/g, ' ')}"`
    );

    // =========================================================================
    // SUITE 3C: RESEARCH -> SALES CRM HANDOFF
    // =========================================================================
    currentStepTag = 'flow:research-to-sales-handoff';
    snap = snapshotErrors();
    await page.locator('#view-research button:has-text("Handoff Leads to Sales CRM")').click();
    await waitShort(page, 1200);
    errDiff = diffErrors(snap);

    const toastAfterHandoff = (await page.locator('#toastMessage').innerText()).trim();
    const salesViewVisible = await page.locator('#view-sales').isVisible();
    if (!salesViewVisible) {
      await page.click('#navTab-sales');
      await waitShort(page, 600);
    }

    const dealsText = (await page.locator('#salesDealsContainer').innerText()).trim();
    const salesLeadsText = (await page.locator('#salesLeadsContainer').innerText()).trim();
    const countDiscovered = Number((await page.locator('#salesCountDiscovered').innerText()).trim()) || 0;
    const countDrafted = Number((await page.locator('#salesCountDrafted').innerText()).trim()) || 0;
    const countQualified = Number((await page.locator('#salesCountQualified').innerText()).trim()) || 0;
    const countProposal = Number((await page.locator('#salesCountProposal').innerText()).trim()) || 0;
    const countWon = Number((await page.locator('#salesCountWon').innerText()).trim()) || 0;
    const totalStageCount = countDiscovered + countDrafted + countQualified + countProposal + countWon;

    const hasDeals = dealsText.length > 10 && !dealsText.includes('No active deals yet') && !dealsText.includes('Loading CRM deals');
    const hasSalesLeads = salesLeadsText.length > 10 && !salesLeadsText.includes('No CRM leads yet');

    record(
      'Flow-Handoff-Sales',
      'Research -> Sales CRM Handoff populates deals, leads, and stage counters',
      hasDeals && hasSalesLeads && totalStageCount > 0 && errDiff.failedApi.length === 0,
      `toast="${toastAfterHandoff}", switchedToSales=${salesViewVisible}, hasDeals=${hasDeals}, hasLeads=${hasSalesLeads}, counts=[D:${countDiscovered},Dr:${countDrafted},Q:${countQualified},P:${countProposal},W:${countWon}]`
    );

    // =========================================================================
    // SUITE 3D: SALES AGENT (email-campaign) -> APPROVAL GATE -> EXECUTE
    // =========================================================================
    currentStepTag = 'flow:sales-agent-email';
    snap = snapshotErrors();
    await page.click('#navTab-workbench');
    await waitShort(page, 400);
    await page.locator('#wbPipelineSelector button:has-text("Email Sequence Campaign")').click();
    await waitShort(page, 200);
    await page.click('#wbRunBtn');

    await page.waitForFunction(() => {
      const toast = document.getElementById('toastMessage')?.textContent || '';
      return toast.toLowerCase().includes('complete') || toast.toLowerCase().includes('error');
    }, { timeout: 25000 }).catch(() => {});
    await waitShort(page, 800);
    errDiff = diffErrors(snap);

    const toastAfterEmail = (await page.locator('#toastMessage').innerText()).trim();
    record(
      'Flow-Approvals',
      'Run Sales Agent (email-campaign) completes cleanly',
      !toastAfterEmail.toLowerCase().includes('error') && errDiff.failedApi.length === 0 && errDiff.pageErrors.length === 0,
      `toast="${toastAfterEmail}", failedApi=${errDiff.failedApi.length}`
    );

    // Navigate to Approvals
    currentStepTag = 'flow:approvals-inspect-approve';
    snap = snapshotErrors();
    await page.click('#navTab-approvals');
    await waitShort(page, 800);

    const approvalsListText = (await page.locator('#approvalsFullList').innerText()).trim();
    const hasPendingApproval =
      /Approval:/i.test(approvalsListText) &&
      /Exec:/i.test(approvalsListText) &&
      !approvalsListText.includes('No approvals matching');

    record(
      'Flow-Approvals',
      'Pending approval item appears in #approvalsFullList with Approval: and Exec: badges',
      hasPendingApproval,
      `snippet="${approvalsListText.slice(0, 160).replace(/\n/g, ' ')}"`
    );

    let modalApprovedOk = false;
    if (hasPendingApproval) {
      // Open Approval Inspection Modal
      await page.locator('#approvalsFullList button:has-text("Inspect")').first().click();
      await waitShort(page, 400);
      const modalOpen = await page.locator('#approvalModal').isVisible();
      const modalText = (await page.locator('#approvalModal').innerText()).trim();
      const modalTitle = (await page.locator('#modalAppTitle').innerText()).trim();
      const modalPreview = (await page.locator('#modalAppPreview').innerText()).trim();
      const modalHasBadges = /Approval:/i.test(modalText) && /Exec:/i.test(modalText);
      record(
        'Flow-Approvals',
        'Approval Inspection Modal (#approvalModal) opens with title, preview, Approval: and Exec: badges',
        modalOpen && modalTitle.length > 0 && modalPreview.length > 10 && modalHasBadges,
        `open=${modalOpen}, title="${modalTitle}", previewLen=${modalPreview.length}, hasBadges=${modalHasBadges}`
      );

      // Click Approve inside modal
      await page.fill('#modalAppNotes', 'Verified by Playwright QA');
      const decSnap = snapshotErrors();
      await page.click('#modalBtnApprove');
      await waitShort(page, 1000);
      const decDiff = diffErrors(decSnap);
      const toastAfterApprove = (await page.locator('#toastMessage').innerText()).trim();
      modalApprovedOk =
        toastAfterApprove.toUpperCase().includes('APPROVE') &&
        !toastAfterApprove.toLowerCase().includes('error') &&
        decDiff.failedApi.length === 0;

      record(
        'Flow-Approvals',
        'Approving inside #approvalModal succeeds cleanly via API',
        modalApprovedOk,
        `toast="${toastAfterApprove}", failedApi=${JSON.stringify(decDiff.failedApi)}`
      );

      // If modal approve failed (e.g. null id bug), approve via inline Approve button so we can still test Execute Externally!
      if (!modalApprovedOk) {
        const inlineApprove = page.locator('#approvalsFullList button:has-text("Approve")').first();
        if (await inlineApprove.isVisible().catch(() => false)) {
          await inlineApprove.click();
          await waitShort(page, 900);
        }
      }

      // Switch filter to Approved and check Approval: approved & Exec: not_executed
      currentStepTag = 'flow:approvals-execute';
      await page.selectOption('#approvalsStatusFilter', 'approved');
      await waitShort(page, 800);
      const approvedText = (await page.locator('#approvalsFullList').innerText()).trim();
      const showsApprovedAndNotExec =
        /Approval:\s*approved/i.test(approvedText) && /Exec:\s*not_executed/i.test(approvedText);

      record(
        'Flow-Approvals',
        'Approved item displays Approval: approved & Exec: not_executed',
        showsApprovedAndNotExec,
        `snippet="${approvedText.slice(0, 180).replace(/\n/g, ' ')}"`
      );

      // Click Execute Externally
      const execBtn = page.locator('#approvalsFullList button:has-text("Execute Externally")').first();
      const execBtnVisible = await execBtn.isVisible().catch(() => false);
      if (execBtnVisible) {
        const execSnap = snapshotErrors();
        await execBtn.click();
        await waitShort(page, 1000);
        const execDiff = diffErrors(execSnap);
        const toastAfterExec = (await page.locator('#toastMessage').innerText()).trim();
        const honestFeedback =
          /staged|no external connector|executed|verified/i.test(toastAfterExec) &&
          execDiff.failedApi.length === 0;
        record(
          'Flow-Approvals',
          'Execute Externally returns honest staged/executed feedback',
          honestFeedback,
          `toast="${toastAfterExec}", failedApi=${JSON.stringify(execDiff.failedApi)}`
        );
      } else {
        record('Flow-Approvals', 'Execute Externally button present on approved item', false, 'Button not found');
      }
    }

    // =========================================================================
    // SUITE 3E: SALES -> CREATIVE STUDIO ONBOARDING
    // =========================================================================
    currentStepTag = 'flow:sales-to-creative';
    snap = snapshotErrors();
    await page.click('#navTab-sales');
    await waitShort(page, 700);

    const projectsBeforeOnboard = await page.evaluate(async () => {
      const token = localStorage.getItem('marketing_os_token');
      const r = await fetch('/api/projects', { headers: { Authorization: 'Bearer ' + token } });
      return r.ok ? (await r.json()).projects || [] : [];
    });

    const winBtn = page.locator('#salesDealsContainer button:has-text("Win & Onboard")').first();
    const headerOnboardBtn = page.locator('#view-sales button:has-text("Onboard Deal to Creative Studio")');
    if (await winBtn.isVisible().catch(() => false)) {
      await winBtn.click();
    } else {
      await headerOnboardBtn.click();
    }
    await waitShort(page, 1200);
    errDiff = diffErrors(snap);

    const toastAfterOnboard = (await page.locator('#toastMessage').innerText()).trim();
    const creativeViewVisible = await page.locator('#view-creative').isVisible();
    const projectsAfterOnboard = await page.evaluate(async () => {
      const token = localStorage.getItem('marketing_os_token');
      const r = await fetch('/api/projects', { headers: { Authorization: 'Bearer ' + token } });
      return r.ok ? (await r.json()).projects || [] : [];
    });

    const newCreativeProj = projectsAfterOnboard.find(
      (p) => !projectsBeforeOnboard.some((b) => b.id === p.id)
    );
    let wbsTaskCount = 0;
    if (newCreativeProj) {
      wbsTaskCount = await page.evaluate(async (pid) => {
        const token = localStorage.getItem('marketing_os_token');
        const r = await fetch(`/api/projects/${pid}`, { headers: { Authorization: 'Bearer ' + token } });
        if (!r.ok) return 0;
        const d = await r.json();
        return (d.tasks || []).length;
      }, newCreativeProj.id);
    }

    // Check if Creative Studio UI itself renders the onboarded project or WBS tasks, and check Workbench
    const creativeText = (await page.locator('#view-creative').innerText()).trim();
    await page.click('#navTab-workbench');
    await waitShort(page, 500);
    const wbProjectsText = (await page.locator('#projectCardsList').innerText()).trim();

    record(
      'Flow-Creative',
      'Sales -> Creative Studio onboarding creates new project + WBS tasks',
      Boolean(newCreativeProj) && wbsTaskCount > 0 && creativeViewVisible && wbProjectsText.includes(newCreativeProj?.name || '__MISSING__') && errDiff.failedApi.length === 0,
      `toast="${toastAfterOnboard}", switchedToCreative=${creativeViewVisible}, newProject="${newCreativeProj?.name || 'none'}", wbsTasks=${wbsTaskCount}, inWorkbench=${Boolean(newCreativeProj && wbProjectsText.includes(newCreativeProj.name))}`
    );

    // =========================================================================
    // SUITE 3F: TEAM, KNOWLEDGE BASE (RAG), AND SETTINGS
    // =========================================================================
    currentStepTag = 'inspect:team';
    snap = snapshotErrors();
    await page.click('#navTab-team');
    await waitShort(page, 700);
    errDiff = diffErrors(snap);

    const teamGridCards = await page.locator('#teamMembersGrid > div').count();
    const teamGridText = (await page.locator('#teamMembersGrid').innerText()).trim();
    const hasAddTeamFn = await page.evaluate(() => typeof window.addNewTeamMember === 'function');
    const hasSwitchRoleFn = await page.evaluate(() => typeof window.switchRoleSession === 'function');

    record(
      'Inspect-Team',
      'Team view renders populated team members from backend',
      teamGridCards > 0 && errDiff.pageErrors.length === 0 && errDiff.failedApi.length === 0,
      `cardCount=${teamGridCards}, addNewTeamMemberDefined=${hasAddTeamFn}, switchRoleSessionDefined=${hasSwitchRoleFn}, text="${teamGridText.slice(0, 80)}"`
    );

    // Test Provision Account button in Team if form visible
    if (await page.locator('#addTeamMemberFormBox').isVisible()) {
      const btnSnap = snapshotErrors();
      await page.fill('#tmName', 'Laila QA');
      await page.fill('#tmEmail', 'laila.qa@marketingos.local');
      await page.click('#addTeamMemberFormBox button:has-text("Provision Account")');
      await waitShort(page, 600);
      const btnDiff = diffErrors(btnSnap);
      record(
        'Inspect-Team',
        'Provision Account button in Team view works without ReferenceError',
        hasAddTeamFn && btnDiff.pageErrors.length === 0 && btnDiff.failedApi.length === 0,
        `fnDefined=${hasAddTeamFn}, pageErrors=${JSON.stringify(btnDiff.pageErrors)}, failedApi=${JSON.stringify(btnDiff.failedApi)}`
      );
    }

    // Knowledge Base (RAG)
    currentStepTag = 'inspect:rag';
    snap = snapshotErrors();
    await page.click('#navTab-rag');
    await waitShort(page, 700);

    const ragProjCount = await page.locator('#ragProjectSelect option').count();
    await page.fill('#ragNewDocName', 'QA_Brand_SOP.md');
    await page.fill('#ragNewDocContent', 'Acme Dental Group offers transparent pricing, rapid implant workflows, and 100% digital CAD/CAM diagnostics.');
    await page.click('#view-rag button:has-text("Save to Campaign Knowledge Base")');
    await waitShort(page, 900);

    await page.fill('#ragQueryInput', 'transparent pricing CAD/CAM diagnostics');
    await page.click('#view-rag button:has-text("Search Assets")');
    await waitShort(page, 900);
    errDiff = diffErrors(snap);

    const ragResultsText = (await page.locator('#ragSearchResultsList').innerText()).trim();
    const ragBadgeText = (await page.locator('#ragChunkCountBadge').innerText()).trim();
    const ragSearchWorked =
      ragProjCount > 0 &&
      ragResultsText.includes('QA_Brand_SOP.md') &&
      errDiff.pageErrors.length === 0 &&
      errDiff.failedApi.length === 0;

    record(
      'Inspect-RAG',
      'Knowledge Base ingests document and returns semantic search hits',
      ragSearchWorked,
      `projects=${ragProjCount}, badge="${ragBadgeText}", hitFound=${ragResultsText.includes('QA_Brand_SOP.md')}, failedApi=${JSON.stringify(errDiff.failedApi)}`
    );

    // Settings (Admin Settings)
    currentStepTag = 'inspect:settings';
    snap = snapshotErrors();
    await page.click('#navTab-adminSettings');
    await waitShort(page, 900);
    errDiff = diffErrors(snap);

    const llmCardCount = await page.locator('#llmProvidersContainer > div').count();
    const wdMetricCards = await page.locator('#watchdogMetricsCards > div').count();
    const wdStatusText = (await page.locator('#healthWatchdogStatus').innerText()).trim();
    const settingsText = (await page.locator('#view-adminSettings').innerText()).trim();
    const hasChangePasswordForm =
      (await page.locator('#view-adminSettings input[type="password"]').count()) > 0 ||
      /change password|update password/i.test(settingsText);

    record(
      'Inspect-Settings',
      'Settings renders all 6 LLM providers & Watchdog status cleanly',
      llmCardCount >= 6 && wdMetricCards >= 6 && wdStatusText.length > 0 && errDiff.pageErrors.length === 0 && errDiff.failedApi.length === 0,
      `llmProviders=${llmCardCount}, watchdogCards=${wdMetricCards}, watchdogStatus="${wdStatusText}", failedApi=${JSON.stringify(errDiff.failedApi)}`
    );

    record(
      'Inspect-Settings',
      'Change Password form exists in Settings UI (if implemented)',
      hasChangePasswordForm,
      hasChangePasswordForm ? 'Change Password UI found' : 'No Change Password form found in #view-adminSettings (API /api/auth/change-password has no UI binding)'
    );

    // =========================================================================
    // SUITE 3G: RBAC IN UI AS CLIENT (client@marketingos.local / Client123!)
    // =========================================================================
    currentStepTag = 'rbac:signout-and-client-login';
    await page.click('#signOutBtn');
    await waitShort(page, 400);
    const authReopened = await page.locator('#authModal').isVisible();
    record('RBAC-Client', 'Sign out reopens login modal', authReopened);

    snap = snapshotErrors();
    await page.fill('#loginEmailInput', 'client@marketingos.local');
    await page.fill('#loginPassInput', 'Client123!');
    const [clientLoginRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/login'), { timeout: 10000 }),
      page.click('#loginSubmitBtn')
    ]);
    if (clientLoginRes.status() !== 200) {
      throw new Error(`Client login failed with HTTP ${clientLoginRes.status()}: ${await clientLoginRes.text()}`);
    }
    await waitShort(page, 1200);
    errDiff = diffErrors(snap);

    const clientRoleChip = (await page.locator('#headerRoleChip').innerText()).trim();
    const settingsTabVisibleForClient = await page.locator('#navTab-adminSettings').isVisible();
    const newProjBtnVisibleForClient = await page.locator('#headerNewProjectBtn').isVisible();
    const cleanSlateVisibleForClient = await page.locator('button:has-text("Zero-Data Slate")').isVisible();

    record(
      'RBAC-Client',
      'Client login loads without uncaught JS errors or unexpected 403/500 API noise',
      clientRoleChip.includes('CLIENT') && errDiff.pageErrors.length === 0 && errDiff.failedApi.length === 0,
      `role="${clientRoleChip}", pageErrors=${errDiff.pageErrors.length}, failedApi=${JSON.stringify(errDiff.failedApi)}`
    );

    record(
      'RBAC-Client',
      'Settings tab hidden for client role',
      !settingsTabVisibleForClient,
      `settingsTabVisible=${settingsTabVisibleForClient}`
    );

    record(
      'RBAC-Client',
      'Admin/internal controls (+ New Project, Zero-Data Slate) hidden or cleanly blocked for client',
      !newProjBtnVisibleForClient && !cleanSlateVisibleForClient,
      `headerNewProjectBtnVisible=${newProjBtnVisibleForClient}, cleanSlateVisible=${cleanSlateVisibleForClient}`
    );

    // Click through visible client tabs and verify zero uncaught exceptions or 403/500 API errors
    const clientTabsToCheck = ['navTab-overview', 'navTab-workbench', 'navTab-approvals', 'navTab-research', 'navTab-sales', 'navTab-creative', 'navTab-team', 'navTab-rag'];
    currentStepTag = 'rbac:client-nav-sweep';
    snap = snapshotErrors();
    const visibleClientTabNames = [];
    for (const tabId of clientTabsToCheck) {
      const loc = page.locator(`#${tabId}`);
      if (await loc.isVisible()) {
        visibleClientTabNames.push(tabId);
        await loc.click();
        await waitShort(page, 400);
      }
    }
    errDiff = diffErrors(snap);
    record(
      'RBAC-Client',
      'Client navigation across all visible tabs produces zero JS errors and zero 4xx/5xx API failures',
      errDiff.pageErrors.length === 0 && errDiff.consoleErrors.length === 0 && errDiff.failedApi.length === 0,
      `visited=${visibleClientTabNames.length}, pageErrors=${errDiff.pageErrors.length}, consoleErrors=${errDiff.consoleErrors.length}, failedApi=${JSON.stringify(errDiff.failedApi)}`
    );

    // =========================================================================
    // SUITE 3H: RESPONSIVE MOBILE VIEWPORT (390x844) & DARK/LIGHT THEME TOGGLE
    // =========================================================================
    // Log back in as admin to test full app responsive & theme
    currentStepTag = 'responsive:admin-relogin';
    await page.click('#signOutBtn');
    await waitShort(page, 300);
    await page.fill('#loginEmailInput', 'admin@marketingos.local');
    await page.fill('#loginPassInput', 'Admin123!');
    const [reloginRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/login'), { timeout: 10000 }),
      page.click('#loginSubmitBtn')
    ]);
    if (reloginRes.status() !== 200) {
      throw new Error(`Admin re-login failed with HTTP ${reloginRes.status()}: ${await reloginRes.text()}`);
    }
    await waitShort(page, 800);

    // Theme toggle test
    currentStepTag = 'theme:toggle';
    const initialDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await page.click('#themeToggleBtn');
    await waitShort(page, 150);
    const afterFirstClick = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await page.click('#themeToggleBtn');
    await waitShort(page, 150);
    const afterSecondClick = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    record(
      'UI-Theme',
      'Dark/Light theme toggle switches html.dark cleanly',
      afterFirstClick !== initialDark && afterSecondClick === initialDark,
      `initial=${initialDark}, after1=${afterFirstClick}, after2=${afterSecondClick}`
    );

    // Mobile responsive viewport check (390x844)
    currentStepTag = 'responsive:mobile-390x844';
    await page.setViewportSize({ width: 390, height: 844 });
    await waitShort(page, 300);

    const mobileTabs = [
      { tab: 'navTab-overview', label: 'Overview' },
      { tab: 'navTab-workbench', label: 'Workbench' },
      { tab: 'navTab-sales', label: 'Sales' },
      { tab: 'navTab-approvals', label: 'Approvals' },
      { tab: 'navTab-adminSettings', label: 'Settings' }
    ];

    const overflowIssues = [];
    for (const mt of mobileTabs) {
      await page.locator(`#${mt.tab}`).click();
      await waitShort(page, 400);
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth
      }));
      if (metrics.scrollWidth > metrics.innerWidth + 8) {
        overflowIssues.push(`${mt.label}: scrollWidth=${metrics.scrollWidth} > innerWidth=${metrics.innerWidth}`);
      }
    }

    // Also test a modal on mobile viewport (#guidelinesModal via Workbench Playbook button, and #mcpModal check)
    await page.locator('#navTab-workbench').click();
    await waitShort(page, 300);
    await page.locator('#view-workbench button:has-text("Campaign Playbook")').click();
    await waitShort(page, 300);
    const modalBox = await page.locator('#guidelinesModal > div').boundingBox();
    const modalFitsMobile = modalBox ? modalBox.width <= 390 && modalBox.x >= 0 : false;
    await page.locator('#guidelinesModal button:has-text("Cancel")').click().catch(() => {});
    await waitShort(page, 200);

    record(
      'UI-Responsive',
      'Mobile viewport (390x844) has no severe horizontal overflow across core views & modals',
      overflowIssues.length === 0 && modalFitsMobile,
      `overflows=${overflowIssues.length ? overflowIssues.join('; ') : 'none'}, modalWidth=${modalBox ? Math.round(modalBox.width) : 'n/a'}`
    );

    // Check header "Engine: Online" button (openMcpModal) at desktop width
    currentStepTag = 'ui:header-mcp-button';
    await page.setViewportSize({ width: 1440, height: 900 });
    await waitShort(page, 200);
    snap = snapshotErrors();
    const mcpBtn = page.locator('header button:has-text("Engine: Online")');
    if (await mcpBtn.isVisible()) {
      await mcpBtn.click();
      await waitShort(page, 250);
    }
    errDiff = diffErrors(snap);
    const mcpModalOpen = await page.locator('#mcpModal').isVisible();
    record(
      'UI-Modals',
      'Header "Engine: Online" button opens #mcpModal without ReferenceError',
      mcpModalOpen && errDiff.pageErrors.length === 0,
      `mcpModalOpen=${mcpModalOpen}, pageErrors=${JSON.stringify(errDiff.pageErrors)}`
    );

    await context.close();
  } finally {
    if (browser) await browser.close();
    await stopServer(server);
  }

  // =========================================================================
  // FINAL REPORT SUMMARY
  // =========================================================================
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log('\n====================================================================');
  console.log(`PLAYWRIGHT E2E SUMMARY: ${passed} PASSED / ${failed} FAILED (Total: ${results.length})`);
  console.log(`Page Errors: ${globalDiagnostics.pageErrors.length}`);
  console.log(`Console Errors: ${globalDiagnostics.consoleErrors.length}`);
  console.log(`Unexpected >=400 API Responses: ${globalDiagnostics.failedApiResponses.length}`);
  console.log('====================================================================');

  if (globalDiagnostics.pageErrors.length) {
    console.log('\n--- PAGE ERRORS ---');
    for (const pe of globalDiagnostics.pageErrors) {
      console.log(`  [${pe.step}] ${pe.message}\n    ${pe.stack}`);
    }
  }
  if (globalDiagnostics.consoleErrors.length) {
    console.log('\n--- CONSOLE ERRORS ---');
    for (const ce of globalDiagnostics.consoleErrors) {
      console.log(`  [${ce.step}] ${ce.text}`);
    }
  }
  if (globalDiagnostics.failedApiResponses.length) {
    console.log('\n--- UNEXPECTED >=400 API RESPONSES ---');
    for (const fa of globalDiagnostics.failedApiResponses) {
      console.log(`  [${fa.step}] ${fa.method} ${fa.url} -> HTTP ${fa.status} :: ${fa.body}`);
    }
  }
  if (failed > 0) {
    console.log('\n--- FAILED CHECKS ---');
    for (const r of results.filter((x) => !x.passed)) {
      console.log(`  [${r.suite}] ${r.name}: ${r.details}`);
    }
  }

  const reportPath = '/tmp/playwright-e2e-report.json';
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ summary: { total: results.length, passed, failed }, results, diagnostics: globalDiagnostics }, null, 2)
  );
  console.log(`\nFull JSON report written to ${reportPath}`);

  process.exit(failed === 0 && globalDiagnostics.pageErrors.length === 0 && globalDiagnostics.consoleErrors.length === 0 && globalDiagnostics.failedApiResponses.length === 0 ? 0 : 1);
}

runSuite().catch((err) => {
  console.error('Fatal Playwright runner error:', err);
  process.exit(2);
});
