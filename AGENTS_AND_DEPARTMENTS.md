# Helm (Marketing OS) — Agents & Operational Departments Guide

> **Detailed Specification of Agent Personas, Skills, Tools, and Departmental Contracts**  
> **Reference Document:** In-engine Agent Framework (`server/agentFramework.js`)

---

## 1. Agent Personas Registry

All agents in Helm extend the `BaseAgent` class in `server/agentFramework.js` and operate under explicit, non-overlapping departmental roles:

```
+-----------------------------------------------------------------------------------------+
|                                    AGENT REGISTRY                                       |
|                                                                                         |
| 1. @browser-researcher     Autonomous Forensics & Market Intelligence Specialist        |
| 2. @software-engineer      High-Converting UI & Full-Stack Web Deliverable Specialist   |
| 3. @creative-director      Omnichannel Creative, Copywriting & Media Specialist         |
| 4. @coordinator            Workflow Dispatcher & DAG Progression Orchestrator          |
| 5. @master-reporting-agent Executive Auditor, Anti-Slop Enforcer & QA Verdict Authority |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Department 01: Browser Research & Market Intelligence

### Lead Agent: `@browser-researcher` (`Agent 01`)
- **System Directive:** *"Gather, analyze, and synthesize verified market intelligence, competitor teardowns, search intent matrices, and verified B2B prospect leads. Ground all findings in client harness files and live search without hallucination."*
- **Registered Skills:**
  - `deep_market_research`: 5-Tool forensic market research engine for any business idea.
  - `browser_research`: Web scraping and competitive teardown execution.
  - `market_intel`: Industry sizing, TAM/SAM/SOM calculation, and macro trends.
  - `lead_research`: B2B lead discovery and prospect verification.
  - `content_seo`: Search intent mapping and Keyword Golden Ratio (KGR) analysis.

### The 5 Permanently Assigned Research Tools
Department 01 guarantees that every research report is audited across 5 mandatory tools:

1. **Google Search Console (GSC):**
   - *Target URL:* `https://search.google.com/search-console`
   - *Data Extracted:* Total monthly query impressions, average CTR benchmarks, average SERP position, and Page 2 fast leap opportunities (positions 8–15).
2. **Google Ads Keyword Planner (GKP):**
   - *Target URL:* `https://ads.google.com/aw/keywordplanner`
   - *Data Extracted:* Exact search demand volume, YoY search trend velocity, commercial competition tier, and High/Low Top-of-Page CPC bids.
3. **Google Tag Manager (GTM):**
   - *Target URL:* `https://tagmanager.google.com`
   - *Data Extracted:* Container tag audits (GA4 core, Google Ads enhanced conversions, Meta CAPI), conversion tracking integrity, and funnel leak diagnosis.
4. **SEO Competitor Engine (Ahrefs):**
   - *Target URL:* `https://app.ahrefs.com`
   - *Data Extracted:* Competitor Domain Ratings (DR), backlink footprint analysis, and Keyword Golden Ratio (KGR = `allintitle / search volume < 0.25`) ultra-fast wins.
5. **GEO Search Matrix (Google Business Profile / Maps):**
   - *Target URL:* `https://business.google.com`
   - *Data Extracted:* Google Maps Local 3-Pack competition density, regional metro intent indices (0–100), and suburban vs downtown search dynamics.

### Real-Time GEO Mapping & Typing Autocomplete
The Target Geography input (`#mrTargetGeoInput`) allows arbitrary typing with live autocomplete synchronization across:
- **Countries:** United Kingdom, Canada, United States, United Arab Emirates, Saudi Arabia, Australia, Germany, European Union, Global.
- **Regions & Metros:** London & Metros, Greater Toronto Area, Vancouver & Burnaby, Calgary & Edmonton, NYC Metro, Silicon Valley, Dubai & Abu Dhabi, Riyadh & Jeddah, etc.
- **Typing Fallback:** Any arbitrary city or market (e.g. *"Cairo, Egypt"*, *"Tokyo, Japan"*) can be freely typed and is preserved in the research report.

### Allocated Logins Vault Integration
- The 5 tools are bound to active operator accounts stored in `saved_logins` with encrypted credentials.
- The UI displays an account dropdown for each tool, defaulting to `ibrahim.zed24@gmail.com`.
- **Live Tool Network Pings:** Clicking `⚡ Ping & Verify All 5 Tools` sends concurrent requests to `POST /api/saved-logins/:id/test`, executing real HTTP requests to Google and Ahrefs endpoints and rendering live latency in milliseconds (e.g., `✓ 200 OK (142ms)`).

### Real-Time Google Autocomplete Suggestion Harvesting
When an idea is researched, the engine calls Google's public autocomplete endpoint:
```
https://suggestqueries.google.com/complete/search?client=chrome&q=<query>
```
Harvested real queries are dynamically incorporated into:
1. `google_search_console.top_queries`
2. `google_keyword_planner.high_intent_keywords`
3. `browser_navigation_log.live_search_queries`
4. Section 6 of the Markdown report under a dedicated telemetry table.

---

## 3. Department 02: Software Engineering & Landing Page Factory

### Lead Agent: `@software-engineer` (`Agent 02`)
- **System Directive:** *"Architect, write, and verify production-grade, accessible, responsive landing pages, patient intake forms, interactive pricing calculators, and clean JavaScript components. Follow anti-slop frontend engineering standards with zero broken links or placeholder copy."*
- **Registered Skills:**
  - `landing_page`: Full-page HTML/Tailwind responsive landing page generation.
  - `interactive_calculator`: Embedded eligibility or pricing calculators.
  - `form_builder`: Multi-step conversion forms with client-side validation.
- **Design Standards:**
  - Semantic HTML5 (`<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`).
  - Strict 60-30-10 color harmony (60% background/neutral, 30% structural/slate, 10% high-contrast brand accent).
  - Mobile-first responsive layout (320px, 768px, 1024px, 1440px breakpoints).
  - Accessible touch targets (minimum 44x44px for buttons and links).

---

## 4. Department 03: Creative Media & Multimodal Studio

### Lead Agent: `@creative-director` (`Agent 03`)
- **System Directive:** *"Develop high-converting multimodal marketing assets, WhatsApp Business image cards, email marketing sequences, and persuasive ad copy grounded in buyer personas and clear value propositions."*
- **Registered Skills:**
  - `ad_creative`: Multi-variant ad copy (Facebook, Instagram, LinkedIn, Google Search).
  - `whatsapp_cards`: Branded WhatsApp image cards with CTA buttons.
  - `email_campaign`: 600–680px single-column mobile-friendly email sequences.
- **Copywriting Frameworks:**
  - **PAS:** Problem -> Agitation -> Solution
  - **AIDA:** Attention -> Interest -> Desire -> Action
  - **BAB:** Before -> After -> Bridge

---

## 5. Department 04: Workflow Coordination & DAG Engine

### Lead Agent: `@coordinator`
- **System Directive:** *"Coordinate marketing pipelines across departments, manage task stage progression (Plan -> Assign -> Execute -> Verify -> Report), resolve task dependencies, and maintain project velocity."*
- **Key Responsibilities:**
  - Route tasks to the proper departmental specialist.
  - Manage task dependencies and stage progression.
  - Monitor timeouts and retry failing external calls.

---

## 6. Department 05: Executive Reporting & Governance QA

### Lead Agent: `@master-reporting-agent`
- **System Directive:** *"Audit all marketing deliverables against ground truth harness files, enforce anti-slop linguistic quality rules, verify technical contracts, and synthesize executive management reports with unambiguous delivery verdicts."*
- **Anti-Slop Quality Linter (`server/antiSlopLinter.js`):**
  - Evaluates every deliverable before delivery.
  - **Banned Buzzwords:** *"delve"*, *"tapestry"*, *"testament"*, *"beacon"*, *"game-changer"*, *"seamlessly"*, *"elevate"*, *"plethora"*, *"paradigm shift"*, *"synergistic"*.
  - Asserts deliverable ends with: `**Verdict:** Ready to Deliver`.
