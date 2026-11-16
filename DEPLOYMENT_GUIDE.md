# Deployment & Operations Guide

## 1. Supported Deployment Environments
Marketing OS supports two primary deployment topologies:
1. **Local Self-Hosted / Sovereign Factory (Primary):** Node.js Express server + SQLite WAL mode + local n8n daemon running on macOS/Linux.
2. **Cloud Hybrid (Vercel Serverless + Supabase / VPS):** Frontend deployed on Vercel (`personal-ai-workforce-os-pi.vercel.app`) with serverless API routes or persistent VPS worker.

---

## 2. Environment Variables Configuration (`.env`)

```ini
# Core Web Server
PORT=3000
DATABASE_PATH=./data/marketing-os.db
CORS_ORIGIN=http://localhost:3000

# Security & Authentication
JWT_SECRET=production-grade-random-secret-at-least-32-chars
JWT_EXPIRES_IN=7d
OS_API_KEY=production-secure-webhook-api-key

# File Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=20

# Automation Engine (n8n)
N8N_BASE_URL=http://127.0.0.1:5678
N8N_WEBHOOK_TASK=http://127.0.0.1:5678/webhook/marketing-os-task
N8N_WEBHOOK_REPORT=http://127.0.0.1:5678/webhook/marketing-os-report

# Antigravity Workspace
ANTIGRAVITY_WORKSPACE=./antigravity
```

---

## 3. Step-by-Step Production Launch Sequence

### 3.1 Prerequisites
- Node.js v18.0.0 or higher
- npm v9.0.0 or higher
- SQLite 3 with WAL support

### 3.2 Installation
```bash
cd "/Users/ibrahimzid/Desktop/Marketing Os "
npm install
```

### 3.3 Database Seeding & User Initialization
```bash
# Clean initialization with 4 seed roles
npm run seed
# Or reset and re-seed
npm run reset
```

### 3.4 Starting the Server
```bash
# Development mode
npm run dev

# Production daemon (e.g. via PM2 or systemd)
# pm2 start server/index.js --name marketing-os
npm start
```

### 3.5 Starting the n8n Automation Engine
```bash
# In a separate terminal or service manager:
npx n8n start
```
- Open `http://localhost:5678`
- Import workflows from `./n8n-workflows/`
- Set `OS_API_KEY` in n8n Environment Variables
- Toggle workflow status to **Active**

---

## 4. Health Checks & Verification
- **API Health:** `curl http://localhost:3000/api/health` $\rightarrow$ `{"status":"ok","time":"..."}`
- **Automated Verification:** `bash test-flow.sh`
- **Workflow Pipeline Check:** `python3 marketing_os_workflow.py`
