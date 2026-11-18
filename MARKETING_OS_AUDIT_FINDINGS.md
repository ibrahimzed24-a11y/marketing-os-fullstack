# Marketing OS — Technical & Security Audit Findings

**Audit Date:** 2026-11-18  
**Audited Branch:** `feature/marketing-os-simplification` (branched cleanly from `main` at `3c05ffe`)  
**Audit Method:** Direct static codebase inspection of `server/` and `public/`  
**Status:** Read-only audit complete; awaiting plan review before remediation begins.

---

## Executive Summary

Marketing OS has a solid architectural foundation (Express + SQLite/Turso + RBAC + Watchdog + 3-Department Agent structure), **but contains critical security, data-integrity, and execution-honesty gaps** that must be fixed before running agents with real operational authority.

| Severity | Count | Primary Domains |
| :--- | :---: | :--- |
| **CRITICAL** | 4 | Auth bypass, exposed default credentials, hardcoded JWT fallback, destructive Turso hydration / fire-and-forget sync |
| **HIGH** | 5 | Plaintext secrets in DB, missing RBAC guards on approvals/handoffs, mock agent execution presented as LLM runs, hardcoded frontend handoff leads, missing `approved` vs `externally_executed` separation |
| **MEDIUM** | 2 | Monolithic legacy UI + mock frontend arrays, overlapping runner modules & swallowed errors |

---

## Detailed Findings

### [AUD-001] Unauthenticated Dev Password Reset Endpoint with Default Fallback Key
- **Severity:** `CRITICAL`
- **Phase:** Phase 0 — Security & Data Integrity
- **Affected Files:** `server/index.js` (lines `201–213`)
- **Evidence:**
  ```javascript
  app.post('/api/auth/reset-password-dev', asyncHandler(async (req, res) => {
    const { email, newPassword, devKey } = req.body;
    const expectedKey = process.env.OS_API_KEY || 'local-dev-key-change-me';
    if (devKey !== expectedKey) return res.status(401).json({ error: 'Unauthorized: Invalid devKey' });
  ```
- **Risk:** If `OS_API_KEY` is unset in any deployed environment, any external caller can reset `admin@marketingos.local` (or any account's) password using the public default `'local-dev-key-change-me'`.
- **Required Fix:** Remove or strictly disable this endpoint outside `NODE_ENV === 'development'` with a mandatory non-default env secret, and move password recovery to an authenticated/tokenized workflow.

---

### [AUD-002] Default Credentials Pre-Filled & Exposed in Frontend Login HTML + Cold-Start Auto-Seed
- **Severity:** `CRITICAL`
- **Phase:** Phase 0 — Security & Data Integrity
- **Affected Files:**
  - `public/index.html` (lines `1593–1616`)
  - `server/autoSeed.js` (lines `21–24`)
  - `server/seed.js` (lines `15–18`)
- **Evidence:**
  - `public/index.html:1593, 1597`: Login inputs ship with `value="admin@marketingos.local"` and `value="Admin123!"`.
  - `public/index.html:1605–1613`: Quick-login buttons expose `autofillLogin('admin@marketingos.local','Admin123!')`, `Manager123!`, and `Member123!` in client HTML.
  - `server/autoSeed.js:21–24`: Automatically seeds default accounts with weak static passwords whenever `users` table is empty.
- **Risk:** Full administrative account takeover on any newly deployed or freshly hydrated instance.
- **Required Fix:** Remove all hardcoded values and quick-login credential buttons from `public/index.html`. Gate auto-seeding behind explicit dev-only environment flags (`ALLOW_DEV_SEED=true`) and require initial admin password via env var or forced first-login rotation.

---

### [AUD-003] Hardcoded Fallback JWT Signing Secret
- **Severity:** `CRITICAL`
- **Phase:** Phase 0 — Security & Data Integrity
- **Affected Files:** `server/auth.js` (line `5`)
- **Evidence:**
  ```javascript
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
  ```
- **Risk:** If `JWT_SECRET` is omitted in production, attackers can forge arbitrary `super_admin` JWT tokens offline.
- **Required Fix:** Fail fast on server startup if `NODE_ENV === 'production'` and `process.env.JWT_SECRET` is missing or shorter than 32 characters.

---

### [AUD-004] Unsafe Turso Hydration (`DELETE FROM`) & Fire-and-Forget Serverless Write Mirroring
- **Severity:** `CRITICAL`
- **Phase:** Phase 0 — Security & Data Integrity
- **Affected Files:**
  - `server/turso.js` (lines `82–101`, `106–118`, `125–190`, `197–218`)
  - `server/db.js` (line `606`)
- **Evidence:**
  - `server/db.js:606` invokes `turso.mirrorWrite(sql, args)` without `await` (fire-and-forget). In Vercel Serverless, execution freezes immediately after `res.json()`, risking lost cloud writes and divergence across concurrent serverless instances.
  - `server/turso.js:150–175`: `hydrateFromTurso()` disables foreign keys (`PRAGMA foreign_keys = OFF`), iterates over `SYNC_TABLES`, executes `DELETE FROM ${tableName}` per table without a unified outer transaction, backup snapshot, or row-count verification, and silently ignores per-table failures (`catch (tableErr) {}`).
  - `server/turso.js:113, 215`: `ensureTursoSchema()` and `pushAllToTurso()` swallow exceptions with empty `catch (_) {}` blocks.
- **Risk:** Silent data loss, corrupted partial hydration, and split-brain divergence between Vercel serverless instances and Turso Cloud.
- **Required Fix:**
  - Make Turso the authoritative Source of Truth in serverless deployments (awaited durable writes before sending HTTP response) and treat local SQLite strictly as a verified cache or dev store.
  - Wrap hydration in backup + single atomic transaction + post-hydration row/FK verification, and log all sync errors visibly rather than swallowing them.

---

### [AUD-005] Plaintext API Keys & Sample Passwords Stored in Database Without Encryption-at-Rest
- **Severity:** `HIGH`
- **Phase:** Phase 0 — Security & Data Integrity
- **Affected Files:**
  - `server/llmConfig.js` (lines `257`, `384`)
  - `server/seedLogins.js` (line `535` and credential seed entries)
  - `server/db.js` (lines `298–325`)
- **Evidence:**
  - `admin_llm_configs.api_key` stores LLM provider keys directly as plaintext text columns (masked only on API serialization, never encrypted at rest).
  - `server/seedLogins.js` embeds hardcoded plaintext credential strings (e.g. `Whalesync#Programmatic2026`) into `saved_logins`.
- **Risk:** Any database dump, backup leak, or Turso read exposure immediately compromises all connected LLM keys and third-party logins.
- **Required Fix:** Implement AES-256-GCM encryption/decryption using an external `VAULT_ENCRYPTION_KEY` environment variable before persisting secrets to `admin_llm_configs`, `vault_items`, and `saved_logins`. Remove hardcoded credentials from seed files.

---

### [AUD-006] Missing RBAC `requireRole` Guards on Approvals & Cross-Department Handoffs
- **Severity:** `HIGH`
- **Phase:** Phase 0 — Security & Data Integrity & Phase 4 — Governance
- **Affected Files:** `server/index.js` (lines `1764`, `1837`, `1879`, `1929`)
- **Evidence:**
  - `GET /api/approvals` (`server/index.js:1764`) uses `authMiddleware` only (no role check).
  - `POST /api/approvals` (`server/index.js:1837`) uses `authMiddleware` only.
  - `POST /api/handoff/research-to-sales` (`server/index.js:1879`) uses `authMiddleware` only.
  - `POST /api/handoff/sales-to-creative` (`server/index.js:1929`) uses `authMiddleware` only.
- **Risk:** A `client` role user can read internal agency approval payloads or create projects/deals via handoff endpoints.
- **Required Fix:** Apply strict `requireRole(...)` guards on all internal approval and handoff routes and cover them with automated `403` RBAC tests.

---

### [AUD-007] Agents Return Hardcoded/Template Outputs Disguised with Active LLM Metadata & Silent DB Failure Swallowing
- **Severity:** `HIGH`
- **Phase:** Phase 1 — Agent Engine
- **Affected Files:** `server/agentFramework.js` (lines `101–570`, `186`, `602–645`)
- **Evidence:**
  - `executeAgentTask` calls synchronous template functions (`executeMarketIntel`, `executeLeadResearch`, `executeOutreachSequence`, `executeLandingPage`, etc.) without making any real LLM API request, yet stamps `outputJson.metadata = { provider: llmConfig.provider, model: llmConfig.model }` (`server/agentFramework.js:610–618`).
  - `executeLeadResearch` wraps `INSERT INTO leads` inside an empty `catch (_) {}` (`server/agentFramework.js:186`).
  - Approval insertion failure at `server/agentFramework.js:642` does not fail or roll back the task run.
  - No `agent_runs` execution log table, no timeouts, and no retry policy exist in `agentFramework.js`.
- **Risk:** Users cannot distinguish real AI/research work from hardcoded mock templates, and failed DB operations still report `ok: true` and `in_review`.
- **Required Fix:** Wire `BaseAgent` to real LLM execution via `llmConfig`, add explicit `data_source` (`live` vs `fallback`/`mock`), record every execution in an `agent_runs` table, add timeouts/retries, and abort/fail the task cleanly if any DB operation fails.

---

### [AUD-008] Frontend Research-to-Sales Handoff Sends Hardcoded Placeholder Leads
- **Severity:** `HIGH`
- **Phase:** Phase 2 — Simplification & Phase 3 — Unified Workflow
- **Affected Files:** `public/app.js` (lines `3778–3810`)
- **Evidence:**
  - `handoffResearchToSales()` hardcodes two fictional contacts (`Dr. Michael Vance`, `Sarah Jenkins`) in the `POST /api/handoff/research-to-sales` request body instead of reading verified leads produced by the Research Agent.
- **Risk:** Corrupts the CRM with fake leads during real operations and breaks genuine Research → Sales data continuity.
- **Required Fix:** Pull actual discovered/verified leads from the selected Research task/project and let the user review/select which leads to hand off.

---

### [AUD-009] No Technical Distinction Between `Approved` and `Externally Executed` States
- **Severity:** `HIGH`
- **Phase:** Phase 4 — Approval & Execution Controls
- **Affected Files:**
  - `server/db.js` (lines `519–536`)
  - `server/index.js` (lines `1789–1835`)
- **Evidence:**
  - `approvals` table only contains `status IN ('pending','approved','rejected','revision_requested')`.
  - `POST /api/approvals/:id/decision` updates `approvals.status` in SQLite without distinguishing between human approval and actual external dispatch (email sent, ad campaign launched, social post published, website deployed). No idempotency key or external execution receipt is stored.
- **Risk:** Approving a draft in the UI can be misinterpreted as external execution having succeeded (or vice versa), and retries risk duplicate external side effects.
- **Required Fix:** Add explicit `execution_status` (`not_executed | staged | dispatched | externally_executed | execution_failed`), `idempotency_key`, `executed_at`, and `execution_receipt` columns, backed by guarded execution adapters.

---

### [AUD-010] Monolithic Frontend Contains Legacy Modules & Hardcoded Mock Team Arrays
- **Severity:** `MEDIUM`
- **Phase:** Phase 2 — Application Simplification
- **Affected Files:** `public/index.html` (~1,650 lines), `public/app.js` (~3,850 lines, specifically lines `708–711`)
- **Evidence:**
  - `public/app.js:708–711` defines hardcoded fallback team member objects (`Ibrahim Zid`, `Nadia Hassan`, `Sara Manager`, `Omar Member`) in frontend state.
  - Legacy views/controls remain mixed inside the monolithic HTML/JS alongside the simplified 9-item navigation.
- **Risk:** Stale mock data shown in UI and high regression risk if components are hidden without checking backend/workflow usage first.
- **Required Fix:** Audit every view/component against backend routes before hiding or removing; replace mock arrays with real `/api/users` and backend-sourced state.

---

### [AUD-011] Overlapping Execution Runners & Swallowed Exceptions in `n8n.js`
- **Severity:** `MEDIUM`
- **Phase:** Phase 0 — Security/Logging & Phase 1 — Agent Engine
- **Affected Files:** `server/n8n.js` (lines `4`, `39`, `70`), `server/localRunner.js`
- **Evidence:**
  - `server/n8n.js` swallows errors with `catch (_) {}` across 3 code paths without writing to `error_log`.
  - `server/localRunner.js` overlaps conceptually with `server/agentFramework.js`, creating ambiguity over which runner owns pipeline execution.
- **Risk:** Silent automation failures and maintenance drift between two runner codepaths.
- **Required Fix:** Standardize on `server/agentFramework.js` as the single agent execution framework, log all `n8n.js` errors structurally, and verify whether `localRunner.js` is still referenced before deprecating or consolidating it.
