# Automation Catalog — Workflows, Sidecars & Schedulers

**Document Version:** 2.0.0  
**Target Engine:** n8n v1.x (`http://localhost:5678`) + Antigravity Sidecars  
**Author:** Principal Automation Architect  
**Date:** 2026-11-16  

---

## 1. n8n Visual Automation Workflows

All workflow definitions reside under `n8n-workflows/` and can be imported directly into n8n:

### 1.1 `01-main-task-router.json` (Main Task Router)
- **Path:** `n8n-workflows/01-main-task-router.json`
- **Trigger:** Webhook POST `/webhook/marketing-os-task` (Response Mode: `onReceived`)
- **Nodes & Logic Flow:**
  1. **Webhook Ingress:** Ingests task payload (`task_id`, `pipeline`, `title`, `description`, `harness`, `callback_url`).
  2. **Switch by Pipeline:** Branches execution by pipeline type (`landing-page`, `content-seo`, `lead-research`, `market-intel`, etc.).
  3. **Call Antigravity / LLM:** Dispatches prompt enforcing the 5-stage loop, ground truth rules, and deliverable format.
  4. **Callback to OS:** Posts execution results, output JSON, and markdown Admin Report to `callback_url` (`/api/webhooks/n8n`) with `x-os-api-key` header.
- **Failover:** `continueOnFail: true` ensures that LLM timeout or error does not drop the task; fallback payload is sent to OS callback.

### 1.2 `02-landing-page-factory.json` (Landing Page Factory)
- **Path:** `n8n-workflows/02-landing-page-factory.json`
- **Trigger:** Webhook POST `/webhook/marketing-os-landing`
- **Nodes & Logic Flow:**
  1. **Webhook Ingress:** Ingests project brief, wireframe specs, and target offer.
  2. **HTML Assembly & Tailwind Injection:** Generates clean, responsive HTML with dual CTAs, features grid, and lead capture form.
  3. **W3C & Responsive Check:** Validates semantic structure and viewport tags.
  4. **Callback to OS:** Delivers output with `type: "html"` and verification report.

### 1.3 `03-lead-research.json` (Lead Intelligence & Enrichment)
- **Path:** `n8n-workflows/03-lead-research.json`
- **Trigger:** Webhook POST `/webhook/marketing-os-leads`
- **Nodes & Logic Flow:**
  1. **Webhook Ingress:** Ingests target company URL and job titles.
  2. **Domain Scraper & SERP Query:** Gathers verified company facts and leadership profiles.
  3. **ICP Match Scoring Node:** Calculates match score (0-100) and formats contact records.
  4. **Callback to OS:** Delivers structured leads array and enrichment evidence.

---

## 2. Background Sidecar Cron Schedulers

### 2.1 Daily Marketing OS Automated Verification Job
- **Configuration File:** `~/.gemini/config/sidecars/daily-marketing-os-test/sidecar.json`
- **Schedule:** `CRON_TZ=Africa/Cairo 0 9 * * *` (Every morning at 09:00 AM)
- **Target Command:** `bash "~/Desktop/Marketing Os /test-flow.sh"`
- **Log File:** `~/Desktop/Marketing Os /test-flow.log`
- **Restart Policy:** `always`
- **Permissions:** Full read/write within workspace.
- **Purpose:** Executes automated health, RBAC, and pipeline validation every morning to guarantee system operational readiness before business hours.

---

## 3. Automation Reliability & Failover Strategy

| Failure Scenario | Impact | System Reaction & Recovery Policy |
| :--- | :--- | :--- |
| **n8n Process Down** | Webhook fails with Connection Refused | `server/n8n.js` logs warning, catches exception, and seamlessly routes task to `server/localRunner.js`. Task finishes with `status: "in_review"`. |
| **n8n Webhook Timeout (10s)** | External call hangs | `AbortController` triggers abort at 10,000ms. AbortError is caught, and local agent fallback takes over immediately. |
| **Dual-Stack DNS Lag (`localhost`)** | IPv6 vs IPv4 resolution failure | `server/n8n.js` attempts primary URL (`127.0.0.1`), and if unreachable, automatically retries on `localhost` with second timeout window. |
| **Callback Network Failure** | n8n cannot reach OS callback | Task remains in `running` status. Automatic cleanup job detects stale running tasks (>300s) and marks them for retry or local fallback. |
