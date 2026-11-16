# Module Specifications — AI Marketing Operating System

**Document Version:** 2.0.0  
**Target Release:** Marketing OS v2.0 Enterprise  
**Author:** Principal Software Architect & QA Lead  
**Date:** 2026-11-16  

---

## Module 01: Marketing Command Center

- **Objective:** Serve as the unified executive dashboard consolidating live marketing metrics, active campaigns, pending reviews, agent status, and system alerts.
- **Key Capabilities:**
  - Aggregated real-time metrics: Total Projects, Active Tasks, Tasks in Review, Running Engines, Delivered Outputs.
  - Live activity feed showing chronological user and agent actions.
  - Admin daily rhythm guide: Morning review queue, Midday job execution, Evening synthesis.
  - System health indicator (n8n connectivity, SQLite WAL status, local agent engine readiness).
- **Data Source:** Strictly grounded in database tables (`tasks`, `projects`, `reports`, `activity`). Fabricated or decorative placeholder numbers are strictly prohibited.
- **Failure Modes & Error Handling:**
  - Database lock/timeout: Gracefully degrades to cached dashboard snapshot with an informational banner.
  - Network disconnect: Displays offline indicator while keeping UI interactive.
- **Acceptance Criteria:**
  - [x] Returns live JSON from `/api/dashboard` reflecting real SQLite state.
  - [x] Client role users only see statistics and recent tasks for projects they are explicitly members of.

---

## Module 02: Market Intelligence & Research

- **Objective:** Execute structured competitive teardowns, industry benchmarks, market sizing, and customer buying intent analyses.
- **Key Capabilities:**
  - Automated competitive teardowns via `/grillme` interview protocol.
  - Extraction and synthesis of customer pain points from user-provided harness files (PDF/CSV).
  - Structured competitive matrix generation: Market whitespace, feature gaps, pricing benchmarks.
  - Source tracking with verifiable URL citations and timestamps.
- **Assigned Squad:** `@coordinator`, `@browser-researcher`, `@master-reporting-agent`.
- **Pipeline Identifier:** `market-intel`.
- **Data Contracts:**
  - *Input:* `{ "competitors": ["comp1.com", "comp2.com"], "focus_area": "pricing|features|positioning" }`
  - *Output:* `{ "whitespace": "...", "pricing_comparison": [...], "swot": {...} }`
  - *Report:* Markdown teardown report with explicit verification citations.
- **Acceptance Criteria:**
  - [x] Output strictly distinguishes verified facts from inferred recommendations.

---

## Module 03: SEO & GEO Intelligence

- **Objective:** Conduct search engine optimization and Generative Engine Optimization (GEO) to optimize visibility across Google SERPs and AI search engines (ChatGPT, Gemini, Perplexity).
- **Key Capabilities:**
  - Keyword clustering and search intent mapping (Informational, Commercial, Navigational, Transactional).
  - Content gap analysis against top SERP competitors.
  - Generative Engine Optimization (GEO) citation scoring and brand sentiment tracking.
- **Assigned Squad:** `@coordinator`, `@browser-researcher`, `@software-engineer`, `@master-reporting-agent`.
- **Pipeline Identifier:** `content-seo`.
- **Data Contracts:**
  - *Input:* `{ "primary_topic": "...", "target_domain": "...", "target_geo": "US|CA|Global" }`
  - *Output:* `{ "keyword_clusters": [...], "geo_prompts": [...], "meta_tags": {...} }`
- **Acceptance Criteria:**
  - [x] Evaluates keyword density and schema markup without hallucinating domain metrics.

---

## Module 04: Marketing Strategy & Planning

- **Objective:** Formulate Ideal Customer Profiles (ICPs), buyer personas, brand positioning, and quarterly marketing roadmaps.
- **Key Capabilities:**
  - ICP matrix builder: Firmographics, technographics, budget tiers, and trigger events.
  - Buyer persona cards: Primary goals, core objections, decision criteria.
  - Brand voice & positioning framework: Value pillars, proof points, tone guidelines.
- **Pipeline Identifier:** `brand-kit`.
- **Data Contracts:**
  - *Input:* `{ "project_id": "...", "market_niche": "...", "target_revenue": "..." }`
  - *Output:* `{ "icp": {...}, "personas": [...], "value_propositions": [...] }`
- **Acceptance Criteria:**
  - [x] Persists strategy artifacts directly into project context for subsequent campaign binding.

---

## Module 05: Campaign Management

- **Objective:** Manage and orchestrate multi-channel marketing campaigns across Search, Social, Email, and Content.
- **Key Capabilities:**
  - Multi-channel campaign creation with unified budgeting and spend tracking.
  - Campaign milestone scheduling and task dependency tracking.
  - Asset management linking creative deliverables to target campaign objectives.
- **Data Contracts:**
  - *Input:* `{ "name": "Q1 Dental Launch", "objective": "Lead Gen", "channels": ["email","search"], "budget": 5000 }`
  - *Output:* Persisted `campaigns` record with associated task DAG.
- **Acceptance Criteria:**
  - [x] Calculates spend vs. budget in real time from linked task and ad creative outputs.

---

## Module 06: Lead Generation & Intelligence

- **Objective:** Structure and enrich target accounts and decision-maker leads with verified contact details and ICP qualification scores.
- **Key Capabilities:**
  - Batch prospect discovery and data enrichment from CSV/XLSX harness uploads.
  - Rule-based ICP match scoring (0 to 100) based on firmographic criteria.
  - Duplicate email and domain detection.
  - Verification provenance logging (source file hash, verification timestamp).
- **Pipeline Identifier:** `lead-research`.
- **Data Contracts:**
  - *Input:* `{ "harness_file_id": "...", "target_roles": ["CTO", "Head of Growth"] }`
  - *Output:* `{ "leads_processed": 25, "qualified_count": 18, "records": [...] }`
- **Acceptance Criteria:**
  - [x] Rejects malformed email addresses and flags unverifiable phone numbers.

---

## Module 07: CRM & Pipeline Management

- **Objective:** Provide a lightweight, high-speed CRM managing companies, contacts, deals, and sales revenue stages.
- **Key Capabilities:**
  - Visual deal pipeline with drag-and-drop stages (`lead`, `discovery`, `demo`, `proposal`, `negotiation`, `closed_won`, `closed_lost`).
  - Weighted deal value and win probability calculations.
  - Chronological interaction history and meeting notes per company and lead.
- **Data Contracts:**
  - *Input:* `{ "company_id": "...", "title": "Enterprise License", "value": 15000, "stage": "proposal" }`
  - *Output:* Persisted `deals` record with calculated weighted pipeline value.
- **Acceptance Criteria:**
  - [x] Prevents orphaned deals when companies or leads are removed via cascading foreign keys.

---

## Module 08: Email Marketing & Sequences

- **Objective:** Author, schedule, and orchestrate automated outbound email sequences with strict anti-spam compliance and Gate G2 human consent.
- **Key Capabilities:**
  - 5-step automated nurture sequence copywriting grounded in project merge fields.
  - **Approval Gate G2 Enforcement:** All outbound messages halt at `staging` with inspectable subject lines, recipients, and bodies. Live SMTP dispatch requires explicit admin approval.
  - Suppression list checks and mandatory one-click unsubscribe footers.
- **Pipeline Identifier:** `email-campaign`.
- **Data Contracts:**
  - *Input:* `{ "sequence_name": "...", "target_icp": "...", "steps_count": 5 }`
  - *Output:* Staged sequence with dry-run delivery receipts and provider acceptance IDs.
- **Acceptance Criteria:**
  - [x] Outbound SMTP dispatch is blocked in test mode unless `approved=true` is explicitly provided.

---

## Module 09: Content Operations

- **Objective:** Manage editorial calendars, content briefs, blog articles, social copy, and ad creatives.
- **Key Capabilities:**
  - Unified content calendar supporting Blog, LinkedIn, X, and Paid Ad formats.
  - Long-form markdown article compiler with SEO meta descriptions and reading times.
  - 7-day social authority schedule generator (`social-content` pipeline).
  - Multi-platform ad copy generator (`ads-creative` pipeline).
- **Data Contracts:**
  - *Input:* `{ "topic": "...", "format": "blog_post|social_post|ad_copy", "campaign_id": "..." }`
  - *Output:* Clean HTML/Markdown content asset with associated metadata.
- **Acceptance Criteria:**
  - [x] Validates character limits for Google Search ads and social post variants.

---

## Module 10: AI Workforce Engine

- **Objective:** Govern and dispatch the autonomous workforce squad following the strict 5-stage loop.
- **Key Capabilities:**
  - Core squad: `@coordinator` (Lead), `@browser-researcher` (Research), `@software-engineer` (Code/UI), `@master-reporting-agent` (QA/Verdicts).
  - Full access to all 32 specialized agents from the sovereign workforce registry.
  - Strict 5-Stage Agent Execution Loop:
    $$\text{Policy} \longrightarrow \text{Think} \longrightarrow \text{Act} \longrightarrow \text{Observe} \longrightarrow \text{Deterministic Code Check}$$
  - Mandatory dual-deliverable output: Structured JSON + Standardized Markdown Admin Report.
- **Acceptance Criteria:**
  - [x] Zero hallucinated facts; unverified claims are flagged as "Not grounded in harness".

---

## Module 11: n8n Automation Infrastructure

- **Objective:** Provide visual workflow orchestration, scheduled sidecars, and event-driven webhooks for marketing processes.
- **Key Capabilities:**
  - Visual workflows in `n8n-workflows/`:
    - `01-main-task-router.json`: Webhook ingress -> Switch -> LLM invocation -> OS callback.
    - `02-landing-page-factory.json`: HTML compiler and validation pipeline.
    - `03-lead-research.json`: Lead extraction and CSV enrichment pipeline.
  - Resilient webhook delivery with 10s AbortController timeout and dual-stack localhost/127.0.0.1 fallback.
  - Seamless automatic failover to local agent runner when n8n is offline or unreachable.
- **Acceptance Criteria:**
  - [x] Offline n8n never causes application crash or unhandled promise rejection.

---

## Module 12: Analytics & Reporting

- **Objective:** Compile marketing performance indicators, conversion funnels, agent telemetry, and multi-format downloadable audit reports.
- **Key Capabilities:**
  - Funnel performance calculation (Visitors -> Leads -> Qualified -> Deals -> Revenue).
  - Agent telemetry metrics (execution latency, token usage, retry rates).
  - Multi-format document exporter: Adobe PDF (`.pdf`), Word (`.docx`), Excel (`.xlsx`), CSV (`.csv`), Markdown (`.md`).
- **Acceptance Criteria:**
  - [x] Report downloads enforce session token validation to prevent unauthenticated access.
