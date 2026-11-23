#!/usr/bin/env bash
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)" || exit 1
set -e

PORT=${PORT:-3001}
export PORT
BASE_URL="http://127.0.0.1:$PORT"

echo "=== 1. Start Server for Testing on port $PORT ==="
node server/index.js &
SERVER_PID=$!

cleanup() {
  echo "Stopping test server PID $SERVER_PID..."
  kill -9 $SERVER_PID 2>/dev/null || true
}
trap cleanup EXIT

# Wait for server to start
for i in {1..20}; do
  if curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
    echo "Server up on $BASE_URL (attempt $i)"
    break
  fi
  sleep 0.2
done

echo ""
echo "=== 2. Super Admin Login ==="
ADMIN_RES=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@marketingos.local","password":"Admin123!"}')
ADMIN_TOKEN=$(echo "$ADMIN_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.token);")
echo "Admin token obtained: ${ADMIN_TOKEN:0:20}..."

echo ""
echo "=== 3. RBAC Gate Verification on /api/admin/llm-config ==="
# 3a. Client login & request -> expect 403 Forbidden
CLIENT_RES=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"client@marketingos.local","password":"Client123!"}')
CLIENT_TOKEN=$(echo "$CLIENT_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.token);")
CLIENT_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $CLIENT_TOKEN" "$BASE_URL/api/admin/llm-config")
echo "Client role GET /api/admin/llm-config HTTP: $CLIENT_CODE (Expected: 403)"
if [ "$CLIENT_CODE" -ne 403 ]; then
  echo "FAILED: Client was not forbidden (expected 403, got $CLIENT_CODE)"
  exit 1
fi

# 3b. Member login & request -> expect 403 Forbidden
MEMBER_RES=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"member@marketingos.local","password":"Member123!"}')
MEMBER_TOKEN=$(echo "$MEMBER_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.token);")
MEMBER_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $MEMBER_TOKEN" "$BASE_URL/api/admin/llm-config")
echo "Member role GET /api/admin/llm-config HTTP: $MEMBER_CODE (Expected: 403)"
if [ "$MEMBER_CODE" -ne 403 ]; then
  echo "FAILED: Member was not forbidden (expected 403, got $MEMBER_CODE)"
  exit 1
fi

echo ""
echo "=== 4. GET /api/admin/llm-config (Verify all 7 providers seeded & masked) ==="
GET_RES=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/api/admin/llm-config")
TOTAL=$(echo "$GET_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.total);")
PROVIDERS=$(echo "$GET_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.configs.map(c => c.provider).sort().join(','));")
echo "Total Providers: $TOTAL (Expected: 7)"
echo "Configured Providers: $PROVIDERS"
if [ "$TOTAL" -ne 7 ]; then
  echo "FAILED: Expected 7 providers, got $TOTAL"
  exit 1
fi

EXPECTED_PROVIDERS="anthropic,gemini,lmstudio,ollama,openai,openrouter,vllm"
if [ "$PROVIDERS" != "$EXPECTED_PROVIDERS" ]; then
  echo "FAILED: Providers list mismatch. Got '$PROVIDERS', expected '$EXPECTED_PROVIDERS'"
  exit 1
fi

echo ""
echo "=== 5. GET /api/admin/llm-config/active ==="
# Ensure starting state is default ollama
curl -s -X POST "$BASE_URL/api/admin/llm-config" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"default_provider": "ollama"}' > /dev/null

ACTIVE_RES=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/api/admin/llm-config/active")
ACTIVE_PROV=$(echo "$ACTIVE_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.active_config.provider);")
echo "Active primary provider: $ACTIVE_PROV (Expected: ollama)"
if [ "$ACTIVE_PROV" != "ollama" ]; then
  echo "FAILED: Expected default active provider ollama, got $ACTIVE_PROV"
  exit 1
fi

echo ""
echo "=== 6. POST /api/admin/llm-config (Update OpenAI key & settings) ==="
UPDATE_RES=$(curl -s -X POST "$BASE_URL/api/admin/llm-config" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "base_url": "https://api.openai.com/v1",
    "api_key": "sk-proj-supersecretkey1234567890abcdef9999",
    "default_model": "gpt-4o",
    "is_active": true
  }')
SAVED_MASKED_KEY=$(echo "$UPDATE_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.config.api_key);")
HAS_KEY=$(echo "$UPDATE_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.config.has_api_key);")
echo "Returned OpenAI masked key: $SAVED_MASKED_KEY"
echo "Has key flag: $HAS_KEY"

# Ensure secret was NOT leaked verbatim
if [[ "$SAVED_MASKED_KEY" == *"supersecretkey"* ]]; then
  echo "FAILED: Secret key leaked in response: $SAVED_MASKED_KEY"
  exit 1
fi
if [[ "$SAVED_MASKED_KEY" != *"••••••••"* ]]; then
  echo "FAILED: Key was not masked with bullet characters: $SAVED_MASKED_KEY"
  exit 1
fi

echo ""
echo "=== 7. Masking Preservation (Do not overwrite secret when client sends masked key) ==="
REUPDATE_RES=$(curl -s -X POST "$BASE_URL/api/admin/llm-config" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "api_key": "'"$SAVED_MASKED_KEY"'",
    "default_model": "gpt-4o-mini"
  }')
MODEL_AFTER=$(echo "$REUPDATE_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.config.default_model);")
echo "Updated model: $MODEL_AFTER (Expected: gpt-4o-mini)"

# Verify stored DB value is encrypted at rest AND decrypts to the real preserved secret!
DB_RAW_KEY=$(node -e "const db = require('./server/db'); const r = db.prepare('SELECT api_key FROM admin_llm_configs WHERE provider = ?').get('openai'); console.log(r.api_key);")
if [[ "$DB_RAW_KEY" != enc:v1:* ]]; then
  echo "FAILED: Stored DB key is NOT encrypted at rest: $DB_RAW_KEY"
  exit 1
fi
DB_DECRYPTED_KEY=$(node -e "const db = require('./server/db'); const { decryptSecret } = require('./server/cryptoVault'); const r = db.prepare('SELECT api_key FROM admin_llm_configs WHERE provider = ?').get('openai'); console.log(decryptSecret(r.api_key));")
if [ "$DB_DECRYPTED_KEY" != "sk-proj-supersecretkey1234567890abcdef9999" ]; then
  echo "FAILED: Decrypted DB key was corrupted by masked input: $DB_DECRYPTED_KEY"
  exit 1
fi
echo "Verified: Stored secret encrypted at rest (AES-256-GCM) and preserved without corruption."

echo ""
echo "=== 8. Switching Primary Routing Provider ==="
ROUTE_RES=$(curl -s -X POST "$BASE_URL/api/admin/llm-config" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"default_provider": "openai"}')
NEW_ACTIVE_PROV=$(echo "$ROUTE_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.config.provider);")
NEW_ACTIVE_DEF=$(echo "$ROUTE_RES" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.config.is_default);")
echo "New active provider: $NEW_ACTIVE_PROV | is_default: $NEW_ACTIVE_DEF"

ACTIVE_CHECK=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/api/admin/llm-config/active")
CHECK_NAME=$(echo "$ACTIVE_CHECK" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.active_config.provider);")
if [ "$CHECK_NAME" != "openai" ]; then
  echo "FAILED: Expected openai to be active, got $CHECK_NAME"
  exit 1
fi
echo "Verified: Routing primary switch successfully updated active engine to openai."

echo ""
echo "=== 9. Connection Testing / Ping Endpoint ==="
# 9a. Test missing key for cloud provider without key (Anthropic)
TEST_MISSING_KEY=$(curl -s -X POST "$BASE_URL/api/admin/llm-config/anthropic/test" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')
ANTH_OK=$(echo "$TEST_MISSING_KEY" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.ok);")
ANTH_ERR=$(echo "$TEST_MISSING_KEY" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.error);")
echo "Anthropic without key result: ok=$ANTH_OK, error=$ANTH_ERR"
if [ "$ANTH_OK" != "false" ]; then
  echo "FAILED: Expected test to fail due to missing key"
  exit 1
fi

# 9b. Test local Ollama connection test (handled gracefully even if offline)
TEST_OLLAMA=$(curl -s -X POST "$BASE_URL/api/admin/llm-config/test" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider": "ollama", "base_url": "http://127.0.0.1:11434"}')
OLLAMA_STATUS=$(echo "$TEST_OLLAMA" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.status);")
OLLAMA_LATENCY=$(echo "$TEST_OLLAMA" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(typeof d.latency_ms);")
echo "Ollama ping result: status=$OLLAMA_STATUS, latency type=$OLLAMA_LATENCY"

# 9c. Test POST /api/admin/llm-config/ping alias
TEST_PING_ALIAS=$(curl -s -X POST "$BASE_URL/api/admin/llm-config/ping" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider": "vllm"}')
VLLM_STATUS=$(echo "$TEST_PING_ALIAS" | node -e "let d=JSON.parse(require('fs').readFileSync(0)); console.log(d.status);")
echo "vLLM /ping alias result: status=$VLLM_STATUS"

# Reset default provider back to ollama for idempotent repeatable test runs
curl -s -X POST "$BASE_URL/api/admin/llm-config" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"default_provider": "ollama"}' > /dev/null

echo ""
echo "=== ALL ADMIN LLM CONFIG & ROUTING TESTS PASSED (100% OK) ==="
