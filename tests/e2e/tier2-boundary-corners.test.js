/**
 * tests/e2e/tier2-boundary-corners.test.js
 * 
 * Tier 2: Boundary, Corner & Security Error Cases:
 * 1. TEST-BND-01: Empty brief / title rejection (400)
 * 2. TEST-BND-02: Missing project_id rejection (400)
 * 3. TEST-BND-03: Unknown pipeline rejection (400)
 * 4. TEST-BND-04: Invalid department rejection (400)
 * 5. TEST-BND-05: Missing harness file fallback handling
 * 6. TEST-BND-06: Ungrounded slop rejection gate & humanizer anti-slop linter
 * 7. TEST-BND-07: RBAC 401 Unauthorized & 403 Forbidden enforcement
 * 8. TEST-BND-08: Idempotency 409 Conflict on concurrent/already running task
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  setupE2EServer,
  loginAs,
  assertNoSlop,
  FORBIDDEN_SLOP_REGEX
} = require('./harness');
const { lintDeliverableQuality } = require('../../server/skillEngine');

describe('Tier 2: Boundary, Corner Cases & Fault Tolerance', () => {
  let server;
  let adminAuth;
  let clientAuth;
  let memberAuth;
  let projectId;

  before(async () => {
    server = await setupE2EServer();
    adminAuth = await loginAs(server.baseUrl, 'admin');
    clientAuth = await loginAs(server.baseUrl, 'client');
    memberAuth = await loginAs(server.baseUrl, 'member');

    // Create a base project for boundary tests
    const projRes = await fetch(`${server.baseUrl}/api/projects`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        name: 'Boundary Test Workspace',
        client_name: 'Test Health Corp',
        department: 'sales',
        type: 'email-campaign'
      })
    });
    const projData = await projRes.json();
    assert.strictEqual(projRes.status, 200);
    projectId = projData.id;
  });

  after(async () => {
    if (server) {
      server.cleanup();
    }
  });

  it('TEST-BND-01: Rejects empty title with 400 Bad Request', async () => {
    const res = await fetch(`${server.baseUrl}/api/tasks`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        project_id: projectId,
        title: '',
        pipeline: 'market-intel'
      })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'title required');
  });

  it('TEST-BND-02: Rejects missing project_id with 400 Bad Request', async () => {
    const res = await fetch(`${server.baseUrl}/api/tasks`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        title: 'Task without project',
        pipeline: 'market-intel'
      })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'project_id required');
  });

  it('TEST-BND-03: Rejects unknown / malformed pipeline with 400 Bad Request', async () => {
    const res = await fetch(`${server.baseUrl}/api/tasks`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        project_id: projectId,
        title: 'Task with malformed pipeline',
        pipeline: 'non-existent-pipeline-xyz'
      })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'Unknown pipeline');
  });

  it('TEST-BND-04: Rejects invalid department with 400 Bad Request', async () => {
    const res = await fetch(`${server.baseUrl}/api/tasks`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        project_id: projectId,
        title: 'Task with invalid department',
        pipeline: 'market-intel',
        department: 'invalid-department-name'
      })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'Invalid department');
  });

  it('TEST-BND-05: Handles project with 0 harness files gracefully without crash', async () => {
    // Create empty project with no uploads
    const emptyProjRes = await fetch(`${server.baseUrl}/api/projects`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        name: 'Empty Harness Project',
        client_name: 'No Asset Clinic',
        department: 'creative',
        type: 'landing-page',
        goal: 'Test zero-harness fallback'
      })
    });
    assert.strictEqual(emptyProjRes.status, 200);
    const emptyProj = await emptyProjRes.json();

    // Create and run task
    const taskRes = await fetch(`${server.baseUrl}/api/tasks`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        project_id: emptyProj.id,
        title: 'Landing Page Without Harness Files',
        pipeline: 'landing-page',
        department: 'creative'
      })
    });
    assert.strictEqual(taskRes.status, 200);
    const task = await taskRes.json();

    const runRes = await fetch(`${server.baseUrl}/api/tasks/${task.id}/run`, {
      method: 'POST',
      headers: adminAuth.headers
    });
    assert.strictEqual(runRes.status, 200);
    const runData = await runRes.json();
    assert.strictEqual(runData.ok, true);

    // Verify preview endpoint also handles 0 harness files without crash
    const prevRes = await fetch(`${server.baseUrl}/api/tasks/${task.id}/preview`, {
      headers: adminAuth.headers
    });
    assert.strictEqual(prevRes.status, 200);
  });

  it('TEST-BND-06: Anti-slop quality linter penalizes stock AI vocabulary and rejects slop', () => {
    // 1. Test slop detection regex against known prohibited strings
    const fakeTamString = 'We anticipate a $4.2B Global Market opportunity across the sector.';
    assert.ok(FORBIDDEN_SLOP_REGEX.test(fakeTamString), 'Must detect $4.2B Global Market slop');

    const fakeDoctorString = 'Lead Contact: Dr. Marcus Vance, phone +1 416-555-0142.';
    assert.ok(FORBIDDEN_SLOP_REGEX.test(fakeDoctorString), 'Must detect Dr. Marcus Vance and 555-01 phone');

    const purpleGradientString = 'header class="bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600"';
    assert.ok(FORBIDDEN_SLOP_REGEX.test(purpleGradientString), 'Must detect forbidden purple gradient');

    // 2. Test quality linter penalties on inflated AI prose
    const slopProse = `
      Let's dive in. This cutting-edge solution is not just a tool, but a testament to our ever-evolving tapestry of seamless excellence.
      The real question is how we foster and unlock the power of game-changer workflows — that is the real win.
    `;
    const audit = lintDeliverableQuality(slopProse);
    assert.strictEqual(audit.passed_quality_gate, false, 'Slop prose must fail quality gate');
    assert.ok(audit.humanizer_score < 75, `Score (${audit.humanizer_score}) must be below 75 threshold`);
    assert.ok(audit.tells_found && audit.tells_found.length >= 3, 'Must identify multiple AI vocabulary tells');

    // 3. Test clean, grounded text passes quality gate
    const cleanProse = `
      Billings Bridge Dental Centre operates in Ottawa, Ontario. 
      The clinic provides comprehensive oral health services to over 1,200 local patients annually. 
      The proposal offers a $499 turnkey setup with 30 free days of the AI Growth Agent.
    `;
    const cleanAudit = lintDeliverableQuality(cleanProse);
    assert.strictEqual(cleanAudit.passed_quality_gate, true, 'Clean grounded prose must pass quality gate');
    assert.ok(cleanAudit.humanizer_score >= 85, 'Clean text should achieve high humanizer score');
  });

  it('TEST-BND-07: Enforces RBAC: 401 for unauthenticated, 403 for unauthorized role', async () => {
    // 1. Unauthenticated access receives 401
    const unauthRes = await fetch(`${server.baseUrl}/api/projects`);
    assert.strictEqual(unauthRes.status, 401, 'Request without token must receive 401 Unauthorized');

    // 2. Client role cannot create projects (requires admin/manager)
    const clientProjRes = await fetch(`${server.baseUrl}/api/projects`, {
      method: 'POST',
      headers: clientAuth.headers,
      body: JSON.stringify({
        name: 'Unauthorized Client Project',
        client_name: 'Client Co',
        department: 'sales',
        type: 'email-campaign'
      })
    });
    assert.strictEqual(clientProjRes.status, 403, 'Client role must receive 403 Forbidden when creating projects');

    // 3. Invalid credentials receive 401 on login
    const badLoginRes = await fetch(`${server.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@marketingos.local', password: 'WrongPassword123!' })
    });
    assert.strictEqual(badLoginRes.status, 401, 'Invalid password must receive 401 Unauthorized');
  });

  it('TEST-BND-08: Prevents concurrent execution with 409 Conflict when task is already running', async () => {
    // Create task
    const taskRes = await fetch(`${server.baseUrl}/api/tasks`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        project_id: projectId,
        title: 'Idempotency Concurrency Guard Test',
        pipeline: 'landing-page',
        department: 'creative'
      })
    });
    assert.strictEqual(taskRes.status, 200);
    const task = await taskRes.json();

    // Use test database connection to set task status to 'running'
    const Database = require('better-sqlite3');
    const localDb = new Database(server.dbPath);
    localDb.prepare("UPDATE tasks SET status = 'running' WHERE id = ?").run(task.id);
    localDb.close();

    // Now attempt to run the task while it is in 'running' status
    const runRes = await fetch(`${server.baseUrl}/api/tasks/${task.id}/run`, {
      method: 'POST',
      headers: adminAuth.headers
    });
    assert.strictEqual(runRes.status, 409, 'Attempting to run a task currently in "running" status must return 409 Conflict');
    const data = await runRes.json();
    assert.strictEqual(data.error, 'Task is currently running. Please wait for completion.');
  });
});
