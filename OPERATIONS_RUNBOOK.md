# Operations Runbook — Marketing Operating System

## 1. Quick Reference & System Health
- **App URL:** `http://localhost:3000`
- **n8n URL:** `http://localhost:5678`
- **Health Check Endpoint:** `GET http://localhost:3000/api/health`
- **Primary Database File:** `./data/marketing-os.db`
- **Uploads Directory:** `./uploads`
- **Log Locations:**
  - Server logs: stdout / system log
  - Test suite logs: `test-flow.log`
  - Workflow orchestrator logs: `marketing_os_workflow.log`

---

## 2. Daily Operational Routine

### Morning (09:00 AM)
1. Automated sidecar cron fires `test-flow.sh`. Check `test-flow.log` to ensure all tests passed.
2. Login to Command Center as Admin / Manager.
3. Review tasks in the **In Review** queue (`statReview` on dashboard).
4. Review Admin Reports, inspect HTML previews via "Preview Page", and click **Approve & Deliver** for verified assets.

### Midday
1. Ingest new client harness files into target projects via `/api/projects/:id/harness`.
2. Dispatch 1–2 pipeline tasks in the Pipeline Workbench.
3. Monitor real-time execution status (queued $\rightarrow$ running $\rightarrow$ in_review).

### Evening
1. Confirm all approved tasks reflect on Client Dashboards.
2. Review system activity logs via `GET /api/activity`.
3. Check disk storage and database file size.

---

## 3. Incident Management & Disaster Recovery

### Scenario A: Server Crash or Port 3000 Blocked
1. Check running process:
   ```bash
   lsof -i :3000
   ```
2. Terminate hung process if necessary:
   ```bash
   kill -9 <PID>
   ```
3. Restart server:
   ```bash
   npm run dev
   ```

### Scenario B: Database Locked or Corrupted
1. SQLite WAL mode ensures transactional recovery. If WAL files need checkpointing:
   ```bash
   sqlite3 data/marketing-os.db "PRAGMA wal_checkpoint(TRUNCATE);"
   ```
2. To restore from backup:
   ```bash
   cp data/marketing-os.db.bak data/marketing-os.db
   ```
3. Emergency re-seed (Caution: Replaces seed users & projects):
   ```bash
   npm run seed
   ```

### Scenario C: n8n Engine Offline
- **Impact:** None on factory continuity. The task runner immediately shifts to Antigravity Local Fallback (`server/localRunner.js`), generating grounded deliverables and Admin Reports without interruption.
- **Resolution:**
  ```bash
  npx n8n start
  ```
  Once restarted, future tasks resume routing through n8n automatically.

---

## 4. Backup & Maintenance Procedures
- **Daily Automated Backup Command:**
  ```bash
  sqlite3 data/marketing-os.db ".backup 'data/backup-$(date +%Y%m%d).db'"
  ```
- **Cleanup of Temporary Uploads:**
  ```bash
  find ./uploads -type f -mtime +30 -delete
  ```
