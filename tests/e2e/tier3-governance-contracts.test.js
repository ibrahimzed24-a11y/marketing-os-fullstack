/**
 * tests/e2e/tier3-governance-contracts.test.js
 * 
 * Tier 3: Governance Contracts, 5-Stage Loop, Approval Gates & Cross-Interaction:
 * 1. TEST-GOV-01: 5-Stage Loop task execution and stage progression
 * 2. TEST-GOV-02: Deliverable Output Contract validation (output_json structure & quality_audit)
 * 3. TEST-GOV-03: Admin Report Markdown Contract format and verdict
 * 4. TEST-GOV-04: Human-in-the-Loop Approval Gate transition to 'delivered'
 * 5. TEST-GOV-05: RBAC transition enabling client preview upon delivery
 * 6. TEST-GOV-06: Multi-View UI synchronization in Playwright
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  setupE2EServer,
  loginAs,
  launchBrowser,
  assertNoSlop
} = require('./harness');

describe('Tier 3: Governance Contracts & 5-Stage Loop', () => {
  let server;
  let adminAuth;
  let clientAuth;
  let projectId;
  let approvalTaskId;
  let approvalId;

  before(async () => {
    server = await setupE2EServer();
    adminAuth = await loginAs(server.baseUrl, 'admin');
    clientAuth = await loginAs(server.baseUrl, 'client');

    const projRes = await fetch(`${server.baseUrl}/api/projects`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        name: 'Governance & Compliance Campaign',
        client_name: 'Valioz Health Governance',
        department: 'creative',
        type: 'landing-page',
        goal: 'Verify 5-stage loop and regulatory approval gates'
      })
    });
    const projData = await projRes.json();
    assert.strictEqual(projRes.status, 200);
    projectId = projData.id;

    // Grant client access to project
    await fetch(`${server.baseUrl}/api/projects/${projectId}/members`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({ user_id: clientAuth.user.id })
    });
  });

  after(async () => {
    if (server) {
      server.cleanup();
    }
  });

  it('TEST-GOV-01: Executes 5-Stage Loop with deterministic lifecycle progression', async () => {
    // Stage 1: Plan - Create task with brief and parameters
    const createRes = await fetch(`${server.baseUrl}/api/tasks`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        project_id: projectId,
        title: 'Stage-Gated Landing Page Deployment',
        pipeline: 'landing-page',
        department: 'creative',
        priority: 'high',
        input: {
          client_brand: 'Valioz Health',
          compliance: 'CASL and CDCP Standards'
        }
      })
    });
    assert.strictEqual(createRes.status, 200);
    const createData = await createRes.json();
    approvalTaskId = createData.id;
    assert.strictEqual(createData.status, 'draft', 'Initial task stage must be draft');

    // Stage 2 & 3: Assign & Execute - Trigger task execution
    const runRes = await fetch(`${server.baseUrl}/api/tasks/${approvalTaskId}/run`, {
      method: 'POST',
      headers: adminAuth.headers
    });
    assert.strictEqual(runRes.status, 200);
    const runData = await runRes.json();
    assert.strictEqual(runData.ok, true);

    // Stage 4: Verify - Verify task transitioned to in_review and queued approval
    const taskRes = await fetch(`${server.baseUrl}/api/tasks/${approvalTaskId}`, {
      headers: adminAuth.headers
    });
    const taskData = await taskRes.json();
    assert.strictEqual(taskData.task.status, 'in_review', 'Task must transition to in_review upon execution');

    // Stage 5: Report - Activity log records execution
    const statsRes = await fetch(`${server.baseUrl}/api/overview/stats`, {
      headers: adminAuth.headers
    });
    const statsData = await statsRes.json();
    const taskActivity = (statsData.recent_activity || []).filter(a => a.task_id === approvalTaskId);
    assert.ok(taskActivity.length >= 1, 'Lifecycle activity trail must be recorded');
  });

  it('TEST-GOV-02: Validates Deliverable Output Contract schema and quality audit', async () => {
    const taskRes = await fetch(`${server.baseUrl}/api/tasks/${approvalTaskId}`, {
      headers: adminAuth.headers
    });
    const taskData = await taskRes.json();
    const output = typeof taskData.task.output_json === 'string'
      ? JSON.parse(taskData.task.output_json)
      : taskData.task.output_json;

    // Output JSON Deliverable Contract assertions
    assert.ok(output.title, 'output_json must specify deliverable title');
    assert.ok(output.summary, 'output_json must specify deliverable summary');
    assert.ok(output.html || output.deliverable || output.headlines || output.palette, 'output_json must contain concrete deliverable payload');

    // Quality Audit Contract
    assert.ok(output.quality_audit, 'output_json must contain quality_audit');
    assert.strictEqual(typeof output.quality_audit.passed_quality_gate, 'boolean');
    assert.strictEqual(typeof output.quality_audit.humanizer_score, 'number');

    // Metadata Contract
    assert.ok(output.metadata, 'output_json must contain metadata');
    assert.strictEqual(output.metadata.status, 'succeeded');
    assert.ok(output.metadata.executed_at, 'metadata must include timestamp');

    // Zero slop enforcement on deliverable
    assertNoSlop(output, 'Tier 3 Deliverable Contract');
  });

  it('TEST-GOV-03: Validates Admin Report Markdown Contract and verdict', async () => {
    const taskRes = await fetch(`${server.baseUrl}/api/tasks/${approvalTaskId}`, {
      headers: adminAuth.headers
    });
    const taskData = await taskRes.json();
    const reportMd = taskData.task.report_md || '';

    assert.ok(reportMd.length > 50, 'Report markdown must be populated');
    assert.ok(
      reportMd.includes('**Verdict:** Ready to Deliver') || reportMd.includes('Ready to Deliver'),
      'Report markdown must state Ready to Deliver verdict'
    );
    assertNoSlop(reportMd, 'Tier 3 Report Markdown');
  });

  it('TEST-GOV-04: Enforces Human-in-the-Loop Approval Gate transition to delivered', async () => {
    // 1. Fetch pending approvals to locate the one created by landing page task
    const appRes = await fetch(`${server.baseUrl}/api/approvals`, {
      headers: adminAuth.headers
    });
    assert.strictEqual(appRes.status, 200);
    const appData = await appRes.json();
    const pendingApp = appData.approvals.find(a => a.task_id === approvalTaskId);
    assert.ok(pendingApp, 'Pending approval must exist for the critical landing page task');
    approvalId = pendingApp.id;
    assert.strictEqual(pendingApp.status, 'pending');

    // 2. Admin submits decision: 'approve'
    const decisionRes = await fetch(`${server.baseUrl}/api/approvals/${approvalId}/decision`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        decision: 'approve',
        notes: 'Verified compliance with brand guidelines and CASL requirements.'
      })
    });
    assert.strictEqual(decisionRes.status, 200);
    const decisionData = await decisionRes.json();
    assert.strictEqual(decisionData.ok, true);

    // 3. Verify task status has transitioned to 'delivered'
    const taskRes = await fetch(`${server.baseUrl}/api/tasks/${approvalTaskId}`, {
      headers: adminAuth.headers
    });
    const taskData = await taskRes.json();
    assert.strictEqual(taskData.task.status, 'delivered', 'Task status must transition from in_review to delivered upon approval');
  });

  it('TEST-GOV-05: Permits client preview access after deliverable is transitioned to delivered', async () => {
    // Client attempts to preview the delivered task
    const res = await fetch(`${server.baseUrl}/api/tasks/${approvalTaskId}/preview`, {
      headers: clientAuth.headers
    });
    assert.strictEqual(res.status, 200, 'Client must now be allowed to preview delivered task');
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.ok(data.inlinedHtml || data.source, 'Preview data must be returned to client');
  });

  it('TEST-GOV-06: Synchronizes multi-view UI state in Playwright without refresh', async () => {
    const pw = await launchBrowser();
    try {
      await pw.page.goto(server.baseUrl, { waitUntil: 'networkidle' });
      await pw.page.fill('#loginEmailInput', adminAuth.user.email);
      await pw.page.fill('#loginPassInput', 'Admin123!');
      await pw.page.click('#loginSubmitBtn');
      await pw.page.waitForSelector('#authModal.hidden', { state: 'attached', timeout: 8000 });

      // Navigate to Workbench view
      await pw.page.evaluate(() => {
        if (typeof window.switchMainView === 'function') {
          window.switchMainView('workbench');
        }
      });
      await pw.page.waitForTimeout(600);

      // Verify header role chip
      const roleChip = await pw.page.locator('#headerRoleChip').innerText();
      assert.ok(roleChip.includes('SUPER ADMIN') || roleChip.includes('ADMIN'), 'Role chip must indicate Admin');

      // Navigate to Overview view
      await pw.page.evaluate(() => {
        if (typeof window.switchMainView === 'function') {
          window.switchMainView('overview');
        }
      });
      await pw.page.waitForTimeout(600);

      // Verify no uncaught browser page errors occurred
      assert.strictEqual(pw.pageErrors.length, 0, `Browser uncaught errors: ${pw.pageErrors.join(', ')}`);
    } finally {
      await pw.close();
    }
  });
});
