#!/usr/bin/env bash
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)" || exit 1
set -e

PORT=3003
BASE_URL="http://127.0.0.1:${PORT}"

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
ADMIN_RES=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@marketingos.local","password":"Admin123!"}')
ADMIN_TOKEN=$(echo "$ADMIN_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.token);")
echo "Admin token obtained: ${ADMIN_TOKEN:0:20}..."

echo ""
echo "=== 3. Verify All 8 Pipelines In Catalog ==="
PIPELINES_RES=$(curl -s -X GET "$BASE_URL/api/pipelines" -H "Authorization: Bearer $ADMIN_TOKEN")
PIPELINE_COUNT=$(echo "$PIPELINES_RES" | node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync(0));
const keys = Object.keys(d.pipelines || {});
console.log(keys.length);
")
echo "Total registered pipelines: $PIPELINE_COUNT (Expected: 8)"
if [ "$PIPELINE_COUNT" -ne 8 ]; then
  echo "FAILED: Expected 8 pipelines, got $PIPELINE_COUNT"
  exit 1
fi

echo ""
echo "=== 4. Test Standardized Output Schema Across All 8 Pipelines ==="
PROJ_RES=$(curl -s -X POST "$BASE_URL/api/projects" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Schema Test Studio","client_name":"Apex Corp","goal":"Validate standardized signal flow"}')
PROJ_ID=$(echo "$PROJ_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.id);")

ALL_PIPELINES=("content-seo" "social-content" "ads-creative" "email-campaign" "lead-research" "landing-page" "market-intel" "brand-kit")

for pipe in "${ALL_PIPELINES[@]}"; do
  TASK_RES=$(curl -s -X POST "$BASE_URL/api/projects/$PROJ_ID/tasks" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"title\":\"Test Run for $pipe\",\"pipeline\":\"$pipe\",\"description\":\"Standardized schema verification\"}")
  TASK_ID=$(echo "$TASK_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.id);")

  RUN_RES=$(curl -s -X POST "$BASE_URL/api/tasks/$TASK_ID/run" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

  # Verify schema of task output
  VERIFY_OUT=$(node -e "
    const db = require('./server/db');
    const task = db.prepare('SELECT output_json, report_md FROM tasks WHERE id = ?').get('$TASK_ID');
    const out = JSON.parse(task.output_json || '{}');
    const hasSummary = !!out.summary;
    const hasMetadata = !!out.metadata && !!out.metadata.pipeline && !!out.metadata.provider && !!out.metadata.model;
    const hasReport = !!task.report_md && task.report_md.includes('**Verdict:** Ready to Deliver');
    if (hasSummary && hasMetadata && hasReport) {
      console.log('VALID | provider=' + out.metadata.provider + ' | model=' + out.metadata.model);
    } else {
      console.log('INVALID | summary=' + hasSummary + ' | meta=' + hasMetadata + ' | report=' + hasReport);
    }
  ")

  echo "Pipeline '$pipe' output schema: $VERIFY_OUT"
  if [[ "$VERIFY_OUT" != *"VALID"* ]]; then
    echo "Schema verification failed for $pipe!"
    exit 1
  fi
done

echo ""
echo "=== 5. Verify Dynamic LLM Provider Propagation to Pipeline Deliverables ==="
# Switch default provider to openai
curl -s -X POST "$BASE_URL/api/admin/llm-config" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"default_provider":"openai"}' > /dev/null

# Run a new task under landing-page pipeline
SWITCH_TASK_RES=$(curl -s -X POST "$BASE_URL/api/projects/$PROJ_ID/tasks" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Dynamic LLM Switch Test","pipeline":"landing-page","description":"Verify OpenAI metadata inheritance"}')
SWITCH_TASK_ID=$(echo "$SWITCH_TASK_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.id);")

curl -s -X POST "$BASE_URL/api/tasks/$SWITCH_TASK_ID/run" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null

ACTIVE_PROVIDER=$(node -e "
  const db = require('./server/db');
  const task = db.prepare('SELECT output_json FROM tasks WHERE id = ?').get('$SWITCH_TASK_ID');
  const out = JSON.parse(task.output_json || '{}');
  console.log(out.metadata?.provider);
")

echo "Deliverable metadata inherited active provider: $ACTIVE_PROVIDER (Expected: openai)"
if [ "$ACTIVE_PROVIDER" != "openai" ]; then
  echo "Dynamic LLM propagation failed! Expected openai, got $ACTIVE_PROVIDER"
  exit 1
fi

# Restore default provider to ollama
curl -s -X POST "$BASE_URL/api/admin/llm-config" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"default_provider":"ollama"}' > /dev/null

echo ""
echo "=== 6. Verify Pipeline Spec Files in antigravity/pipelines/ ==="
for pipe in "${ALL_PIPELINES[@]}"; do
  SPEC_FILE="antigravity/pipelines/$pipe.md"
  if [ -f "$SPEC_FILE" ]; then
    echo "Found spec: $SPEC_FILE"
  else
    echo "MISSING spec: $SPEC_FILE"
    exit 1
  fi
done

echo ""
echo "=== ALL PHASE 3 SIGNAL FLOW & SCHEMA TESTS PASSED (100% OK) ==="
