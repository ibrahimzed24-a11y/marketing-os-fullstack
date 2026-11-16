# Marketing OS - Full Stack Admin Factory
**Built for Local: n8n + Antigravity + Node + SQLite**

You are the Admin. Your team runs real marketing tasks through real pipelines.
No mock data in prod - every task triggers an n8n webhook -> Antigravity agent -> back to OS.

## Quick Start (Local - 5 min)

```bash
# 1. Install
npm install

# 2. Copy env
cp .env.example .env

# 3. Start OS (API + Web)
npm run dev
# -> http://localhost:3000

# 4. Start n8n (separate terminal)
npx n8n start
# -> http://localhost:5678

# 5. Import workflows
# n8n -> Workflows -> Import from File -> import all files in /n8n-workflows/*.json
# Set env in n8n: OS_API_URL=http://localhost:3000, OS_API_KEY=your-key

# 6. Start Antigravity (your agent IDE)
# Point Antigravity workspace to /antigravity/
# Each agent has AGENT.md + SKILL.md + MEMORY.md
```

## Login (Seeded)
- Super Admin: admin@marketingos.local / Admin123!
- Manager: manager@marketingos.local / Manager123!
- Member: member@marketingos.local / Member123!
- Client: client@marketingos.local / Client123!

Change in production! Run `npm run seed` to reset.

## Architecture
```
Browser (Frontend - Vanilla + Tailwind via CDN, no build)
  |
  v
Node Express API (server/index.js) - JWT Auth, RBAC, SQLite
  |
  +-> /api/auth, /api/projects, /api/tasks, /api/pipelines, /api/harness
  |
  v
n8n Webhooks (n8n-workflows/*.json) - Orchestration
  |
  v
Antigravity Agents (antigravity/agents/*) - Real execution
  |
  v
Callback -> OS API /api/webhooks/n8n -> Task status + Admin Report
```

## Roles & Access
| Role | Can Do |
|------|--------|
| super_admin | Everything, manage users, billing, all projects, vault, settings |
| admin | Manage team, projects, approve reports, deliver |
| manager | Create projects, assign tasks, review reports, manage own team |
| member | Execute assigned tasks, upload harness, chat with agents, submit work |
| client | View-only own projects + delivered reports, approve deliverables |

Every API route checks `requireRole()` + `requireProjectAccess()`.

## Marketing Pipelines (Real)
1. content-seo - Blog / SEO Article Factory
2. social-content - Social Content Calendar
3. ads-creative - Ads Creative + Copy
4. email-campaign - Email Campaign
5. lead-research - Lead Research + Outreach
6. landing-page - Landing Page Factory
7. market-intel - Market Intelligence / GrillMe
8. brand-kit - Brand Kit + Visuals

Each pipeline = n8n workflow + Antigravity squad + 5 stages:
Plan -> Assign -> Execute -> Verify -> Report/Deliver

## n8n + Antigravity Flow
1. User creates Task in OS -> OS calls n8n webhook `POST /webhook/marketing-os-task`
2. n8n routes by pipeline type -> calls Antigravity / your LLM / tools
3. Antigravity agent reads Harness files from /uploads, executes, returns JSON
4. n8n calls back OS: `POST /api/webhooks/n8n` with result + Admin Report markdown
5. OS updates Task to In Review, notifies Admin + Assignee
6. Admin Approves -> Task Delivered, Client sees it.

## Folders
- server/ - API
- public/ - Frontend (single-page app, role dashboards)
- n8n-workflows/ - Importable workflows
- antigravity/ - Agent definitions + skills + prompts
- uploads/ - Harness files (gitignored)
- data/ - SQLite DB (gitignored)
