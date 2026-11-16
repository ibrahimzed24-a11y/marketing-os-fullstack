# Testing Strategy & Quality Assurance Architecture

## 1. Quality Assurance Philosophy
In Marketing OS, **"Implemented" is never confused with "Verified"**. Every capability, security boundary, and pipeline must pass reproducible test suites with concrete action receipts before being declared ready for production.

---

## 2. Testing Levels & Matrix

```
       ▲
      / \     Level 4: End-to-End User Journeys (test-flow.sh & Browser checks)
     /   \
    /     \   Level 3: Adversarial Security & RBAC Boundary Testing (61 test cases)
   /       \
  /         \ Level 2: Pipeline Integration & Fallback Resilience (marketing_os_workflow.py)
 /           \
/_____________\ Level 1: Unit & Relational Model Integrity (DB & Password Cryptography)
```

### 2.1 Level 1: Unit & Relational Integrity
- **Scope:** Database constraints, foreign keys, unique email index, bcrypt hash verification.
- **Verification Tool:** `fix/reset-users.js` and SQLite pragmas.

### 2.2 Level 2: Pipeline Integration & Failover Resilience
- **Scope:** All 8 marketing pipelines (`landing-page`, `content-seo`, `social-content`, `ads-creative`, `email-campaign`, `lead-research`, `market-intel`, `brand-kit`).
- **Resilience Assertion:** When n8n is offline, the task runner must seamlessly fall back to local agent execution, write `output_json` and `report_md`, and transition task status to `in_review` without blocking.
- **Verification Tool:** `python3 marketing_os_workflow.py`.

### 2.3 Level 3: Adversarial Security & RBAC Testing
- **Scope:**
  - Role isolation across all 5 roles (`super_admin`, `admin`, `manager`, `member`, `client`).
  - Negative assertion: Unauthorized member PATCH to `status='delivered'` MUST return HTTP 403 Forbidden.
  - Negative assertion: Client GET unapproved task MUST return HTTP 403 Forbidden.
  - Type-confusion tests: Array or object wrapped status payloads are rejected or sanitized.

### 2.4 Level 4: Realistic End-to-End Business Scenario
- **Scenario:**
  1. Login as Super Admin (`admin@marketingos.local`).
  2. Create Project: "Automated Growth Engine".
  3. Attach team members (Manager, Member, Client).
  4. Create Task: "Landing Page for Nile Supplies".
  5. Run task $\rightarrow$ Verify execution in review with grounded HTML output.
  6. Attempt Member delivery $\rightarrow$ Confirm 403 rejection.
  7. Admin approves & delivers $\rightarrow$ Confirm 200 OK.
  8. Login as Client $\rightarrow$ Verify client only sees delivered tasks.
- **Verification Tool:** `bash test-flow.sh`.

---

## 3. Daily Continuous Automated Verification
- **Automated Sidecar:** Runs every morning at 09:00 AM (`CRON_TZ=Africa/Cairo 0 9 * * *`).
- **Execution Script:** `test-flow.sh` with stdout/stderr piped to `test-flow.log`.
- **Alerting:** Any non-zero exit code triggers an emergency alert logged in `test-flow.log`.
