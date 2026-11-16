# DIAGNOSIS.md — Marketing OS Admin Factory

**Author:** @coordinator (Boss)  
**Date:** 2026-11-16  
**Status:** Diagnosed, Ready for Fix

---

## 1. System & Port Connectivity
| Service | Target URL | Status | Details |
|---|---|---|---|
| **Marketing OS** | `http://localhost:3000/` | **200 OK** | Node Express API & frontend serving properly |
| **Marketing OS Health** | `http://localhost:3000/api/health` | **200 OK** | Responding to health probes |
| **n8n (localhost)** | `http://localhost:5678/` | **DOWN (Connection Refused)** | n8n process not active on port 5678 |
| **n8n (127.0.0.1)** | `http://127.0.0.1:5678/` | **DOWN (Connection Refused)** | n8n process not active on IPv4 either |

---

## 2. Database Inspection (`data/marketing-os.db`)
SQLite database exists and contains the 4 seed users:
- `admin@marketingos.local` (`super_admin`, active)
- `manager@marketingos.local` (`manager`, active)
- `member@marketingos.local` (`member`, active)
- `client@marketingos.local` (`client`, active)

---

## 3. Root Cause Analysis of Reported Bugs

### BUG 1 — n8n: "n8n not reachable. Task is queued. Start n8n and Retry. fetch failed"
1. **n8n is not running on port 5678**:
   - `npx n8n start` failed to install/start cleanly due to peer dependency conflicts between npm 10 / Node 22 and packages within n8n (`@getzep/zep-cloud`, `zod`, `openai`, `@langchain/community`).
   - Node on macOS defaults to IPv6 (`::1`) when resolving `localhost` in Node 18+, which causes `fetch failed` if the listener is bound strictly to `127.0.0.1` or vice-versa.
2. **Missing Local Fallback**:
   - `server/n8n.js` and `server/index.js` currently have no graceful local execution fallback. When n8n is offline or unreachable, the system abruptly queues the task and returns an alert error to the user, completely stalling the factory.
3. **Workflow Issues (`01-main-task-router.json`)**:
   - In `n8n-workflows/01-main-task-router.json`, the `Switch by Pipeline` node has disconnected outputs. The connections object only links `Webhook` -> `Switch by Pipeline`, leaving `Call Antigravity / LLM` and `Callback to OS` orphaned.
   - The workflow `active` flag was set to `false`.

### BUG 2 — Auth: Login as `manager@marketingos.local` says "Invalid credentials"
1. **Frontend Input Sanitization**:
   - In `public/index.html`, `login()` passes raw `document.getElementById('email').value` and `password` without `.trim()` or `.toLowerCase()`. If whitespace is copied or typed, or capital letters are entered, the credentials fail lookup or bcrypt comparison.
2. **Token & State Handling**:
   - Failed login attempts do not invalidate previously cached tokens in `localStorage.getItem('mos_token')`, causing desync between the UI session and server state.
3. **Missing Developer Reset Utility**:
   - No direct diagnostic or DEV password reset endpoint existed in `server/index.js` to inspect or reset passwords without wiping the entire database.

---

## 4. Remediation Plan
1. **Auth Fixes**: Deploy `fix/reset-users.js`, add `POST /api/auth/reset-password-dev`, update `public/index.html` login handler with `.trim().toLowerCase()`.
2. **Network & Connection Resilience**: Update `.env` to prefer `127.0.0.1:5678`, add retry/dual-stack fallback (localhost + 127.0.0.1) in `server/n8n.js` with 10s timeout.
3. **Local Fallback Engine**: Add immediate local agent execution fallback in `server/index.js` for all 8 pipelines when n8n is offline so the factory never blocks.
4. **Repair Workflows**: Fix node connections and callback parameters in `n8n-workflows/01-main-task-router.json` and document activation in `N8N_SETUP.md`.
5. **RBAC & Role Dashboards**: Enforce server-side role permissions on PATCH delivery and tailor UI tabs per role.
