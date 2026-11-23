# Helm (Marketing OS) — Master Agent Handover Document

> **Authoritative Orientation & Transfer Guide for Successor AI Agents and Lead Engineers**  
> **Last Updated:** November 2026 | **Current Production Deployment:** [marketing-os-fullstack.vercel.app](https://marketing-os-fullstack.vercel.app)  
> **Repository:** `github.com/ibrahimzed24-a11y/marketing-os` (`main` branch)

---

## 1. Executive Summary & System Identity

**Helm ("Marketing OS")** is an autonomous marketing and operations engine built for multi-client agency operations. It coordinates autonomous AI agents across 5 specialized operational departments to deliver verified, high-converting marketing assets, forensic market research, responsive landing pages, multimodal creatives, and executive reports grounded in client database truth.

### The Non-Negotiable Core Tenet: Real Data & Anti-Slop
Unlike generic demo apps or mock wrappers, Helm operates under strict production honesty rules:
1. **Zero Hallucination Policy:** Agents never fabricate client names, pricing, contact details, or metrics that are not grounded in uploaded harness files (`/uploads`) or live verified API connections.
2. **Zero Fake Statuses:** No UI pill or badge displays `Connected`, `Online`, or `Active` unless a real HTTP ping, database check, or execution process has verified it.
3. **No Fake Deliverables in Production:** If no live LLM provider is connected in Production, the system fails fast (`HTTP 503 LLM_NOT_CONFIGURED`) rather than injecting bogus leads or fake copy.
4. **Deterministic 5-Stage Operational Loop:** Every task progresses sequentially through `Plan` -> `Assign` -> `Execute` -> `Verify` -> `Report/Deliver`.

---

## 2. Technology Stack Overview

| Layer | Technologies & Libraries | Key Responsibilities |
| :--- | :--- | :--- |
| **Backend API** | Node.js 22 LTS, Express 4, `asyncHandler` | REST API, SSE streaming, authentication, task dispatching |
| **Local Database** | SQLite via `better-sqlite3` (WAL mode enabled) | Fast local transactional storage, relational schema, zero-latency queries |
| **Cloud Database** | Turso LibSQL Cloud (`@libsql/client`) | Remote sync bridge for serverless environments (e.g. Vercel) |
| **Frontend UI** | Vanilla ES6+ JavaScript SPA (`public/app.js`), Tailwind CSS, CSS variables | Single-Page Application, zero heavy framework overhead, instant render |
| **Security & Secrets** | AES-256-GCM (`server/cryptoVault.js`), bcrypt, JWT | Encrypted tool logins vault, password hashing, RBAC token enforcement |
| **AI & LLM Engine** | Multi-provider router (`server/llmClient.js`) | Ollama (Qwen 2.5), OpenAI (GPT-4o), Anthropic (Claude 3.5), Gemini 2.0 |
| **RAG / Knowledge Base** | Custom Vector + Lexical Chunking (`server/rag.js`) | Multi-select KB tiers (Project, Agency DNA, Task Briefings, Uploads) |
| **Quality Control** | Humanizer rules + Anti-Slop Linter (`server/antiSlopLinter.js`) | Enforces active voice, bans banned AI buzzwords, guarantees valid contracts |
| **Testing Suites** | Node.js test runner (`node:test`, `node:assert/strict`), Playwright Chromium | 6 sequential test tiers (56+ automated tests) in isolated temporary DBs |
| **Hosting & CI/CD** | Vercel Serverless (`vercel.json`), Git auto-deploy | Production deployment, CDN edge caching, serverless API functions |

*(For full in-depth specifications of versions, environment variables, and cryptographic configurations, see [STACK.md](file:///Users/ibrahimzid/Desktop/Marketing%20Os%20/STACK.md).)*

---

## 3. The 5 Operational Departments & Specialized Agents

Helm is architected around 5 core departments, each represented by a dedicated agent persona:

```
+-----------------------------------------------------------------------------------+
|                                  HELM WORKSPACE                                   |
|                                                                                   |
|  +--------------------+  +--------------------+  +--------------------+           |
|  |   Department 01    |  |   Department 02    |  |   Department 03    |           |
|  | Browser Research & |  | Software Eng. &    |  | Creative Media &   |           |
|  | Market Intelligence|  | Landing Page Fact. |  | Multimodal Studio  |           |
|  | (@browser-research)|  | (@software-engineer|  | (@creative-director|           |
|  +--------------------+  +--------------------+  +--------------------+           |
|                                                                                   |
|  +--------------------------------------------+  +--------------------+           |
|  |   Department 04                            |  |   Department 05    |           |
|  |   Workflow Coordination & DAG Engine       |  | Executive Report & |           |
|  |   (@coordinator)                           |  | Governance QA      |           |
|  |                                            |  | (@master-reporting|           |
|  +--------------------------------------------+  +--------------------+           |
+-----------------------------------------------------------------------------------+
```

### Department 01: Browser Research & Market Intelligence (`@browser-researcher`)
- **Key Capability:** Live competitive teardowns, market sizing (TAM/SAM/SOM), search demand audits, Keyword Golden Ratio (KGR < 0.25) fast-win discovery, and B2B prospect extraction.
- **Permanently Assigned Tools:**
  1. *Google Search Console (GSC)* — Real query impressions, average CTR, position benchmarks, and Page 2 fast leap opportunities.
  2. *Google Ads Keyword Planner (GKP)* — Exact search volume, YoY demand velocity, and commercial Top-of-Page Low/High CPC bids.
  3. *Google Tag Manager (GTM)* — Container tag audits (GA4, CAPI), conversion tracking integrity, and funnel leak diagnosis.
  4. *SEO Competitor Engine (Ahrefs)* — Domain Rating (DR), backlink gap analysis, and allintitle KGR calculations.
  5. *GEO Search Matrix (Google Business Profile / Maps)* — Local 3-pack competition density, regional metro intent indices.
- **Vault Integration:** Links each tool to live accounts stored in `saved_logins` with active operator credentials (`ibrahim.zed24@gmail.com`).
- **Live Tool Reachability:** One-click `⚡ Ping & Verify All 5 Tools` triggers parallel `POST /api/saved-logins/:id/test` calls and renders live ms latency pills.
- **Google Search Suggestion Harvesting:** Directly queries `suggestqueries.google.com` to harvest genuine Google autocomplete queries in real time.

### Department 02: Software Engineering & Landing Page Factory (`@software-engineer`)
- **Key Capability:** Production-grade HTML/Tailwind landing pages, patient triage forms, interactive pricing/CDCP eligibility calculators, and high-converting micro-interactions.

### Department 03: Creative Media & Multimodal Studio (`@creative-director`)
- **Key Capability:** WhatsApp Business Image Cards, high-converting ad copy (PAS, AIDA, BAB frameworks), email nurture sequences, and omnichannel visual campaigns.

### Department 04: Workflow Coordination & DAG Engine (`@coordinator`)
- **Key Capability:** Task lifecycle orchestration, multi-department pipeline dispatching, stage progression enforcement (`Plan` -> `Assign` -> `Execute` -> `Verify` -> `Report`), and dependency resolution.

### Department 05: Executive Reporting, Governance & Anti-Slop QA (`@master-reporting-agent`)
- **Key Capability:** Deliverable auditing, Anti-Slop Linter execution, Humanizer rule verification, and issuing the official executive verdict (`**Verdict:** Ready to Deliver` or `needs_fix`).

---

## 4. Key Architectural Decisions & Invariants

1. **State Isolation:**
   - `task.status` (`draft`, `in_progress`, `in_review`, `completed`, `cancelled`) is strictly segregated from `task.stage` (`plan`, `assign`, `execute`, `verify`, `report`) and `approval_status`.
   - Client approval never implies external network actions have occurred unless verified by an explicit integration log.
2. **Encrypted Vault Storage:**
   - All credentials and sensitive API keys in `saved_logins` are encrypted at rest using AES-256-GCM via `server/cryptoVault.js`.
   - Plaintext passwords and full API keys are never leaked to non-admin roles or in public task outputs.
3. **Dual Database Architecture:**
   - In standard local Node execution, `better-sqlite3` runs with Write-Ahead Logging (`PRAGMA journal_mode=WAL;`), providing microsecond queries and atomic transactions.
   - In serverless / edge contexts, the database layer transparently interfaces with Turso LibSQL Cloud if `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are present.
4. **ADHD / Zen Focus Mode:**
   - The UI includes a global `Zen Mode` toggle (`state.zenMode`). When enabled, non-essential clutter, decorative stats, and extraneous animations are suppressed, providing a hyper-focused, distraction-free cockpit.

---

## 5. Essential Commands & Quick-Start

### Prerequisites
- Node.js >= 20.0.0 (Node 22 LTS recommended)
- npm >= 10.0.0

### Daily Development Commands
```bash
# 1. Run syntax verification across server and frontend (Zero syntax errors allowed)
npm run lint
# Or explicitly:
node -c server/index.js && node -c public/app.js && node -c server/agentFramework.js

# 2. Run the full 6-Tier automated E2E test suite (All 56+ tests must pass 100%)
npm test
# Or run the runner directly:
node scripts/run-e2e-tiers.js

# 3. Start local development server
npm start
# -> Opens http://localhost:3000
```

### Seeding & Resetting Data
```bash
# Seed default projects, users, harness data, and saved logins vault
npm run seed
```

### Git & Deployment
```bash
# Check git status
git status

# Push to origin main (Automatically triggers production build on Vercel)
git push origin main
```

---

## 6. Seeded User Accounts & Roles

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@marketingos.local` | `Admin123!` | Complete unrestricted access across all departments, vaults, settings, and users |
| **Manager** | `manager@marketingos.local` | `Manager123!` | Can manage projects, assign department tasks, review reports, and test logins |
| **Member** | `member@marketingos.local` | `Member123!` | Can execute assigned tasks, upload harness data, and launch research workflows |
| **Client** | `client@marketingos.local` | `Client123!` | Read-only access restricted to their assigned project and approved deliverables |

---

## 7. Codebase Directory Map

```
/
├── server/                           # Express Backend & Core Services
│   ├── index.js                      # Main API server, route handlers, middleware
│   ├── db.js                         # Database initialization, SQLite/Turso connection, migrations
│   ├── agentFramework.js             # Autonomous Agent engine, 5 personas, skills, Loop runner
│   ├── cryptoVault.js                # AES-256-GCM encryption & decryption routines
│   ├── antiSlopLinter.js             # Quality assurance linter, bans prohibited phrases
│   ├── llmClient.js                  # Multi-provider LLM gateway (Ollama, OpenAI, Claude, Gemini)
│   ├── rag.js                        # Vector & lexical knowledge retrieval engine
│   └── seedLogins.js                 # Initial seed definitions for 45+ tool vault logins
├── public/                           # Frontend Single-Page Application (SPA)
│   ├── index.html                    # Semantic HTML5 layout, modals, tabs, department views
│   ├── app.js                        # Reactive SPA controller (~10,700 lines), state management
│   └── style.css                     # Custom design tokens, high-contrast dark/light mode rules
├── tests/                            # Automated QA Test Framework
│   └── e2e/                          # 6 Sequential E2E Test Tiers
│       ├── harness.js                # E2E test server harness, isolated temp DB setup, Playwright launcher
│       ├── tier1-feature-coverage.test.js    # Tier 1: 5-department feature coverage (25 tests)
│       ├── tier2-boundary-corners.test.js    # Tier 2: Boundary conditions & error recovery (10 tests)
│       ├── tier3-governance-contracts.test.js# Tier 3: Governance, RBAC & anti-slop rules (5 tests)
│       ├── tier4-grounded-workload.test.js   # Tier 4: Grounded workloads & harness file verification (5 tests)
│       ├── tier5-multiselect-kbtiers.test.js # Tier 5: Multi-select knowledge base tiers & RAG (6 tests)
│       └── tier6-deep-market-research.test.js# Tier 6: 5-Tool Market Research, GEO typing, pings (5+ tests)
├── scripts/
│   ├── run-e2e-tiers.js              # Master test runner executing all 6 tiers sequentially
│   └── test-all-e2e.sh               # Shell script wrapper for E2E suites
├── uploads/                          # Client harness files (Ground truth data: CSV, PDF, TXT)
├── skills/                           # Installed prompt skill packs (Humanizer, Open Design, Engineering)
└── vercel.json                       # Vercel serverless deployment routing & configuration
```

---

## 8. Successor Next-Steps Checklist

When continuing development or maintenance on Helm, execute this checklist first:
- [ ] Run `npm run lint` to verify that there are zero JavaScript syntax or runtime errors.
- [ ] Run `npm test` to verify that all 6 test tiers pass with 100% success rate.
- [ ] Inspect `git status` to ensure working directory is clean before making changes.
- [ ] When adding a new capability or API endpoint, always add corresponding tests to the appropriate `tests/e2e/tier*.test.js` suite.
- [ ] Never remove anti-slop checks or bypass the `Ready to Deliver` contract.
