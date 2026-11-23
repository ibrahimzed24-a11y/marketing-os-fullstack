#!/usr/bin/env bash
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)" || exit 1
set -e

PORT=3004
BASE_URL="http://127.0.0.1:${PORT}"

echo "================================================================="
echo " MARKETING OS - PHASE 4 FRONTEND & UX INTEGRATION TEST SUITE"
echo "================================================================="

echo ""
echo "=== 1. Start Server for Testing on port $PORT ==="
PORT=$PORT NODE_ENV=development WATCHDOG_INTERVAL_MS=60000 node server/index.js > /dev/null 2>&1 &
SERVER_PID=$!

cleanup() {
  echo ""
  echo "Cleaning up: Stopping test server PID $SERVER_PID..."
  kill -9 $SERVER_PID 2>/dev/null || true
}
trap cleanup EXIT

for i in {1..15}; do
  if curl -s "${BASE_URL}/api/health" | grep -q "ok"; then
    echo "Server up on ${BASE_URL} (attempt $i)"
    break
  fi
  sleep 0.5
done

echo ""
echo "=== 2. Static Asset Delivery & HTML Elements ==="
INDEX_HTML=$(curl -s "${BASE_URL}/")
APP_JS_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/app.js")
STYLE_CSS_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/style.css")

echo "GET /app.js HTTP Code: $APP_JS_HTTP (Expected: 200)"
if [ "$APP_JS_HTTP" != "200" ]; then
  echo "FAILED: /app.js not served!"
  exit 1
fi

echo "GET /style.css HTTP Code: $STYLE_CSS_HTTP (Expected: 200)"
if [ "$STYLE_CSS_HTTP" != "200" ]; then
  echo "FAILED: /style.css not served!"
  exit 1
fi

echo "Checking required Phase 4 DOM elements in index.html..."
for ELEM in "navTab-adminSettings" "view-adminSettings" "healthApiStatus" "healthWatchdogStatus" "healthActiveProvider" "llmProvidersContainer" "watchdogMetricsCards" "watchdogAlertsContainer"; do
  if echo "$INDEX_HTML" | grep -q "$ELEM"; then
    echo "  [PASS] Element found: #$ELEM"
  else
    echo "  [FAIL] Missing required element: #$ELEM"
    exit 1
  fi
done

echo ""
echo "=== 3. Authentication & RBAC Boundary ==="
ADMIN_LOGIN=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@marketingos.local","password":"Admin123!"}')
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | node -e "const d=JSON.parse(require('fs').readFileSync(0)); console.log(d.token||'');")

if [ -z "$ADMIN_TOKEN" ]; then
  echo "FAILED: Admin authentication failed: $ADMIN_LOGIN"
  exit 1
fi
echo "Admin authenticated. Token: ${ADMIN_TOKEN:0:20}..."

CLIENT_LOGIN=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"client@marketingos.local","password":"Client123!"}')
CLIENT_TOKEN=$(echo "$CLIENT_LOGIN" | node -e "const d=JSON.parse(require('fs').readFileSync(0)); console.log(d.token||'');")

if [ -z "$CLIENT_TOKEN" ]; then
  echo "FAILED: Client authentication failed: $CLIENT_LOGIN"
  exit 1
fi
echo "Client authenticated. Token: ${CLIENT_TOKEN:0:20}..."

echo "Testing RBAC protection on Admin Settings..."
CLIENT_ADMIN_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X GET "${BASE_URL}/api/admin/llm-config" \
  -H "Authorization: Bearer ${CLIENT_TOKEN}")
echo "Client GET /api/admin/llm-config HTTP: $CLIENT_ADMIN_HTTP (Expected: 403)"
if [ "$CLIENT_ADMIN_HTTP" != "403" ]; then
  echo "FAILED: Client was not rejected with 403 on admin LLM config endpoint!"
  exit 1
fi

echo ""
echo "=== 4. Admin Settings Data & Live Ping Verification ==="
LLM_CONFIG_RES=$(curl -s -X GET "${BASE_URL}/api/admin/llm-config" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

CONFIG_COUNT=$(echo "$LLM_CONFIG_RES" | node -e "const d=JSON.parse(require('fs').readFileSync(0)); console.log(d.configs ? d.configs.length : 0);")
ACTIVE_PROVIDER=$(echo "$LLM_CONFIG_RES" | node -e "const d=JSON.parse(require('fs').readFileSync(0)); console.log(d.active_provider || d.default_provider || 'none');")
echo "Configured LLM providers found: $CONFIG_COUNT (Expected: >= 6)"
echo "Current active provider: $ACTIVE_PROVIDER"
if [ "$CONFIG_COUNT" -lt 6 ]; then
  echo "FAILED: Expected at least 6 providers in LLM registry!"
  exit 1
fi

WATCHDOG_STATUS=$(curl -s -X GET "${BASE_URL}/api/admin/watchdog/status" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")
WD_ACTIVE=$(echo "$WATCHDOG_STATUS" | node -e "const d=JSON.parse(require('fs').readFileSync(0)); const wd = d.watchdog || d; console.log(wd.active === true ? 'yes' : 'no');")
echo "Watchdog background process active: $WD_ACTIVE (Expected: yes)"
if [ "$WD_ACTIVE" != "yes" ]; then
  echo "FAILED: Watchdog is not active in status response!"
  exit 1
fi

echo "Testing Admin Ping Endpoint (POST /api/admin/llm-config/ping)..."
PING_RES=$(curl -s -X POST "${BASE_URL}/api/admin/llm-config/ping" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"provider":"ollama"}')
PING_PROVIDER=$(echo "$PING_RES" | node -e "const d=JSON.parse(require('fs').readFileSync(0)); console.log(d.provider || '');")
echo "Ping response provider: $PING_PROVIDER (Expected: ollama)"
if [ "$PING_PROVIDER" != "ollama" ]; then
  echo "FAILED: Ping endpoint failed to return expected provider!"
  exit 1
fi

echo ""
echo "=== 5. Workbench Asynchronous Task Dispatch & Deliverable Review Flow ==="
PROJECTS_RES=$(curl -s -X GET "${BASE_URL}/api/projects" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

PROJECT_ID=$(echo "$PROJECTS_RES" | node -e "
  const d = JSON.parse(require('fs').readFileSync(0));
  const list = Array.isArray(d) ? d : (d.projects || []);
  console.log(list.length > 0 ? list[0].id : '');
")

if [ -z "$PROJECT_ID" ]; then
  echo "Creating new test project..."
  NEW_PROJ=$(curl -s -X POST "${BASE_URL}/api/projects" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"name":"Alpha Growth Project","slug":"alpha-growth"}')
  PROJECT_ID=$(echo "$NEW_PROJ" | node -e "const d=JSON.parse(require('fs').readFileSync(0)); console.log(d.id||'');")
fi

echo "Using Project ID: $PROJECT_ID"
echo "Creating new task via POST /api/projects/${PROJECT_ID}/tasks..."
TASK_CREATE_RES=$(curl -s -X POST "${BASE_URL}/api/projects/${PROJECT_ID}/tasks" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"title":"Q4 Growth Pillar Post","type":"content-seo","priority":"high","input_payload":{"target_kw":"omnichannel conversion rate"}}')

TASK_ID=$(echo "$TASK_CREATE_RES" | node -e "const d=JSON.parse(require('fs').readFileSync(0)); console.log(d.id || '');")
echo "Created task ID: $TASK_ID"
if [ -z "$TASK_ID" ]; then
  echo "FAILED to create task: $TASK_CREATE_RES"
  exit 1
fi

echo "Triggering task execution via POST /api/tasks/${TASK_ID}/run..."
RUN_RES=$(curl -s -X POST "${BASE_URL}/api/tasks/${TASK_ID}/run" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

TASK_STATUS=$(echo "$RUN_RES" | node -e "const d=JSON.parse(require('fs').readFileSync(0)); console.log(d.task ? d.task.status : (d.status || ''));")
DELIVERABLE_TITLE=$(echo "$RUN_RES" | node -e "
  const d=JSON.parse(require('fs').readFileSync(0));
  let out = null;
  if (d.task && d.task.output_json) {
    out = typeof d.task.output_json === 'string' ? JSON.parse(d.task.output_json) : d.task.output_json;
  } else if (d.deliverable) {
    out = { deliverable: d.deliverable };
  }
  const del = out && out.deliverable ? out.deliverable : out;
  console.log(del && del.title ? del.title : '');
")
echo "Task execution status: $TASK_STATUS (Expected: in_review or delivered)"
echo "Deliverable Title: $DELIVERABLE_TITLE"

if [ -z "$DELIVERABLE_TITLE" ]; then
  echo "FAILED: Deliverable title missing from execution result!"
  exit 1
fi

echo "Testing Deliverable Approval (PATCH /api/tasks/${TASK_ID} status: delivered)..."
APPROVE_RES=$(curl -s -X PATCH "${BASE_URL}/api/tasks/${TASK_ID}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"status":"delivered"}')

APPROVED_STATUS=$(echo "$APPROVE_RES" | node -e "const d=JSON.parse(require('fs').readFileSync(0)); console.log(d.status || '');")
echo "Task status after approval: $APPROVED_STATUS (Expected: delivered)"
if [ "$APPROVED_STATUS" != "delivered" ]; then
  echo "FAILED to transition task to delivered!"
  exit 1
fi

echo ""
echo "Testing Deliverable Revision Request (PATCH /api/tasks/${TASK_ID} status: needs_fix)..."
FIX_RES=$(curl -s -X PATCH "${BASE_URL}/api/tasks/${TASK_ID}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"status":"needs_fix"}')

FIX_STATUS=$(echo "$FIX_RES" | node -e "const d=JSON.parse(require('fs').readFileSync(0)); console.log(d.status || '');")
echo "Task status after revision request: $FIX_STATUS (Expected: needs_fix)"
if [ "$FIX_STATUS" != "needs_fix" ]; then
  echo "FAILED to transition task to needs_fix!"
  exit 1
fi

echo ""
echo "================================================================="
echo " ALL PHASE 4 FRONTEND & UX INTEGRATION TESTS PASSED (100%)"
echo "================================================================="
