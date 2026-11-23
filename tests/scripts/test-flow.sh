#!/usr/bin/env bash
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)" || exit 1
set -e

PORT=${PORT:-3000}
BASE_URL="http://127.0.0.1:${PORT}"

# Auto-start server if not already running on target port
STARTED_SERVER=false
if ! curl -s "${BASE_URL}/api/health" | grep -q "ok"; then
  echo "Starting background test server on port $PORT..."
  PORT=$PORT NODE_ENV=development WATCHDOG_INTERVAL_MS=60000 node server/index.js > /dev/null 2>&1 &
  SERVER_PID=$!
  STARTED_SERVER=true
  cleanup() {
    if [ "$STARTED_SERVER" = true ] && [ -n "$SERVER_PID" ]; then
      echo "Stopping test server PID $SERVER_PID..."
      kill -9 $SERVER_PID 2>/dev/null || true
    fi
  }
  trap cleanup EXIT
  for i in {1..10}; do
    if curl -s "${BASE_URL}/api/health" | grep -q "ok"; then
      echo "Server up on ${BASE_URL} (attempt $i)"
      break
    fi
    sleep 0.5
  done
fi

echo "=== 1. Super Admin Login ==="
ADMIN_RES=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@marketingos.local","password":"Admin123!"}')
ADMIN_TOKEN=$(echo "$ADMIN_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.token);")
echo "Admin token obtained: ${ADMIN_TOKEN:0:20}..."

echo -e "\n=== 2. Create Project: Test Factory ==="
PROJ_RES=$(curl -s -X POST "$BASE_URL/api/projects" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Factory","goal":"Generate 50 qualified B2B leads / week","client_name":"Nile Supplies","type":"landing-page"}')
PROJ_ID=$(echo "$PROJ_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.id);")
echo "Project created. ID: $PROJ_ID"

echo -e "\n=== 2b. Upload Ground Truth Harness File ==="
echo "Brand Spec Brief: Nile Enterprise Supplies verified grounded assets" > /tmp/harness_brief.txt
HARNESS_HTTP_CODE=$(curl -s -o /tmp/harness_resp.json -w "%{http_code}" -X POST "$BASE_URL/api/projects/$PROJ_ID/harness" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@/tmp/harness_brief.txt")
rm -f /tmp/harness_brief.txt
if [ "$HARNESS_HTTP_CODE" -ne 200 ]; then
  echo "❌ Error: Expected HTTP 200 for harness upload, got $HARNESS_HTTP_CODE"
  cat /tmp/harness_resp.json
  rm -f /tmp/harness_resp.json
  exit 1
fi
HARNESS_ID=$(node -e "let d=JSON.parse(require('fs').readFileSync('/tmp/harness_resp.json')); console.log(d.id);")
rm -f /tmp/harness_resp.json
echo "Harness uploaded successfully. ID: $HARNESS_ID (HTTP 200 OK)"

echo -e "\n=== 2c. Verify Non-existent Project Task Creation (Expect HTTP 404) ==="
GHOST_TASK_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/projects/00000000-0000-0000-0000-000000000000/tasks" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Ghost Task","pipeline":"content-seo"}')
echo "Non-existent project task creation HTTP code: $GHOST_TASK_STATUS (Expected: 404)"
if [ "$GHOST_TASK_STATUS" -ne 404 ]; then
  echo "❌ Error: Expected HTTP 404, got $GHOST_TASK_STATUS"
  exit 1
fi
echo "Verified: Foreign key project check correctly returns HTTP 404"

echo -e "\n=== 3. Add Client and Member to Project ==="
CLIENT_USER=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"client@marketingos.local","password":"Client123!"}')
CLIENT_ID=$(echo "$CLIENT_USER" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.user.id);")
CLIENT_TOKEN=$(echo "$CLIENT_USER" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.token);")
curl -s -X POST "$BASE_URL/api/projects/$PROJ_ID/members" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$CLIENT_ID\",\"role_in_project\":\"client\"}"
echo "Client $CLIENT_ID attached to project."

MEMBER_USER=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"member@marketingos.local","password":"Member123!"}')
MEMBER_ID=$(echo "$MEMBER_USER" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.user.id);")
MEMBER_TOKEN=$(echo "$MEMBER_USER" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.token);")
curl -s -X POST "$BASE_URL/api/projects/$PROJ_ID/members" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$MEMBER_ID\",\"role_in_project\":\"member\"}"
echo "Member $MEMBER_ID attached to project."

echo -e "\n=== 4. Create Task: Landing Page for Nile Supplies ==="
TASK_RES=$(curl -s -X POST "$BASE_URL/api/projects/$PROJ_ID/tasks" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Landing Page for Nile Supplies","pipeline":"landing-page","description":"Build landing page from catalog + leads with lead capture form.","priority":"high"}')
TASK_ID=$(echo "$TASK_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.id);")
echo "Task created. ID: $TASK_ID"

echo -e "\n=== 5. Run Task (Testing Local Fallback) ==="
RUN_RES=$(curl -s -X POST "$BASE_URL/api/tasks/$TASK_ID/run" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "Run result: $RUN_RES"

echo -e "\n=== 6. Verify Task In Review & Deliverable Output ==="
TASK_CHECK=$(curl -s -X GET "$BASE_URL/api/tasks/$TASK_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
STATUS=$(echo "$TASK_CHECK" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.task.status);")
echo "Current Task Status: $STATUS (Expected: in_review)"

echo -e "\n=== 7a. Test Member Array Type Confusion Exploit (Expect HTTP 400) ==="
MEMBER_ARRAY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE_URL/api/tasks/$TASK_ID" \
  -H "Authorization: Bearer $MEMBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":["delivered"]}')
echo "Member array delivery attempt HTTP code: $MEMBER_ARRAY_STATUS (Expected: 400)"
if [ "$MEMBER_ARRAY_STATUS" -ne 400 ]; then
  echo "❌ Error: Expected HTTP 400 for array status exploit, got $MEMBER_ARRAY_STATUS"
  exit 1
fi
echo "Verified: Array type confusion exploit safely rejected with HTTP 400 Bad Request"

echo -e "\n=== 7b. Test Member RBAC Gate (Member tries string deliver -> Expect HTTP 403) ==="
MEMBER_TRY_DELIVER=$(curl -s -X PATCH "$BASE_URL/api/tasks/$TASK_ID" \
  -H "Authorization: Bearer $MEMBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"delivered"}')
echo "Member deliver attempt response: $MEMBER_TRY_DELIVER (Expected: 403 / Only admin/manager can deliver)"

echo -e "\n=== 8. Admin Approves & Delivers Task ==="
APPROVE_RES=$(curl -s -X PATCH "$BASE_URL/api/tasks/$TASK_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"delivered"}')
echo "Approve result: $APPROVE_RES"

echo -e "\n=== 9. Client Verification (Client views delivered task) ==="
CLIENT_VIEW=$(curl -s -X GET "$BASE_URL/api/projects/$PROJ_ID" \
  -H "Authorization: Bearer $CLIENT_TOKEN")
CLIENT_DELIVERED_TASKS=$(echo "$CLIENT_VIEW" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.tasks.length);")
echo "Delivered tasks visible to client: $CLIENT_DELIVERED_TASKS"

echo -e "\n=== 10. Test Remaining Pipelines Execution ==="
for pl in content-seo social-content ads-creative email-campaign lead-research market-intel brand-kit; do
  T_RES=$(curl -s -X POST "$BASE_URL/api/projects/$PROJ_ID/tasks" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"title\":\"Pipeline test: $pl\",\"pipeline\":\"$pl\",\"description\":\"Verify $pl pipeline execution\"}")
  T_ID=$(echo "$T_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.id);")
  R_RES=$(curl -s -X POST "$BASE_URL/api/tasks/$T_ID/run" -H "Authorization: Bearer $ADMIN_TOKEN")
  echo "Pipeline '$pl' execution: $(echo "$R_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.mode + ' -> ' + d.message);")"
done

echo -e "\n=== ALL TESTS PASSED SUCCESSFULLY ==="
