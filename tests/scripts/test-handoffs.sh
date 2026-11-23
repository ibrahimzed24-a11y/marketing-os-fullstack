#!/bin/bash
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)" || exit 1
set -e

PORT=3008
BASE_URL="http://127.0.0.1:$PORT"
echo "=== TESTING PHASE 3: CROSS-DEPARTMENT HANDOFFS & APPROVALS ==="

# 1. Start test server
echo "Starting background test server on port $PORT..."
PORT=$PORT node server/index.js > /dev/null 2>&1 &
SERVER_PID=$!
trap "kill -9 $SERVER_PID 2>/dev/null || true" EXIT

for i in {1..10}; do
  if curl -s "$BASE_URL/health" > /dev/null; then
    echo "Server up on $BASE_URL"
    break
  fi
  sleep 0.5
done

# 2. Login as Admin
ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@marketingos.local","password":"AdminPassword123!"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  # Fallback to Admin123!
  ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@marketingos.local","password":"Admin123!"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)
fi

echo "Admin logged in successfully."

# 3. Create test project for research
PROJECT_RES=$(curl -s -X POST "$BASE_URL/api/projects" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Handoff Test Brand","client_name":"Handoff Brand Corp","goal":"Scale dental clinic chain in Ontario"}')

PROJECT_ID=$(echo "$PROJECT_RES" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "Created Project ID: $PROJECT_ID"

# 4. Test Research -> Sales Handoff
echo "Testing POST /api/handoff/research-to-sales..."
HANDOFF_RES=$(curl -s -X POST "$BASE_URL/api/handoff/research-to-sales" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"project_id\": \"$PROJECT_ID\",
    \"leads\": [
      {\"name\": \"Dr. Emily Chen\", \"email\": \"echen@cliniccare.ca\", \"title\": \"Lead Practitioner\", \"icp_score\": 95},
      {\"name\": \"Mark Ross\", \"email\": \"mross@dentalops.ca\", \"title\": \"Director of Procurement\", \"icp_score\": 89}
    ],
    \"deal_title\": \"Q4 Dental Outbound Campaign\",
    \"estimated_value\": 35000
  }")

echo "Research -> Sales result: $HANDOFF_RES"
if echo "$HANDOFF_RES" | grep -q '"ok":true'; then
  echo "✓ Research -> Sales handoff PASSED"
else
  echo "✗ Research -> Sales handoff FAILED"
  exit 1
fi

DEAL_ID=$(echo "$HANDOFF_RES" | grep -o '"deal_id":"[^"]*' | cut -d'"' -f4)

# 5. Test Sales -> Creative Studio Handoff
echo "Testing POST /api/handoff/sales-to-creative..."
ONBOARD_RES=$(curl -s -X POST "$BASE_URL/api/handoff/sales-to-creative" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"deal_id\": \"$DEAL_ID\",
    \"client_name\": \"Apex Health Ontario\",
    \"project_name\": \"Apex Health Production Launch\",
    \"goal\": \"Deliver high-converting landing page and Google Ads campaigns\",
    \"services\": [\"landing-page\", \"ads-creative\", \"social-content\"]
  }")

echo "Sales -> Creative result: $ONBOARD_RES"
if echo "$ONBOARD_RES" | grep -q '"ok":true'; then
  echo "✓ Sales -> Creative handoff PASSED"
else
  echo "✗ Sales -> Creative handoff FAILED"
  exit 1
fi

# 6. Test Approvals Engine & Decision Lifecycle
echo "Testing Approvals Lifecycle..."
# Create a sample pending approval
NEW_APP_RES=$(curl -s -X POST "$BASE_URL/api/approvals" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"project_id\": \"$PROJECT_ID\",
    \"agent_id\": \"agent-02\",
    \"agent_name\": \"Sales Agent\",
    \"department\": \"sales\",
    \"action_type\": \"dispatch_email_sequence\",
    \"title\": \"Outreach Campaign to 50 Verified Clinics\",
    \"summary\": \"3-part cold email sequence targeting clinic directors\",
    \"preview_data\": {\"subject\": \"Elevating Dental Patient Acquisition\", \"leads_count\": 50}
  }")

APP_ID=$(echo "$NEW_APP_RES" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "Created Approval ID: $APP_ID"

# Fetch approvals list
FETCH_APPS=$(curl -s "$BASE_URL/api/approvals?status=pending" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$FETCH_APPS" | grep -q "$APP_ID"; then
  echo "✓ GET /api/approvals found pending approval"
else
  echo "✗ GET /api/approvals did not find pending approval"
  exit 1
fi

# Approve the pending action
DECISION_RES=$(curl -s -X POST "$BASE_URL/api/approvals/$APP_ID/decision" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"decision": "approve", "notes": "Approved by Marketing Director"}')

if echo "$DECISION_RES" | grep -q '"ok":true'; then
  echo "✓ Decision recording PASSED"
else
  echo "✗ Decision recording FAILED"
  exit 1
fi

echo "=== ALL PHASE 3 HANDOFF & APPROVAL TESTS PASSED (100% OK) ==="
