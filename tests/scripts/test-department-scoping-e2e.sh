#!/usr/bin/env bash
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)" || exit 1
# ==============================================================================
# Marketing OS - Department Scoping, Relocation & Bi-Directional Sync E2E Suite
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "================================================================================"
echo "   MARKETING OS — DEPARTMENT SCOPING, RELOCATION & SYNC E2E TEST RUNNER"
echo "================================================================================"

export TURSO_DATABASE_URL=""
export TURSO_AUTH_TOKEN=""
export LIBSQL_URL=""
export LIBSQL_AUTH_TOKEN=""
export ALLOW_SIMULATED_FALLBACK=true

echo ""
echo ">>> Tier 1: Running Backend REST API & DB Persistence Suite..."
node tests/test-department-api.mjs

echo ""
echo ">>> Tier 2: Running Playwright UI Relocation, Scoping & Bi-Directional Sync Suite..."
node tests/test-department-sync.mjs

echo ""
echo "================================================================================"
echo "✓ All Department Scoping, Relocation & Bi-Directional Sync tests passed cleanly!"
echo "================================================================================"
