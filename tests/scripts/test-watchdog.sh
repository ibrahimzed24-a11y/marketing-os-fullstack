#!/usr/bin/env bash
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)" || exit 1
set -e

PORT=3002
BASE_URL="http://127.0.0.1:${PORT}"
OS_KEY="local-dev-key-change-me"

echo "=== 1. Start Server for Testing on port $PORT ==="
PORT=$PORT NODE_ENV=development WATCHDOG_INTERVAL_MS=60000 node server/index.js > /dev/null 2>&1 &
SERVER_PID=$!

cleanup() {
  echo "Stopping test server PID $SERVER_PID..."
  kill -9 $SERVER_PID 2>/dev/null || true
}
trap cleanup EXIT

for i in {1..10}; do
  if curl -s "${BASE_URL}/api/health" | grep -q "ok"; then
    echo "Server up on ${BASE_URL} (attempt $i)"
    break
  fi
  sleep 0.5
done

echo ""
echo "=== 2. Super Admin Login ==="
LOGIN_RES=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@marketingos.local","password":"Admin123!"}')

TOKEN=$(echo "$LOGIN_RES" | node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync(0)); console.log(d.token||'');")
if [ -z "$TOKEN" ]; then
  echo "Failed to get admin token: $LOGIN_RES"
  exit 1
fi
echo "Admin token obtained: ${TOKEN:0:20}..."

echo ""
echo "=== 3. RBAC Gate Verification on Watchdog Endpoints ==="
CLIENT_LOGIN=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"client@marketingos.local","password":"Client123!"}')
CLIENT_TOKEN=$(echo "$CLIENT_LOGIN" | node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync(0)); console.log(d.token||'');")

HTTP_CLIENT=$(curl -s -o /dev/null -w "%{http_code}" -X GET "${BASE_URL}/api/admin/watchdog/status" \
  -H "Authorization: Bearer ${CLIENT_TOKEN}")
echo "Client role GET /api/admin/watchdog/status HTTP: $HTTP_CLIENT (Expected: 403)"
if [ "$HTTP_CLIENT" != "403" ]; then
  echo "RBAC Gate FAILED! Expected 403, got $HTTP_CLIENT"
  exit 1
fi

HTTP_SCAN_CLIENT=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/admin/watchdog/scan" \
  -H "Authorization: Bearer ${CLIENT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"sla_seconds": 60}')
echo "Client role POST /api/admin/watchdog/scan HTTP: $HTTP_SCAN_CLIENT (Expected: 403)"
if [ "$HTTP_SCAN_CLIENT" != "403" ]; then
  echo "RBAC Gate FAILED! Expected 403, got $HTTP_SCAN_CLIENT"
  exit 1
fi

echo ""
echo "=== 4. GET /api/admin/watchdog/status (Super Admin) ==="
STATUS_RES=$(curl -s -X GET "${BASE_URL}/api/admin/watchdog/status" \
  -H "Authorization: Bearer ${TOKEN}")
IS_RUNNING=$(echo "$STATUS_RES" | node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync(0)); console.log(d.watchdog.is_running);")
SLA_SEC=$(echo "$STATUS_RES" | node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync(0)); console.log(d.watchdog.sla_timeout_seconds);")
echo "Watchdog is_running: $IS_RUNNING | SLA: ${SLA_SEC}s"
if [ "$IS_RUNNING" != "true" ]; then
  echo "Watchdog status check failed!"
  exit 1
fi

echo ""
echo "=== 5. Stuck Task Stall Detection & Transition to needs_attention ==="
# Inject an aged task directly into SQLite
TEST_TASK_ID="test-stuck-task-$(date +%s)"
node -e "
const db = require('./server/db');
const proj = db.prepare('SELECT id FROM projects LIMIT 1').get();
db.prepare(\`
  INSERT INTO tasks (id, project_id, title, pipeline, status, updated_at)
  VALUES (?, ?, 'Stalled Pipeline Job', 'content-seo', 'running', datetime('now', '-600 seconds'))
\`).run('$TEST_TASK_ID', proj.id);
"

# Trigger scan cycle with 60 second SLA
SCAN_RES=$(curl -s -X POST "${BASE_URL}/api/admin/watchdog/scan" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"sla_seconds": 60}')

RECOVERED_COUNT=$(echo "$SCAN_RES" | node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync(0)); console.log(d.scan_result.recovered_tasks.length);")
echo "Recovered tasks count: $RECOVERED_COUNT"

# Verify task state in database
TASK_INFO=$(node -e "
const db = require('./server/db');
const task = db.prepare('SELECT status, report_md FROM tasks WHERE id = ?').get('$TEST_TASK_ID');
const errLog = db.prepare(\"SELECT category, code FROM error_log WHERE correlation_id = ?\").get('$TEST_TASK_ID');
console.log(JSON.stringify({ status: task?.status, has_report: !!task?.report_md, err_code: errLog?.code }));
")

echo "Task post-scan verification: $TASK_INFO"
VERIFIED=$(echo "$TASK_INFO" | node -e "
const fs=require('fs');
const d=JSON.parse(fs.readFileSync(0));
if (d.status === 'needs_attention' && d.has_report && d.err_code === 'TASK_SLA_EXCEEDED') {
  console.log('OK');
} else {
  console.log('FAIL');
}
")

if [ "$VERIFIED" != "OK" ]; then
  echo "Stalled task recovery verification FAILED!"
  exit 1
fi
echo "Verified: Stalled task automatically healed -> transitioned to 'needs_attention' with admin report and error log."

echo ""
echo "=== 6. Webhook Retries & Dead-Letter Verification ==="
# Enqueue a webhook to an unreachable local port with max_attempts=2
node -e "
const { enqueueWebhookDispatch } = require('./server/watchdog');
enqueueWebhookDispatch('$TEST_TASK_ID', 'http://127.0.0.1:59999/unreachable-webhook', { test: true }, 2);
"

# Trigger scan cycle 1 (Attempt 1 fails -> backoff scheduled)
curl -s -X POST "${BASE_URL}/api/admin/watchdog/scan" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"sla_seconds": 60}' > /dev/null

RETRY_STATE_1=$(node -e "
const db = require('./server/db');
const row = db.prepare('SELECT attempt_count, status FROM webhook_retries WHERE task_id = ?').get('$TEST_TASK_ID');
console.log(JSON.stringify(row));
")
echo "Retry state after Attempt 1: $RETRY_STATE_1"

# Fast-forward next_retry_at to past so Attempt 2 can execute immediately
node -e "
const db = require('./server/db');
db.prepare(\"UPDATE webhook_retries SET next_retry_at = datetime('now', '-10 seconds') WHERE task_id = ?\").run('$TEST_TASK_ID');
"

# Trigger scan cycle 2 (Attempt 2 reaches max_attempts 2 -> dead_letter)
curl -s -X POST "${BASE_URL}/api/admin/watchdog/scan" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"sla_seconds": 60}' > /dev/null

RETRY_STATE_2=$(node -e "
const db = require('./server/db');
const row = db.prepare('SELECT attempt_count, status, last_error FROM webhook_retries WHERE task_id = ?').get('$TEST_TASK_ID');
const errRow = db.prepare(\"SELECT code FROM error_log WHERE correlation_id = ? AND code = 'WEBHOOK_DEAD_LETTER'\").get('$TEST_TASK_ID');
console.log(JSON.stringify({ status: row?.status, attempts: row?.attempt_count, dead_letter_logged: !!errRow }));
")
echo "Retry state after Attempt 2: $RETRY_STATE_2"

DEAD_LETTER_VERIFIED=$(echo "$RETRY_STATE_2" | node -e "
const fs=require('fs');
const d=JSON.parse(fs.readFileSync(0));
if (d.status === 'dead_letter' && d.dead_letter_logged) {
  console.log('OK');
} else {
  console.log('FAIL');
}
")

if [ "$DEAD_LETTER_VERIFIED" != "OK" ]; then
  echo "Dead-letter queue verification FAILED!"
  exit 1
fi
echo "Verified: Unreachable webhook dead-lettered after max attempts and logged to error_log."

echo ""
echo "=== 7. Incoming Webhook Ingress & Validation Testing ==="
# Missing task_id on POST /webhook/marketing-os-task
HTTP_INGRESS_BAD=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/webhook/marketing-os-task" \
  -H "Content-Type: application/json" \
  -d '{"pipeline":"content-seo"}')
echo "Missing task_id POST /webhook/marketing-os-task HTTP: $HTTP_INGRESS_BAD (Expected: 400)"
if [ "$HTTP_INGRESS_BAD" != "400" ]; then
  echo "Ingress validation failed! Expected 400, got $HTTP_INGRESS_BAD"
  exit 1
fi

# Valid POST /webhook/marketing-os-task
INGRESS_OK=$(curl -s -X POST "${BASE_URL}/webhook/marketing-os-task" \
  -H "Content-Type: application/json" \
  -d "{\"task_id\":\"$TEST_TASK_ID\",\"pipeline\":\"content-seo\"}")
INGRESS_RECEIVED=$(echo "$INGRESS_OK" | node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync(0)); console.log(d.received);")
echo "Valid POST /webhook/marketing-os-task received: $INGRESS_RECEIVED"
if [ "$INGRESS_RECEIVED" != "true" ]; then
  echo "Valid ingress test failed!"
  exit 1
fi

# Invalid status on POST /api/webhooks/n8n
HTTP_N8N_BAD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/webhooks/n8n" \
  -H "x-os-api-key: $OS_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"task_id\":\"$TEST_TASK_ID\",\"status\":\"invalid_status_xyz\"}")
echo "Invalid status POST /api/webhooks/n8n HTTP: $HTTP_N8N_BAD_STATUS (Expected: 400)"
if [ "$HTTP_N8N_BAD_STATUS" != "400" ]; then
  echo "n8n callback status validation failed! Expected 400, got $HTTP_N8N_BAD_STATUS"
  exit 1
fi

# Valid status on POST /api/webhooks/n8n
N8N_OK=$(curl -s -X POST "${BASE_URL}/api/webhooks/n8n" \
  -H "x-os-api-key: $OS_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"task_id\":\"$TEST_TASK_ID\",\"status\":\"in_review\",\"output\":{\"test\":true},\"report_md\":\"# Test Report\"}")
N8N_RECEIVED=$(echo "$N8N_OK" | node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync(0)); console.log(d.received);")
echo "Valid POST /api/webhooks/n8n received: $N8N_RECEIVED"
if [ "$N8N_RECEIVED" != "true" ]; then
  echo "Valid n8n callback test failed!"
  exit 1
fi

# Clean up test task
node -e "
const db = require('./server/db');
db.prepare('DELETE FROM tasks WHERE id = ?').run('$TEST_TASK_ID');
db.prepare('DELETE FROM webhook_retries WHERE task_id = ?').run('$TEST_TASK_ID');
db.prepare('DELETE FROM error_log WHERE correlation_id = ?').run('$TEST_TASK_ID');
db.prepare('DELETE FROM reports WHERE task_id = ?').run('$TEST_TASK_ID');
db.prepare('DELETE FROM activity WHERE task_id = ?').run('$TEST_TASK_ID');
"

echo ""
echo "=== ALL SELF-HEALING WATCHDOG & INGRESS TESTS PASSED (100% OK) ==="
