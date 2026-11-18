/**
 * Marketing OS — Unified Real LLM Execution Client & Provider Adapters
 *
 * Connects the 3 Core Agents (Research, Sales, Creative) and Local Worker to
 * real configured LLM providers from `admin_llm_configs` (and optional env overrides):
 *   - Local Engines: Ollama (official /api/chat & /api/generate), LM Studio, vLLM
 *   - Cloud APIs: OpenAI, Anthropic, Gemini
 *
 * Capabilities:
 *   - Provider adapter registry (`PROVIDER_ADAPTERS`)
 *   - Decrypted API key resolution via `cryptoVault`
 *   - Chat, plain generation, structured JSON (`format: 'json'`), tool calling, and NDJSON streaming
 *   - Normalized responses & token usage telemetry
 *   - Classified error codes (unavailable, model_not_found, timeout, malformed_output, invalid_json)
 *   - Safe bounded exponential-backoff retries & fallback provider failover
 *   - Zero secret leakage in error messages or logs
 */

const { decryptSecret } = require('./cryptoVault');

const CLOUD_PROVIDERS = new Set(['openai', 'anthropic', 'gemini']);
const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

const DEFAULT_OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').trim().replace(/\/+$/, '');
const DEFAULT_OLLAMA_MODEL = (process.env.OLLAMA_MODEL || 'qwen2.5:7b').trim();
const DEFAULT_OLLAMA_TIMEOUT_MS = Math.max(parseInt(process.env.OLLAMA_TIMEOUT_MS || '300000', 10) || 300000, 5000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLocalEndpoint(url) {
  if (!url || typeof url !== 'string') return false;
  return /\/\/(127\.0\.0\.1|localhost|\[::1\]|0\.0\.0\.0)(:|\/|$)/i.test(url.trim());
}

/**
 * Strip API keys, bearer tokens, or query key params from diagnostic messages.
 */
function sanitizeErrorMessage(msg) {
  if (!msg) return 'Unknown LLM error';
  return String(msg)
    .replace(/([?&]key=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED]')
    .replace(/(sk-[A-Za-z0-9_-]{6})[A-Za-z0-9_-]+/g, '$1[REDACTED]')
    .slice(0, 400);
}

function getProviderRow(db, providerName) {
  if (!providerName || !db) return null;
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

  let extraHeaders = {};
  if (row.extra_headers) {
    try {
      extraHeaders = typeof row.extra_headers === 'string' ? JSON.parse(row.extra_headers) : row.extra_headers;
    } catch (_) {
      extraHeaders = {};
    }
  }

  const baseUrl = (row.base_url || (row.provider === 'ollama' ? DEFAULT_OLLAMA_BASE_URL : '')).replace(/\/+$/, '');
  const defaultTimeout = row.provider === 'ollama' ? DEFAULT_OLLAMA_TIMEOUT_MS : 30000;

  return {
    provider: row.provider,
    provider_type: row.provider_type,
    base_url: baseUrl,
    api_key: apiKey,
    model: row.default_model || (row.provider === 'ollama' ? DEFAULT_OLLAMA_MODEL : ''),
    temperature: row.temperature !== null && row.temperature !== undefined ? Number(row.temperature) : 0.4,
    max_tokens: row.max_tokens !== null && row.max_tokens !== undefined ? Number(row.max_tokens) : 2048,
    timeout_ms: row.timeout_ms !== null && row.timeout_ms !== undefined ? Number(row.timeout_ms) : defaultTimeout,
    extra_headers: extraHeaders
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

  // Optional environment override (e.g. LLM_PROVIDER=ollama in Local Worker or CLI scripts)
  const envProvider = (process.env.LLM_PROVIDER || '').trim().toLowerCase();
  if (envProvider && db) {
    const envRow = getProviderRow(db, envProvider);
    if (envRow) {
      if (envProvider === 'ollama') {
        if (process.env.OLLAMA_BASE_URL) envRow.base_url = DEFAULT_OLLAMA_BASE_URL;
        if (process.env.OLLAMA_MODEL) envRow.model = DEFAULT_OLLAMA_MODEL;
        if (process.env.OLLAMA_TIMEOUT_MS) envRow.timeout_ms = DEFAULT_OLLAMA_TIMEOUT_MS;
      }
      pushUnique(envRow);
    }
  }

  try {
    if (db) {
      const routing = db.prepare('SELECT primary_provider, fallback_provider, auto_fallback FROM admin_llm_routing LIMIT 1').get();
      if (routing?.primary_provider) pushUnique(getProviderRow(db, routing.primary_provider));

      const defaultRow = db.prepare('SELECT provider FROM admin_llm_configs WHERE is_default = 1 LIMIT 1').get();
      if (defaultRow?.provider) pushUnique(getProviderRow(db, defaultRow.provider));

      if (routing?.fallback_provider && routing.auto_fallback !== 0) {
        pushUnique(getProviderRow(db, routing.fallback_provider));
      }
    }
  } catch (err) {
    console.warn(`[llmClient] Error resolving candidate providers: ${err.message}`);
  }

  // Fallback to pure env-configured Ollama when invoked without a DB (e.g. standalone worker or unit tests)
  if (candidates.length === 0 && (envProvider === 'ollama' || process.env.OLLAMA_BASE_URL)) {
    pushUnique({
      provider: 'ollama',
      provider_type: 'local',
      base_url: DEFAULT_OLLAMA_BASE_URL,
      api_key: null,
      model: DEFAULT_OLLAMA_MODEL,
      temperature: 0.4,
      max_tokens: 2048,
      timeout_ms: DEFAULT_OLLAMA_TIMEOUT_MS,
      extra_headers: {}
    });
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

function buildMessagesList({ systemPrompt, userPrompt, messages }) {
  if (Array.isArray(messages) && messages.length > 0) {
    return messages;
  }
  const list = [];
  if (systemPrompt) list.push({ role: 'system', content: systemPrompt });
  if (userPrompt) list.push({ role: 'user', content: userPrompt });
  return list;
}

function normalizeOllamaToolCalls(rawToolCalls) {
  if (!Array.isArray(rawToolCalls) || rawToolCalls.length === 0) return [];
  const normalized = [];
  for (const tc of rawToolCalls) {
    const fn = tc?.function || tc;
    if (!fn || !fn.name) continue;
    let parsedArgs = fn.arguments;
    let parseError = null;
    if (typeof parsedArgs === 'string') {
      try {
        parsedArgs = JSON.parse(parsedArgs);
      } catch (err) {
        parseError = `Malformed tool arguments JSON: ${err.message}`;
      }
    }
    normalized.push({
      id: tc.id || null,
      name: String(fn.name),
      arguments: parsedArgs && typeof parsedArgs === 'object' ? parsedArgs : {},
      raw_arguments: typeof fn.arguments === 'string' ? fn.arguments : JSON.stringify(fn.arguments || {}),
      parse_error: parseError
    });
  }
  return normalized;
}

function normalizeOllamaUsage(data) {
  if (!data || typeof data !== 'object') return null;
  const promptTokens = typeof data.prompt_eval_count === 'number' ? data.prompt_eval_count : null;
  const completionTokens = typeof data.eval_count === 'number' ? data.eval_count : null;
  const evalDurationNs = typeof data.eval_duration === 'number' ? data.eval_duration : null;
  const totalDurationNs = typeof data.total_duration === 'number' ? data.total_duration : null;
  const tokensPerSecond = (completionTokens && evalDurationNs && evalDurationNs > 0)
    ? Number((completionTokens / (evalDurationNs / 1e9)).toFixed(2))
    : null;

  if (promptTokens === null && completionTokens === null && totalDurationNs === null) {
    return null;
  }

  return {
    prompt_tokens: promptTokens || 0,
    completion_tokens: completionTokens || 0,
    total_tokens: (promptTokens || 0) + (completionTokens || 0),
    tokens_per_second: tokensPerSecond,
    total_duration_ms: totalDurationNs ? Math.round(totalDurationNs / 1e6) : null
  };
}

/**
 * Parse an Ollama NDJSON streaming response body cleanly into normalized content, tool calls, and usage.
 */
async function readOllamaStream(res, { onToken, mode }) {
  const reader = res.body?.getReader ? res.body.getReader() : null;
  if (!reader) {
    // Fallback if runtime fetch does not expose a ReadableStream reader
    const text = await res.text();
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    let content = '';
    let lastObj = null;
    const toolCalls = [];
    for (const line of lines) {
      let obj;
      try {
        obj = JSON.parse(line);
      } catch (err) {
        throw new Error(`Malformed Ollama NDJSON chunk: ${err.message}`);
      }
      if (obj.error) throw new Error(obj.error);
      const token = mode === 'generate' ? (obj.response || '') : (obj.message?.content || '');
      if (token) {
        content += token;
        if (typeof onToken === 'function') onToken(token);
      }
      if (Array.isArray(obj.message?.tool_calls)) {
        toolCalls.push(...normalizeOllamaToolCalls(obj.message.tool_calls));
      }
      lastObj = obj;
    }
    return { content, toolCalls, usage: normalizeOllamaUsage(lastObj) };
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let lastObj = null;
  const toolCalls = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIdx;
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);
      if (!line) continue;

      let obj;
      try {
        obj = JSON.parse(line);
      } catch (err) {
        throw new Error(`Malformed Ollama NDJSON stream chunk: ${err.message}`);
      }
      if (obj.error) {
        throw new Error(obj.error);
      }
      const token = mode === 'generate' ? (obj.response || '') : (obj.message?.content || '');
      if (token) {
        content += token;
        if (typeof onToken === 'function') onToken(token);
      }
      if (Array.isArray(obj.message?.tool_calls)) {
        toolCalls.push(...normalizeOllamaToolCalls(obj.message.tool_calls));
      }
      lastObj = obj;
    }
  }

  if (buffer.trim()) {
    try {
      const obj = JSON.parse(buffer.trim());
      if (obj.error) throw new Error(obj.error);
      const token = mode === 'generate' ? (obj.response || '') : (obj.message?.content || '');
      if (token) {
        content += token;
        if (typeof onToken === 'function') onToken(token);
      }
      if (Array.isArray(obj.message?.tool_calls)) {
        toolCalls.push(...normalizeOllamaToolCalls(obj.message.tool_calls));
      }
      lastObj = obj;
    } catch (err) {
      throw new Error(`Incomplete trailing Ollama stream chunk: ${err.message}`);
    }
  }

  return { content, toolCalls, usage: normalizeOllamaUsage(lastObj) };
}

// =============================================================================
// PROVIDER ADAPTER REGISTRY
// =============================================================================

const PROVIDER_ADAPTERS = {
  ollama: {
    name: 'ollama',
    resolveTimeout(cfg, timeoutMs) {
      if (timeoutMs) return timeoutMs;
      // Local 7B models on CPU need generous headroom; ECONNREFUSED still fails in <20ms
      return Math.max(Number(cfg.timeout_ms) || DEFAULT_OLLAMA_TIMEOUT_MS, DEFAULT_OLLAMA_TIMEOUT_MS);
    },
    buildRequest(cfg, opts) {
      const mode = opts.mode === 'generate' ? 'generate' : 'chat';
      const url = mode === 'generate'
        ? `${cfg.base_url}/api/generate`
        : `${cfg.base_url}/api/chat`;

      const headers = {
        'Content-Type': 'application/json',
        ...(cfg.extra_headers || {})
      };
      if (cfg.api_key) {
        headers['Authorization'] = `Bearer ${cfg.api_key}`;
      }

      const ollamaOptions = {
        temperature: opts.temperature !== undefined ? opts.temperature : cfg.temperature,
        num_predict: opts.maxTokens || cfg.max_tokens || 2048
      };
      const envNumCtx = parseInt(process.env.OLLAMA_NUM_CTX || '0', 10);
      if (opts.numCtx || envNumCtx > 0) {
        ollamaOptions.num_ctx = opts.numCtx || envNumCtx;
      }

      const body = {
        model: opts.model || cfg.model || DEFAULT_OLLAMA_MODEL,
        stream: Boolean(opts.stream),
        options: ollamaOptions
      };

      if (opts.expectJson) {
        body.format = opts.jsonSchema && typeof opts.jsonSchema === 'object' ? opts.jsonSchema : 'json';
      }

      if (mode === 'generate') {
        body.prompt = opts.userPrompt || opts.prompt || '';
        if (opts.systemPrompt) body.system = opts.systemPrompt;
      } else {
        body.messages = buildMessagesList(opts);
        if (Array.isArray(opts.tools) && opts.tools.length > 0) {
          body.tools = opts.tools;
        }
      }

      return { url, headers, body, mode };
    },
    async parseResponse(res, opts, reqMeta) {
      if (opts.stream) {
        return readOllamaStream(res, { onToken: opts.onToken, mode: reqMeta.mode });
      }
      let data;
      try {
        data = await res.json();
      } catch (err) {
        throw Object.assign(new Error(`Malformed JSON from Ollama API: ${err.message}`), { code: 'OLLAMA_MALFORMED_OUTPUT' });
      }
      if (data?.error) {
        throw new Error(String(data.error));
      }
      const content = reqMeta.mode === 'generate'
        ? (data?.response || '')
        : (data?.message?.content || data?.response || '');
      const toolCalls = normalizeOllamaToolCalls(data?.message?.tool_calls);
      const usage = normalizeOllamaUsage(data);
      return { content, toolCalls, usage };
    },
    classifyHttpError(status, errBody, cfg, opts) {
      const lower = String(errBody || '').toLowerCase();
      const targetModel = opts.model || cfg.model || DEFAULT_OLLAMA_MODEL;
      if (status === 404 || lower.includes('not found') || lower.includes('try pulling')) {
        return {
          code: 'OLLAMA_MODEL_NOT_FOUND',
          retryable: false,
          error: `Ollama model '${targetModel}' is not installed. Run: ollama pull ${targetModel}`
        };
      }
      return {
        code: `OLLAMA_HTTP_${status}`,
        retryable: RETRYABLE_HTTP_STATUSES.has(status),
        error: `ollama HTTP ${status}: ${sanitizeErrorMessage(errBody)}`
      };
    }
  },

  anthropic: {
    name: 'anthropic',
    resolveTimeout(cfg, timeoutMs) {
      return timeoutMs || Math.min(cfg.timeout_ms || 30000, 60000);
    },
    buildRequest(cfg, opts) {
      const url = `${cfg.base_url}/messages`;
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': cfg.api_key,
        'anthropic-version': '2023-06-01',
        ...(cfg.extra_headers || {})
      };
      const body = {
        model: opts.model || cfg.model || 'claude-3-5-sonnet-20241022',
        max_tokens: opts.maxTokens || cfg.max_tokens || 2048,
        temperature: opts.temperature !== undefined ? opts.temperature : cfg.temperature,
        system: opts.systemPrompt || undefined,
        messages: Array.isArray(opts.messages) && opts.messages.length
          ? opts.messages.filter((m) => m.role !== 'system')
          : [{ role: 'user', content: opts.userPrompt || '' }]
      };
      return { url, headers, body, mode: 'chat' };
    },
    async parseResponse(res) {
      const data = await res.json();
      return {
        content: data?.content?.[0]?.text || '',
        toolCalls: [],
        usage: data?.usage || null
      };
    }
  },

  gemini: {
    name: 'gemini',
    resolveTimeout(cfg, timeoutMs) {
      return timeoutMs || Math.min(cfg.timeout_ms || 30000, 60000);
    },
    buildRequest(cfg, opts) {
      const modelName = opts.model || cfg.model || 'gemini-2.5-flash';
      const url = `${cfg.base_url}/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(cfg.api_key)}`;
      const headers = { 'Content-Type': 'application/json', ...(cfg.extra_headers || {}) };
      const body = {
        systemInstruction: opts.systemPrompt ? { parts: [{ text: opts.systemPrompt }] } : undefined,
        contents: [{ role: 'user', parts: [{ text: opts.userPrompt || '' }] }],
        generationConfig: {
          temperature: opts.temperature !== undefined ? opts.temperature : cfg.temperature,
          maxOutputTokens: opts.maxTokens || cfg.max_tokens || 2048
        }
      };
      return { url, headers, body, mode: 'chat' };
    },
    async parseResponse(res) {
      const data = await res.json();
      return {
        content: data?.candidates?.[0]?.content?.parts?.[0]?.text || '',
        toolCalls: [],
        usage: data?.usageMetadata || null
      };
    }
  },

  openaiCompatible: {
    name: 'openai-compatible',
    resolveTimeout(cfg, timeoutMs) {
      if (timeoutMs) return timeoutMs;
      if (isLocalEndpoint(cfg.base_url)) {
        return Math.min(cfg.timeout_ms || 30000, 60000);
      }
      return Math.min(cfg.timeout_ms || 30000, 60000);
    },
    buildRequest(cfg, opts) {
      const url = `${cfg.base_url}/chat/completions`;
      const headers = { 'Content-Type': 'application/json', ...(cfg.extra_headers || {}) };
      if (cfg.api_key) headers['Authorization'] = `Bearer ${cfg.api_key}`;
      const body = {
        model: opts.model || cfg.model || 'gpt-4o-mini',
        temperature: opts.temperature !== undefined ? opts.temperature : cfg.temperature,
        max_tokens: opts.maxTokens || cfg.max_tokens || 2048,
        messages: buildMessagesList(opts)
      };
      if (opts.expectJson) {
        body.response_format = { type: 'json_object' };
      }
      return { url, headers, body, mode: 'chat' };
    },
    async parseResponse(res) {
      const data = await res.json();
      return {
        content: data?.choices?.[0]?.message?.content || '',
        toolCalls: data?.choices?.[0]?.message?.tool_calls || [],
        usage: data?.usage || null
      };
    }
  }
};

// Alias OpenAI-compatible adapters so every supported provider resolves cleanly
PROVIDER_ADAPTERS.openai = PROVIDER_ADAPTERS.openaiCompatible;
PROVIDER_ADAPTERS.lmstudio = PROVIDER_ADAPTERS.openaiCompatible;
PROVIDER_ADAPTERS.vllm = PROVIDER_ADAPTERS.openaiCompatible;

function getAdapter(providerName) {
  return PROVIDER_ADAPTERS[providerName] || PROVIDER_ADAPTERS.openaiCompatible;
}

async function callSingleProviderOnce(cfg, opts = {}) {
  const { timeoutMs = null, expectJson = false, strictJson = false } = opts;

  if (CLOUD_PROVIDERS.has(cfg.provider) && !cfg.api_key) {
    return {
      ok: false,
      code: 'API_KEY_MISSING',
      retryable: false,
      error: `API key not configured for cloud provider '${cfg.provider}'`
    };
  }

  if (!cfg.base_url) {
    return {
      ok: false,
      code: 'BASE_URL_MISSING',
      retryable: false,
      error: `Base URL not configured for provider '${cfg.provider}'`
    };
  }

  const adapter = getAdapter(cfg.provider);
  const effectiveTimeout = adapter.resolveTimeout(cfg, timeoutMs);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), effectiveTimeout);

  try {
    const reqMeta = adapter.buildRequest(cfg, opts);
    const res = await fetch(reqMeta.url, {
      method: 'POST',
      headers: reqMeta.headers,
      body: JSON.stringify(reqMeta.body),
      signal: controller.signal
    });

    if (!res.ok) {
      clearTimeout(timer);
      const errBody = await res.text().catch(() => '');
      if (typeof adapter.classifyHttpError === 'function') {
        const classified = adapter.classifyHttpError(res.status, errBody, cfg, opts);
        return { ok: false, status: res.status, ...classified };
      }
      return {
        ok: false,
        status: res.status,
        code: `HTTP_${res.status}`,
        retryable: RETRYABLE_HTTP_STATUSES.has(res.status),
        error: `${cfg.provider} HTTP ${res.status}: ${sanitizeErrorMessage(errBody)}`
      };
    }

    const parsedRes = await adapter.parseResponse(res, opts, reqMeta);
    clearTimeout(timer);

    const content = (parsedRes.content || '').trim();
    const toolCalls = Array.isArray(parsedRes.toolCalls) ? parsedRes.toolCalls : [];

    if (!content && toolCalls.length === 0) {
      return {
        ok: false,
        code: 'EMPTY_RESPONSE',
        retryable: true,
        error: `${cfg.provider} returned empty response payload`
      };
    }

    const parsedJson = content ? extractJsonFromText(content) : null;
    if (strictJson && !parsedJson) {
      return {
        ok: false,
        code: 'INVALID_JSON',
        retryable: true,
        content,
        error: `${cfg.provider} did not return valid JSON output`
      };
    }

    // Detect tool-call parse failures cleanly without crashing
    const toolErrors = toolCalls.filter((t) => t.parse_error).map((t) => `${t.name}: ${t.parse_error}`);
    if (toolErrors.length > 0 && opts.strictToolCalls) {
      return {
        ok: false,
        code: 'TOOL_CALL_PARSE_ERROR',
        retryable: false,
        content,
        toolCalls,
        error: `Malformed tool call arguments: ${toolErrors.join('; ')}`
      };
    }

    return {
      ok: true,
      content,
      parsedJson,
      jsonValid: expectJson ? Boolean(parsedJson) : null,
      toolCalls,
      usage: parsedRes.usage || null
    };
  } catch (err) {
    clearTimeout(timer);
    const isAbort = err.name === 'AbortError';
    const rawCode = err.cause?.code || err.code || '';
    const errMsg = isAbort
      ? `Timeout after ${effectiveTimeout}ms`
      : sanitizeErrorMessage(rawCode || err.message);

    const isConnRefused = String(rawCode).includes('ECONNREFUSED')
      || String(err.message || '').includes('ECONNREFUSED');
    const isUnreachable = isConnRefused
      || String(rawCode).includes('ENOTFOUND')
      || String(rawCode).includes('EHOSTUNREACH')
      || String(err.message || '').toLowerCase().includes('fetch failed');

    let code = 'PROVIDER_ERROR';
    if (isAbort) code = cfg.provider === 'ollama' ? 'OLLAMA_TIMEOUT' : 'LLM_TIMEOUT';
    else if (isUnreachable) code = cfg.provider === 'ollama' ? 'OLLAMA_UNAVAILABLE' : 'LLM_UNAVAILABLE';
    else if (err.code) code = err.code;

    return {
      ok: false,
      code,
      retryable: isAbort || (!isConnRefused && !isLocalEndpoint(cfg.base_url)),
      error: `${cfg.provider} error (${code}): ${errMsg}`
    };
  }
}

/**
 * Directly invoke a single explicit provider config (useful for Local Worker & adapter tests).
 */
async function invokeProvider(cfg, opts = {}) {
  const startTime = Date.now();
  const maxRetries = opts.maxRetries !== undefined ? opts.maxRetries : 1;
  const baseBackoffMs = opts.baseBackoffMs !== undefined ? opts.baseBackoffMs : 250;
  let attempts = 0;
  const errors = [];
  let lastCode = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    attempts++;
    const res = await callSingleProviderOnce(cfg, opts);
    if (res.ok) {
      return {
        ok: true,
        data_source: 'live_llm',
        provider: cfg.provider,
        model: opts.model || cfg.model,
        content: res.content,
        parsedJson: res.parsedJson,
        jsonValid: res.jsonValid,
        toolCalls: res.toolCalls || [],
        usage: res.usage || null,
        attempts,
        latencyMs: Date.now() - startTime
      };
    }

    lastCode = res.code || 'PROVIDER_ERROR';
    errors.push(`${cfg.provider}[#${attempt}]: ${res.error}`);
    if (!res.retryable || attempt > maxRetries) break;
    await sleep(baseBackoffMs * Math.pow(2, attempt - 1));
  }

  return {
    ok: false,
    data_source: 'simulated_fallback',
    provider: cfg.provider,
    model: opts.model || cfg.model,
    errorCode: lastCode,
    attempts,
    latencyMs: Date.now() - startTime,
    error: errors.join(' | ')
  };
}

/**
 * Invoke the active LLM provider with retry backoff & fallback provider failover.
 */
async function invokeLLM(db, opts = {}) {
  const startTime = Date.now();
  const {
    maxRetries = 2,
    baseBackoffMs = 200
  } = opts;
  const candidates = Array.isArray(opts.overrideCandidates) && opts.overrideCandidates.length > 0
    ? opts.overrideCandidates
    : resolveCandidateProviders(db);

  if (candidates.length === 0) {
    return {
      ok: false,
      data_source: 'simulated_fallback',
      errorCode: 'NO_PROVIDERS_CONFIGURED',
      attempts: 0,
      latencyMs: Date.now() - startTime,
      error: 'No LLM providers configured in admin_llm_configs'
    };
  }

  let totalAttempts = 0;
  const errors = [];
  let lastCode = null;

  for (const cfg of candidates) {
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      totalAttempts++;
      const res = await callSingleProviderOnce(cfg, opts);
      if (res.ok) {
        return {
          ok: true,
          data_source: 'live_llm',
          provider: cfg.provider,
          model: opts.model || cfg.model,
          content: res.content,
          parsedJson: res.parsedJson,
          jsonValid: res.jsonValid,
          toolCalls: res.toolCalls || [],
          usage: res.usage || null,
          attempts: totalAttempts,
          latencyMs: Date.now() - startTime
        };
      }

      lastCode = res.code || 'PROVIDER_ERROR';
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
    model: opts.model || candidates[0]?.model || 'none',
    errorCode: lastCode,
    attempts: totalAttempts,
    latencyMs: Date.now() - startTime,
    error: errors.join(' | ')
  };
}

module.exports = {
  PROVIDER_ADAPTERS,
  invokeProvider,
  invokeLLM,
  extractJsonFromText,
  resolveCandidateProviders,
  isLocalEndpoint,
  sanitizeErrorMessage
};
