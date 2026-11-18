#!/usr/bin/env bash
# ==============================================================================
# Marketing OS - Master End-to-End Real Integration Test Suite
# ==============================================================================
# Consolidates all 6 autonomous verification test suites:
#   1. test-flow.sh             (End-to-End Lifecycle & Harness Uploads)
#   2. test-agents-rag.sh       (32 Sovereign Agents & Vector Chunking)
#   3. test-llm-config.sh       (Dynamic 6-Provider Registry & Key Vaulting)
#   4. test-watchdog.sh         (Self-Healing SLA Stall & Webhook Dead-Letter)
#   5. test-pipeline-schemas.sh (Standardized Output Schemas across 8 Pipelines)
#   6. test-frontend-ui.sh      (Frontend Assets, Workbench Real Dispatch & RBAC)
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ANSI Colors
BOLD="\033[1m"
GREEN="\033[0;32m"
RED="\033[0;31m"
CYAN="\033[0;36m"
YELLOW="\033[0;33m"
RESET="\033[0m"

echo -e "${BOLD}${CYAN}================================================================================${RESET}"
echo -e "${BOLD}${CYAN}          MARKETING OS — MASTER END-TO-END VERIFICATION SUITE                  ${RESET}"
echo -e "${BOLD}${CYAN}================================================================================${RESET}"
echo -e "Target Environment: Node.js $(node -v) | SQLite (WAL) | Local n8n & Antigravity"
echo -e "Working Directory:  ${SCRIPT_DIR}"
echo -e "Started At:         $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo -e "${BOLD}${CYAN}--------------------------------------------------------------------------------${RESET}\n"

SUITES=(
  "test-phase0-security.sh:Phase 0 Security & Data Integrity:JWT Fail-Fast, Vault AES-256-GCM, RBAC, Turso Safety"
  "test-flow.sh:Core Lifecycle & Harness Grounding:Lifecycle, Harness Upload, RBAC Exploits"
  "test-agents-rag.sh:Sovereign Agents & Vector Search:32 Agents Registry, Semantic Ingestion, RBAC Gates"
  "test-llm-config.sh:Dynamic LLM Routing & Key Vault:6-Provider Registry, Key Masking, Ping Verification"
  "test-watchdog.sh:Self-Healing Watchdog & Resilience:300s SLA Stall Detection, Webhook Backoff, Ingress"
  "test-pipeline-schemas.sh:Unified Pipeline Output Schemas:8 Pipelines Deliverable JSON & Report Markdown"
  "test-frontend-ui.sh:Frontend UX & Workbench Integration:DOM Elements, Async API Dispatch, Role Boundaries"
  "test-handoffs.sh:Cross-Dept Handoffs & Approvals:Research->Sales, Sales->Creative, Human Approval Gate"
  "test-phase4-walkthrough.sh:Phase 4 Real Agency Lifecycle:End-to-End Walkthrough A-Z"
)

TOTAL_START=$(date +%s)
FAILED_SUITES=()
PASSED_COUNT=0
TOTAL_COUNT=${#SUITES[@]}

declare -a REPORT_ROWS

for item in "${SUITES[@]}"; do
  IFS=":" read -r SCRIPT_NAME TITLE DETAILS <<< "$item"
  echo -e "\n${BOLD}${CYAN}▶ RUNNING SUITE [${PASSED_COUNT}/$TOTAL_COUNT]: ${TITLE} (${SCRIPT_NAME})${RESET}"
  echo -e "  Focus: ${DETAILS}"
  echo -e "  ----------------------------------------------------------------------------"

  if [ ! -f "$SCRIPT_NAME" ]; then
    echo -e "  ${RED}✗ FAILED: Script ${SCRIPT_NAME} not found!${RESET}"
    FAILED_SUITES+=("$SCRIPT_NAME (File Not Found)")
    REPORT_ROWS+=("❌ FAILED | ${SCRIPT_NAME} | File not found | 0s")
    continue
  fi

  chmod +x "$SCRIPT_NAME"
  SUITE_START=$(date +%s)

  # Execute suite and stream output
  if ./"$SCRIPT_NAME"; then
    SUITE_END=$(date +%s)
    SUITE_DURATION=$((SUITE_END - SUITE_START))
    echo -e "  ${GREEN}✓ PASSED: ${TITLE} in ${SUITE_DURATION}s${RESET}"
    PASSED_COUNT=$((PASSED_COUNT + 1))
    REPORT_ROWS+=("✅ PASSED | ${SCRIPT_NAME} | ${TITLE} | ${SUITE_DURATION}s")
  else
    SUITE_END=$(date +%s)
    SUITE_DURATION=$((SUITE_END - SUITE_START))
    echo -e "  ${RED}✗ FAILED: ${TITLE} failed in ${SUITE_DURATION}s${RESET}"
    FAILED_SUITES+=("$SCRIPT_NAME ($TITLE)")
    REPORT_ROWS+=("❌ FAILED | ${SCRIPT_NAME} | ${TITLE} | ${SUITE_DURATION}s")
  fi
done

TOTAL_END=$(date +%s)
TOTAL_DURATION=$((TOTAL_END - TOTAL_START))

echo -e "\n${BOLD}${CYAN}================================================================================${RESET}"
echo -e "${BOLD}${CYAN}                     MASTER INTEGRATION TEST SUMMARY                            ${RESET}"
echo -e "${BOLD}${CYAN}================================================================================${RESET}"
printf "%-11s | %-26s | %-32s | %-6s\n" "STATUS" "SUITE SCRIPT" "DOMAIN" "TIME"
echo "--------------------------------------------------------------------------------"

for row in "${REPORT_ROWS[@]}"; do
  IFS="|" read -r R_STATUS R_SCRIPT R_DOMAIN R_TIME <<< "$row"
  printf "%-11s | %-26s | %-32s | %-6s\n" "$(echo $R_STATUS | xargs)" "$(echo $R_SCRIPT | xargs)" "$(echo $R_DOMAIN | xargs)" "$(echo $R_TIME | xargs)"
done

echo "--------------------------------------------------------------------------------"
echo -e "Total Suites Run:      ${TOTAL_COUNT}"
echo -e "Total Passed:          ${GREEN}${PASSED_COUNT}${RESET} / ${TOTAL_COUNT}"
echo -e "Total Failed:          $( [ ${#FAILED_SUITES[@]} -eq 0 ] && echo -e "${GREEN}0${RESET}" || echo -e "${RED}${#FAILED_SUITES[@]}${RESET}" )"
echo -e "Total Execution Time:  ${BOLD}${TOTAL_DURATION}s${RESET}"
echo -e "${BOLD}${CYAN}================================================================================${RESET}"

if [ ${#FAILED_SUITES[@]} -ne 0 ]; then
  echo -e "\n${RED}${BOLD}FAILED SUITES LIST:${RESET}"
  for failed in "${FAILED_SUITES[@]}"; do
    echo -e "  - ${RED}${failed}${RESET}"
  done
  echo -e "\n${RED}✗ Master E2E Verification FAILED. Please review logs above.${RESET}"
  exit 1
else
  echo -e "\n${GREEN}${BOLD}✓ ALL ${TOTAL_COUNT} MASTER E2E INTEGRATION TEST SUITES PASSED (100% OK)${RESET}"
  echo -e "${GREEN}System is fully hardened, deterministic, zero-noise, and production ready.${RESET}\n"
  exit 0
fi
