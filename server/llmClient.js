/**
 * Marketing OS — Unified Real LLM Execution Client (Phase 1)
 *
 * Connects the 3 Core Agents (Research, Sales, Creative) to real configured LLM
 * providers from `admin_llm_configs` with:
 * - Decrypted API key resolution via `cryptoVault`
 * - Timeout budgets via AbortController
 * - Safe exponential-backoff retries on transient 429 / 5xx / timeout errors
 * - Automatic failover to configured fallback provider (`admin_llm_routing`)
 * - Honest data_source reporting (`live_llm` only when a real model responds)
 */

const { decryptSecret } = require('./cryptoVault');

const CLOUD_PROVIDERS = new Set(['openai', 'anthropic', 'gemini']);
const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getProviderRow(db, providerName) {
  if (!providerName) return null;
  const row = db.prepare('SELECT * FROM admin_llm_configs WHERE provider = ?').get(providerName);
  if (!row) return null;
  let apiKey = null;
  if (row.api_key && String(row.api_key).trim().length > 0) {
    try {
      apiKey = decryptSecret(row.api_key);
    } catch (err) {
      console.error(`[llmClient] Failed to decrypt api_key for '${providerName}': ${err.message}`);
      apiKey = null;
    }
  }
  return {
    provider: row.provider,
    provider_type: row.provider_type,
    base_url: (row.base_url || '').replace(/\/+$/, ''),
    api_key: apiKey,
    model: row.default_model,
    temperature: row.temperature !== null ? Number(row.temperature) : 0.4,
    max_tokens: row.max_tokens !== null ? Number(row.max_tokens) : 2048,
    timeout_ms: row.timeout_ms !== null ? Number(row.timeout_ms) : 20000
  };
}

function resolveCandidateProviders(db) {
  const candidates = [];
  const seen = new Set();

  const pushUnique = (cfg) => {
    if (cfg && !seen.has(cfg.provider)) {
      seen.add(cfg.provider);
      candidates.push(cfg);
    }
  };

  try {
    const routing = db.prepare('SELECT primary_provider, fallback_provider FROM admin_llm_routing LIMIT 1').get();
    if (routing?.primary_provider) pushUnique(getProviderRow(db, routing.primary_provider));

    const defaultRow = db.prepare('SELECT provider FROM admin_llm_configs WHERE is_default = 1 LIMIT 1').get();
    if (defaultRow?.provider) pushUnique(getProviderRow(db, defaultRow.provider));

    if (routing?.fallback_provider) pushUnique(getProviderRow(db, routing.fallback_provider));
  } catch (err) {
    console.warn(`[llmClient] Error resolving candidate providers: ${err.message}`);
  }

  return candidates;
}

function extractJsonFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();

  // Direct JSON
  try {
    return JSON.parse(trimmed);
  } catch (_) {}

  // Fenced ```json ... ``` block
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch (_) {}
  }

  // First balanced {...} object
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch (_) {}
  }

  return null;
}

async function callSingleProviderOnce(cfg, { systemPrompt, userPrompt, timeoutMs }) {
  if (CLOUD_PROVIDERS.has(cfg.provider) && !cfg.api_key) {
    return {
      ok: false,
      retryable: false,
      error: `API key not configured for cloud provider '${cfg.provider}'`
    };
  }

  if (!cfg.base_url) {
    return {
      ok: false,
      retryable: false,
      error: `Base URL not configured for provider '${cfg.provider}'`
    };
  }

  const isLocalHost = /\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(cfg.base_url);
  const effectiveTimeout = timeoutMs || (isLocalHost ? Math.min(cfg.timeout_ms || 3000, 3000) : Math.min(cfg.timeout_ms || 20000, 30000));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), effectiveTimeout);

  try {
    let url = '';
    let headers = { 'Content-Type': 'application/json' };
    let body = {};

    if (cfg.provider === 'anthropic') {
      url = `${cfg.base_url}/messages`;
      headers['x-api-key'] = cfg.api_key;
      headers['anthropic-version'] = '2023-06-01';
      body = {
        model: cfg.model || 'claude-3-5-sonnet-20241022',
        max_tokens: cfg.max_tokens || 2048,
        temperature: cfg.temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      };
    } else if (cfg.provider === 'gemini') {
      const modelName = cfg.model || 'gemini-2.5-flash';
      url = `${cfg.base_url}/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(cfg.api_key)}`;
      body = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: cfg.temperature,
          maxOutputTokens: cfg.max_tokens || 2048
        }
      };
    } else if (cfg.provider === 'ollama') {
      url = `${cfg.base_url}/api/chat`;
      body = {
        model: cfg.model || 'llama3.2',
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      };
    } else {
      // OpenAI, LM Studio, vLLM (OpenAI-compatible chat completions)
      url = `${cfg.base_url}/chat/completions`;
      if (cfg.api_key) headers['Authorization'] = `Bearer ${cfg.api_key}`;
      body = {
        model: cfg.model || 'gpt-4o-mini',
        temperature: cfg.temperature,
        max_tokens: cfg.max_tokens || 2048,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      return {
        ok: false,
        status: res.status,
        retryable: RETRYABLE_HTTP_STATUSES.has(res.status),
        error: `${cfg.provider} HTTP ${res.status}: ${errBody.slice(0, 200)}`
      };
    }

    const data = await res.json();
    let content = '';
    if (cfg.provider === 'anthropic') {
      content = data?.content?.[0]?.text || '';
    } else if (cfg.provider === 'gemini') {
      content = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (cfg.provider === 'ollama') {
      content = data?.message?.content || data?.response || '';
    } else {
      content = data?.choices?.[0]?.message?.content || '';
    }

    if (!content || !content.trim()) {
      return {
        ok: false,
        retryable: true,
        error: `${cfg.provider} returned empty response payload`
      };
    }

    return {
      ok: true,
      content: content.trim(),
      parsedJson: extractJsonFromText(content),
      usage: data?.usage || null
    };
  } catch (err) {
    clearTimeout(timer);
    const isAbort = err.name === 'AbortError';
    const errMsg = isAbort ? `Timeout after ${effectiveTimeout}ms` : (err.cause?.code || err.message);
    const isConnRefused = String(errMsg).includes('ECONNREFUSED') || String(err.cause?.code || '').includes('ECONNREFUSED');
    return {
      ok: false,
      retryable: isAbort || !isConnRefused,
      error: `${cfg.provider} error: ${errMsg}`
    };
  }
}

/**
 * Invoke the active LLM provider with retry backoff & fallback provider failover.
 */
async function invokeLLM(db, { systemPrompt, userPrompt, maxRetries = 2, baseBackoffMs = 200, timeoutMs = null }) {
  const startTime = Date.now();
  const candidates = resolveCandidateProviders(db);

  if (candidates.length === 0) {
    return {
      ok: false,
      data_source: 'simulated_fallback',
      attempts: 0,
      latencyMs: Date.now() - startTime,
      error: 'No LLM providers configured in admin_llm_configs'
    };
  }

  let totalAttempts = 0;
  const errors = [];

  for (const cfg of candidates) {
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      totalAttempts++;
      const res = await callSingleProviderOnce(cfg, { systemPrompt, userPrompt, timeoutMs });
      if (res.ok) {
        return {
          ok: true,
          data_source: 'live_llm',
          provider: cfg.provider,
          model: cfg.model,
          content: res.content,
          parsedJson: res.parsedJson,
          usage: res.usage,
          attempts: totalAttempts,
          latencyMs: Date.now() - startTime
        };
      }

      errors.push(`${cfg.provider}[#${attempt}]: ${res.error}`);
      if (!res.retryable || attempt > maxRetries) {
        break;
      }

      await sleep(baseBackoffMs * Math.pow(2, attempt - 1));
    }
  }

  return {
    ok: false,
    data_source: 'simulated_fallback',
    provider: candidates[0]?.provider || 'none',
    model: candidates[0]?.model || 'none',
    attempts: totalAttempts,
    latencyMs: Date.now() - startTime,
    error: errors.join(' | ')
  };
}

module.exports = {
  invokeLLM,
  extractJsonFromText,
  resolveCandidateProviders
};
