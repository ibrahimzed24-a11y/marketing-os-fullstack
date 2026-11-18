#!/usr/bin/env node
/**
 * Marketing OS — Local Ollama Worker (MacBook Execution Bridge)
 *
 * Bridges a cloud/Vercel Marketing OS deployment (or local server) with a
 * private local Ollama instance running at http://127.0.0.1:11434 without
 * exposing Ollama's local API to the public internet.
 *
 * Architecture:
 *   1. Verifies local Ollama health & model presence (never claims tasks if Ollama is down).
 *   2. Sends periodic authenticated heartbeats to POST /api/worker/heartbeat.
 *   3. Polls POST /api/worker/claim using X-OS-API-Key.
 *   4. Executes claimed tasks through the EXISTING Marketing OS Unified Agent
 *      Framework (`server/agentFramework.js`) + Unified LLM Client (`server/llmClient.js`).
 *   5. Submits normalized results idempotently via POST /api/worker/complete
 *      (or structured failure via POST /api/worker/fail).
 *
 * Usage:
 *   npm run worker
 *   MARKETING_OS_URL=https://marketing-os-fullstack.vercel.app npm run worker
 *   node worker/ollama-worker.js --check
 *   node worker/ollama-worker.js --once
 */

require('dotenv').config();
const os = require('os');
const { executeAgentTask } = require('../server/agentFramework');
const { pingProvider } = require('../server/llmConfig');
const { sanitizeErrorMessage } = require('../server/llmClient');

const CONFIG = {
  backendUrl: (process.env.MARKETING_OS_URL || `http://127.0.0.1:${process.env.PORT || 3001}`).trim().replace(/\/+$/, ''),
  apiKey: (process.env.OS_API_KEY || '').trim(),
  ollamaBaseUrl: (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').trim().replace(/\/+$/, ''),
  ollamaModel: (process.env.OLLAMA_MODEL || 'qwen2.5:7b').trim(),
  ollamaTimeoutMs: Math.max(parseInt(process.env.OLLAMA_TIMEOUT_MS || '300000', 10) || 300000, 10000),
  ollamaMaxTokens: Math.max(parseInt(process.env.OLLAMA_MAX_TOKENS || '1024', 10) || 1024, 128),
  pollMs: Math.max(parseInt(process.env.WORKER_POLL_MS || '3000', 10) || 3000, 500),
  heartbeatMs: Math.max(parseInt(process.env.WORKER_HEARTBEAT_MS || '20000', 10) || 20000, 3000),
  workerId: (process.env.WORKER_ID || `mac-ollama-${os.hostname()}`).trim().slice(0, 120),
  hostname: os.hostname()
};

const ARGS = new Set(process.argv.slice(2));
const RUN_ONCE = ARGS.has('--once');
const CHECK_ONLY = ARGS.has('--check');

let shuttingDown = false;
let consecutiveBackendErrors = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(level, msg, meta = null) {
  const ts = new Date().toISOString();
  const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
  const line = `[${ts}] [ollama-worker] [${level}] ${msg}${suffix}`;
  if (level === 'ERROR') console.error(line);
  else console.log(line);
}

async function checkLocalOllama() {
  const ping = await pingProvider({
    provider: 'ollama',
    baseUrl: CONFIG.ollamaBaseUrl,
    timeoutMs: 5000
  });
  if (!ping.ok) {
    return {
      ok: false,
      status: 'offline',
      models: [],
      modelInstalled: false,
      error: ping.error || 'Ollama unreachable'
    };
  }
  const models = Array.isArray(ping.detected_models) ? ping.detected_models : [];
  const targetLower = CONFIG.ollamaModel.toLowerCase();
  const modelInstalled = models.some((m) => {
    const ml = String(m).toLowerCase();
    return ml === targetLower || ml === `${targetLower}:latest` || ml.split(':')[0] === targetLower;
  });
  return {
    ok: true,
    status: 'connected',
    latency_ms: ping.latency_ms,
    models,
    modelInstalled,
    error: modelInstalled ? null : `Model '${CONFIG.ollamaModel}' not found in local Ollama (installed: ${models.join(', ') || 'none'})`
  };
}

async function callBackend(endpoint, payload, { timeoutMs = 15000, retries = 1 } = {}) {
  const url = `${CONFIG.backendUrl}${endpoint}`;
  let lastErr = null;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OS-API-Key': CONFIG.apiKey
        },
        body: JSON.stringify(payload || {}),
        signal: controller.signal
      });
      clearTimeout(timer);

      let data = null;
      try {
        data = await res.json();
      } catch (_) {
        data = { ok: false, error: `Non-JSON response (HTTP ${res.status})` };
      }

      if (res.status === 401 || res.status === 403) {
        const err = new Error(data?.error || `Backend rejected worker credentials (HTTP ${res.status})`);
        err.fatalAuth = true;
        err.status = res.status;
        throw err;
      }

      if (!res.ok) {
        lastErr = new Error(data?.error || `Backend HTTP ${res.status}`);
        lastErr.status = res.status;
        if (res.status < 500 || attempt > retries) throw lastErr;
      } else {
        consecutiveBackendErrors = 0;
        return data;
      }
    } catch (err) {
      clearTimeout(timer);
      if (err.fatalAuth) throw err;
      lastErr = err;
      if (attempt > retries) throw err;
      await sleep(500 * attempt);
    }
  }
  throw lastErr || new Error('Unknown backend request error');
}

async function sendHeartbeat(ollamaHealth) {
  return callBackend('/api/worker/heartbeat', {
    worker_id: CONFIG.workerId,
    hostname: CONFIG.hostname,
    provider: 'ollama',
    model: CONFIG.ollamaModel,
    ollama_status: ollamaHealth.ok && ollamaHealth.modelInstalled ? 'connected' : 'offline',
    models: ollamaHealth.models || []
  }, { timeoutMs: 10000, retries: 1 });
}

async function processClaimedJob(claim) {
  const { task, project, harness, remote_context, claim_id, run_id, active_llm_config } = claim;
  const targetModel = CONFIG.ollamaModel || active_llm_config?.default_model || 'qwen2.5:7b';
  const startTime = Date.now();

  log('INFO', 'Claimed task for local Ollama execution', {
    task_id: task.id,
    title: task.title,
    pipeline: task.pipeline,
    model: targetModel,
    run_id
  });

  const overrideCandidates = [
    {
      provider: 'ollama',
      provider_type: 'local',
      base_url: CONFIG.ollamaBaseUrl,
      api_key: null,
      model: targetModel,
      temperature: active_llm_config?.temperature !== undefined ? Number(active_llm_config.temperature) : 0.4,
      max_tokens: Math.min(Number(active_llm_config?.max_tokens || CONFIG.ollamaMaxTokens), CONFIG.ollamaMaxTokens),
      timeout_ms: CONFIG.ollamaTimeoutMs,
      extra_headers: {}
    }
  ];

  try {
    const execResult = await executeAgentTask(task, project, harness || [], {
      skipDbPersistence: true,
      runId: run_id,
      remoteContext: remote_context || {},
      overrideCandidates,
      timeoutMs: CONFIG.ollamaTimeoutMs,
      maxRetries: 1,
      baseBackoffMs: 500
    });

    const durationMs = execResult.durationMs || (Date.now() - startTime);

    // Report normalized result idempotently (retries on transient network hiccup with same run_id)
    const completeRes = await callBackend('/api/worker/complete', {
      task_id: task.id,
      claim_id,
      run_id: execResult.runId || run_id,
      worker_id: CONFIG.workerId,
      provider: execResult.provider || 'ollama',
      model: execResult.model || targetModel,
      duration_ms: durationMs,
      attempts: execResult.attempts || 1,
      usage: execResult.usage || null,
      output_json: execResult.outputJson,
      report_md: execResult.reportMd,
      requires_approval: Boolean(execResult.requiresApproval),
      sop_slug: execResult.sopSlug || task.pipeline || 'general',
      agent: {
        id: execResult.agent?.id || 'agent-worker',
        name: execResult.agent?.name || 'Local Ollama Agent',
        department: execResult.agent?.department || 'creative'
      }
    }, { timeoutMs: 20000, retries: 2 });

    log('INFO', 'Task completed and recorded on backend', {
      task_id: task.id,
      run_id,
      model: execResult.model || targetModel,
      duration_ms: durationMs,
      duplicate: Boolean(completeRes.duplicate),
      status: completeRes.status
    });
    return { ok: true, task_id: task.id, run_id, duration_ms: durationMs };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const safeMsg = sanitizeErrorMessage(err.message);
    const errCode = err.code || 'WORKER_EXECUTION_FAILED';
    const retryable = errCode === 'OLLAMA_TIMEOUT';

    log('ERROR', 'Task execution failed on local Ollama', {
      task_id: task.id,
      run_id,
      error_code: errCode,
      error: safeMsg,
      duration_ms: durationMs
    });

    try {
      await callBackend('/api/worker/fail', {
        task_id: task.id,
        claim_id,
        run_id,
        worker_id: CONFIG.workerId,
        provider: 'ollama',
        model: targetModel,
        duration_ms: durationMs,
        attempts: 1,
        error_code: errCode,
        error_message: safeMsg,
        retryable
      }, { timeoutMs: 15000, retries: 2 });
    } catch (reportErr) {
      log('ERROR', 'Failed reporting task failure to backend', {
        task_id: task.id,
        error: sanitizeErrorMessage(reportErr.message)
      });
    }
    return { ok: false, task_id: task.id, run_id, error: safeMsg };
  }
}

async function runSingleCycle() {
  const ollamaHealth = await checkLocalOllama();
  if (!ollamaHealth.ok || !ollamaHealth.modelInstalled) {
    log('WARN', 'Local Ollama not ready — skipping task claim', { error: ollamaHealth.error });
    try {
      await sendHeartbeat(ollamaHealth);
    } catch (_) {}
    return { ok: false, reason: 'ollama_not_ready', error: ollamaHealth.error };
  }

  const claim = await callBackend('/api/worker/claim', {
    worker_id: CONFIG.workerId
  }, { timeoutMs: 15000, retries: 1 });

  if (!claim.claimed || !claim.task) {
    return { ok: true, claimed: false };
  }

  const result = await processClaimedJob(claim);
  return { ok: result.ok, claimed: true, result };
}

async function main() {
  if (!CONFIG.apiKey) {
    log('ERROR', 'OS_API_KEY is required in environment or .env before starting the Local Ollama Worker.');
    process.exit(1);
  }

  log('INFO', 'Starting Marketing OS Local Ollama Worker', {
    worker_id: CONFIG.workerId,
    backend_url: CONFIG.backendUrl,
    ollama_url: CONFIG.ollamaBaseUrl,
    model: CONFIG.ollamaModel,
    timeout_ms: CONFIG.ollamaTimeoutMs,
    mode: CHECK_ONLY ? 'check' : (RUN_ONCE ? 'once' : 'daemon')
  });

  const initialHealth = await checkLocalOllama();
  if (!initialHealth.ok) {
    log('ERROR', 'Local Ollama check failed', { error: initialHealth.error });
    if (CHECK_ONLY || RUN_ONCE) process.exit(1);
  } else if (!initialHealth.modelInstalled) {
    log('WARN', 'Ollama is running, but configured model is missing', {
      expected: CONFIG.ollamaModel,
      installed: initialHealth.models
    });
    if (CHECK_ONLY || RUN_ONCE) process.exit(1);
  } else {
    log('INFO', 'Local Ollama verified healthy', {
      latency_ms: initialHealth.latency_ms,
      models: initialHealth.models
    });
  }

  try {
    const hb = await sendHeartbeat(initialHealth);
    log('INFO', 'Backend heartbeat acknowledged', {
      pending_queued_tasks: hb.pending_queued_tasks,
      server_time: hb.server_time
    });
  } catch (err) {
    log('ERROR', 'Initial backend heartbeat failed', { error: sanitizeErrorMessage(err.message) });
    if (err.fatalAuth || CHECK_ONLY || RUN_ONCE) process.exit(1);
  }

  if (CHECK_ONLY) {
    log('INFO', 'Worker connectivity check passed.');
    process.exit(0);
  }

  if (RUN_ONCE) {
    try {
      const cycle = await runSingleCycle();
      log('INFO', 'Single cycle finished', { claimed: Boolean(cycle.claimed), ok: Boolean(cycle.ok) });
      process.exit(cycle.ok ? 0 : 1);
    } catch (err) {
      log('ERROR', 'Single cycle error', { error: sanitizeErrorMessage(err.message) });
      process.exit(1);
    }
  }

  // Graceful shutdown handlers
  const handleShutdown = (sig) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log('INFO', `Received ${sig}. Stopping Local Ollama Worker cleanly...`);
  };
  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  let lastHeartbeatAt = Date.now();

  while (!shuttingDown) {
    try {
      if (Date.now() - lastHeartbeatAt >= CONFIG.heartbeatMs) {
        const health = await checkLocalOllama();
        await sendHeartbeat(health);
        lastHeartbeatAt = Date.now();
      }

      const cycle = await runSingleCycle();
      const delayMs = cycle.claimed ? 500 : CONFIG.pollMs;
      await sleep(delayMs);
    } catch (err) {
      if (err.fatalAuth) {
        log('ERROR', 'Fatal authentication error — stopping worker', { error: sanitizeErrorMessage(err.message) });
        process.exit(1);
      }
      consecutiveBackendErrors++;
      const backoffMs = Math.min(CONFIG.pollMs * Math.pow(2, Math.min(consecutiveBackendErrors, 4)), 30000);
      log('WARN', 'Backend communication error — backing off before retry', {
        attempt: consecutiveBackendErrors,
        backoff_ms: backoffMs,
        error: sanitizeErrorMessage(err.message)
      });
      await sleep(backoffMs);
    }
  }

  log('INFO', 'Local Ollama Worker exited cleanly.');
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    log('ERROR', 'Unhandled worker crash', { error: sanitizeErrorMessage(err.message) });
    process.exit(1);
  });
}

module.exports = { checkLocalOllama, runSingleCycle, CONFIG };
