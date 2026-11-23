# Helm (Marketing OS) — System Architecture & Operating Model

> **Authoritative Engineering Guide to System Internals, Operational Loops, and Domain Models**  
> **Target Audience:** Systems Architects, Core Agent Developers, and Successor Technical Leads

---

## 1. High-Level Architectural Vision

Helm is an **Agentic Operating System** designed to eliminate human bottlenecks in modern marketing operations. It replaces chaotic SaaS point solutions and manual agency overhead with a unified, state-managed engine where autonomous agents work collaboratively alongside human operators.

```
+----------------------------------------------------------------------------------------------------+
|                                      OPERATOR FRONTEND (SPA)                                       |
|  - Minimalist Zen Cockpit (ADHD-Optimized)                                                         |
|  - Department Workspaces (Research, Engineering, Creative, Coordination, Reporting)                |
|  - Live 5-Tool Ping Telemetry & Vault Credential Allocator                                         |
+--------------------------------------------------+-------------------------------------------------+
                                                   | HTTP REST / SSE Streams
                                                   v
+----------------------------------------------------------------------------------------------------+
|                                    EXPRESS 4 REST API GATEWAY                                      |
|  - Role-Based Access Control (RBAC) & JWT Guard                                                    |
|  - Task Dispatcher & Stage State Machine                                                           |
|  - AES-256-GCM Crypto Vault Router                                                                 |
+--------------------------------------------------+-------------------------------------------------+
                                                   |
         +-----------------------------------------+-----------------------------------------+
         |                                         |                                         |
         v                                         v                                         v
+-----------------------+              +-----------------------+                 +-----------------------+
|    AGENT FRAMEWORK    |              |   DATA & PERSISTENCE  |                 |    EXTERNAL ACCESS    |
| - 5 Specialized Agents|              | - SQLite WAL Engine   |                 | - Real Tool HTTP Ping |
| - Unified 5-Stage Loop|              | - Turso LibSQL Cloud  |                 | - Google Suggest API  |
| - Anti-Slop QA Linter |              | - Multi-Tier RAG KB   |                 | - Client Harness Data |
| - Multi-LLM Gateway   |              | - Encrypted Vault     |                 |   (/uploads)          |
+-----------------------+              +-----------------------+                 +-----------------------+
```

---

## 2. The 5 Operational Departments

Helm partitions marketing work into 5 distinct, decoupled operational departments. Each department owns specific pipeline types, input contracts, and output schemas:

### Department 01: Browser Research & Market Intelligence
- **Lead Agent:** `@browser-researcher` (`Agent 01`)
- **Mission:** Execute deep, forensic market research on any business idea or market niche using real data from 5 permanently assigned tools:
  1. *Google Search Console (GSC)* — Real query impressions, average CTR, position benchmarks, and Page 2 fast leap opportunities.
  2. *Google Ads Keyword Planner (GKP)* — Exact search volume, YoY demand velocity, and commercial Top-of-Page Low/High CPC bids.
  3. *Google Tag Manager (GTM)* — Container tag audits (GA4, CAPI), conversion tracking integrity, and funnel leak diagnosis.
  4. *SEO Competitor Engine (Ahrefs)* — Domain Rating (DR), backlink gap analysis, and allintitle KGR calculations.
  5. *GEO Search Matrix (Google Business Profile / Maps)* — Local 3-pack competition density, regional metro intent indices.
- **Operator Vault Integration:** Every tool is bound to a live account in the `saved_logins` vault with real operator credentials (`ibrahim.zed24@gmail.com`).
- **Telemetry & Live Suggestions:** Pings tool endpoints for real-time latency (`ms`) and harvests live Google search autocomplete suggestions via `suggestqueries.google.com`.

### Department 02: Software Engineering & Landing Page Factory
- **Lead Agent:** `@software-engineer` (`Agent 02`)
- **Mission:** Construct high-converting, accessible, and responsive landing pages, patient triage forms, interactive calculators (e.g. CDCP coverage estimator), and micro-interaction components.
- **Guiding Skill:** `Leonxlnx/taste-skill` v2.5.1 (Anti-slop design: clean typography, 60-30-10 color rule, semantic HTML5, zero broken links).

### Department 03: Creative Media & Multimodal Studio
- **Lead Agent:** `@creative-director` (`Agent 03`)
- **Mission:** Produce omnichannel creative assets, WhatsApp Business Image Cards, high-intent ad copy variations (AIDA/PAS frameworks), and email marketing sequences.
- **Guiding Skill:** `nexu-io/open-design/email-marketing` (600–680px single-column mobile-first emails, verified CTAs).

### Department 04: Workflow Coordination & DAG Execution Engine
- **Lead Agent:** `@coordinator`
- **Mission:** Route multi-stage marketing campaigns across departments, manage task dependencies, monitor execution timeouts, and track project health.

### Department 05: Executive Reporting, Governance & Anti-Slop QA
- **Lead Agent:** `@master-reporting-agent`
- **Mission:** Audit every deliverable against ground-truth harness data, execute the Anti-Slop Linter (`server/antiSlopLinter.js`), and stamp deliverables with an official executive verdict: `**Verdict:** Ready to Deliver` or `needs_fix`.

---

## 3. The Unified 5-Stage Operational Loop

Every task in Helm, regardless of department, deterministically executes through the 5-Stage Workforce Loop:

```
+------------+       +------------+       +------------+       +------------+       +------------+
|  STAGE 1   | ----> |  STAGE 2   | ----> |  STAGE 3   | ----> |  STAGE 4   | ----> |  STAGE 5   |
|    PLAN    |       |   ASSIGN   |       |  EXECUTE   |       |   VERIFY   |       |   REPORT   |
+------------+       +------------+       +------------+       +------------+       +------------+
  Deconstruct         Select Lead         Run LLM or          Audit against        Generate JSON
  task brief &        Agent Persona       Specialized         Harness & run        Contract +
  RAG context         & Skills            Tool Pipelines      Anti-Slop Linter     Admin Markdown
```

### Stage 1: Plan
- Deconstructs task input parameters (`task.input_json`), project goals, and target geography.
- Queries `server/rag.js` for relevant knowledge chunks across Project Knowledge, Agency DNA, and Task Briefings.
- Verifies that required databases and ground-truth harness files exist.

### Stage 2: Assign
- Resolves the target agent persona (`@browser-researcher`, `@software-engineer`, `@creative-director`, etc.) from `AGENT_REGISTRY`.
- Binds allocated credentials from `saved_logins` vault.
- Updates `tasks.stage = 'assign'`.

### Stage 3: Execute
- Invokes the live configured LLM provider via `server/llmClient.js` (Ollama, OpenAI, Claude, or Gemini).
- In Department 01, executes real HTTP tool pings and harvests live Google search autocomplete suggestions.
- Updates `tasks.stage = 'execute'`, `tasks.status = 'running'`.

### Stage 4: Verify
- Passes deliverable text and code through `server/antiSlopLinter.js`.
- Banned buzzwords (e.g. *"delve"*, *"testament"*, *"tapestry"*, *"game-changer"*, *"plethora"*) trigger immediate rejection or auto-sanitization.
- Asserts that all numbers, prices, and metrics match ground-truth harness files or live harvested data.
- Updates `tasks.stage = 'verify'`.

### Stage 5: Report / Deliver
- Synthesizes the dual deliverable contract:
  1. `output_json`: Machine-readable structured deliverable payload.
  2. `report_md`: Human-readable executive markdown report ending with `**Verdict:** Ready to Deliver`.
- Persists results to `tasks`, `reports`, `market_research_reports`, and `activity` tables in an atomic SQLite transaction.

---

## 4. State Machine & Task Status Separation

A fundamental architectural principle of Helm is the strict separation of **Execution State**, **Workflow Stage**, and **Human Approval**:

| Attribute | Column Name | Permitted Values | Meaning |
| :--- | :--- | :--- | :--- |
| **Workflow Stage** | `stage` | `plan`, `assign`, `execute`, `verify`, `report` | The current operational phase in the 5-stage loop |
| **Execution Status** | `status` | `draft`, `queued`, `running`, `in_review`, `completed`, `cancelled` | The lifecycle state of the task runner |
| **Report Verdict** | `verdict` | `pending`, `approved`, `needs_fix` | The QA / executive audit assessment |

> **Invariance Rule:** A task transitioning to `in_review` means execution completed and passed automated QA. Only an Admin or Manager can approve the deliverable for final client delivery. Human approval never simulates external network events.

---

## 5. Security & Cryptographic Architecture

### Credential Vault (`server/cryptoVault.js`)
External marketing logins (Google Ads, Search Console, Ahrefs, Meta, etc.) are protected using industry-standard authenticated encryption:

```
[Plaintext Secret] + [Random 12-byte IV] + [32-byte Vault Key]
                          |
                          v (AES-256-GCM)
   [IV Hex] : [Auth Tag Hex] : [Ciphertext Hex]
                          |
                          v
        Persisted in `saved_logins.password`
```

- Decryption verifies the 16-byte authentication tag; any modification results in an immediate authentication error.
- Non-admin roles only receive masked tokens (`••••••••••••`).

---

## 6. Ground-Truth Data Architecture

### Ground Truth Hierarchy
1. **Tier 1 (Harness Files in `/uploads`):** Client-uploaded spreadsheets (`.csv`), verified contact databases, and brand specification documents.
2. **Tier 2 (Live API Telemetry):** Real-time HTTP pings, Google search suggestion queries, and verified external tool connections.
3. **Tier 3 (Project Knowledge Chunks):** Extracted text fragments stored in `knowledge_chunks`.
4. **Tier 4 (LLM Reasoning):** Synthesis and copywriting strictly bounded by Tiers 1-3.
