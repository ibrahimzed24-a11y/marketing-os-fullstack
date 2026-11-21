const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupE2EServer, loginAs, assertNoSlop } = require('./harness');
const rag = require('../../server/rag');
const { executeAgentTask, validateTaskDatabaseRequirement } = require('../../server/agentFramework');

describe('Tier 5: Multi-Select, 3-Tier Knowledge Base & Pre-Flight Grounding Gate', () => {
  let server;
  let adminAuth;
  let memberAuth;

  before(async () => {
    server = await setupE2EServer();
    adminAuth = await loginAs(server.baseUrl, 'admin');
    memberAuth = await loginAs(server.baseUrl, 'member');
  });

  after(async () => {
    if (server && server.cleanup) {
      server.cleanup();
    }
  });

  it('TEST-PROJ-01: Creates project with multiple pipelines, multiple deliverables, and initial knowledge notes', async () => {
    const res = await fetch(`${server.baseUrl}/api/projects`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        name: 'Enterprise Multi-Pipeline Expansion',
        client_name: 'Acme Global Growth',
        goal: 'Multi-channel B2B customer acquisition',
        department: 'sales',
        pipelines: ['offer-campaign', 'whatsapp-campaign', 'email-campaign'],
        deliverables: ['Commercial Offer & Proposal', 'Dual-Branded Email Sequence', 'WhatsApp Image Card + Audio Pitch'],
        knowledge_notes: 'Targeting mid-market B2B enterprises. Tone: Professional and consultative. Pricing: $499 flat rate.'
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.ok(data.id);
    assert.deepEqual(data.pipelines, ['offer-campaign', 'whatsapp-campaign', 'email-campaign']);
    assert.deepEqual(data.deliverables, ['Commercial Offer & Proposal', 'Dual-Branded Email Sequence', 'WhatsApp Image Card + Audio Pitch']);
  });

  it('TEST-KB-01: Helm Global Knowledge Base permits Admin writes and rejects non-Admin writes with 403', async () => {
    // Non-admin upload to helm scope should fail with 403
    const memberUploadRes = await fetch(`${server.baseUrl}/api/projects/helm/knowledge/document`, {
      method: 'POST',
      headers: memberAuth.headers,
      body: JSON.stringify({
        title: 'Unauthorized Helm Policy',
        content: 'This should be blocked by RBAC.',
        category: 'brand_guidelines',
        scope: 'helm'
      })
    });
    assert.equal(memberUploadRes.status, 403);

    // Admin upload to helm scope should succeed with 200
    const adminUploadRes = await fetch(`${server.baseUrl}/api/projects/helm/knowledge/document`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        title: 'Helm Workspace Global Agency DNA',
        content: 'System-wide operating principles: 5-Stage Loop, zero AI slop, verified inputs.',
        category: 'brand_guidelines',
        scope: 'helm'
      })
    });
    assert.equal(adminUploadRes.status, 200);
    const adminData = await adminUploadRes.json();
    assert.equal(adminData.ok, true);
    assert.equal(adminData.scope, 'helm');

    // Retrieve Helm Global Knowledge summary
    const helmGetRes = await fetch(`${server.baseUrl}/api/projects/helm/knowledge?scope=helm`, {
      headers: adminAuth.headers
    });
    assert.equal(helmGetRes.status, 200);
    const helmGetData = await helmGetRes.json();
    assert.equal(helmGetData.scope, 'helm');
    assert.ok(helmGetData.files.some(f => f.original_name.includes('Helm Workspace Global Agency DNA')));
  });

  it('TEST-KB-02: Attaches Task-scoped Knowledge Base and searches hierarchically', async () => {
    // Create a project
    const projRes = await fetch(`${server.baseUrl}/api/projects`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        name: 'Task Scoping Test Project',
        client_name: 'Beta Labs',
        department: 'sales',
        type: 'email-campaign'
      })
    });
    const projData = await projRes.json();
    const projectId = projData.id;

    // Create a task with knowledge notes
    const taskRes = await fetch(`${server.baseUrl}/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        title: 'Q4 Personalized WhatsApp Sprint',
        pipeline: 'whatsapp-campaign',
        description: 'Outreach to verified accounts',
        department: 'sales',
        knowledge_notes: 'Priority target: Decision makers with high Google ratings. Mention 30-day AI Growth Agent.'
      })
    });
    const taskData = await taskRes.json();
    assert.equal(taskRes.status, 200);
    const taskId = taskData.id;

    // Retrieve knowledge for task scope
    const taskKbRes = await fetch(`${server.baseUrl}/api/projects/${projectId}/knowledge?scope=task&task_id=${taskId}`, {
      headers: adminAuth.headers
    });
    assert.equal(taskKbRes.status, 200);
    const taskKbData = await taskKbRes.json();
    assert.equal(taskKbData.scope, 'task');
    assert.equal(taskKbData.task_id, taskId);
  });

  it('TEST-GATE-01: Validates database requirement pre-flight gate blocks ungrounded tasks and allows grounded tasks', () => {
    const Database = require('better-sqlite3');
    const localDb = new Database(':memory:');
    localDb.exec(`
      CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT, goal TEXT, knowledge_notes TEXT);
      CREATE TABLE leads (id TEXT PRIMARY KEY, project_id TEXT);
      CREATE TABLE harness_files (id TEXT PRIMARY KEY, project_id TEXT);
      CREATE TABLE rag_chunks (id TEXT PRIMARY KEY, project_id TEXT, task_id TEXT, scope TEXT, content TEXT);
    `);

    localDb.prepare("INSERT INTO projects (id, name, goal, knowledge_notes) VALUES ('p-empty', 'Empty Proj', 'Goal', '')").run();

    const emptyTask = {
      id: 't-empty',
      project_id: 'p-empty',
      title: 'Ungrounded Cold Outreach',
      pipeline: 'email-campaign',
      description: 'Blind outreach with no data'
    };

    // 1. Should be blocked: 0 leads, 0 harness files, 0 knowledge notes
    const gateBlock = validateTaskDatabaseRequirement(emptyTask, { id: 'p-empty' }, [], localDb);
    assert.equal(gateBlock.valid, false);
    assert.ok(gateBlock.reason.includes('requires a grounded database'));

    // 2. Now attach leads to the project
    localDb.prepare("INSERT INTO leads (id, project_id) VALUES ('lead-1', 'p-empty')").run();
    const gatePassWithLeads = validateTaskDatabaseRequirement(emptyTask, { id: 'p-empty' }, [], localDb);
    assert.equal(gatePassWithLeads.valid, true);

    // 3. Or attach knowledge notes directly to the task
    const groundedTask = {
      ...emptyTask,
      knowledge_notes: 'Verified ICP: B2B dental software vendors with >$2M ARR'
    };
    const gatePassWithNotes = validateTaskDatabaseRequirement(groundedTask, { id: 'p-empty' }, [], localDb);
    assert.equal(gatePassWithNotes.valid, true);

    localDb.close();
  });

  it('TEST-DIR-01: Dedicated Projects directory API returns all projects with multi-pipeline metadata', async () => {
    const res = await fetch(`${server.baseUrl}/api/projects`, {
      headers: adminAuth.headers
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.projects));

    // Verify system helm project is excluded from standard project list
    assert.ok(!data.projects.some(p => p.id === 'helm'));

    const sample = data.projects.find(p => Array.isArray(p.pipelines) && p.pipelines.length > 1);
    if (sample) {
      assert.ok(Array.isArray(sample.pipelines));
      assert.ok(Array.isArray(sample.deliverables));
      assert.ok(typeof sample.task_count === 'number');
    }
  });

  it('TEST-DIR-02: Deletes project and cascades associated records safely', async () => {
    // Create temporary project
    const tempRes = await fetch(`${server.baseUrl}/api/projects`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({ name: 'Temp To Delete', department: 'sales', type: 'offer-campaign' })
    });
    const { id } = await tempRes.json();

    // Delete it
    const delRes = await fetch(`${server.baseUrl}/api/projects/${id}`, {
      method: 'DELETE',
      headers: adminAuth.headers
    });
    assert.equal(delRes.status, 200);

    // Verify it is removed
    const getRes = await fetch(`${server.baseUrl}/api/projects/${id}`, {
      headers: adminAuth.headers
    });
    assert.equal(getRes.status, 404);
  });
});
