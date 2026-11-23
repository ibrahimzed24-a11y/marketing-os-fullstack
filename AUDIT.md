# Audit — Helm (Marketing OS)

**Audited:** `/Users/ibrahimzid/Desktop/Marketing Os/`
**Date:** 2026-11-23 · **Runner:** Solar (Hermes)
**Gate baseline:** `npm run lint` → 0 syntax errors · `git remote` → origin = github.com/ibrahimzed24-a11y/marketing-os-fullstack.git

---

## 1. What is healthy (do not break)

| Area | Evidence |
|---|---|
| **Static quality** | `npm run lint` clean (node --check on 4 core files) |
| **Core architecture** | 5-stage loop (`plan → assign → execute → verify → report`), RBAC, AES-256-GCM vault, anti-slop linter, skills catalog, SEO/GEO engine, n8n bridge, watchdog |
| **KB existence** | `rag_chunks` table + `rag.js` (hierarchical Helm/Project/Task scope + 5 categories) |
| **KB wiring** | `agentFramework.js:2073-2083` — `searchChunks` called inside Stage 3 (Execute), merged with `project.knowledge_notes` / `task.knowledge_notes` |
| **Deliverable contract** | `tasks.output_json` + `tasks.report_md` + `deliverables` array on projects; `approvalPolicy.js` gates `deliverable_signoff` |
| **Test suite** | 6 E2E tiers present (`tests/e2e/`); runner `scripts/run-e2e-tiers.js` |

## 2. Findings vs. your three asks

### A. Knowledge base — REAL but thin
- **Working:** RAG engine (`rag.js`) with `ingestDocument` → `rag_chunks`, search with Helm/Project/Task scope, categories (market_research, gaps_opportunities, brand_guidelines, customer_profiles, offer_frameworks). Already wired into Stage 3 (Execute) and the report templates.
- **Gaps:**
  1. **No content.** The only seeded KB is the `helm` system project (a single row). No valioz-specific sales/research/offer/brand/QA knowledge is loaded, so agents act on the Canadian-dental harness, not on *your* sales reality.
  2. **No ingestion UI/API.** An admin (you) can put text into `knowledge_notes` text columns, but there is no way to curate KB items, nor a search UI, nor a way to confirm an agent actually used the KB.
  3. **Plan stage (Stage 1) does not load the KB.** The KB is only consulted inside Execute (Stage 3). A grounded agent should read the KB in Plan and carry the context forward.

### B. Browsing agent — documented but not built
- **Working:** `@browser-researcher` with 5 skills and 5 tool keys (google_search_console, keyword_planner, tag_manager, seo_engine, geo_matrix) that ping endpoints; `browserNavigationLog` in the report templates; `agentsData.js` lists `Headless Chromium Navigation` as a capability; the **docs explicitly describe** "Authenticated Browser Use Agent Navigation".
- **Gaps (the biggest one):**
  1. **No live browser.** Zero `playwright/chromium/puppeteer` usage in `server/`. The "browser" is an HTTP-ping engine only — it never *navigates* a website, never extracts DOM/SERP/pricing, never records a navigation trail as an artifact.
  2. **No browsing skill/agent surface.** The agent framework has `registerSkill(slug, config)` and `getSkill(sopSlug)`, but no `browsing`/`web-research` skill entry that front-end UI or another agent can invoke.
  3. **No navigation trail artifact.** Browsed pages, extracted content, and actions are not persisted anywhere.

### C. Deliverables & artifacts — present but no artifact store
- **Working:** `artifacts` of final output lives in `tasks.output_json` + `tasks.report_md`; `previewBuilder.js` renders a deliverable preview; `deliverables` is a project attribute; `approvalPolicy.js` requires approval for `deliverable_signoff`.
- **Gaps:**
  1. **No persistent artifacts store.** Final deliverables (email sequence, landing page, ad copy, research kit, report) are not versioned or download-exported in a way the UI can offer; there is no "final deliverables & artifacts" archive endpoint.
  2. **No `artifacts` table.** The DB has `tasks`/`reports`/`harness_files` but no structured `artifacts` table, so a delivered artifact cannot be re-fetched, versioned, or listed by the UI later.
  3. **No Stage-5 artifact persistence.** The 5-stage loop writes `output_json`/`report_md` but never saves the deliverable payloads (e.g., HTML, email .eml, report PDF) as files under `uploads/`.

## 3. Build plan (in priority order)

| # | Build | What it adds | Verify |
|---|---|---|---|
| 1 | **Knowledge base (KB)** | KV seed content (valioz sales/research/offer/brand/QA) + `POST /api/knowledge/ingest` + `GET /api/knowledge/search` + seed hook into `npm run seed`; agent prompt gains a KB section | lint + a KB-search smoke test + agent report shows `[KB]` citations |
| 2 | **Browsing agent** | `server/browserEngine.js` (playwright headless: navigate, DOM/SERP/pricing/table extraction, 5-tool ping, trail record) + `browsing`/`web-research` skills wired into `@browser-researcher` + a `POST /api/browser/navigation` endpoint + artifact capture | lint + Playwright smoke + a navigation run that returns captured page content |
| 3 | **Deliverables & artifacts** | `artifacts` table + `GET/POST /api/artifacts` + download; Stage 5 saves every deliverable payload to `uploads/artifacts/<task>/`; project deliverable panel lists + downloads | lint + 200s on artifact endpoints + a delivered task shows an artifact id |

## 4. Audit evidence (commands + results)

| Command | Result |
|---|---|
| `npm run lint` | ✅ 0 syntax errors |
| `git remote -v` | ✅ origin = github.com/ibrahimzed24-a11y/marketing-os-fullstack.git |
| `grep -n "rag\." server/agentFramework.js` | ✅ 1 hit, wired into Stage 3 (Exec) |
| `grep -rn playwright\|chromium server/` | ⚠️ 0 hits (no live browser anywhere) |
| `grep -n "knowledge" server/db.js` | ⚠️ `knowledge_notes` text cols + `helm` seed KB, **no** `knowledge_chunks` table (QB uses `rag_chunks`) |

---

*Audit notes will be updated after each build phase. The next phase is the Knowledge Base.*
