# Changelog — Marketing Operating System

All notable changes to the Marketing Operating System are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.1.0] - 2026-11-16
### Added
- Complete suite of 12 system documentation blueprints conforming to Master Directive:
  - `SYSTEM_ARCHITECTURE.md`
  - `DATABASE_SCHEMA.md`
  - `MODULE_SPECIFICATIONS.md`
  - `API_CONTRACTS.md`
  - `AUTOMATION_CATALOG.md`
  - `AI_AGENT_REGISTRY.md`
  - `SECURITY_POLICY.md`
  - `DEPLOYMENT_GUIDE.md`
  - `TESTING_STRATEGY.md`
  - `IMPLEMENTATION_TRACKER.md`
  - `CHANGELOG.md`
  - `OPERATIONS_RUNBOOK.md`
- Multi-engine Python Workflow Orchestrator (`marketing_os_workflow.py`) testing all 8 pipelines and RBAC security gates autonomously.
- Daily continuous verification cron sidecar configured at `~/.gemini/config/sidecars/daily-marketing-os-test/sidecar.json`.
- Interactive Generative UI status badge component (`marketing_os_status_badge.html`).
- Antigravity Workforce Plugin package (`~/.gemini/config/plugins/marketing-os-agents/`).

### Fixed
- Authentication login normalization: emails trimmed and lowercased; passwords trimmed.
- Dual-stack loopback retry logic (`127.0.0.1` and `localhost`) with 10s timeout to resolve Mac IPv6 resolution latency.
- Factory never blocks: Antigravity Local Fallback implemented in `server/localRunner.js`, automatically generating grounded deliverables if n8n is offline.
- Client role scoping: Clients restricted to viewing only delivered tasks in assigned projects.
- RBAC boundary hardening: Member delivery attempts strictly return HTTP 403 Forbidden.

---

## [2.0.0] - 2026-11-15
### Initial Full-Stack Release
- Node.js Express server on port 3000.
- SQLite relational database with WAL mode and foreign key constraints.
- Responsive frontend interface (`public/index.html`) with Tailwind CSS and live HTML preview modal.
- n8n visual automation workflow router (`n8n-workflows/01-main-task-router.json`).
- 4 specialized Antigravity AI agents (`@coordinator`, `@browser-researcher`, `@software-engineer`, `@master-reporting-agent`).
