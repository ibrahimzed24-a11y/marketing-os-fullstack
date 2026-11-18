#!/bin/bash
set -e

PORT=3010
BASE_URL="http://127.0.0.1:$PORT"

echo "================================================================================"
echo "          MARKETING OS — PHASE 0 SECURITY & DATA INTEGRITY VERIFICATION         "
echo "================================================================================"

# 1. Static Frontend Hygiene Check (P0-02)
echo "▶ 1. Checking Frontend for exposed credentials (P0-02)..."
if grep -qE "(Admin123!|Manager123!|Member123!|Client123!|autofillLogin)" public/index.html public/app.js; then
  echo "  ✗ FAILED: Default credentials or autofillLogin still present in public/"
  exit 1
fi
echo "  ✓ PASSED: Zero hardcoded passwords or autofillLogin found in public/"

# 2. Production JWT_SECRET Fail-Fast Check (P0-03)
echo "▶ 2. Verifying production JWT_SECRET fail-fast enforcement (P0-03)..."
if NODE_ENV=production JWT_SECRET="" node -e "require('./server/auth')" >/dev/null 2>&1; then
  echo "  ✗ FAILED: server/auth.js allowed empty JWT_SECRET in production!"
  exit 1
fi
if NODE_ENV=production JWT_SECRET="dev-secret-change-me" node -e "require('./server/auth')" >/dev/null 2>&1; then
  echo "  ✗ FAILED: server/auth.js allowed default 'dev-secret-change-me' in production!"
  exit 1
fi
echo "  ✓ PASSED: Production startup fails fast when JWT_SECRET is missing or weak."

# 3. Production Vault Key & AES-256-GCM Encryption Verification (P0-04)
echo "▶ 3. Verifying AES-256-GCM Vault encryption & prod key enforcement (P0-04)..."
node -e "
const { encryptSecret, decryptSecret, isEncrypted } = require('./server/cryptoVault');
const secret = 'sk-live-test-encryption-9876543210';
const enc = encryptSecret(secret);
if (!isEncrypted(enc) || enc === secret || enc.includes(secret)) {
  console.error('Encryption failed:', enc);
  process.exit(1);
}
if (encryptSecret(enc) !== enc) {
  console.error('Encryption is not idempotent');
  process.exit(1);
}
if (decryptSecret(enc) !== secret) {
  console.error('Decryption mismatch');
  process.exit(1);
}
"
if NODE_ENV=production VAULT_ENCRYPTION_KEY="" node -e "const v = require('./server/cryptoVault'); v.encryptSecret('test');" >/dev/null 2>&1; then
  echo "  ✗ FAILED: cryptoVault allowed encryption without VAULT_ENCRYPTION_KEY in production!"
  exit 1
fi
echo "  ✓ PASSED: AES-256-GCM encryption verified & production key required."

# 4. Production autoSeed refuses weak default credentials (P0-02)
echo "▶ 4. Verifying production autoSeed blocks weak default accounts (P0-02)..."
node -e "
const Database = require('better-sqlite3');
const mem = new Database(':memory:');
mem.exec('CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT, password_hash TEXT, role TEXT, department TEXT)');
process.env.NODE_ENV = 'production';
delete process.env.INITIAL_ADMIN_EMAIL;
delete process.env.INITIAL_ADMIN_PASSWORD;
const { autoSeedIfEmpty } = require('./server/autoSeed');
autoSeedIfEmpty(mem);
const count = mem.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (count !== 0) {
  console.error('Production autoSeed created unexpected users:', count);
  process.exit(1);
}
"
echo "  ✓ PASSED: Production cold-start never seeds weak default accounts."

# 5. Start test server for live endpoint & RBAC verification
echo "▶ 5. Starting test server on port $PORT..."
PORT=$PORT node server/index.js > /dev/null 2>&1 &
SERVER_PID=$!
trap "kill -9 $SERVER_PID 2>/dev/null || true" EXIT

for i in {1..15}; do
  if curl -s "$BASE_URL/health" > /dev/null; then
    echo "  ✓ Server up on $BASE_URL"
    break
  fi
  sleep 0.5
done

# 6. Verify /api/auth/reset-password-dev is disabled by default (P0-01)
echo "▶ 6. Verifying /api/auth/reset-password-dev is disabled by default (P0-01)..."
RESET_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/reset-password-dev" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@marketingos.local","newPassword":"Hacked123!","devKey":"local-dev-key-change-me"}')
if [ "$RESET_CODE" != "404" ]; then
  echo "  ✗ FAILED: /api/auth/reset-password-dev returned HTTP $RESET_CODE (Expected 404)"
  exit 1
fi
echo "  ✓ PASSED: /api/auth/reset-password-dev returns HTTP 404 (disabled)."

# 7. Authenticate roles for RBAC verification (P0-05)
echo "▶ 7. Authenticating roles for RBAC matrix (P0-05)..."
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
MEMBER_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"member@marketingos.local","password":"Member123!"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

check_http() {
  local label="$1"
  local method="$2"
  local url="$3"
  local token="$4"
  local expected="$5"
  local body="$6"
  if [ -n "$body" ]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "$body")
  else
    code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" -H "Authorization: Bearer $token")
  fi
  if [ "$code" != "$expected" ]; then
    echo "  ✗ FAILED: $label returned HTTP $code (Expected $expected)"
    exit 1
  fi
  echo "  ✓ $label -> HTTP $code"
}

check_http "Client GET /api/approvals" "GET" "$BASE_URL/api/approvals" "$CLIENT_TOKEN" "403"
check_http "Client POST /api/approvals" "POST" "$BASE_URL/api/approvals" "$CLIENT_TOKEN" "403" '{"department":"sales","agent_name":"x","action_type":"x","title":"x"}'
check_http "Client GET /api/overview/stats" "GET" "$BASE_URL/api/overview/stats" "$CLIENT_TOKEN" "403"
check_http "Client POST /api/handoff/research-to-sales" "POST" "$BASE_URL/api/handoff/research-to-sales" "$CLIENT_TOKEN" "403" '{"project_id":"x"}'
check_http "Client POST /api/handoff/sales-to-creative" "POST" "$BASE_URL/api/handoff/sales-to-creative" "$CLIENT_TOKEN" "403" '{"client_name":"x"}'
check_http "Member POST /api/handoff/research-to-sales" "POST" "$BASE_URL/api/handoff/research-to-sales" "$MEMBER_TOKEN" "403" '{"project_id":"x"}'
check_http "Member POST /api/handoff/sales-to-creative" "POST" "$BASE_URL/api/handoff/sales-to-creative" "$MEMBER_TOKEN" "403" '{"client_name":"x"}'
check_http "Admin GET /api/approvals" "GET" "$BASE_URL/api/approvals" "$ADMIN_TOKEN" "200"
check_http "Admin GET /api/overview/stats" "GET" "$BASE_URL/api/overview/stats" "$ADMIN_TOKEN" "200"

# 8. Verify saved_logins stores encrypted passwords at rest (P0-04)
echo "▶ 8. Verifying saved_logins encrypts secrets at rest in SQLite (P0-04)..."
LOGIN_CREATE=$(curl -s -X POST "$BASE_URL/api/saved-logins" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Phase0 Vault Test","category":"Testing","website_url":"https://example.com","username":"vault@test.local","password":"UltraSecretPassword99!","api_key":"sk-vault-test-key-12345"}')
LOGIN_ID=$(echo "$LOGIN_CREATE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

node -e "
const db = require('./server/db');
const { isEncrypted, decryptSecret } = require('./server/cryptoVault');
const row = db.prepare('SELECT password, api_key FROM saved_logins WHERE id = ?').get('$LOGIN_ID');
if (!row || !isEncrypted(row.password) || !isEncrypted(row.api_key)) {
  console.error('saved_logins row is NOT encrypted at rest:', row);
  process.exit(1);
}
if (decryptSecret(row.password) !== 'UltraSecretPassword99!' || decryptSecret(row.api_key) !== 'sk-vault-test-key-12345') {
  console.error('saved_logins decryption mismatch');
  process.exit(1);
}
db.prepare('DELETE FROM saved_logins WHERE id = ?').run('$LOGIN_ID');
"
echo "  ✓ PASSED: saved_logins secrets stored as AES-256-GCM ciphertext & verified."

# 9. Verify Turso durability API & safe status telemetry (P0-06)
echo "▶ 9. Verifying Turso durability API & status metrics (P0-06)..."
node -e "
const turso = require('./server/turso');
if (typeof turso.flushPendingWrites !== 'function') {
  console.error('turso.flushPendingWrites missing');
  process.exit(1);
}
const st = turso.getStatus();
if (typeof st.pending_writes !== 'number' || typeof st.failed_writes !== 'number') {
  console.error('turso.getStatus missing write telemetry:', st);
  process.exit(1);
}
"
echo "  ✓ PASSED: Turso write-flush API & telemetry verified."

echo "================================================================================"
echo "✓ ALL PHASE 0 SECURITY & DATA INTEGRITY TESTS PASSED (100% OK)"
echo "================================================================================"
