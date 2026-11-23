# Helm (Marketing OS) — Comprehensive Technology Stack Specification

> **Technical Reference for Engineering Architecture, Libraries, Protocols, and Infrastructure**  
> **Target Environment:** Node.js 22 LTS | Express 4 | SQLite / Turso LibSQL | Vanilla JS SPA | Vercel

---

## 1. Backend Architecture & Runtime

### Core Runtime
- **Node.js:** Version 22.x LTS (compatible with Node >= 20.0.0). Uses modern ES modules alongside CommonJS interop where required. Native `fetch` with `AbortController` timeouts is used across all outbound HTTP requests.
- **Web Framework:** `Express 4.19+`
  - Strict JSON body parsing with 50MB payload limits (`express.json({ limit: '50mb' })`) to accommodate multimodal image data and document uploads.
  - URL-encoded body parser with 50MB limits (`express.urlencoded({ extended: true, limit: '50mb' })`).
  - Asynchronous route handler wrapper (`asyncHandler`) ensuring all uncaught promise rejections flow safely into the centralized error-handling middleware without crashing the Node process.

### Authentication & Authorization (RBAC)
- **Token Format:** JSON Web Token (JWT) signed via `jsonwebtoken` using HS256 algorithm.
- **Token Secret:** `JWT_SECRET` environment variable (minimum 32 characters in production; fallbacks provided for local testing).
- **Password Hashing:** `bcryptjs` with salt rounds = 10.
- **Role Hierarchy:**
  - `super_admin`: Full system control, billing, LLM provider secrets, user deletion, global database reset.
  - `admin`: User management, project management, report approval, delivery sign-off.
  - `manager`: Project creation, task dispatching, squad assignment, review management.
  - `member`: Task execution, harness uploading, chat interactions, deliverable submission.
  - `client`: Read-only access restricted strictly to their assigned `project_id` and delivered reports.
- **Access Control Middlewares:**
  - `authMiddleware`: Extracts `Authorization: Bearer <token>` or `?token=` query param, decodes user payload, verifies user active status in database.
  - `requireRole(...roles)`: Enforces role permissions. Returns HTTP 403 on insufficient privilege.
  - `canAccessProject(user, projectId)`: Guards tenant boundaries. Clients cannot view other clients' projects.

---

## 2. Database & Data Persistence

### Dual Engine: Local SQLite + Cloud LibSQL Bridge
Helm implements a resilient, dual-mode database layer in `server/db.js`:

```
                           +---------------------------+
                           |       server/db.js        |
                           +-------------+-------------+
                                         |
                         +---------------+---------------+
                         |                               |
                         v                               v
             +-----------------------+       +-----------------------+
             |     Local Engine      |       |      Cloud Bridge     |
             |    better-sqlite3     |       |    @libsql/client     |
             |   WAL Mode Enabled    |       |   Turso Cloud Sync    |
             |  (/data/marketing.db) |       | (Serverless / Vercel) |
             +-----------------------+       +-----------------------+
```

1. **Local High-Performance Engine (`better-sqlite3`):**
   - File Path: `data/marketing.db` (gitignored).
   - Write-Ahead Logging (WAL) enabled: `PRAGMA journal_mode = WAL;`.
   - Foreign Keys enforced: `PRAGMA foreign_keys = ON;`.
   - Synchronous mode: `PRAGMA synchronous = NORMAL;`.
   - Busy timeout set to 5000ms to eliminate locking contention during parallel test runs.
2. **Cloud Bridge Engine (`@libsql/client`):**
   - Active when `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` environment variables are present.
   - Provides serverless compatibility across distributed Vercel lambdas without requiring persistent local filesystem disk attachments.

### Database Schema Highlights
- `users`: Accounts, password hashes, roles, avatar URLs, status flags.
- `projects`: Client projects, target goals, attached pipelines, budget allocations.
- `tasks`: Core unit of work; stores title, pipeline, stage (`plan`, `assign`, `execute`, `verify`, `report`), priority, status, assigned agent, `input_json`, and `output_json`.
- `market_research_reports`: Dedicated structured storage for 5-tool forensic research (GSC, GKP, GTM, SEO, GEO, allocated logins, navigation logs).
- `saved_logins`: Encrypted credentials vault for external marketing tools, accounts, and platforms.
- `harness_files`: Ground truth files (CSVs, briefs, brand guides) attached to projects.
- `knowledge_chunks`: Text chunks with lexical and vector metadata for RAG retrieval.
- `agent_runs`: Audit trail tracking every autonomous agent execution, token duration, model used, and outcome.
- `activity`: Global audit log recording all user and agent actions.

---

## 3. Cryptography & Vault Security

### Encryption at Rest (`server/cryptoVault.js`)
- **Algorithm:** AES-256-GCM (Galois/Counter Mode) authenticated encryption.
- **Key Derivation:** `VAULT_ENCRYPTION_KEY` environment variable (32-byte hex or SHA-256 derived).
- **IV / Nonce:** Unique cryptographically random 12-byte initialization vector (`crypto.randomBytes(12)`) generated per encryption operation.
- **Payload Format:** `enc:v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`.
- **Integrity Guarantee:** Any tampering with the ciphertext or auth tag throws an immediate decryption error.
- **Masking Rules:** Sensitive fields (passwords, full API keys) are masked with `••••••••••••` before returning to non-admin API consumers.

---

## 4. Multi-Provider AI & LLM Engine

Located in `server/llmClient.js`, the AI gateway abstracts provider calls with uniform streaming, timeouts, retries, and automatic JSON extraction:

| Provider | Supported Models | Configuration Keys | Use Case |
| :--- | :--- | :--- | :--- |
| **Ollama** (Local Worker) | `qwen2.5:7b`, `qwen2.5:14b`, `llama3.1:8b` | `OLLAMA_HOST` (default `http://127.0.0.1:11434`), `OLLAMA_MODEL` | Zero-cost local execution, offline development, privacy-first runs |
| **OpenAI** | `gpt-4o`, `gpt-4o-mini`, `o1-preview` | `OPENAI_API_KEY`, `OPENAI_MODEL` | High-complexity reasoning, executive report synthesis |
| **Anthropic** | `claude-3-5-sonnet-20241022`, `claude-3-5-haiku` | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Nuanced brand copy, humanized tone, strategic roadmaps |
| **Google Gemini** | `gemini-1.5-pro`, `gemini-2.0-flash` | `GEMINI_API_KEY`, `GEMINI_MODEL` | Multimodal analysis, large context processing |

### Honesty Guarantee & Fail-Fast
When running in production, if no live LLM provider is connected and functioning, the system explicitly throws `HTTP 503 LLM_NOT_CONFIGURED`. It strictly prohibits hallucinating output or fabricating synthetic prospect leads.

---

## 5. RAG & Knowledge Retrieval Pipeline

Located in `server/rag.js`:
- **Chunking Strategy:** Recursive text chunker (800-character chunks with 150-character overlap) preserving paragraph and markdown heading boundaries.
- **Multi-Tier Scoping:**
  - `project`: Knowledge scoped strictly to the client's brand guidelines, tone, and historical assets.
  - `agency_dna`: Global agency frameworks, copywriting formulas, and conversion patterns.
  - `task`: Ephemeral brief instructions and merge field overrides.
  - `harness`: Direct document extracts from uploaded client CSVs and PDFs.
- **Hybrid Search:** Combines keyword token matching (BM25-style lexical scoring) with metadata filtering for sub-10ms chunk retrieval.

---

## 6. Frontend Stack & UI Engineering

### Architecture: Vanilla ES6+ Single-Page Application
- **File Structure:**
  - `public/index.html`: Semantic layout, navigation shell, accessible modals, slide-over panels, and department containers.
  - `public/app.js`: Master application state controller (~10,700 lines), component renderers, event delegation, client-side routing, and real-time polling.
  - `public/style.css`: Design tokens, dark/light mode CSS variables, scrollbars, and high-contrast accessibility rules.
- **Zero Heavy Framework Overhead:** No React, Vue, or Angular build step required. Loads instantly in browser with zero bundle compilation latency.
- **Styling:** Tailwind CSS (via official script CDN) configured with custom extended palette, paired with CSS variables:
  - `--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-soft`, `--primary`.
- **ADHD / Zen Focus Mode:** Global switch (`Zen Mode: ON`) that dynamically filters visual complexity, hides secondary metric noise, and highlights the primary action at hand.

---

## 7. Testing & Quality Assurance Suite

### 6-Tier E2E Test Suite (`scripts/run-e2e-tiers.js`)
All tests run natively using Node's built-in `node:test` and `node:assert/strict` test harness against ephemeral, temporary SQLite databases in `/tmp/`:

1. **Tier 1 — Feature Coverage (`tests/e2e/tier1-feature-coverage.test.js`):** 25 tests covering all 5 core capabilities (5 tests per department).
2. **Tier 2 — Boundary & Corner Cases (`tests/e2e/tier2-boundary-corners.test.js`):** 10 tests covering bad inputs, missing parameters, concurrency, and DB reconnection.
3. **Tier 3 — Governance & Anti-Slop (`tests/e2e/tier3-governance-contracts.test.js`):** 5 tests verifying RBAC security boundaries, JWT expiration, and Anti-Slop Linter rejections.
4. **Tier 4 — Grounded Workloads (`tests/e2e/tier4-grounded-workload.test.js`):** 5 tests executing full workloads grounded in client harness files.
5. **Tier 5 — Multi-Select Knowledge Base (`tests/e2e/tier5-multiselect-kbtiers.test.js`):** 6 tests verifying multi-tier RAG chunk retrieval, snippet priority, and context injection.
6. **Tier 6 — Deep 5-Tool Market Research (`tests/e2e/tier6-deep-market-research.test.js`):** 5+ tests verifying the 5-tool research engine, live typing GEO mapping, allocated logins vault, real HTTP pings, Google search suggestion harvesting, and Playwright UI interactions.

---

## 8. Environment Variables Reference

| Variable | Type | Required | Default | Description |
| :--- | :---: | :---: | :---: | :--- |
| `NODE_ENV` | string | Optional | `development` | Runtime environment (`development`, `production`, `test`) |
| `PORT` | number | Optional | `3000` | Port for Express HTTP server |
| `DATABASE_PATH` | string | Optional | `data/marketing.db` | Path to local SQLite database file |
| `JWT_SECRET` | string | **Required (Prod)** | Random string | Secret key for signing user JWT tokens (>= 32 chars) |
| `VAULT_ENCRYPTION_KEY` | string | **Required (Prod)** | Random string | 32-byte encryption key for AES-256-GCM vault |
| `TURSO_DATABASE_URL` | string | Optional | None | Remote LibSQL database URL (e.g. `libsql://...turso.io`) |
| `TURSO_AUTH_TOKEN` | string | Optional | None | Remote LibSQL authentication token |
| `OLLAMA_HOST` | string | Optional | `http://127.0.0.1:11434`| Local Ollama service host |
| `OLLAMA_MODEL` | string | Optional | `qwen2.5:7b` | Default Ollama model for agent tasks |
| `OPENAI_API_KEY` | string | Optional | None | OpenAI API key |
| `ANTHROPIC_API_KEY` | string | Optional | None | Anthropic Claude API key |
| `GEMINI_API_KEY` | string | Optional | None | Google Gemini API key |
| `ALLOW_SIMULATED_FALLBACK` | boolean| Optional | `false` | Explicitly permits simulated fallback in offline tests only |
