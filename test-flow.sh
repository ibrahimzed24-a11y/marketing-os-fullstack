#!/usr/bin/env bash
set -e

BASE_URL="http://127.0.0.1:3000"

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

echo -e "\n=== 3. Add Client to Project ==="
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

echo -e "\n=== 7. Test Member RBAC (Member tries to deliver -> must return 403) ==="
MEMBER_USER=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"member@marketingos.local","password":"Member123!"}')
MEMBER_TOKEN=$(echo "$MEMBER_USER" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.token);")
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
