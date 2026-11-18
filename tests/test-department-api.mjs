import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PORT = 3026;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TEST_DB_PATH = `/tmp/marketing-os-department-api-test-${Date.now()}.db`;

// Clean up any previous test database
try {
  fs.rmSync(TEST_DB_PATH, { force: true });
  fs.rmSync(`${TEST_DB_PATH}-wal`, { force: true });
  fs.rmSync(`${TEST_DB_PATH}-shm`, { force: true });
} catch (_) {}

console.log('====================================================');
console.log('🧪 MARKETING OS: DEPARTMENT API & PERSISTENCE TEST SUITE');
console.log(`Port: ${PORT} | Database: ${TEST_DB_PATH}`);
console.log('====================================================\n');

// 1. Spawn isolated server process
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
  try {
    fs.rmSync(TEST_DB_PATH, { force: true });
    fs.rmSync(`${TEST_DB_PATH}-wal`, { force: true });
    fs.rmSync(`${TEST_DB_PATH}-shm`, { force: true });
  } catch (_) {}
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

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  assert.strictEqual(res.status, 200, `Login failed for ${email}: ${JSON.stringify(data)}`);
  return data.token;
}

try {
  // 2. Authenticate test roles
  console.log('\n--- Step 1: Authentication & Role Setup ---');
  const adminToken = await login('admin@marketingos.local', 'Admin123!');
  const memberToken = await login('member@marketingos.local', 'Member123!');
  const clientToken = await login('client@marketingos.local', 'Client123!');
  assert.ok(adminToken, 'Admin token acquired');
  assert.ok(memberToken, 'Member token acquired');
  assert.ok(clientToken, 'Client token acquired');
  console.log('✅ Tokens generated for super_admin, member, and client');

  const adminHeaders = { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
  const memberHeaders = { 'Authorization': `Bearer ${memberToken}`, 'Content-Type': 'application/json' };
  const clientHeaders = { 'Authorization': `Bearer ${clientToken}`, 'Content-Type': 'application/json' };

  // 3. Projects CRUD with department tagging and filtering
  console.log('\n--- Step 2: Projects CRUD & Department Scoping ---');
  // Create Research project
  const resProj1 = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ name: 'Market Intel 2026', department: 'research', type: 'market-intel' })
  });
  assert.strictEqual(resProj1.status, 200);
  const proj1 = await resProj1.json();
  assert.strictEqual(proj1.department, 'research');
  console.log('✅ Created Research Project:', proj1.id, `(department: ${proj1.department})`);

  // Create Sales project
  const resProj2 = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ name: 'Q4 Dental Outreach', department: 'sales', type: 'email-campaign' })
  });
  assert.strictEqual(resProj2.status, 200);
  const proj2 = await resProj2.json();
  assert.strictEqual(proj2.department, 'sales');
  console.log('✅ Created Sales Project:', proj2.id, `(department: ${proj2.department})`);

  // Create Creative project
  const resProj3 = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ name: 'Brand Kit Revamp', department: 'creative', type: 'landing-page' })
  });
  assert.strictEqual(resProj3.status, 200);
  const proj3 = await resProj3.json();
  assert.strictEqual(proj3.department, 'creative');
  console.log('✅ Created Creative Project:', proj3.id, `(department: ${proj3.department})`);

  // Create Default project (should default to 'creative')
  const resProj4 = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ name: 'Default Dept Project' })
  });
  assert.strictEqual(resProj4.status, 200);
  const proj4 = await resProj4.json();
  assert.strictEqual(proj4.department, 'creative');
  console.log('✅ Created Project without department defaults to creative');

  // Verify GET /api/projects filtering
  const resAllProjects = await fetch(`${BASE_URL}/api/projects`, { headers: adminHeaders });
  const allProjectsData = await resAllProjects.json();
  assert.ok(allProjectsData.projects.length >= 4);

  const resResearchProjects = await fetch(`${BASE_URL}/api/projects?department=research`, { headers: adminHeaders });
  const researchProjectsData = await resResearchProjects.json();
  assert.ok(researchProjectsData.projects.length >= 1);
  assert.ok(researchProjectsData.projects.every(p => p.department === 'research'), 'All projects returned must belong to research');

  const resSalesProjects = await fetch(`${BASE_URL}/api/projects?department=sales`, { headers: adminHeaders });
  const salesProjectsData = await resSalesProjects.json();
  assert.ok(salesProjectsData.projects.length >= 1);
  assert.ok(salesProjectsData.projects.every(p => p.department === 'sales'), 'All projects returned must belong to sales');

  console.log('✅ GET /api/projects?department= filtering validated');

  // 4. Tasks Creation & Auto-Tagging / Pipeline Inference
  console.log('\n--- Step 3: Tasks Creation, Auto-tagging & Pipeline Inference ---');
  // Task with explicit department: 'research'
  const resTask1 = await fetch(`${BASE_URL}/api/projects/${proj1.id}/tasks`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'Analyze Competitor Pricing',
      pipeline: 'market-intel',
      department: 'research',
      priority: 'high'
    })
  });
  assert.strictEqual(resTask1.status, 200);
  const task1 = await resTask1.json();
  assert.strictEqual(task1.department, 'research');
  console.log('✅ Task 1 created with explicit research department');

  // Task with inferred department from 'email-campaign' -> 'sales'
  const resTask2 = await fetch(`${BASE_URL}/api/projects/${proj2.id}/tasks`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'Deploy Cold Outreach Email Sequence',
      pipeline: 'email-campaign',
      priority: 'urgent'
    })
  });
  assert.strictEqual(resTask2.status, 200);
  const task2 = await resTask2.json();
  assert.strictEqual(task2.department, 'sales', 'Pipeline email-campaign must infer department=sales');
  console.log('✅ Task 2 pipeline email-campaign correctly inferred department=sales');

  // Task with inferred department from 'landing-page' -> 'creative'
  const resTask3 = await fetch(`${BASE_URL}/api/projects/${proj3.id}/tasks`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'Design Hero Section for Dental Landing Page',
      pipeline: 'landing-page',
      priority: 'medium'
    })
  });
  assert.strictEqual(resTask3.status, 200);
  const task3 = await resTask3.json();
  assert.strictEqual(task3.department, 'creative', 'Pipeline landing-page must infer department=creative');
  console.log('✅ Task 3 pipeline landing-page correctly inferred department=creative');

  // Validation: Invalid department should be rejected with 400
  const resTaskInvalidDept = await fetch(`${BASE_URL}/api/projects/${proj1.id}/tasks`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'Invalid Dept Task',
      pipeline: 'market-intel',
      department: 'finance'
    })
  });
  assert.strictEqual(resTaskInvalidDept.status, 400, 'Invalid department must return HTTP 400');
  console.log('✅ Invalid department rejected with HTTP 400');

  // 5. Standalone Tasks Query (GET /api/tasks)
  console.log('\n--- Step 4: Standalone Tasks Listing & Query Filtering ---');
  const resAllTasks = await fetch(`${BASE_URL}/api/tasks`, { headers: adminHeaders });
  const allTasksData = await resAllTasks.json();
  assert.strictEqual(resAllTasks.status, 200);
  assert.ok(allTasksData.tasks.length >= 3);

  const resResearchTasks = await fetch(`${BASE_URL}/api/tasks?department=research`, { headers: adminHeaders });
  const researchTasksData = await resResearchTasks.json();
  assert.ok(researchTasksData.tasks.length >= 1);
  assert.ok(researchTasksData.tasks.every(t => t.department === 'research'));

  const resSalesTasks = await fetch(`${BASE_URL}/api/tasks?department=sales`, { headers: adminHeaders });
  const salesTasksData = await resSalesTasks.json();
  assert.ok(salesTasksData.tasks.length >= 1);
  assert.ok(salesTasksData.tasks.every(t => t.department === 'sales'));

  const resCreativeTasks = await fetch(`${BASE_URL}/api/tasks?department=creative`, { headers: adminHeaders });
  const creativeTasksData = await resCreativeTasks.json();
  assert.ok(creativeTasksData.tasks.length >= 1);
  assert.ok(creativeTasksData.tasks.every(t => t.department === 'creative'));

  console.log('✅ GET /api/tasks?department= scoping verified for research, sales, and creative');

  // 6. Task Status Transitions (queued, in_progress, in_review, delivered) & Metadata Update
  console.log('\n--- Step 5: Status Transitions & Task Editing (PATCH /api/tasks/:id) ---');
  // Transition to 'queued'
  const patchQueued = await fetch(`${BASE_URL}/api/tasks/${task1.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'queued' })
  });
  assert.strictEqual(patchQueued.status, 200);
  assert.strictEqual((await patchQueued.json()).task.status, 'queued');

  // Transition to 'in_progress' (verifying schema CHECK constraint & ALLOWED_STATUSES)
  const patchInProgress = await fetch(`${BASE_URL}/api/tasks/${task1.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'in_progress' })
  });
  assert.strictEqual(patchInProgress.status, 200, 'Transition to in_progress must succeed with HTTP 200');
  const taskInProgress = (await patchInProgress.json()).task;
  assert.strictEqual(taskInProgress.status, 'in_progress', 'Task status must be in_progress in DB');
  console.log('✅ Status transition to in_progress verified');

  // Transition to 'in_review'
  const patchInReview = await fetch(`${BASE_URL}/api/tasks/${task1.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'in_review', report_md: '# Preliminary Research Report\nVerified.' })
  });
  assert.strictEqual(patchInReview.status, 200);
  assert.strictEqual((await patchInReview.json()).task.status, 'in_review');

  // Update task metadata: title, description, priority
  const patchMeta = await fetch(`${BASE_URL}/api/tasks/${task1.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'Analyze Competitor Pricing & Packages',
      description: 'Expanded market analysis covering top 5 dental clinics',
      priority: 'urgent'
    })
  });
  assert.strictEqual(patchMeta.status, 200);
  const taskMeta = (await patchMeta.json()).task;
  assert.strictEqual(taskMeta.title, 'Analyze Competitor Pricing & Packages');
  assert.strictEqual(taskMeta.description, 'Expanded market analysis covering top 5 dental clinics');
  assert.strictEqual(taskMeta.priority, 'urgent');
  console.log('✅ Metadata updates (title, description, priority) verified');

  // Transition to 'delivered' as admin
  const patchDeliveredAdmin = await fetch(`${BASE_URL}/api/tasks/${task1.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'delivered' })
  });
  assert.strictEqual(patchDeliveredAdmin.status, 200);
  assert.strictEqual((await patchDeliveredAdmin.json()).task.status, 'delivered');
  console.log('✅ Admin delivery transition verified');

  // 7. RBAC Guards & Error boundaries
  console.log('\n--- Step 6: RBAC Boundaries & Malformed Payload Handling ---');
  // Member attempting delivery must be rejected with 403
  const patchDeliveredMember = await fetch(`${BASE_URL}/api/tasks/${task2.id}`, {
    method: 'PATCH',
    headers: memberHeaders,
    body: JSON.stringify({ status: 'delivered' })
  });
  assert.strictEqual(patchDeliveredMember.status, 403, 'Member delivery attempt must return HTTP 403');
  console.log('✅ Member delivery attempt blocked with HTTP 403 Forbidden');

  // Invalid status value
  const patchInvalidStatus = await fetch(`${BASE_URL}/api/tasks/${task2.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'invalid_status_xyz' })
  });
  assert.strictEqual(patchInvalidStatus.status, 400, 'Invalid status must return HTTP 400');

  // Array exploit payload
  const patchArrayExploit = await fetch(`${BASE_URL}/api/tasks/${task2.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ status: ['delivered'] })
  });
  assert.strictEqual(patchArrayExploit.status, 400, 'Array status payload must return HTTP 400');
  console.log('✅ Invalid status and array payload rejected with HTTP 400');

  // Client role scoping: Client only sees 'delivered' tasks
  const resClientTasks = await fetch(`${BASE_URL}/api/tasks`, { headers: clientHeaders });
  assert.strictEqual(resClientTasks.status, 200);
  const clientTasksData = await resClientTasks.json();
  assert.ok(clientTasksData.tasks.every(t => t.status === 'delivered'), 'Client must only view delivered tasks');
  console.log('✅ Client role strictly restricted to delivered tasks');

  // 8. Task Deletion (DELETE /api/tasks/:id)
  console.log('\n--- Step 7: Task Deletion & Cascading Removal ---');
  // Create a disposable task
  const resDispTask = await fetch(`${BASE_URL}/api/projects/${proj1.id}/tasks`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ title: 'Temporary Scratch Task', pipeline: 'market-intel', department: 'research' })
  });
  assert.strictEqual(resDispTask.status, 200);
  const dispTask = await resDispTask.json();

  // Delete disposable task
  const resDelete = await fetch(`${BASE_URL}/api/tasks/${dispTask.id}`, {
    method: 'DELETE',
    headers: adminHeaders
  });
  assert.strictEqual(resDelete.status, 200);
  const deleteData = await resDelete.json();
  assert.strictEqual(deleteData.ok, true);
  assert.strictEqual(deleteData.deleted_id, dispTask.id);

  // Subsequent GET should return 404
  const resCheckDeleted = await fetch(`${BASE_URL}/api/tasks/${dispTask.id}`, { headers: adminHeaders });
  assert.strictEqual(resCheckDeleted.status, 404, 'Deleted task must return HTTP 404');

  // Deleting non-existent task returns 404
  const resDeleteNonExistent = await fetch(`${BASE_URL}/api/tasks/non-existent-task-id-12345`, {
    method: 'DELETE',
    headers: adminHeaders
  });
  assert.strictEqual(resDeleteNonExistent.status, 404, 'Deleting non-existent task must return HTTP 404');
  console.log('✅ DELETE /api/tasks/:id successfully deletes task and returns 404 for deleted/non-existent tasks');

  console.log('\n====================================================');
  console.log('🎉 ALL BACKEND API & PERSISTENCE TESTS PASSED CLEANLY');
  console.log('====================================================');
} finally {
  cleanupServer();
}
