#!/usr/bin/env node
/**
 * Marketing OS — Ollama + Qwen2.5 7B + Local Worker Integration Verification Suite
 *
 * Part A (always runs):
 *   - Unified LLM Client Ollama adapter error handling:
 *     connection refused, model not found (live Ollama), timeout, invalid JSON, malformed tool calls
 *   - Vercel-to-Local Worker Bridge E2E against an isolated temp SQLite server:
 *     auth rejection (401), heartbeat -> /api/system/status, 202 local_worker_queued,
 *     atomic single-claim (duplicate prevention), idempotent complete, retryable/fatal fail,
 *     and stale disconnected-worker reaping
 *
 * Part B (runs when --live-model is passed OR qwen2.5:7b is installed in local Ollama):
 *   - Live Ollama /api/tags verification for qwen2.5:7b
 *   - Plain English prompt, Arabic prompt, structured JSON output, streaming tokens, tool-calling probe
 *   - Real execution of Research Agent, Sales Agent, and Creative Director Agent via Unified Framework
 *   - Real Local Worker (`worker/ollama-worker.js --once`) claiming & completing a queued task via Qwen2.5 7B
 */

import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert';
import { spawn } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  PROVIDER_ADAPTERS,
  invokeProvider,
  invokeLLM,
  isLocalEndpoint
} = require('../server/llmClient');
const { pingProvider } = require('../server/llmConfig');

const OLLAMA_URL = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const FORCE_LIVE = process.argv.includes('--live-model');
const SKIP_LIVE = process.argv.includes('--offline-only');

const results = [];
const metrics = {};

async function test(name, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    const ms = Date.now() - t0;
    results.push({ name, passed: true, ms, detail: detail || null });
    console.log(`  ✅ PASS [${ms}ms] ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (err) {
    const ms = Date.now() - t0;
    results.push({ name, passed: false, ms, error: err.message });
    console.error(`  ❌ FAIL [${ms}ms] ${name} — ${err.message}`);
  }
}

function startMockServer(handler) {
  return new Promise((resolve) => {
    const srv = http.createServer(handler);
    srv.listen(0, '127.0.0.1', () => {
      resolve({ server: srv, port: srv.address().port, url: `http://127.0.0.1:${srv.address().port}` });
    });
  });
}

function closeServer(srv) {
  return new Promise((resolve) => srv.close(() => resolve()));
}

function runNodeScript(args, env, timeoutMs = 320000) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: path.resolve('.'),
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (c) => { out += c.toString(); });
    child.stderr.on('data', (c) => { err += c.toString(); });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Child script timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`Exit ${code}: ${(err || out).slice(-500)}`));
      else resolve(out);
    });
  });
}

async function waitForServer(url, maxMs = 15000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${url}/api/health`);
      if (r.ok) return true;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

async function main() {
  console.log('\n======================================================================');
  console.log('Marketing OS — Ollama, Qwen2.5 7B & Local Worker Integration Tests');
  console.log('======================================================================\n');

  // ---------------------------------------------------------------------------
  // PART A: Deterministic Adapter Error Handling & Worker Bridge E2E
  // ---------------------------------------------------------------------------
  console.log('▶ PART A: Unified LLM Adapter Error Handling & Local Worker Bridge');

  await test('Ollama adapter is registered in Unified LLM Client (PROVIDER_ADAPTERS.ollama)', async () => {
    assert.ok(PROVIDER_ADAPTERS.ollama, 'PROVIDER_ADAPTERS.ollama missing');
    assert.strictEqual(isLocalEndpoint('http://127.0.0.1:11434'), true);
    assert.strictEqual(isLocalEndpoint('https://api.openai.com/v1'), false);
    return 'ollama adapter + local endpoint detector verified';
  });

  await test('Error handling: Ollama unavailable (connection refused fails fast without hanging)', async () => {
    const res = await invokeProvider(
      { provider: 'ollama', base_url: 'http://127.0.0.1:19999', model: OLLAMA_MODEL, temperature: 0.2, max_tokens: 64 },
      { userPrompt: 'ping', maxRetries: 1, timeoutMs: 2000 }
    );
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.errorCode, 'OLLAMA_UNAVAILABLE');
    assert.strictEqual(res.attempts, 1, 'Localhost ECONNREFUSED should not retry needlessly');
    return `code=${res.errorCode}, attempts=${res.attempts}, latency=${res.latencyMs}ms`;
  });

  await test('Error handling: Model not found (HTTP 404 against live local Ollama)', async () => {
    const ping = await pingProvider({ provider: 'ollama', baseUrl: OLLAMA_URL, timeoutMs: 3000 });
    assert.strictEqual(ping.ok, true, `Local Ollama must be running at ${OLLAMA_URL}`);
    const res = await invokeProvider(
      { provider: 'ollama', base_url: OLLAMA_URL, model: 'definitely-not-installed-model-999:latest', temperature: 0.2, max_tokens: 32 },
      { userPrompt: 'hello', maxRetries: 1, timeoutMs: 5000 }
    );
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.errorCode, 'OLLAMA_MODEL_NOT_FOUND');
    assert.ok(res.error.includes('ollama pull'), `Expected pull hint, got: ${res.error}`);
    return `code=${res.errorCode}, attempts=${res.attempts}`;
  });

  await test('Error handling: Request timeout (OLLAMA_TIMEOUT)', async () => {
    const mock = await startMockServer((req, res) => {
      setTimeout(() => {
        if (!res.writableEnded) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: { content: 'too late' } }));
        }
      }, 1500);
    });
    try {
      const res = await invokeProvider(
        { provider: 'ollama', base_url: mock.url, model: OLLAMA_MODEL, temperature: 0.2, max_tokens: 64 },
        { userPrompt: 'slow', maxRetries: 0, timeoutMs: 180 }
      );
      assert.strictEqual(res.ok, false);
      assert.strictEqual(res.errorCode, 'OLLAMA_TIMEOUT');
      return `code=${res.errorCode}, latency=${res.latencyMs}ms`;
    } finally {
      await closeServer(mock.server);
    }
  });

  await test('Error handling: Malformed output & strict invalid JSON rejection', async () => {
    const mock = await startMockServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: { content: 'This is not valid JSON at all.' } }));
    });
    try {
      const res = await invokeProvider(
        { provider: 'ollama', base_url: mock.url, model: OLLAMA_MODEL, temperature: 0.2, max_tokens: 64 },
        { userPrompt: 'return json', expectJson: true, strictJson: true, maxRetries: 0, timeoutMs: 3000 }
      );
      assert.strictEqual(res.ok, false);
      assert.strictEqual(res.errorCode, 'INVALID_JSON');
      return `code=${res.errorCode}`;
    } finally {
      await closeServer(mock.server);
    }
  });

  await test('Error handling: Tool-call parse error caught cleanly when strictToolCalls=true', async () => {
    const mock = await startMockServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: {
          content: '',
          tool_calls: [{ function: { name: 'lookup_lead', arguments: '{broken_json' } }]
        }
      }));
    });
    try {
      const res = await invokeProvider(
        { provider: 'ollama', base_url: mock.url, model: OLLAMA_MODEL, temperature: 0.2, max_tokens: 64 },
        { userPrompt: 'use tool', strictToolCalls: true, maxRetries: 0, timeoutMs: 3000 }
      );
      assert.strictEqual(res.ok, false);
      assert.strictEqual(res.errorCode, 'TOOL_CALL_PARSE_ERROR');
      return `code=${res.errorCode}`;
    } finally {
      await closeServer(mock.server);
    }
  });

  // Spin up an isolated temp Marketing OS backend in Local-Worker-Queue mode (simulating Vercel)
  const tmpDb = path.join(os.tmpdir(), `marketing-os-ollama-test-${Date.now()}.db`);
  const testPort = 3457;
  const testBaseUrl = `http://127.0.0.1:${testPort}`;
  const testApiKey = 'test-worker-secret-key-2026-verify';

  const srvProc = spawn(process.execPath, ['server/index.js'], {
    cwd: path.resolve('.'),
    env: {
      ...process.env,
      PORT: String(testPort),
      NODE_ENV: 'development',
      DATABASE_PATH: tmpDb,
      TURSO_DATABASE_URL: '',
      TURSO_AUTH_TOKEN: '',
      LIBSQL_URL: '',
      LIBSQL_AUTH_TOKEN: '',
      OS_API_KEY: testApiKey,
      FORCE_LOCAL_WORKER_QUEUE: 'true',
      OLLAMA_BASE_URL: OLLAMA_URL,
      OLLAMA_MODEL: OLLAMA_MODEL
    },
    stdio: ['ignore', 'ignore', 'pipe']
  });
  let srvStderr = '';
  srvProc.stderr.on('data', (chunk) => { srvStderr += chunk.toString(); });

  try {
    await waitForServer(testBaseUrl);

    // Log in as auto-seeded dev super_admin
    const loginRes = await fetch(`${testBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@marketingos.local', password: 'Admin123!' })
    }).then((r) => r.json());
    assert.ok(loginRes.token, 'Failed to obtain dev super_admin JWT');
    const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${loginRes.token}` };
    const workerHeaders = { 'Content-Type': 'application/json', 'X-OS-API-Key': testApiKey };

    await test('Worker security: Unauthenticated / bad X-OS-API-Key rejected with HTTP 401', async () => {
      const r1 = await fetch(`${testBaseUrl}/api/worker/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.strictEqual(r1.status, 401);
      const r2 = await fetch(`${testBaseUrl}/api/worker/heartbeat`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-OS-API-Key': 'wrong-key' }, body: '{}' });
      assert.strictEqual(r2.status, 401);
      return '401 enforced on missing & wrong X-OS-API-Key';
    });

    await test('Worker heartbeat updates /api/system/status honestly', async () => {
      const hb = await fetch(`${testBaseUrl}/api/worker/heartbeat`, {
        method: 'POST',
        headers: workerHeaders,
        body: JSON.stringify({
          worker_id: 'test-mac-worker',
          hostname: os.hostname(),
          provider: 'ollama',
          model: OLLAMA_MODEL,
          ollama_status: 'connected',
          models: [OLLAMA_MODEL]
        })
      }).then((r) => r.json());
      assert.strictEqual(hb.ok, true);

      const sys = await fetch(`${testBaseUrl}/api/system/status`, { headers: authHeaders }).then((r) => r.json());
      assert.strictEqual(sys.local_worker.online, true);
      assert.strictEqual(sys.local_worker.model, OLLAMA_MODEL);
      assert.strictEqual(sys.llm.connected, true);
      assert.strictEqual(sys.llm.via_local_worker, true);
      return `worker_online=true, via_local_worker=true`;
    });

    // Create isolated project + task for worker queue tests
    const proj = await fetch(`${testBaseUrl}/api/projects`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Ollama Bridge Test Project', client_name: 'Atlas Clinics', goal: 'Validate worker bridge' })
    }).then((r) => r.json());
    assert.ok(proj.id, 'Project creation failed');

    const task1 = await fetch(`${testBaseUrl}/api/projects/${proj.id}/tasks`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ title: 'Worker Idempotency Test Task', pipeline: 'market-intel', description: 'Verify atomic claim & idempotent complete' })
    }).then((r) => r.json());

    let claimedRunId = null;
    let claimedClaimId = null;

    await test('Vercel-mode task run queues cleanly (HTTP 202) and atomic claim prevents duplicates', async () => {
      const runRes = await fetch(`${testBaseUrl}/api/tasks/${task1.id}/run`, { method: 'POST', headers: authHeaders });
      assert.strictEqual(runRes.status, 202);
      const runBody = await runRes.json();
      assert.strictEqual(runBody.mode, 'local_worker_queued');
      assert.strictEqual(runBody.status, 'queued');

      const [c1, c2] = await Promise.all([
        fetch(`${testBaseUrl}/api/worker/claim`, { method: 'POST', headers: workerHeaders, body: JSON.stringify({ worker_id: 'worker-a' }) }).then((r) => r.json()),
        fetch(`${testBaseUrl}/api/worker/claim`, { method: 'POST', headers: workerHeaders, body: JSON.stringify({ worker_id: 'worker-b' }) }).then((r) => r.json())
      ]);
      const claimedCount = [c1, c2].filter((c) => c.claimed).length;
      assert.strictEqual(claimedCount, 1, `Expected exactly 1 atomic claim, got ${claimedCount}`);
      const winner = c1.claimed ? c1 : c2;
      claimedRunId = winner.run_id;
      claimedClaimId = winner.claim_id;
      assert.strictEqual(winner.task.id, task1.id);
      return `202 queued -> exactly 1 of 2 concurrent workers claimed task`;
    });

    await test('Worker complete is idempotent (duplicate delivery creates zero duplicate records)', async () => {
      const payload = {
        task_id: task1.id,
        claim_id: claimedClaimId,
        run_id: claimedRunId,
        worker_id: 'worker-a',
        provider: 'ollama',
        model: OLLAMA_MODEL,
        duration_ms: 1234,
        attempts: 1,
        output_json: { title: 'Verified Output', summary: 'Worker completed cleanly.', deliverable: { points: ['A'] } },
        report_md: '### Report\nCompleted.\n\n**Verdict:** Ready to Deliver\n',
        sop_slug: 'market_intel',
        agent: { id: 'agent-01', name: 'Research Agent', department: 'research' }
      };
      const first = await fetch(`${testBaseUrl}/api/worker/complete`, { method: 'POST', headers: workerHeaders, body: JSON.stringify(payload) }).then((r) => r.json());
      assert.strictEqual(first.ok, true);
      assert.strictEqual(first.duplicate, false);

      const second = await fetch(`${testBaseUrl}/api/worker/complete`, { method: 'POST', headers: workerHeaders, body: JSON.stringify(payload) }).then((r) => r.json());
      assert.strictEqual(second.ok, true);
      assert.strictEqual(second.duplicate, true);
      return 'first=recorded, duplicate=ignored safely';
    });

    await test('Worker failure handling: retryable re-queues then fatal transitions to needs_attention (never success)', async () => {
      const t2 = await fetch(`${testBaseUrl}/api/projects/${proj.id}/tasks`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ title: 'Worker Failure Test', pipeline: 'content-seo' })
      }).then((r) => r.json());

      await fetch(`${testBaseUrl}/api/tasks/${t2.id}/run`, { method: 'POST', headers: authHeaders });
      const claim1 = await fetch(`${testBaseUrl}/api/worker/claim`, { method: 'POST', headers: workerHeaders, body: JSON.stringify({ worker_id: 'worker-a' }) }).then((r) => r.json());
      assert.strictEqual(claim1.claimed, true);

      const fail1 = await fetch(`${testBaseUrl}/api/worker/fail`, {
        method: 'POST',
        headers: workerHeaders,
        body: JSON.stringify({ task_id: t2.id, run_id: claim1.run_id, error_code: 'OLLAMA_TIMEOUT', error_message: 'Simulated timeout', retryable: true })
      }).then((r) => r.json());
      assert.strictEqual(fail1.requeued, true);
      assert.strictEqual(fail1.status, 'queued');

      const claim2 = await fetch(`${testBaseUrl}/api/worker/claim`, { method: 'POST', headers: workerHeaders, body: JSON.stringify({ worker_id: 'worker-a' }) }).then((r) => r.json());
      assert.strictEqual(claim2.claimed, true);

      const fail2 = await fetch(`${testBaseUrl}/api/worker/fail`, {
        method: 'POST',
        headers: workerHeaders,
        body: JSON.stringify({ task_id: t2.id, run_id: claim2.run_id, error_code: 'OLLAMA_MODEL_NOT_FOUND', error_message: 'Model missing', retryable: false })
      }).then((r) => r.json());
      assert.strictEqual(fail2.requeued, false);
      assert.strictEqual(fail2.status, 'needs_attention');
      return 'retryable -> queued -> fatal -> needs_attention';
    });

    await test('Worker disconnection recovery: stale running task reaped to needs_attention', async () => {
      const t3 = await fetch(`${testBaseUrl}/api/projects/${proj.id}/tasks`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ title: 'Disconnected Worker Stale Task', pipeline: 'market-intel' })
      }).then((r) => r.json());
      await fetch(`${testBaseUrl}/api/tasks/${t3.id}/run`, { method: 'POST', headers: authHeaders });
      const c = await fetch(`${testBaseUrl}/api/worker/claim`, { method: 'POST', headers: workerHeaders, body: JSON.stringify({ worker_id: 'crashed-worker' }) }).then((r) => r.json());
      assert.strictEqual(c.claimed, true);

      await new Promise((r) => setTimeout(r, 40));
      await fetch(`${testBaseUrl}/api/worker/claim`, {
        method: 'POST',
        headers: workerHeaders,
        body: JSON.stringify({ worker_id: 'healthy-worker', stale_timeout_ms: 10 })
      });
      const fetched = await fetch(`${testBaseUrl}/api/tasks/${t3.id}`, { headers: authHeaders }).then((r) => r.json());
      assert.strictEqual(fetched.task.status, 'needs_attention');
      return 'abandoned running task cleanly marked needs_attention';
    });

    // ---------------------------------------------------------------------------
    // PART B: Live Qwen2.5 7B Model, 3 Agents & Local Worker Real E2E
    // ---------------------------------------------------------------------------
    const livePing = await pingProvider({ provider: 'ollama', baseUrl: OLLAMA_URL, timeoutMs: 4000 });
    const installedModels = livePing.detected_models || [];
    const hasQwen = installedModels.some((m) => String(m).toLowerCase().startsWith(OLLAMA_MODEL.toLowerCase()));

    if (SKIP_LIVE) {
      console.log('\n⏭️  Skipping Part B (--offline-only specified).');
    } else if (!hasQwen && !FORCE_LIVE) {
      console.log(`\n⏭️  Skipping Part B: '${OLLAMA_MODEL}' not yet installed (found: ${installedModels.join(', ') || 'none'}). Re-run after 'ollama pull ${OLLAMA_MODEL}'.`);
    } else {
      console.log(`\n▶ PART B: Live Qwen2.5 7B Inference, All 3 Agents & Local Worker Real E2E`);

      const ollamaCfg = {
        provider: 'ollama',
        base_url: OLLAMA_URL,
        model: OLLAMA_MODEL,
        temperature: 0.3,
        max_tokens: 512,
        timeout_ms: 300000
      };

      await test(`Live Ollama /api/tags confirms ${OLLAMA_MODEL} installed`, async () => {
        assert.strictEqual(livePing.ok, true);
        assert.strictEqual(hasQwen, true, `${OLLAMA_MODEL} not in [${installedModels.join(', ')}]`);
        return `models=[${installedModels.join(', ')}]`;
      });

      await test('Live English chat inference via Unified LLM Client', async () => {
        const res = await invokeProvider(ollamaCfg, {
          systemPrompt: 'You are a concise B2B marketing strategist. Reply in 2 sentences max.',
          userPrompt: 'Explain what an Ideal Customer Profile (ICP) is for a dental SaaS company.',
          maxTokens: 120,
          maxRetries: 0
        });
        assert.strictEqual(res.ok, true, res.error);
        assert.strictEqual(res.data_source, 'live_llm');
        assert.ok(res.content.length > 20);
        metrics.english_ms = res.latencyMs;
        metrics.english_tps = res.usage?.tokens_per_second || null;
        return `latency=${res.latencyMs}ms, tps=${res.usage?.tokens_per_second ?? 'n/a'}, chars=${res.content.length}`;
      });

      await test('Live Arabic inference via Unified LLM Client', async () => {
        const res = await invokeProvider(ollamaCfg, {
          systemPrompt: 'أنت خبير تسويق رقمي. أجب بجملتين واضحتين باللغة العربية الفصحى فقط.',
          userPrompt: 'ما هي أهم فائدة لتحديد الجمهور المستهدف قبل إطلاق حملة إعلانية؟',
          maxTokens: 150,
          maxRetries: 0
        });
        assert.strictEqual(res.ok, true, res.error);
        const arabicCharCount = (res.content.match(/[\u0600-\u06FF]/g) || []).length;
        assert.ok(arabicCharCount >= 10, `Expected Arabic script output (>=10 chars), got ${arabicCharCount}: ${res.content.slice(0, 80)}`);
        metrics.arabic_ms = res.latencyMs;
        metrics.arabic_tps = res.usage?.tokens_per_second || null;
        return `latency=${res.latencyMs}ms, tps=${res.usage?.tokens_per_second ?? 'n/a'}, preview="${res.content.slice(0, 60)}..."`;
      });

      await test('Live structured JSON output (format: json, strictJson: true)', async () => {
        const res = await invokeProvider(ollamaCfg, {
          systemPrompt: 'Return ONLY a JSON object with keys: channel (string), primary_kpi (string), steps (array of 2 short strings).',
          userPrompt: 'Recommend one B2B outbound marketing channel for a software agency.',
          expectJson: true,
          strictJson: true,
          maxTokens: 180,
          maxRetries: 0
        });
        assert.strictEqual(res.ok, true, res.error);
        assert.ok(res.parsedJson && typeof res.parsedJson === 'object');
        assert.ok(typeof res.parsedJson.channel === 'string');
        assert.ok(Array.isArray(res.parsedJson.steps));
        metrics.json_ms = res.latencyMs;
        return `latency=${res.latencyMs}ms, keys=[${Object.keys(res.parsedJson).join(',')}]`;
      });

      await test('Live NDJSON streaming (stream: true + onToken callback)', async () => {
        let chunks = 0;
        const res = await invokeProvider(ollamaCfg, {
          userPrompt: 'List 3 B2B marketing metrics in one short line.',
          stream: true,
          onToken: () => { chunks++; },
          maxTokens: 80,
          maxRetries: 0
        });
        assert.strictEqual(res.ok, true, res.error);
        assert.ok(chunks >= 3, `Expected streaming chunks >= 3, got ${chunks}`);
        return `chunks=${chunks}, latency=${res.latencyMs}ms`;
      });

      await test('Live tool-calling compatibility probe on Qwen2.5 7B', async () => {
        const res = await invokeProvider(ollamaCfg, {
          userPrompt: 'Check the current status of campaign ID cmp-402 using the get_campaign_status tool.',
          tools: [
            {
              type: 'function',
              function: {
                name: 'get_campaign_status',
                description: 'Fetch status for a marketing campaign by ID',
                parameters: {
                  type: 'object',
                  properties: { campaign_id: { type: 'string' } },
                  required: ['campaign_id']
                }
              }
            }
          ],
          maxTokens: 150,
          maxRetries: 0
        });
        assert.strictEqual(res.ok, true, res.error);
        const called = res.toolCalls.some((tc) => tc.name === 'get_campaign_status');
        metrics.tool_calling_supported = called;
        metrics.tool_call_sample = res.toolCalls;
        return `tool_calls_emitted=${res.toolCalls.length}, matched_tool=${called}, latency=${res.latencyMs}ms`;
      });

      // Test all 3 real Marketing OS Agents + Local Worker E2E!
      const { executeAgentTask } = require('../server/agentFramework');
      const liveOverride = [{ ...ollamaCfg, provider_type: 'local', max_tokens: 450 }];

      const sampleProject = {
        id: proj.id,
        name: 'Nova Dental Launch',
        client_name: 'Nova Dental Group',
        goal: 'Generate qualified B2B clinic demo bookings in Q2',
        guidelines: 'Plain, honest, human B2B copy. Never fabricate stats or emails.'
      };

      for (const [label, dept, pipeline, title] of [
        ['Research Agent', 'research', 'market-intel', 'Q2 Dental SaaS Market Audit'],
        ['Sales Agent', 'sales', 'email-campaign', 'Clinic Director 2-Step Outreach Draft'],
        ['Creative Director Agent', 'creative', 'landing-page', 'Nova Dental Hero & Value Prop Section']
      ]) {
        await test(`Real ${label} execution via Unified Framework + Qwen2.5 7B`, async () => {
          const out = await executeAgentTask(
            { id: `live-${dept}-${Date.now()}`, project_id: proj.id, department: dept, pipeline, title, description: `Produce a concise, honest ${label} deliverable for Nova Dental Group.` },
            sampleProject,
            [],
            { skipDbPersistence: true, overrideCandidates: liveOverride, timeoutMs: 300000, maxRetries: 0 }
          );
          assert.strictEqual(out.dataSource, 'live_llm');
          assert.strictEqual(out.isSimulated, false);
          assert.strictEqual(out.provider, 'ollama');
          assert.strictEqual(out.model, OLLAMA_MODEL);
          assert.ok(out.durationMs > 0);
          assert.ok(out.outputJson.metadata.provider === 'ollama');
          assert.ok(out.outputJson.metadata.model === OLLAMA_MODEL);
          assert.ok(typeof out.outputJson.quality_audit?.humanizer_score === 'number');
          metrics[`agent_${dept}_ms`] = out.durationMs;
          return `provider=${out.provider}, model=${out.model}, duration=${out.durationMs}ms, humanizer=${out.outputJson.quality_audit.humanizer_score}/100`;
        });
      }

      await test('Real Local Worker (worker/ollama-worker.js --once) claims & executes queued task via Qwen2.5 7B', async () => {
        const tWorker = await fetch(`${testBaseUrl}/api/projects/${proj.id}/tasks`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            title: 'Live Worker Qwen Verification',
            pipeline: 'market-intel',
            description: 'Summarize 2 key positioning angles for Nova Dental Group in concise JSON.'
          })
        }).then((r) => r.json());

        const runRes = await fetch(`${testBaseUrl}/api/tasks/${tWorker.id}/run`, { method: 'POST', headers: authHeaders });
        assert.strictEqual(runRes.status, 202);

        const workerOut = await runNodeScript(['worker/ollama-worker.js', '--once'], {
          ...process.env,
          MARKETING_OS_URL: testBaseUrl,
          OS_API_KEY: testApiKey,
          OLLAMA_BASE_URL: OLLAMA_URL,
          OLLAMA_MODEL: OLLAMA_MODEL,
          OLLAMA_TIMEOUT_MS: '300000',
          OLLAMA_MAX_TOKENS: '350'
        }, 320000);
        assert.ok(workerOut.includes('Task completed and recorded on backend'), `Worker output unexpected: ${workerOut.slice(-400)}`);

        const completed = await fetch(`${testBaseUrl}/api/tasks/${tWorker.id}`, { headers: authHeaders }).then((r) => r.json());
        assert.strictEqual(completed.task.status, 'in_review');
        const outJson = JSON.parse(completed.task.output_json || '{}');
        assert.strictEqual(outJson.data_source, 'live_llm');
        assert.strictEqual(outJson.metadata.provider, 'ollama');
        assert.strictEqual(outJson.metadata.model, OLLAMA_MODEL);
        assert.ok(outJson.metadata.duration_ms > 0);

        const runs = await fetch(`${testBaseUrl}/api/agent-runs?task_id=${tWorker.id}`, { headers: authHeaders }).then((r) => r.json());
        assert.ok(runs.runs.length >= 1 && runs.runs[0].status === 'succeeded');
        metrics.worker_e2e_ms = outJson.metadata.duration_ms;
        return `task_status=in_review, run_status=succeeded, model=${outJson.metadata.model}, duration=${outJson.metadata.duration_ms}ms`;
      });
    }
  } finally {
    srvProc.kill('SIGTERM');
    try { fs.unlinkSync(tmpDb); } catch (_) {}
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log('\n======================================================================');
  console.log(`SUMMARY: ${passed} PASSED / ${failed} FAILED`);
  if (Object.keys(metrics).length > 0) {
    console.log('MEASURED METRICS:', JSON.stringify(metrics, null, 2));
  }
  console.log('======================================================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
