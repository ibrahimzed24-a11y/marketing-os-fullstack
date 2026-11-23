# Helm (Marketing OS) — Operations, Testing & Deployment Runbook

> **Operational Runbook for Development, Test Automation, and Production Deployments**  
> **Target Audience:** Site Reliability Engineers, QA Leads, and Core Contributors

---

## 1. Local Environment Setup & Initialization

### Prerequisites
- **Node.js:** >= 20.0.0 (Node 22 LTS strongly recommended)
- **npm:** >= 10.0.0
- **Git:** Installed and configured

### Step-by-Step Setup
```bash
# 1. Clone repository (if working on a fresh machine)
git clone https://github.com/ibrahimzed24-a11y/marketing-os.git
cd marketing-os

# 2. Install dependencies
npm install

# 3. Configure environment variables
# Copy .env.example or create .env with required keys:
cat << 'EOF' > .env
NODE_ENV=development
PORT=3000
JWT_SECRET=super-secure-production-jwt-secret-minimum-32-chars-long
VAULT_ENCRYPTION_KEY=super-secure-production-vault-encryption-key-32ch
DATABASE_PATH=data/marketing.db
EOF

# 4. Initialize and seed SQLite database
npm run seed
# -> Automatically creates data/marketing.db, runs schema migrations,
#    and seeds default projects, users, and 45+ tool logins in saved_logins.

# 5. Start the local server
npm start
# -> Server listening on http://localhost:3000
```

---

## 2. Automated Testing Framework & Test Tiers

Helm uses Node's native test runner (`node:test` and `node:assert/strict`) combined with Playwright for browser-level E2E validation. All automated tests execute in completely isolated temporary SQLite databases in `/tmp/`, ensuring zero interference with development or production data.

### Master Test Runner
To execute all 6 tiers sequentially:
```bash
npm test
# Or execute the runner script directly:
node scripts/run-e2e-tiers.js
```

### Breakdown of Test Tiers

| Tier | Test File | Test Count | Focus Area |
| :---: | :--- | :---: | :--- |
| **Tier 1** | `tests/e2e/tier1-feature-coverage.test.js` | 25 | Operational coverage across all 5 departments (Research, Software Engineering, Creative, Coordination, Reporting) |
| **Tier 2** | `tests/e2e/tier2-boundary-corners.test.js` | 10 | Boundary values, invalid inputs, SQL injection protection, concurrent tasks, network timeouts |
| **Tier 3** | `tests/e2e/tier3-governance-contracts.test.js` | 5 | RBAC security boundaries, client tenant isolation, JWT expiration, Anti-Slop Linter rejections |
| **Tier 4** | `tests/e2e/tier4-grounded-workload.test.js` | 5 | Grounded workload execution using real client harness files (`Priority_A_Outreach_Email_Merge_Fields.csv`) |
| **Tier 5** | `tests/e2e/tier5-multiselect-kbtiers.test.js` | 6 | Multi-select Knowledge Base RAG tiers (Project, Agency DNA, Task Briefings), chunk priority, and context injection |
| **Tier 6** | `tests/e2e/tier6-deep-market-research.test.js` | 5+ | 5-Tool Deep Market Research, typing GEO mapping, allocated logins vault, real HTTP pings, Google search suggestion harvesting, and Playwright UI interactions |

### Running an Individual Test Tier
```bash
# Run only Tier 6 (Deep Market Research)
node tests/e2e/tier6-deep-market-research.test.js

# Run only Tier 1 (Feature Coverage)
node tests/e2e/tier1-feature-coverage.test.js
```

### Playwright Headless Browser Testing
Browser automation tests use `launchBrowser()` from `tests/e2e/harness.js` which boots headless Chromium:
```bash
# Verify Playwright dependencies are installed
npx playwright install chromium
```

---

## 3. Code Quality & Linting Protocol

Before committing any code or triggering deployment, execute the syntax and lint check:
```bash
npm run lint
```
This runs `node -c` across all core files:
- `server/index.js`
- `server/db.js`
- `server/agentFramework.js`
- `server/cryptoVault.js`
- `server/antiSlopLinter.js`
- `public/app.js`

> **Rule:** Every commit must have zero syntax errors. Any syntax failure will break `DOMContentLoaded` in the frontend or crash the API server.

---

## 4. Production Deployment to Vercel

### Architecture on Vercel
Helm is configured for Vercel Serverless via `vercel.json`:
- `server/index.js` acts as the serverless function handler.
- Static assets in `public/` are served by Vercel's global Edge CDN with asset hashing.
- Cloud persistence uses Turso LibSQL Cloud bridge (`@libsql/client`) when `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set in the Vercel project settings.

### Deployment Workflow
```bash
# 1. Verify working directory is clean and tests pass
npm run lint
npm test

# 2. Commit changes
git add .
git commit -m "feat: describe changes"

# 3. Push to GitHub main branch
git push origin main
# -> Vercel GitHub Integration automatically builds and deploys to production
```

### Required Production Environment Variables on Vercel
In the Vercel Project Settings -> Environment Variables, configure:
- `NODE_ENV`: `production`
- `JWT_SECRET`: 64-character random string
- `VAULT_ENCRYPTION_KEY`: 64-character random string (or 32-byte hex)
- `TURSO_DATABASE_URL`: `libsql://your-database.turso.io`
- `TURSO_AUTH_TOKEN`: `eyJhbG...`
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`: Active API keys for live agent execution

---

## 5. Troubleshooting & Common Pitfalls

### Issue: Playwright test times out waiting for `#authModal.hidden`
- **Cause:** A syntax error or unhandled runtime exception occurred in `public/app.js`, preventing `DOMContentLoaded` from initializing state and opening the login modal.
- **Fix:** Run `node -c public/app.js`. Inspect any recent edits for misplaced commas, brackets, or unescaped template literal backticks.

### Issue: Tool Ping returns HTTP 403 for Ahrefs
- **Cause:** Cloudflare bot protection on `app.ahrefs.com` rejects requests without a standard browser `User-Agent`.
- **Fix:** In `server/index.js` (`POST /api/saved-logins/:id/test`), ensure the `User-Agent` header is explicitly passed in `fetch()`. The endpoint treats HTTP 403 as reachable (`resp.status < 500`) since the target server responded.

### Issue: Deliverable Rejected by Anti-Slop Linter
- **Cause:** The LLM output or generated copy contains prohibited AI buzzwords (e.g. *"delve"*, *"tapestry"*, *"testament"*, *"seamlessly"*).
- **Fix:** Use active, human phrasing. State facts, numbers, and direct value propositions without flowery corporate filler.
