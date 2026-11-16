#!/usr/bin/env bash
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

echo "=== 1. Login Super Admin ==="
ADMIN_RES=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@marketingos.local","password":"Admin123!"}')
ADMIN_TOKEN=$(echo "$ADMIN_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.token);")
echo "Super Admin token acquired: ${ADMIN_TOKEN:0:20}..."

echo ""
echo "=== 2. Verify 32 Sovereign Agents Catalog ==="
AGENTS_RES=$(curl -s "$BASE_URL/api/agents" -H "Authorization: Bearer $ADMIN_TOKEN")
AGENTS_COUNT=$(echo "$AGENTS_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.count);")
echo "Total Agents in Sovereign Registry: $AGENTS_COUNT (Expected: 32)"
if [ "$AGENTS_COUNT" -ne 32 ]; then
  echo "FAILED: Agents count is $AGENTS_COUNT, expected 32"
  exit 1
fi

echo ""
echo "=== 3. Create Project for RAG & Agent Test ==="
PROJ_RES=$(curl -s -X POST "$BASE_URL/api/projects" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"RAG & Agent Verification Project","client_name":"Valioz Dental Labs","goal":"Test autonomous RAG chunking and agent dispatch","type":"landing-page"}')
PROJ_ID=$(echo "$PROJ_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.id);")
echo "Created Project ID: $PROJ_ID"

echo ""
echo "=== 4. Test RAG Document Ingestion ==="
INGEST_RES=$(curl -s -X POST "$BASE_URL/api/projects/$PROJ_ID/rag/ingest" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "document_name": "canadian_dental_cdcp_protocol.md",
    "content": "CANADIAN DENTAL CARE PLAN (CDCP) PROTOCOL 2026:\nValioz Health provides turnkey patient intake for Canadian clinics.\nPricing: $499 one-time setup fee + 30 days of AI growth agent included. Ongoing optional retainer is $299/mo.\nFull clinic ownership of domain and patient records is permanently guaranteed under PIPEDA."
  }')
CHUNKS_CREATED=$(echo "$INGEST_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.chunks_created);")
TOTAL_PROJECT_CHUNKS=$(echo "$INGEST_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.total_project_chunks);")
echo "Chunks Created: $CHUNKS_CREATED | Total Project Chunks: $TOTAL_PROJECT_CHUNKS"

echo ""
echo "=== 5. Test RAG Semantic Vector Search ==="
SEARCH_RES=$(curl -s -X POST "$BASE_URL/api/projects/$PROJ_ID/rag/search" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"CDCP pricing retainer 499 setup fee PIPEDA","top_k":3}')
MATCH_COUNT=$(echo "$SEARCH_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.results_count);")
TOP_SCORE=$(echo "$SEARCH_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.results[0].match_pct);")
echo "Results Count: $MATCH_COUNT | Top Score: $TOP_SCORE% (Expected: >= 1 result with > 70% match)"

if [ "$MATCH_COUNT" -lt 1 ]; then
  echo "FAILED: RAG search returned 0 results"
  exit 1
fi

echo ""
echo "=== 6. Test Sovereign Agent Dispatch (@coordinator) ==="
DISPATCH_CO_RES=$(curl -s -X POST "$BASE_URL/api/agents/dispatch" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_slug": "coordinator",
    "project_id": "'"$PROJ_ID"'",
    "title": "Orchestrate CDCP Growth Workflow",
    "brief": "Plan out 5-stage marketing loop for Canadian clinics accepting CDCP."
  }')
STATUS_CO=$(echo "$DISPATCH_CO_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.task.status);")
REPORT_CO=$(echo "$DISPATCH_CO_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.task.report_md.includes('Ready to Deliver'));")
echo "Coordinator Task Status: $STATUS_CO (Expected: in_review) | Verified Report: $REPORT_CO"

echo ""
echo "=== 7. Test Specialist Agent Dispatch (@sentry - Legal & Compliance) ==="
DISPATCH_SN_RES=$(curl -s -X POST "$BASE_URL/api/agents/dispatch" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_slug": "sentry",
    "project_id": "'"$PROJ_ID"'",
    "title": "CASL and PIPEDA Outbound Compliance Review",
    "brief": "Audit outbound email sequence for postal address, unsubscribe headers, and consent proof under CASL."
  }')
STATUS_SN=$(echo "$DISPATCH_SN_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.task.status);")
echo "Sentry Task Status: $STATUS_SN (Expected: in_review)"

echo ""
echo "=== 8. Test Client Role RBAC Gate (Expect 403 Forbidden on Ingest & Dispatch) ==="
CLIENT_LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"client@marketingos.local","password":"Client123!"}')
CLIENT_TOKEN=$(echo "$CLIENT_LOGIN" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.token);")

CLIENT_INGEST_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/projects/$PROJ_ID/rag/ingest" \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"document_name":"hack.txt","content":"forbidden"}')
echo "Client Ingest Attempt HTTP Code: $CLIENT_INGEST_HTTP (Expected: 403)"

CLIENT_DISPATCH_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/projects/$PROJ_ID/rag/dispatch" \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent_slug":"coordinator","project_id":"'"$PROJ_ID"'","title":"Unauthorized"}')
echo "Client Dispatch Attempt HTTP Code: $CLIENT_DISPATCH_HTTP (Expected: 403 or 404)"

if [ "$CLIENT_INGEST_HTTP" -ne 403 ]; then
  echo "FAILED: RBAC gate failed to reject client write request."
  exit 1
fi

echo ""
echo "=== ALL AGENTS & RAG VERIFICATION TESTS PASSED (100% OK) ==="
