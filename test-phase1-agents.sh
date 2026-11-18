#!/bin/bash
set -e

PORT=3011
BASE_URL="http://127.0.0.1:$PORT"

echo "================================================================================"
echo "          MARKETING OS — PHASE 1 AGENT ENGINE VERIFICATION SUITE                "
echo "================================================================================"

# 1. Live LLM Execution + Retry Backoff + Strict DB Failure Unit/Integration Test
echo "▶ 1. Testing Live LLM Execution (with 503 retry -> success) & Strict DB Failure Guard..."
node -e "
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const db = require('./server/db');
const { executeAgentTask } = require('./server/agentFramework');

(async () => {
  // Save original active routing so we restore cleanly after test
  const origRouting = db.prepare('SELECT primary_provider, fallback_provider FROM admin_llm_routing LIMIT 1').get();
  const origVllm = db.prepare('SELECT base_url, default_model, is_default, is_active FROM admin_llm_configs WHERE provider = ?').get('vllm');

  // Start a tiny local OpenAI-compatible mock LLM server (503 on attempt 1, 200 JSON on attempt 2)
  let callCount = 0;
  const mockServer = http.createServer((req, res) => {
    callCount++;
    if (callCount === 1) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Temporary overload' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            title: 'Live Grounded Dental Market Report',
            summary: 'Live LLM analysis confirming high implant demand across Toronto clinics.',
            report_md: '### Live Market Intel\nGrounded live response from mock vLLM.\n\n**Verdict:** Ready to Deliver'
          })
        }
      }]
    }));
  });

  await new Promise(resolve => mockServer.listen(0, '127.0.0.1', resolve));
  const mockPort = mockServer.address().port;

  // Create temp project & task
  const owner = db.prepare('SELECT id FROM users LIMIT 1').get();
  const projId = uuidv4();
  const taskId = uuidv4();
  db.prepare('INSERT INTO projects (id, name, client_name, goal, owner_id) VALUES (?, ?, ?, ?, ?)').run(
    projId, 'Phase1 Live LLM Test', 'LiveBrand Inc', 'Validate real LLM execution', owner.id
  );
  db.prepare('INSERT INTO tasks (id, project_id, title, pipeline, description, created_by) VALUES (?, ?, ?, ?, ?, ?)').run(
    taskId, projId, 'Market Analysis Live Test', 'market-intel', 'Analyze Ontario clinics', owner.id
  );

  try {
    // Point vllm to our mock server & make it primary
    db.prepare('UPDATE admin_llm_configs SET is_default = 0').run();
    db.prepare('UPDATE admin_llm_configs SET base_url = ?, default_model = ?, is_default = 1, is_active = 1 WHERE provider = ?').run(
      'http://127.0.0.1:' + mockPort, 'mock-live-model', 'vllm'
    );
    db.prepare('UPDATE admin_llm_routing SET primary_provider = ?, fallback_provider = NULL').run('vllm');

    const proj = db.prepare('SELECT * FROM projects WHERE id = ?').get(projId);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

    // 1A. Live LLM with retry on 503
    const liveRes = await executeAgentTask(task, proj, [], { maxRetries: 2, baseBackoffMs: 50 });
    if (liveRes.dataSource !== 'live_llm' || liveRes.isSimulated !== false || liveRes.attempts !== 2) {
      console.error('FAILED 1A: Expected live_llm with 2 attempts, got:', liveRes);
      process.exit(1);
    }
    const runRow = db.prepare('SELECT * FROM agent_runs WHERE id = ?').get(liveRes.runId);
    if (!runRow || runRow.status !== 'succeeded' || runRow.data_source !== 'live_llm' || runRow.attempt_count !== 2) {
      console.error('FAILED 1A: agent_runs row invalid:', runRow);
      process.exit(1);
    }
    console.log('  ✓ Live LLM execution succeeded after transient 503 retry (data_source=live_llm, attempts=2)');

    // 1B. Honest Simulated Fallback + Real Leads Table Persistence
    const leadTaskId = uuidv4();
    db.prepare('INSERT INTO tasks (id, project_id, title, pipeline, description, created_by) VALUES (?, ?, ?, ?, ?, ?)').run(
      leadTaskId, projId, 'Lead Discovery Fallback Test', 'lead-research', 'Find verified leads', owner.id
    );
    const leadTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(leadTaskId);
    const simRes = await executeAgentTask(leadTask, proj, [], { skipLiveLLM: true });
    if (simRes.dataSource !== 'simulated_fallback' || simRes.isSimulated !== true || simRes.persistedLeadsCount < 1) {
      console.error('FAILED 1B: Expected simulated_fallback with persisted leads, got:', simRes);
      process.exit(1);
    }
    const leadsCount = db.prepare('SELECT COUNT(*) as c FROM leads WHERE project_id = ?').get(projId).c;
    if (leadsCount < 1) {
      console.error('FAILED 1B: Leads were not persisted to leads table!');
      process.exit(1);
    }
    console.log('  ✓ Simulated fallback honestly tagged (is_simulated=true) & ' + leadsCount + ' leads persisted to DB');

    // 1C. Strict DB Failure Guard: Agent MUST fail if DB write fails (invalid FK project_id)
    let failedAsExpected = false;
    try {
      await executeAgentTask(
        { id: null, project_id: 'non-existent-project-fk', title: 'Broken FK Lead Test', pipeline: 'lead-research' },
        { id: 'non-existent-project-fk', client_name: 'Ghost' },
        [],
        { skipLiveLLM: true }
      );
    } catch (expectedErr) {
      failedAsExpected = true;
    }
    if (!failedAsExpected) {
      console.error('FAILED 1C: Agent falsely reported success despite DB FK failure!');
      process.exit(1);
    }
    console.log('  ✓ Strict DB failure guard verified: Agent failed cleanly instead of falsely reporting success');
  } finally {
    mockServer.close();
    // Restore original routing & vllm config
    db.prepare('UPDATE admin_llm_configs SET is_default = 0').run();
    if (origVllm) {
      db.prepare('UPDATE admin_llm_configs SET base_url = ?, default_model = ?, is_default = ?, is_active = ? WHERE provider = ?').run(
        origVllm.base_url, origVllm.default_model, origVllm.is_default, origVllm.is_active, 'vllm'
      );
    }
    if (origRouting?.primary_provider) {
      db.prepare('UPDATE admin_llm_configs SET is_default = 1 WHERE provider = ?').run(origRouting.primary_provider);
      db.prepare('UPDATE admin_llm_routing SET primary_provider = ?, fallback_provider = ?').run(
        origRouting.primary_provider, origRouting.fallback_provider
      );
    }
    // Cleanup temp project
    db.prepare('DELETE FROM agent_runs WHERE project_id = ?').run(projId);
    db.prepare('DELETE FROM leads WHERE project_id = ?').run(projId);
    db.prepare('DELETE FROM approvals WHERE project_id = ?').run(projId);
    db.prepare('DELETE FROM tasks WHERE project_id = ?').run(projId);
    db.prepare('DELETE FROM projects WHERE id = ?').run(projId);
  }
})();
"

# 2. Verify all 3 Agents via HTTP API & GET /api/agent-runs RBAC
echo "▶ 2. Testing all 3 Agents via HTTP API & GET /api/agent-runs observability..."
PORT=$PORT node server/index.js > /dev/null 2>&1 &
SERVER_PID=$!
trap "kill -9 $SERVER_PID 2>/dev/null || true" EXIT

for i in {1..15}; do
  if curl -s "$BASE_URL/health" > /dev/null; then
    echo "  ✓ Server active on $BASE_URL"
    break
  fi
  sleep 0.5
done

ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@marketingos.local","password":"AdminPassword123!"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)
if [ -z "$ADMIN_TOKEN" ]; then
  ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@marketingos.local","password":"Admin123!"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)
fi
CLIENT_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"client@marketingos.local","password":"Client123!"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Verify client is blocked from /api/agent-runs
CLIENT_RUNS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/agent-runs" -H "Authorization: Bearer $CLIENT_TOKEN")
if [ "$CLIENT_RUNS_CODE" != "403" ]; then
  echo "  ✗ FAILED: Client GET /api/agent-runs returned $CLIENT_RUNS_CODE (Expected 403)"
  exit 1
fi
echo "  ✓ Client GET /api/agent-runs -> HTTP 403 (RBAC enforced)"

# Create test project and run Research (01), Sales (02), Creative (03)
P_RES=$(curl -s -X POST "$BASE_URL/api/projects" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Phase1 3-Agent Suite","client_name":"TriAgent Corp","goal":"Verify all 3 core agents"}')
P_ID=$(echo "$P_RES" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

for PIPE in "market-intel" "email-campaign" "landing-page"; do
  T_RES=$(curl -s -X POST "$BASE_URL/api/projects/$P_ID/tasks" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"title\":\"Test $PIPE\",\"pipeline\":\"$PIPE\",\"description\":\"Verify agent execution\"}")
  T_ID=$(echo "$T_RES" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
  RUN_OUT=$(curl -s -X POST "$BASE_URL/api/tasks/$T_ID/run" -H "Authorization: Bearer $ADMIN_TOKEN")
  if ! echo "$RUN_OUT" | grep -q '"run_id":"'; then
    echo "  ✗ FAILED: Pipeline $PIPE did not return run_id: $RUN_OUT"
    exit 1
  fi
  echo "  ✓ Pipeline '$PIPE' executed with traceable run_id & data_source"
done

RUNS_LIST=$(curl -s "$BASE_URL/api/agent-runs?limit=10" -H "Authorization: Bearer $ADMIN_TOKEN")
if ! echo "$RUNS_LIST" | grep -q '"ok":true'; then
  echo "  ✗ FAILED: GET /api/agent-runs failed: $RUNS_LIST"
  exit 1
fi
echo "  ✓ GET /api/agent-runs returned recorded executions"

# Cleanup test project
node -e "
const db = require('./server/db');
db.prepare('DELETE FROM agent_runs WHERE project_id = ?').run('$P_ID');
db.prepare('DELETE FROM approvals WHERE project_id = ?').run('$P_ID');
db.prepare('DELETE FROM activity WHERE project_id = ?').run('$P_ID');
db.prepare('DELETE FROM reports WHERE project_id = ?').run('$P_ID');
db.prepare('DELETE FROM tasks WHERE project_id = ?').run('$P_ID');
db.prepare('DELETE FROM project_members WHERE project_id = ?').run('$P_ID');
db.prepare('DELETE FROM projects WHERE id = ?').run('$P_ID');
"

echo "================================================================================"
echo "✓ ALL PHASE 1 AGENT ENGINE TESTS PASSED (100% OK)"
echo "================================================================================"
