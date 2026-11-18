# Marketing OS — Simplification & Hardening Plan

**Branch:** `feature/marketing-os-simplification`  
**Base Branch (Untouched):** `main`  
**Execution Order:** `Security (Phase 0) → Agent Engine (Phase 1) → Application Simplification (Phase 2) → Unified Workflow (Phase 3) → Approval & Execution Controls (Phase 4) → Testing & Release (Phase 5)`  
**Status:** Drafted for Review & Sign-Off (No implementation started)

---

## Core Operating Principles & Constraints

1. **Do NOT touch `main`:** All planning, audits, and subsequent implementation work happen exclusively on `feature/marketing-os-simplification` (and merge only after full verification and explicit approval).
2. **No Rebuild:** Preserve and harden the existing Marketing OS architecture, database schema, working pipelines, and reusable backend/frontend code.
3. **No Silent Destructive Changes:** Never delete data, tables, endpoints, or UI features before proving they are unused in Backend or Workflows.
4. **No Implementation Before Approval:** Do not modify application code until this plan and [MARKETING_OS_AUDIT_FINDINGS.md](./MARKETING_OS_AUDIT_FINDINGS.md) are reviewed and approved.
5. **Security Before Autonomy:** Every critical security and data-integrity defect must be resolved before running any Agent with execution capabilities.
6. **Atomic, Verifiable Commits:** Every phase and logical change must land in a clear, isolated commit with its own acceptance criteria and test proof.

---

## Phase 0: Security & Data Integrity (Highest Priority)

**Objective:** Eliminate all exposed secrets, hardcoded credentials, auth bypasses, RBAC gaps, and unsafe SQLite/Turso sync paths before any agent execution work begins.

### Scope
- **Secrets & Credentials Audit:** Remove hardcoded passwords, sample credentials, and default API keys from codebase and frontend bundles (`public/index.html`, `server/seedLogins.js`, `server/autoSeed.js`).
- **Frontend Hygiene:** Remove pre-filled login credentials and quick-login autofill buttons from production builds; guarantee zero API keys or secret tokens are exposed to client code.
- **Authentication & Password Reset Hardening:**
  - Require `JWT_SECRET` in non-test environments (fail fast at startup instead of falling back to `'dev-secret-change-me'`).
  - Disable/remove `POST /api/auth/reset-password-dev` in production (or replace with a proper authenticated/signed token reset flow).
  - Restrict dev/test auth bypasses (`ALLOW_ANONYMOUS_DEV_ADMIN`, `x-session-role`) strictly to isolated local test environments.
- **Vault & Key Encryption:** Encrypt `admin_llm_configs.api_key` and `vault_items` / `saved_logins` at rest using an externally managed encryption key (`VAULT_ENCRYPTION_KEY`) stored outside the database.
- **RBAC Enforcement:** Add explicit `requireRole(...)` guards on `/api/approvals`, `/api/handoff/research-to-sales`, `/api/handoff/sales-to-creative`, and verify role boundaries across `super_admin`, `admin`, `manager`, `member`, and `client`.
- **Turso Synchronization & SQLite Hydration Safety:**
  - Eliminate silent data destruction (`DELETE FROM` without atomic transaction/backup/verification).
  - Replace fire-and-forget `mirrorWrite` on Vercel Serverless with awaited, durable write guarantees or Turso-as-Source-of-Truth for serverless persistence.
  - Replace empty `catch (_) {}` blocks in `server/turso.js`, `server/db.js`, and `server/n8n.js` with structured error logging to `error_log` and observable health telemetry.

### Acceptance Criteria (Success Condition)
- Zero exposed credentials or pre-filled passwords in Frontend or tracked files.
- Server fails fast if required security env vars (`JWT_SECRET`, `VAULT_ENCRYPTION_KEY`) are missing in production.
- All RBAC boundary tests pass (Client cannot read internal approvals or execute handoffs).
- No sync/hydration routine can wipe or partially overwrite data silently; every sync operation is transactional, verified, and logged.

---

## Phase 1: Agent Engine (3 Core Sovereign Agents)

**Objective:** Upgrade the 3 core Agents from hardcoded/template outputs to real, verifiable, fault-tolerant execution connected to their designated Skills and LLM providers.

### The 3 Core Agents

| Agent | Department | Responsibilities |
| :--- | :--- | :--- |
| **Agent 01 — Research Agent** | Research | Market Research, Competitor Analysis, Lead Discovery & Verification, SEO Research, GEO Research |
| **Agent 02 — Sales Agent** | Sales | Lead Qualification, CRM Enrichment, Outreach Drafting, Follow-ups, Meeting & Proposal Prep |
| **Agent 03 — Creative Agent** | Creative & Delivery | Service Delivery (Social, Google Ads, SEO, GEO, Branding, Website Building, Media Buying), Production WBS, Brand QA |

### Scope
- **Real Execution over Hardcoded Mocks:** Connect `BaseAgent` / `executeAgentTask` in `server/agentFramework.js` to actual configured LLM providers (`server/llmConfig.js`) and grounded harness/RAG context (`server/rag.js`).
- **Skill Registry Wiring:** Bind each Agent cleanly to its department skills and SOPs; remove ambiguity between `localRunner.js` and `agentFramework.js`.
- **Unified Execution Contract:** Standardize inputs, grounded JSON deliverables, Admin Report Markdown, metadata, and `execution_mode` / `data_source` (`live` vs `simulated`/`fallback` explicitly labeled—never disguised as live).
- **Resilience Controls:** Add explicit timeout budgets, safe retry policies with backoff, provider failover handling, and structured error reporting.
- **Transactional Integrity on Agent Runs:**
  - Add an `agent_runs` audit table recording `run_id`, `agent_id`, `task_id`, `skill`, `provider`, `model`, `status`, `duration_ms`, `tokens/cost`, `data_source`, and `error_details`.
  - Guarantee an Agent **never** reports task success if any database write (lead insertion, approval creation, deliverable persistence) fails.

### Acceptance Criteria (Success Condition)
- Each of the 3 Agents executes a real task grounded in project context and harness files.
- Outputs are traceable via `agent_runs`, clearly distinguishing live LLM outputs from any fallback/test fixture.
- Simulated DB failure or provider timeout fails cleanly with accurate error logs and zero false-positive `in_review`/`delivered` states.

---

## Phase 2: Application Simplification (UI & Navigation)

**Objective:** Deliver a clean, focused operational interface without breaking or deleting any active backend functionality or workflow dependency.

### Target Navigation Structure (9 Core Views)
1. **Overview** — KPIs, Action Required approvals queue, 3-department shortcuts, real-time audit stream.
2. **Research** — Research Agent workspace, market/competitor/SEO/GEO briefs, discovered leads table, handoff trigger.
3. **Sales CRM** — Pipeline stages, leads/companies/deals CRUD, outreach drafts, handoff to onboarding.
4. **Creative Studio** — Active client workspaces, service categories, Creative Agent WBS & production queue.
5. **Projects & Tasks** — Unified task board, harness uploads, deliverable viewer, run history.
6. **Approvals** — Centralized Human-in-the-Loop review queue, payload inspection modal, audit history.
7. **Team** — Internal team roster, roles, permissions, workload visibility.
8. **Knowledge Base** — Client harness files, SOPs, brand guidelines, RAG search.
9. **Settings** — LLM Provider Registry, Turso/Sync status, Watchdog health, Password & Security controls.

### Mandatory Pre-Removal Audit Rule
- Before hiding, consolidating, or removing any existing screen, modal, or JS helper in `public/index.html` / `public/app.js`, map its API endpoints and workflow references in `IMPLEMENTATION_TRACKER.md`.
- Remove hardcoded dummy frontend arrays (e.g. mock team list in `public/app.js:708-711`, hardcoded leads in `handoffResearchToSales`) and bind views strictly to live backend APIs.

### Acceptance Criteria (Success Condition)
- All 9 navigation sections load cleanly from real backend data with zero console errors.
- No active backend endpoint or workflow is orphaned or broken by UI simplification.

---

## Phase 3: Unified End-to-End Workflow

**Objective:** Ensure seamless, zero-reentry operational flow across the full agency lifecycle.

```
Research (Market Intel · Leads · SEO · GEO)
   │  [Verified Leads + Research Brief]
   ▼
Sales (Qualification · Outreach · CRM · Deals)
   │  [Closed-Won Deal + Client Scope]
   ▼
Client Onboarding (Client Context · Brief · Scope · Project Setup)
   │  [Client Workspace + Harness Grounding]
   ▼
Creative Studio (Service SOP · Task Assignment · Production · QA)
   │  [Deliverable JSON + Report MD + Assets]
   ▼
Human Approval & Delivery (Review · Approve · Publish · Deliver)
```

### Scope
- Replace hardcoded handoff payloads with real selection of verified leads from Research tasks and real deal/scope records from Sales CRM.
- Ensure Client Onboarding captures brief, guidelines, target services, and team assignments in one transactional flow.
- Preserve full traceability (`origin_research_task_id` → `lead_id` → `deal_id` → `project_id` → `delivery_task_id`).

### Acceptance Criteria (Success Condition)
- Real data flows end-to-end from Research → Sales → Onboarding → Creative → Approval → Delivery with zero manual copy-paste and full foreign-key traceability.

---

## Phase 4: Approval & Execution Controls (Governance)

**Objective:** Enforce strict separation between autonomous preparation and human-approved external execution.

### Autonomy & Approval Policy Matrix

| Operation | Policy |
| :--- | :--- |
| Research (Market, Competitor, SEO, GEO) | **Automatic** |
| Lead qualification | **Automatic** |
| Email drafting | **Automatic** |
| **Sending emails** | **Human approval required** |
| Social content creation | **Automatic** |
| **Publishing content** | **Human approval required** |
| Google Ads setup / drafting | **Automatic** |
| **Launching campaigns / spending budget** | **Human approval required** |
| **Website changes** | **Stage first, approve publishing** |
| **Final client delivery** | **Human approval required** |

### Technical State Separation (Mandatory)
The system must explicitly separate three distinct lifecycle states—changing a DB status must **never** imply an external side effect occurred:
1. **`task_status`** (`draft` → `running` → `in_review` → `completed` / `needs_fix`) — Agent finished generating the artifact.
2. **`approval_status`** (`pending` → `approved` / `rejected` / `revision_requested`) — Authorized human reviewed and signed off.
3. **`execution_status`** (`not_executed` → `staged` → `dispatched` → `externally_executed` / `execution_failed`) — Actual external connector/integration confirmed execution with an idempotency key and external receipt/log.

### Acceptance Criteria (Success Condition)
- Approving an item never falsely claims an email was sent or ad launched unless an actual execution adapter runs and returns a verified external receipt.
- Unauthorized roles (e.g., `member`, `client`) are blocked (`403`) from approving or triggering external execution.
- Idempotency keys prevent duplicate external dispatch on retries or double-clicks.

---

## Phase 5: Testing & Release

**Objective:** Verify the entire hardened system under automated tests, failure modes, and staged rollout before touching `main` or production.

### Scope
- Run all existing E2E suites (`test-all-e2e.sh`) and fix any failures without weakening assertions.
- Add dedicated test suites for:
  - **Security & RBAC:** JWT enforcement, disabled dev reset, encrypted vault keys, role isolation.
  - **3 Core Agents:** Real/grounded execution contract, DB failure rollback, `agent_runs` logging, `data_source` honesty.
  - **CRM CRUD & Data Persistence:** Full Companies/Leads/Deals lifecycle and Turso sync/hydration integrity.
  - **Approval & Execution Controls:** Role gates, `approved` vs `externally_executed` state separation, idempotency.
  - **Unified Workflow A–Z:** Research → Sales → Onboarding → Creative → Approval → Delivery.
  - **Failure & Retry Resilience:** External LLM timeout/quota failure, webhook backoff, Watchdog stall recovery.
- **Release Gate:**
  1. Deploy branch `feature/marketing-os-simplification` to **Staging / Preview** (Vercel preview + isolated Turso staging DB).
  2. Run smoke + E2E verification on Staging.
  3. Only after human sign-off, open PR to `main` and deploy to **Production**.

### Acceptance Criteria (Success Condition)
- 100% of automated test suites pass with zero skipped security checks.
- Staging environment passes full A–Z operational verification.
- Production release approved and verified with rollback plan ready.
