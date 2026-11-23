# Helm — Autonomous Marketing & Operations Engine

[![Production Status](https://img.shields.io/badge/Deployment-Live%20on%20Vercel-success)](https://marketing-os-fullstack.vercel.app)
[![Node Version](https://img.shields.io/badge/Node.js-22.x%20LTS-blue)](https://nodejs.org)
[![Database](https://img.shields.io/badge/Database-SQLite%20(WAL)%20%2B%20Turso%20LibSQL-teal)](https://turso.tech)
[![Testing](https://img.shields.io/badge/Test%20Suite-6%20Tiers%20(100%25%20Passing)-emerald)](tests/e2e/)
[![Anti-Slop](https://img.shields.io/badge/Quality-Anti--Slop%20Verified-blueviolet)](server/antiSlopLinter.js)

**Helm ("Marketing OS")** is an autonomous marketing and operations engine for agency teams. It coordinates autonomous AI agents across 5 specialized operational departments to deliver verified, high-converting marketing assets, forensic market research, responsive landing pages, multimodal creatives, and executive reports grounded in client database truth.

Live URL: **[marketing-os-fullstack.vercel.app](https://marketing-os-fullstack.vercel.app)**

---

## 📚 Master Documentation Suite

For comprehensive documentation, specifications, and handover guides, consult the dedicated documentation files:

| Document | Primary Audience | Key Contents |
| :--- | :--- | :--- |
| **[HANDOVER.md](file:///Users/ibrahimzid/Desktop/Marketing%20Os%20/HANDOVER.md)** | Successor Agents & Leads | Executive overview, system orientation, recent features, active credentials, quick checklist |
| **[STACK.md](file:///Users/ibrahimzid/Desktop/Marketing%20Os%20/STACK.md)** | Full-Stack Engineers | Complete technology stack reference: Node 22, Express, SQLite WAL, Turso LibSQL, Tailwind, AES-256-GCM Vault, LLM Router |
| **[ARCHITECTURE.md](file:///Users/ibrahimzid/Desktop/Marketing%20Os%20/ARCHITECTURE.md)** | Software Architects | System internals, the 5-Stage Operational Loop, task state machine, cryptographic vault, RAG knowledge pipeline |
| **[AGENTS_AND_DEPARTMENTS.md](file:///Users/ibrahimzid/Desktop/Marketing%20Os%20/AGENTS_AND_DEPARTMENTS.md)** | AI & Marketing Engineers | Detailed specifications of the 5 departments, 5 agent personas, the 5-tool Market Research engine, and input/output contracts |
| **[OPERATIONS_AND_TESTING.md](file:///Users/ibrahimzid/Desktop/Marketing%20Os%20/OPERATIONS_AND_TESTING.md)** | QA & SREs | Local runbook, running the 6-Tier automated E2E test suites, Playwright headless testing, Vercel deployments |

---

## ⚡ Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Seed database (Creates local SQLite data/marketing.db and seeds users, projects, logins)
npm run seed

# 3. Verify code quality (Zero syntax errors)
npm run lint

# 4. Run automated E2E test suite (6 Tiers, 56+ tests, 100% pass rate)
npm test

# 5. Start the local server
npm start
# -> Opens http://localhost:3000
```

### Seeded Test Accounts

| Role | Email | Password | Scope |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@marketingos.local` | `Admin123!` | Unrestricted access across all departments, vaults, settings |
| **Manager** | `manager@marketingos.local` | `Manager123!` | Manages projects, assigns department tasks, reviews reports |
| **Member** | `member@marketingos.local` | `Member123!` | Executes assigned tasks, uploads harness data, launches research |
| **Client** | `client@marketingos.local` | `Client123!` | Read-only access to assigned projects and delivered deliverables |

---

## 🏛️ The 5 Operational Departments

1. **Department 01: Browser Research & Market Intelligence (`@browser-researcher`)**  
   5-tool deep forensic market research (Google Search Console, Keyword Planner, Tag Manager, SEO Ahrefs Engine, GEO Matrix) with live typing GEO autocomplete, encrypted saved logins vault integration, real HTTP tool pings with ms latency telemetry, and real-time Google search suggestion harvesting.
2. **Department 02: Software Engineering & Landing Page Factory (`@software-engineer`)**  
   High-converting, responsive landing pages, patient triage forms, interactive pricing/CDCP eligibility calculators, and accessible micro-interactions.
3. **Department 03: Creative Media & Multimodal Studio (`@creative-director`)**  
   WhatsApp Business Image Cards, high-converting ad copy (PAS, AIDA, BAB frameworks), and omnichannel email nurture sequences.
4. **Department 04: Workflow Coordination & DAG Execution Engine (`@coordinator`)**  
   Multi-stage marketing pipeline routing, DAG task dependencies, and 5-stage loop progression.
5. **Department 05: Executive Reporting, Governance & Anti-Slop QA (`@master-reporting-agent`)**  
   Deliverable auditing against ground-truth harness data, Anti-Slop Linter execution, and official executive sign-off (`**Verdict:** Ready to Deliver`).

---

## 🛡️ Non-Negotiable Engineering Invariants

- **Zero Fake Statuses or Data:** No UI indicator displays `Connected`, `Online`, or `Active` unless a real HTTP ping, database check, or execution process has verified it.
- **No Fake Deliverables in Production:** If no live LLM provider is connected in Production, the system fails explicitly (`HTTP 503 LLM_NOT_CONFIGURED`) rather than fabricating fake leads or bogus statistics.
- **Cryptographic Security:** Stored marketing tool credentials and API keys are protected using AES-256-GCM authenticated encryption (`server/cryptoVault.js`).
- **Anti-Slop Linguistic Policy:** Every output is audited by `server/antiSlopLinter.js` to eliminate AI buzzwords and guarantee humanized, high-converting deliverables.
- **Isolated Automated Testing:** All automated tests execute in isolated, temporary SQLite databases in `/tmp/`, leaving live data untouched.

---

## 🌐 Production Deployment

Helm is continuously deployed to Vercel production:
- **Live URL:** [https://marketing-os-fullstack.vercel.app](https://marketing-os-fullstack.vercel.app)
- **Deployment Strategy:** Vercel Serverless Function (`server/index.js`) + Edge CDN (`public/`) + Turso LibSQL Cloud bridge.
- **GitHub Repository:** [github.com/ibrahimzed24-a11y/marketing-os](https://github.com/ibrahimzed24-a11y/marketing-os)
