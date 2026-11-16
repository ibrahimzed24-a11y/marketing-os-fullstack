# Marketing OS — Production Operations & Deployment Runbook

> **Version:** 2.4 (Hardened Full-Stack Edition)  
> **Repository:** `https://github.com/ibrahimzed24-a11y/marketing-os-fullstack.git`  
> **Status:** Production-Ready & Verified  
> **Last Updated:** November 2026

---

## 1. System Architecture & High-Signal Mandate

Marketing OS is an enterprise, sovereign marketing factory combining a high-performance Express backend, SQLite WAL persistence, local/cloud n8n webhook automation, dynamic multi-provider LLM orchestration, and an abstracted, zero-noise agency frontend.

```
+-----------------------------------------------------------------------------+
|                               FRONTEND (Vanilla JS)                         |
|  - Role-Tailored Views: Client Portal, Member Queue, Manager/Admin Studio   |
|  - Real API Dispatch (Zero Client Timers / Zero Simulation)                 |
|  - Strict UI Abstraction: Zero Agent Monologue / Only Clean Deliverables    |
+-----------------------------------------------------------------------------+
                                      │ HTTP / JSON
                                      ▼
+-----------------------------------------------------------------------------+
|                          EXPRESS REST API & RBAC GATE                       |
|  - Role Hierarchy: super_admin > admin > manager > member > client          |
|  - Unified Ingress & Payload Validation (POST /webhook/marketing-os-task)   |
|  - Rate Limiting, CORS & Token Authentication                               |
+----------------------+------------------------------+-----------------------+
                       │                              │
                       ▼                              ▼
+--------------------------------------+  +-----------------------------------+
|      DYNAMIC LLM ROUTING ENGINE      |  |       SELF-HEALING WATCHDOG       |
|  - Local: Ollama, LM Studio, vLLM    |  |  - 300s Task SLA Stall Detection  |
|  - Cloud: OpenAI, Anthropic, Gemini  |  |  - Exponential Webhook Backoff    |
|  - Masked Key Vault (SQLite)         |  |  - Dead-Letter Queue & Alerts     |
+----------------------+---------------+  +-----------------------------------+
                       │                              │
                       ▼                              ▼
+-----------------------------------------------------------------------------+
|                 DUAL EXECUTION LAYER: n8n & ANTIGRAVITY AGENTS              |
|  - 8 Standardized Pipelines: content-seo, social-content, ads-creative, ... |
|  - 32 Sovereign Specialist Agents + Local Agent Fallback Runner             |
|  - 14 SEO & GEO Hierarchical Disciplines                                    |
+-----------------------------------------------------------------------------+
                                      │
                                      ▼
+-----------------------------------------------------------------------------+
|                     SQLITE WAL PERSISTENCE FOUNDATION                       |
|  - 29 Provisioned Tables (WAL Mode, Foreign Keys Enforced, Zero-Locks)      |
|  - Atomic Transactions & Automatic Checkpointing                            |
+-----------------------------------------------------------------------------+
```

### Core Architectural Mandates
1. **Zero Noise, High Signal:** Internal agent reasoning, tool debugging chatter, and raw n8n execution steps are strictly isolated to server logs and admin reports. End users and clients only see clean task states (`Queued`, `In Progress`, `In Review`, `Delivered`), interactive HTML/lead deliverables, and approval buttons.
2. **Dynamic LLM Provider Routing:** Admins can switch between offline local LLMs (Ollama, LM Studio, vLLM) and frontier cloud endpoints (OpenAI, Anthropic, Gemini) via UI/API without server restarts.
3. **Autonomous Self-Healing:** The backend watchdog automatically recovers tasks stuck past SLA timeouts (default 300s) and retries failed webhooks with exponential backoff before dead-lettering.

---

## 2. Infrastructure & Prerequisites

### System Requirements
| Component | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **Node.js** | v18.17.0+ LTS | v20.x or v22.x LTS |
| **npm** | v9.0.0+ | v10.x+ |
| **RAM** | 2 GB (cloud-only) / 16 GB (local Ollama) | 32 GB+ (for local 8B+ models) |
| **Disk** | 1 GB SSD (Database + Assets) | 20 GB+ NVMe SSD |
| **OS** | macOS 13+, Ubuntu 22.04 LTS, Debian 12 | Linux (Ubuntu/Debian) or macOS |

### External Dependencies
* **n8n Automation Engine:** Running locally on port `5678` or reachable over HTTPS.
* **Local LLM Server (Optional for offline mode):**
  * Ollama (`http://localhost:11434/v1`)
  * LM Studio (`http://localhost:1234/v1`)
  * vLLM (`http://localhost:8000/v1`)

---

## 3. Environment Configuration & Vaulting

Create a `.env` file in the project root based on the production template below. **Never commit `.env` or production API keys to source control.**

```bash
# ------------------------------------------------------------------------------
# MARKETING OS — PRODUCTION ENVIRONMENT CONFIGURATION
# ------------------------------------------------------------------------------

# 1. Server Core Configuration
PORT=3000
NODE_ENV=production
APP_SECRET=production-jwt-hmac-sha256-secret-change-in-prod-min-32-chars
PORTAL_URL=https://marketing.yourdomain.com
CORS_ORIGIN=https://marketing.yourdomain.com

# 2. Database Foundation
DATABASE_PATH=data/marketing-os.db

# 3. Self-Healing Watchdog Engine
WATCHDOG_ENABLED=true
WATCHDOG_INTERVAL_MS=30000        # Background scan interval (default: 30s)
WATCHDOG_SLA_SECONDS=300          # Stalled task recovery threshold (default: 300s)
WEBHOOK_MAX_RETRIES=3             # Max attempts before dead-lettering

# 4. n8n Automation Engine Ingress/Egress
N8N_BASE_URL=http://127.0.0.1:5678
N8N_WEBHOOK_TASK=http://127.0.0.1:5678/webhook/marketing-os-task
OS_WEBHOOK_KEY=prod-shared-webhook-signature-key-min-32-chars

# 5. Dynamic LLM Providers (Initial Fallback Defaults)
# Note: Providers can be dynamically configured & vaulted directly in Admin Settings.
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
OLLAMA_DEFAULT_MODEL=llama3.2:latest

OPENAI_API_KEY=
OPENAI_DEFAULT_MODEL=gpt-4o-mini

ANTHROPIC_API_KEY=
ANTHROPIC_DEFAULT_MODEL=claude-3-5-sonnet-20241022

GEMINI_API_KEY=
GEMINI_DEFAULT_MODEL=gemini-1.5-pro
```

---

## 4. Production Deployment Procedures

### Method A: PM2 Process Manager (Recommended for Single/Multi-Core Host)

1. **Install PM2 globally:**
   ```bash
   npm install -g pm2
   ```

2. **Initialize Database & Seed Default Admin:**
   ```bash
   npm run seed
   ```

3. **Start Application with PM2 Ecosystem:**
   Create `ecosystem.config.js`:
   ```javascript
   module.exports = {
     apps: [{
       name: 'marketing-os',
       script: 'server/index.js',
       instances: 1, // Keep at 1 for SQLite WAL concurrency
       autorestart: true,
       watch: false,
       max_memory_restart: '1G',
       env_production: {
         NODE_ENV: 'production',
         PORT: 3000
       }
     }]
   };
   ```

4. **Launch & Enable Autostart on Boot:**
   ```bash
   pm2 start ecosystem.config.js --env production
   pm2 save
   pm2 startup
   ```

### Method B: Reverse Proxy Configuration (Nginx)

```nginx
server {
    listen 80;
    server_name marketing.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name marketing.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/marketing.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/marketing.yourdomain.com/privkey.pem;

    client_max_body_size 50M;

    # Static Assets & UI Caching
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API Webhook Buffering Settings
    location /webhook/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_buffering off;
        proxy_read_timeout 120s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 5. Dynamic LLM Provider Routing

The system supports 6 primary LLM providers partitioned into **Local First** and **Frontier Cloud APIs**.

### Supported Providers
| Provider Key | Type | Default Endpoint | Default Model | Key Required |
| :--- | :---: | :--- | :--- | :---: |
| `ollama` | Local | `http://localhost:11434/v1` | `llama3.2:latest` | No |
| `lmstudio` | Local | `http://localhost:1234/v1` | `local-model` | No |
| `vllm` | Local | `http://localhost:8000/v1` | `meta-llama/Llama-3-8B-Instruct` | No |
| `openai` | Cloud | `https://api.openai.com/v1` | `gpt-4o-mini` | Yes |
| `anthropic` | Cloud | `https://api.anthropic.com/v1` | `claude-3-5-sonnet-20241022` | Yes |
| `gemini` | Cloud | `https://generativelanguage.googleapis.com/v1beta` | `gemini-1.5-flash` | Yes |

### Management API (Super Admin / Admin Only)
* **List Providers & Status:** `GET /api/admin/llm-config`
* **Get Active Provider:** `GET /api/admin/llm-config/active`
* **Update Provider / Key:** `POST /api/admin/llm-config`
  ```json
  {
    "provider": "openai",
    "api_key": "sk-proj-...",
    "default_model": "gpt-4o",
    "is_default": true
  }
  ```
* **Live Connection Ping:** `POST /api/admin/llm-config/ping`
  ```json
  {
    "provider": "ollama",
    "base_url": "http://localhost:11434/v1"
  }
  ```

---

## 6. Self-Healing Watchdog Operations

The background watchdog runs every 30 seconds to maintain high system availability.

### 1. Task SLA Stall Recovery
* **Detection:** Tasks in status `'running'` whose `updated_at` exceeds `WATCHDOG_SLA_SECONDS` (300s).
* **Action:**
  1. Status updated to `'needs_attention'`.
  2. Diagnostic Admin Report created in `reports` with error details and immediate recovery instructions.
  3. Security alert logged to `error_log` with error code `TASK_SLA_EXCEEDED`.
  4. Activity event recorded on the project timeline.

### 2. Outgoing Webhook Backoff Retries
* **Algorithm:** Exponential backoff calculated as $\text{backoff\_seconds} = 4^{\text{attempt\_count}}$.
  * Attempt 1: 4 seconds.
  * Attempt 2: 16 seconds.
  * Attempt 3: 64 seconds.
* **Dead-Lettering:** After 3 failed dispatches, status is set to `'dead_letter'` and alert is logged to `error_log`.

### Watchdog API
* **Status Telemetry:** `GET /api/admin/watchdog/status`
* **Force Immediate Scan:** `POST /api/admin/watchdog/scan`

---

## 7. Database Maintenance & SQLite WAL Protocols

The database resides in `data/marketing-os.db` with 29 provisioned tables.

### Optimization Pragmas
The connection pool in `server/db.js` enforces optimal production pragmas:
```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
```

### Routine Backup Routine
Execute hot backups without stopping the service using SQLite's online backup API:
```bash
# Hot backup to timestamped file
sqlite3 data/marketing-os.db ".backup 'backups/marketing-os-$(date +%Y%m%d_%H%M%S).db'"

# Truncate WAL file after backup
sqlite3 data/marketing-os.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

---

## 8. Incident Response & Troubleshooting Playbook

| Symptom | Probable Cause | Immediate Remediation |
| :--- | :--- | :--- |
| **Port 3000 in use (`EADDRINUSE`)** | Dangling test process or previous instance | Find process: `lsof -i :3000` -> Terminate: `kill -9 <PID>` |
| **Tasks stuck in `In Progress`** | n8n hung or network drop | Run Watchdog scan from Admin Settings UI or call `POST /api/admin/watchdog/scan`. Task transitions to `needs_attention`. Click **Retry Task** in Workbench. |
| **LLM Ping returns `status: offline`** | Local server (Ollama/vLLM) not running | Check local runner: `curl http://localhost:11434/api/tags`. If offline, fallback to Cloud provider in Admin UI. |
| **403 Forbidden on Admin Settings** | Session role is `client` or `member` | Switch role session to `admin` or `super_admin` in header navigation. |
| **Database `SQLITE_BUSY` or Locked** | Concurrent write without busy timeout | Verify `PRAGMA busy_timeout = 5000` is active. Ensure PM2 runs in single instance mode (`instances: 1`). |
| **Client sees internal logs** | UI regression | All client renderings must route through `renderWorkbenchOutput()` and `renderRoleSpecificDashboard()`. Run `npm run test:ui`. |

---

## 9. Verification & Quality Assurance Protocol

Run the consolidated master test suite prior to deploying any production release:

```bash
# Execute the full 6-suite E2E test runner
npm test
# OR
./test-all-e2e.sh
```

### Verified Test Matrix
1. **`test-flow.sh`**: Project creation, harness upload, n8n/local execution, RBAC type-confusion exploits.
2. **`test-agents-rag.sh`**: 32 sovereign agents registry, vector chunking & cosine search.
3. **`test-llm-config.sh`**: 6-provider registry, key vaulting/masking, live ping tests.
4. **`test-watchdog.sh`**: 300s SLA stall detection, automatic healing, webhook backoff retries.
5. **`test-pipeline-schemas.sh`**: 8 pipelines deliverable JSON schema & dynamic LLM inheritance.
6. **`test-frontend-ui.sh`**: Frontend asset serving, workbench asynchronous execution, and RBAC boundaries.
