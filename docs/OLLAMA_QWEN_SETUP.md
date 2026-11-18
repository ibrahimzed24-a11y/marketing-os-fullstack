# Ollama + Qwen2.5 7B & Local Worker Integration Guide

This document describes how Marketing OS runs **Ollama** with **Qwen2.5 7B (`qwen2.5:7b`)** on macOS and integrates it into both local and Vercel-deployed instances without exposing Ollama to the public internet.

---

## 1. Architecture Overview

Marketing OS keeps its existing **Unified LLM Client** (`server/llmClient.js`) and **3-Agent Execution Framework** (`server/agentFramework.js`) intact:

- **Provider Adapter Registry (`server/llmClient.js`):**
  - `PROVIDER_ADAPTERS.ollama` speaks Ollama's official API (`https://docs.ollama.com/api`):
    - `/api/chat` (default for agents, multi-turn messages, and tool calling)
    - `/api/generate` (optional plain-text mode via `mode: 'generate'`)
    - `format: 'json'` when `expectJson: true`
    - NDJSON streaming via `stream: true` + `onToken`
  - Normalizes output, token usage (`prompt_tokens`, `completion_tokens`, `tokens_per_second`), tool calls, and classified error codes (`OLLAMA_UNAVAILABLE`, `OLLAMA_MODEL_NOT_FOUND`, `OLLAMA_TIMEOUT`, `INVALID_JSON`, `TOOL_CALL_PARSE_ERROR`).
  - Reuses existing bounded retry backoff, failover routing (`admin_llm_routing`), and zero-secret error sanitization.

- **Vercel ↔ MacBook Local Worker Bridge (`worker/ollama-worker.js` + `/api/worker/*`):**
  - A Vercel serverless function **cannot** call `http://127.0.0.1:11434` on your MacBook.
  - Instead of exposing Ollama publicly or creating a second database:
    1. When running on Vercel (`VERCEL=1`) with a localhost primary provider (`ollama`), `POST /api/tasks/:id/run` and `POST /api/agents/dispatch` queue the task cleanly (`tasks.status = 'queued'`, HTTP `202`).
    2. Your MacBook runs `worker/ollama-worker.js`, which connects **outbound** over HTTPS to Marketing OS using `X-OS-API-Key: <OS_API_KEY>`.
    3. The worker sends heartbeats (`POST /api/worker/heartbeat`), atomically claims queued tasks (`POST /api/worker/claim`), executes them through the **existing** `server/agentFramework.js` + `server/llmClient.js` against `http://127.0.0.1:11434`, and reports normalized results idempotently (`POST /api/worker/complete`) or failures (`POST /api/worker/fail`).
  - When running Marketing OS locally (`npm start` on your MacBook), `POST /api/tasks/:id/run` calls `http://127.0.0.1:11434` directly in-process.

---

## 2. Ollama Installation & Service Management (macOS)

- **Installed distribution:** Official universal macOS bundle (`/Applications/Ollama.app`, CLI symlinked at `~/.local/bin/ollama`).
- **Auto-start LaunchAgent:** `~/Library/LaunchAgents/com.marketingos.ollama.plist`
  - Explicitly bound to `OLLAMA_HOST=127.0.0.1:11434` (loopback only — never exposed to LAN/internet).
  - Logs: `~/Library/Logs/ollama.stdout.log` and `~/Library/Logs/ollama.stderr.log`.

### Start, Stop, and Restart Ollama

```bash
# Check status & verify local API
curl -s http://127.0.0.1:11434/api/tags
~/.local/bin/ollama list

# Stop Ollama LaunchAgent
launchctl bootout "gui/$(id -u)/com.marketingos.ollama"

# Start Ollama LaunchAgent
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.marketingos.ollama.plist"
```

---

## 3. Model Installation & Configuration (`qwen2.5:7b`)

```bash
# Pull Qwen2.5 7B
~/.local/bin/ollama pull qwen2.5:7b

# Verify installed models
~/.local/bin/ollama list

# Quick interactive inference check
~/.local/bin/ollama run qwen2.5:7b "Reply in one sentence: what is Marketing OS?"
```

### Centralized Environment Variables (`.env` / Shell)

| Variable | Default | Purpose |
|---|---|---|
| `LLM_PROVIDER` | `ollama` | Optional env override for active LLM provider |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Local Ollama endpoint (never put in frontend bundle) |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Default Ollama model |
| `OLLAMA_TIMEOUT_MS` | `300000` | Request timeout in ms (5 min recommended for 7B CPU inference) |
| `OLLAMA_MAX_TOKENS` | `1024` | Worker token cap per task to keep Intel CPU runs bounded |
| `OLLAMA_NUM_CTX` | *(model default: 4096)* | Optional context window override (model supports up to 32,768) |
| `MARKETING_OS_URL` | `http://127.0.0.1:3000` | Backend URL for the Local Worker (set to your Vercel URL in prod) |
| `OS_API_KEY` | *(required in prod)* | Shared secret header (`X-OS-API-Key`) for `/api/worker/*` |

### Switching Models Later

1. Pull the new model locally: `~/.local/bin/ollama pull <model-tag>` (e.g. `qwen2.5:3b` for faster Intel CPU inference, or `llama3.2:3b`).
2. Update **Settings → LLM Providers → Ollama → Default Model** (and/or `OLLAMA_MODEL` when starting the worker).
3. Click **Save** and **Test Ping** (or restart `npm run worker`).

---

## 4. Starting & Stopping the Local Worker

### Against Local Marketing OS
```bash
npm run worker
```

### Against Live Vercel Production (`https://marketing-os-fullstack.vercel.app`)
```bash
MARKETING_OS_URL=https://marketing-os-fullstack.vercel.app npm run worker
```

### Connectivity Check & Single-Task Run
```bash
# Verify local Ollama + backend X-OS-API-Key handshake without claiming tasks
MARKETING_OS_URL=https://marketing-os-fullstack.vercel.app node worker/ollama-worker.js --check

# Claim and execute at most one queued task, then exit
MARKETING_OS_URL=https://marketing-os-fullstack.vercel.app node worker/ollama-worker.js --once
```

Stop the foreground worker cleanly with `Ctrl+C` (`SIGINT`) or `kill -TERM <pid>`.

---

## 5. Testing Connectivity & Regression Suites

```bash
# Run Ollama adapter + Local Worker Bridge + live Qwen2.5 7B + 3-Agent tests
npm run test:ollama

# Run full 11-suite backend E2E tests (isolated temp DB)
npm test

# Run 41-test Playwright UI & API E2E suite
node tests/playwright-e2e.mjs
```

---

## 6. Troubleshooting Common Errors

| Error Code / Symptom | Cause | Fix |
|---|---|---|
| `OLLAMA_UNAVAILABLE` (`ECONNREFUSED`) | Ollama daemon is stopped | Start LaunchAgent (`launchctl bootstrap ...`) or run `ollama serve` |
| `OLLAMA_MODEL_NOT_FOUND` | Model tag not downloaded locally | Run `ollama pull qwen2.5:7b` and verify with `ollama list` |
| `OLLAMA_TIMEOUT` | CPU inference exceeded timeout budget | Increase `OLLAMA_TIMEOUT_MS` (e.g. `240000`) or use a smaller quantization/model (`qwen2.5:3b`) |
| `HTTP 401 Unauthorized worker API key` | `OS_API_KEY` mismatch between `.env` and Vercel Secrets | Ensure local `OS_API_KEY` matches the Vercel `OS_API_KEY` secret |
| Task stays `queued` on Vercel | Local Worker is not running on the MacBook | Start `MARKETING_OS_URL=https://marketing-os-fullstack.vercel.app npm run worker` |
| Task marked `needs_attention` | Worker disconnected >10 min or non-retryable model error | Inspect `GET /api/agent-runs` / `error_log`, fix root cause, and retry the task |

---

## 7. Future Extension Points: Agency DNA & Shared SOP Engine

The current architecture already exposes clean, additive integration points so a shared Agency Knowledge Base and SOP Engine can be added without rebuilding the 3 agents:

1. **Shared Agency Context Storage (`agent_blueprints` table, `agent_slug = 'agency_dna'`):**
   - `server/agentFramework.js` includes `loadAgencyContext(targetDb)` which automatically injects any saved `agency_dna` tabs (e.g., `identity`, `services_offers`, `icp`, `brand_voice`, `email_standards`, `design_preferences`, `research_sops`) into every agent's system prompt (`SHARED AGENCY DNA & SOP STANDARDS`).
   - Editable via the existing `GET/PUT /api/agent-blueprints/agency_dna` Admin endpoints — zero schema rewrite required.
2. **Semantic / BM25 Knowledge Retrieval (`server/rag.js`):**
   - Currently retrieves top-K chunks per `project_id`. Extending `rag.searchChunks` with an optional `scope = 'agency_global'` lookup allows shared agency SOP documents and templates to be indexed and retrieved alongside project-specific harness files.
3. **Runtime Skill Directives (`server/skillEngine.js`):**
   - `buildSkillDirectives(department, pipeline)` maps department/pipeline pairs to versioned `SKILL.md` rules (`skills/`), providing a clean plug-in point for agency-authored SOP packs.

---

## 8. Verified Capabilities & Measured Benchmarks

Measured on this MacBook (**macOS 15.8.3**, **Intel Core i7-8850H x86_64**, **16.0 GB RAM**, **Ollama v0.40.16**, **qwen2.5:7b `Q4_K_M` / `7.6B` / `4.7 GB` on disk**):

- **Observed Resource Usage (`ollama ps`):**
  - Memory footprint when loaded: **`5.1 GB` RAM**
  - Compute allocation: **`100% CPU`** (`llamacpp` runner — Intel Mac has no Apple Silicon Metal unified GPU acceleration)
  - Default runtime context window: **`4096`** tokens (model metadata supports up to `32,768` via `OLLAMA_NUM_CTX`, at higher RAM & latency cost)
  - Sustained generation speed: **`2.56 – 2.73 tokens/sec`**

### Verified Test Results

| Capability / Test | Status | Measured Result |
|---|---|---|
| Ollama service & `/api/tags` (`127.0.0.1:11434` loopback-only) | Verified | `HTTP 200 OK`, `ollama v0.40.16`, `qwen2.5:7b` present |
| English chat inference (`/api/chat`) | Verified | `28.96s`, `2.69 tok/s`, 368 chars |
| Arabic chat inference (`/api/chat`) | Verified | `24.05s`, `2.73 tok/s`, fluent Modern Standard Arabic (`153` Arabic chars) |
| Structured JSON output (`format: 'json'`, `strictJson: true`) | Verified | `15.70s`, exact schema keys returned (`channel`, `primary_kpi`, `steps`) |
| NDJSON streaming (`stream: true` + `onToken`) | Verified | `5.79s`, 12 streamed chunks |
| Native tool calling (`tools: [get_campaign_status]`) | Verified | `19.11s`, valid tool call emitted (`campaign_id: "cmp-402"`, `parse_error: null`) |
| **Research Agent** (`agent-01`, `market-intel`) | Verified | `213.91s`, `provider=ollama`, `model=qwen2.5:7b`, `humanizer=100/100` |
| **Sales Agent** (`agent-02`, `email-campaign`) | Verified | `218.26s`, `provider=ollama`, `model=qwen2.5:7b`, `humanizer=92/100` |
| **Creative Director Agent** (`agent-03`, `landing-page`) | Verified | `199.90s`, `provider=ollama`, `model=qwen2.5:7b`, `humanizer=92/100` |
| **Local Worker E2E** (`worker/ollama-worker.js --check` & `--once`) | Verified | `155.46s` (`816` prompt + `350` completion tokens, `2.56 tok/s`), `tasks.status=in_review`, `agent_runs.status=succeeded` |
| Error handling (`OLLAMA_UNAVAILABLE`, `OLLAMA_MODEL_NOT_FOUND`, `OLLAMA_TIMEOUT`, `INVALID_JSON`, `TOOL_CALL_PARSE_ERROR`) | Verified | 6/6 passed (`12/12` Part A adapter & worker bridge tests) |
| Existing regression suites | Verified | `11/11` Backend E2E (`./test-all-e2e.sh`) + `41/41` Playwright E2E |

### Verified Limitations & Unverified Items

- **CPU Inference Latency:** On an Intel Core i7-8850H without GPU acceleration, `qwen2.5:7b` runs at ~2.6 tok/s, so full agent deliverables take ~2.5–3.6 minutes each. Keep `OLLAMA_TIMEOUT_MS=300000` (5 min) and `OLLAMA_MAX_TOKENS=1024` (or pull `qwen2.5:3b` later if faster turnaround is needed).
- **Long-Context (32k) Behavior:** Not yet stress-tested at >4096 tokens on this 16 GB Intel Mac; increasing `OLLAMA_NUM_CTX` will raise RAM above `5.1 GB` and further slow CPU prompt evaluation.
- **Production Vercel Deployment of `/api/worker/*`:** The new `/api/worker/*` bridge routes and `local_workers` table have been verified locally in simulated Vercel mode (`FORCE_LOCAL_WORKER_QUEUE=true`), but have **not yet been pushed/deployed to `https://marketing-os-fullstack.vercel.app`** pending user approval to deploy.

