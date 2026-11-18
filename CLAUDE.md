# Marketing OS — Project Rules & Context Engineering Guide

## Tech Stack
- **Backend:** Node.js 22, Express 4, SQLite (`better-sqlite3` WAL mode), Turso LibSQL Cloud bridge (`@libsql/client`)
- **Frontend:** Vanilla JS SPA (`public/app.js`, `public/index.html`, `public/style.css`), Tailwind CSS
- **Deployment:** Vercel Serverless (`vercel.json`) + Turso Cloud (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`)
- **Testing:** 11 Bash/Node E2E suites (`./test-all-e2e.sh`) + 41-check Headless Chromium Playwright suite (`tests/playwright-e2e.mjs`)

## Core Commands
- Syntax check: `node --check server/index.js && node --check public/app.js`
- Full E2E suite (isolated temp DB, Turso disabled): `./test-all-e2e.sh`
- Playwright browser E2E (isolated temp DB): `node tests/playwright-e2e.mjs`
- Local dev server: `node server/index.js`

## Installed Skill Packs (`skills/`)
Loaded at runtime by `server/skillEngine.js` and injected into the 3 Core Agents:
1. **`skills/humanizer/SKILL.md`** (`blader/humanizer` v4.0.0) — Anti-AI-slop writing rules applied to Research reports, Sales outreach emails, Creative copy, and UI prose.
2. **`skills/design-taste-frontend/SKILL.md`** (`Leonxlnx/taste-skill` v2.5.1) — Anti-slop frontend & landing page design rules (plain copy, equal edges, one section per screen, hover micro-interactions, real visuals).
3. **`skills/open-design/{dashboard,email-marketing,critique}/SKILL.md`** (`nexu-io/open-design`) — DESIGN.md token discipline, 600–680px single-column email structure, and 5-dimension design critique (Philosophy, Hierarchy, Detail, Functionality, Innovation).
4. **`skills/engineering/*/SKILL.md`** (`addyosmani/agent-skills`) — Security & hardening, doubt-driven adversarial review, context engineering, API & interface design, code simplification, observability, and frontend UI engineering.

## Non-Negotiable Engineering & Honesty Boundaries
- **Zero Fake Statuses or Data:** Never show green `Online`/`Connected`/`Active` unless live connectivity or background execution is verified.
- **No Fake Agent Deliverables in Production:** If no live LLM provider is connected, agents fail explicitly (`HTTP 503 LLM_NOT_CONFIGURED`) and never fabricate leads or metrics.
- **Strict State Separation:** `task_status` != `approval_status` != `execution_status`. Human approval never implies an external email was sent or ad campaign launched.
- **Security Fail-Fast:** `JWT_SECRET` (>= 32 chars) and `VAULT_ENCRYPTION_KEY` (>= 32 chars) are mandatory in production; all stored API keys use AES-256-GCM (`server/cryptoVault.js`).
- **Protect Live Production DB:** Local tests MUST clear `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` and point `DATABASE_PATH` to `/tmp/*.db`.
