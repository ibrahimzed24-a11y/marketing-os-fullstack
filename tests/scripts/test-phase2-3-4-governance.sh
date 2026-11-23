#!/bin/bash
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)" || exit 1
set -e

PORT=3012
BASE_URL="http://127.0.0.1:$PORT"

echo "================================================================================"
echo "     MARKETING OS — PHASE 2/3/4 CRM CRUD, LINEAGE & EXECUTION CONTROLS TEST     "
echo "================================================================================"

# 1. Start Test Server
echo "▶ 1. Starting test server on port $PORT..."
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

# 2. Authenticate Admin, Member, Client
ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@marketingos.local","password":"AdminPassword123!"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)
if [ -z "$ADMIN_TOKEN" ]; then
  ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@marketingos.local","password":"Admin123!"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)
fi
MEMBER_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"member@marketingos.local","password":"Member123!"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)
CLIENT_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"client@marketingos.local","password":"Client123!"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# 3. Verify Frontend has ZERO hardcoded mock team members or dummy handoff leads (P2-03)
echo "▶ 2. Verifying zero hardcoded mock team/lead fixtures in public/app.js (P2-03)..."
if grep -qE "(Dr\. Michael Vance|Sarah Jenkins|Nadia Hassan)" public/app.js; then
  echo "  ✗ FAILED: Hardcoded mock fixtures still present in public/app.js"
  exit 1
fi
echo "  ✓ PASSED: Zero hardcoded mock fixtures in public/app.js"

# 4. Verify Governance Policy Matrix (P4-02)
echo "▶ 3. Verifying Governance Autonomy Policy Matrix (GET /api/governance/policy)..."
POLICY_RES=$(curl -s "$BASE_URL/api/governance/policy" -H "Authorization: Bearer $ADMIN_TOKEN")
node -e "
const d = $POLICY_RES;
if (!d.ok || !Array.isArray(d.policy_matrix) || d.policy_matrix.length < 10) {
  console.error('Policy matrix missing entries:', d);
  process.exit(1);
}
const byOp = Object.fromEntries(d.policy_matrix.map(r => [r.operation, r.policy]));
if (byOp.research !== 'automatic' || byOp.sending_emails !== 'human_approval' || byOp.website_changes !== 'stage_then_approve') {
  console.error('Policy mismatch:', byOp);
  process.exit(1);
}
"
echo "  ✓ PASSED: Autonomy policy matrix verified (10 operational rules)."

# 5. CRM CRUD + Real Lead Lineage Handoff (P3-01, P3-02, P3-03)
echo "▶ 4. Testing CRM CRUD (Leads/Deals) & Real Lead Promotion Lineage..."
PROJ_RES=$(curl -s -X POST "$BASE_URL/api/projects" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Phase3 CRM Lineage Corp","client_name":"Lineage Corp","goal":"Test CRM CRUD & lineage"}')
PROJ_ID=$(echo "$PROJ_RES" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

LEAD_RES=$(curl -s -X POST "$BASE_URL/api/projects/$PROJ_ID/leads" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Dr. Layla Mansour","email":"layla@lineageclinic.ca","job_title":"Medical Director","icp_score":91}')
LEAD_ID=$(echo "$LEAD_RES" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

# PATCH lead
PATCH_LEAD=$(curl -s -X PATCH "$BASE_URL/api/leads/$LEAD_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"icp_score":96,"status":"enriched"}')
if ! echo "$PATCH_LEAD" | grep -q '"icp_score":96'; then
  echo "  ✗ FAILED: PATCH /api/leads/:id failed: $PATCH_LEAD"
  exit 1
fi

# Handoff using real lead_ids (must promote without duplicating)
HANDOFF_RES=$(curl -s -X POST "$BASE_URL/api/handoff/research-to-sales" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"project_id\":\"$PROJ_ID\",\"lead_ids\":[\"$LEAD_ID\"],\"deal_title\":\"Enterprise Growth Deal\",\"estimated_value\":40000}")
DEAL_ID=$(echo "$HANDOFF_RES" | grep -o '"deal_id":"[^"]*' | cut -d'"' -f4)
if ! echo "$HANDOFF_RES" | grep -q '"promoted_leads":1'; then
  echo "  ✗ FAILED: Expected promoted_leads:1 without duplication: $HANDOFF_RES"
  exit 1
fi

# Verify GET /api/crm/pipeline returns the lead & deal
CRM_RES=$(curl -s "$BASE_URL/api/crm/pipeline?project_id=$PROJ_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
if ! echo "$CRM_RES" | grep -q "$LEAD_ID" || ! echo "$CRM_RES" | grep -q "$DEAL_ID"; then
  echo "  ✗ FAILED: GET /api/crm/pipeline missing lead or deal"
  exit 1
fi
echo "  ✓ PASSED: CRM CRUD, GET /api/crm/pipeline & zero-duplication lead handoff lineage verified."

# 6. Technical Separation: Approved vs Externally Executed + Idempotency Replay (P4-01, P4-03)
echo "▶ 5. Testing Approved vs Externally Executed Separation & Idempotency Guard..."
APP_CREATE=$(curl -s -X POST "$BASE_URL/api/approvals" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"project_id\":\"$PROJ_ID\",\"department\":\"sales\",\"agent_name\":\"Sales Agent\",\"action_type\":\"sending_emails\",\"title\":\"Cold Email Dispatch Batch\",\"summary\":\"Send 10 approved outreach emails\"}")
APP_ID=$(echo "$APP_CREATE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

# 6a. Execute while still PENDING -> must return HTTP 409!
PRE_EXEC_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/approvals/$APP_ID/execute" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{}')
if [ "$PRE_EXEC_CODE" != "409" ]; then
  echo "  ✗ FAILED: Executing pending approval returned HTTP $PRE_EXEC_CODE (Expected 409)"
  exit 1
fi
echo "  ✓ Blocked execution on pending approval (HTTP 409)"

# 6b. Approve -> MUST keep execution_status='not_executed' & externally_executed=false!
DEC_RES=$(curl -s -X POST "$BASE_URL/api/approvals/$APP_ID/decision" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"decision":"approve","notes":"Copy approved"}')
if ! echo "$DEC_RES" | grep -q '"execution_status":"not_executed"' || ! echo "$DEC_RES" | grep -q '"externally_executed":false'; then
  echo "  ✗ FAILED: Approving falsely implied external execution: $DEC_RES"
  exit 1
fi
echo "  ✓ Approve kept execution_status=not_executed (externally_executed=false)"

# 6c. Member & Client blocked from POST /api/approvals/:id/execute (HTTP 403)
MEM_EXEC_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/approvals/$APP_ID/execute" -H "Authorization: Bearer $MEMBER_TOKEN")
CLI_EXEC_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/approvals/$APP_ID/execute" -H "Authorization: Bearer $CLIENT_TOKEN")
if [ "$MEM_EXEC_CODE" != "403" ] || [ "$CLI_EXEC_CODE" != "403" ]; then
  echo "  ✗ FAILED: Member ($MEM_EXEC_CODE) or Client ($CLI_EXEC_CODE) not blocked with 403"
  exit 1
fi
echo "  ✓ Member & Client blocked from external execution (HTTP 403)"

# 6d. Execute without connector -> staged (externally_executed=false); then with live mock webhook -> externally_executed=true + idempotency replay = 1 hit only!
node -e "
const http = require('http');
(async () => {
  const base = '$BASE_URL';
  const token = '$ADMIN_TOKEN';
  const appId = '$APP_ID';

  // Without connector -> must return staged & externally_executed: false
  const r1 = await fetch(base + '/api/approvals/' + appId + '/execute', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Idempotency-Key': 'stage-key-1' },
    body: JSON.stringify({})
  }).then(r => r.json());
  if (r1.execution_status !== 'staged' || r1.externally_executed !== false) {
    console.error('FAILED 6d-no-connector:', r1);
    process.exit(1);
  }
  console.log('  ✓ No external connector -> execution_status=staged, externally_executed=false (honest)');

  // Now spin up real mock external webhook to test real execution + idempotent replay
  let hits = 0;
  const hook = http.createServer((req, res) => {
    hits++;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ delivered: true, hit: hits }));
  });
  await new Promise(resolve => hook.listen(0, '127.0.0.1', resolve));
  const hookUrl = 'http://127.0.0.1:' + hook.address().port + '/dispatch';

  try {
    const r2 = await fetch(base + '/api/approvals/' + appId + '/execute', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Idempotency-Key': 'live-dispatch-key-99' },
      body: JSON.stringify({ connector_url_override: hookUrl })
    }).then(r => r.json());

    if (!r2.ok || r2.execution_status !== 'externally_executed' || r2.externally_executed !== true || hits !== 1) {
      console.error('FAILED 6d-live:', r2, 'hits:', hits);
      process.exit(1);
    }

    // Duplicate call with same key MUST NOT hit webhook a second time!
    const r3 = await fetch(base + '/api/approvals/' + appId + '/execute', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Idempotency-Key': 'live-dispatch-key-99' },
      body: JSON.stringify({ connector_url_override: hookUrl })
    }).then(r => r.json());

    if (!r3.ok || r3.idempotent_replay !== true || hits !== 1) {
      console.error('FAILED 6d-idempotency:', r3, 'hits:', hits);
      process.exit(1);
    }
    console.log('  ✓ Live external dispatch verified (externally_executed=true) + Idempotent replay prevented double-send (hits=1)');
  } finally {
    hook.close();
  }
})();
"

# Cleanup test data
node -e "
const db = require('./server/db');
db.prepare('DELETE FROM approvals WHERE project_id = ?').run('$PROJ_ID');
db.prepare('DELETE FROM activity WHERE project_id = ?').run('$PROJ_ID');
db.prepare('DELETE FROM deals WHERE project_id = ?').run('$PROJ_ID');
db.prepare('DELETE FROM leads WHERE project_id = ?').run('$PROJ_ID');
db.prepare('DELETE FROM project_members WHERE project_id = ?').run('$PROJ_ID');
db.prepare('DELETE FROM projects WHERE id = ?').run('$PROJ_ID');
"

echo "================================================================================"
echo "✓ ALL PHASE 2/3/4 GOVERNANCE, CRM CRUD & IDEMPOTENCY TESTS PASSED (100% OK)"
echo "================================================================================"
