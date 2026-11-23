# AI Agent Registry — Antigravity & Marketing OS Workforce

**Document Version:** 2.0.0  
**Target Architecture:** Antigravity Native Workforce Plugin + Sovereign 32-Agent Registry  
**Author:** AI Systems Lead  
**Date:** 2026-11-16  

---

## 1. Operating Rules & Core Constraints

1. **Ground Truth Rule:** All claims, metrics, prices, and names must be grounded in `/uploads` harness files or live verified web inputs. Hallucinations are strictly prohibited.
2. **5-Stage Execution Loop:**
   $$\text{Run Policy} \longrightarrow \text{Think} \longrightarrow \text{Act} \longrightarrow \text{Observe} \longrightarrow \text{Deterministic Code Check}$$
3. **Mandatory Deliverable Package:** Every task must output:
   - `output_json`: Machine-readable structured deliverable.
   - `report_md`: Standardized executive Admin Report in markdown.

---

## 2. Core Workforce Agents (Antigravity Plugin)

### 2.1 `@coordinator` (Chief Operating Officer & Pipeline Orchestrator)
- **Plugin Path:** `~/.gemini/config/plugins/marketing-os-agents/agents/coordinator.md`
- **Core Role:** High-level DAG decomposition, task assignment, and QA governance.
- **Assigned Pipelines:** All 8 pipelines (`landing-page`, `lead-research`, `content-seo`, `market-intel`, etc.).
- **Permissions:** Workspace read/write, task status updates, agent delegation. Cannot deliver directly to clients without admin approval.

### 2.2 `@browser-researcher` (Market Intelligence & Lead Specialist)
- **Plugin Path:** `~/.gemini/config/plugins/marketing-os-agents/agents/browser-researcher.md`
- **Core Role:** Autonomous web navigation, competitor intelligence extraction, SERP analysis.
- **Assigned Pipelines:** `market-intel`, `lead-research`, `content-seo`.
- **Tools:** Chromium browser navigation, DOM parsing, structured table extraction.
- **Permissions:** Read-only web and harness access; writes research notes and evidence citations.

### 2.3 `@software-engineer` (Full-Stack Builder & UI Specialist)
- **Plugin Path:** `~/.gemini/config/plugins/marketing-os-agents/agents/software-engineer.md`
- **Core Role:** HTML landing page generation, Tailwind styling, API endpoints, schema validation.
- **Assigned Pipelines:** `landing-page`, `cro-audit`, `brand-kit`.
- **Tools:** Syntax AST validation, HTML linting, code generation.
- **Permissions:** Full development workspace write access.

### 2.4 `@master-reporting-agent` (Independent QA Auditor & Reporter)
- **Plugin Path:** `~/.gemini/config/plugins/marketing-os-agents/agents/master-reporting-agent.md`
- **Core Role:** Quality verification, ground truth validation, rendering `Ready to Deliver` verdicts.
- **Assigned Pipelines:** All pipelines (Pre-delivery gatekeeper).
- **Verdicts:** `approved` (Ready to Deliver) vs `needs_fix`.

---

## 3. Integration of the 32 Sovereign Agents Across 12 Modules

| Module ID | Primary Agent | Supporting Specialists | Department |
| :--- | :--- | :--- | :--- |
| **01: Command Center** | `coordinator` | `progress-monitor`, `executive-summarizer` | Orchestration |
| **02: Market Intel** | `competitor-intelligence` | `market-seo-geo-researcher`, `data-extractor` | Research |
| **03: SEO & GEO** | `seo-auditor` | `geo-targeting-analyst`, `content-strategist` | Growth & Marketing |
| **04: Strategy** | `campaign-planner` | `content-strategist`, `coordinator` | Growth & Marketing |
| **05: Campaigns** | `campaign-planner` | `marketing-agent`, `resource-allocator` | Growth & Marketing |
| **06: Leads** | `data-extractor` | `web-navigator`, `browser-use-agent` | Browser & Data |
| **07: CRM** | `service-manager` | `system-integrator-update-agent` | Outreach & Operations |
| **08: Email** | `email-operator` (Gate G2) | `brand-compliance`, `content-strategist` | Outreach & Operations |
| **09: Content** | `content-strategist` | `marketing-agent`, `visual-inspector` | Growth & Marketing |
| **10: AI Workforce** | `coordinator` | `task-decomposer`, `retrospective-analyst` | Orchestration |
| **11: n8n Automation** | `software-engineer` | `backend-specialist`, `system-integrator` | Engineering & Code |
| **12: Analytics** | `master-reporting-agent`| `audit-trail-compiler`, `release-verifier` | Executive & Audit |
