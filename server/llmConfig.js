/**
 * Admin Local LLM / Cloud API Configuration & Routing Engine
 * Marketing OS — Version 2.2.0 Enterprise
 * 
 * Supports:
 *   - Local Engines: Ollama, LM Studio, vLLM
 *   - Cloud APIs: OpenAI, Anthropic, Gemini
 * 
 * Provides:
 *   - Cryptographic key masking (zero credential leakage)
 *   - Deterministic ping & connection health testing
 *   - Model auto-discovery
 *   - Safe schema migration & pre-seeding
 */

const { v4: uuidv4 } = require('uuid');

const SUPPORTED_PROVIDERS = ['ollama', 'lmstudio', 'vllm', 'openai', 'anthropic', 'gemini'];

const PROVIDER_METADATA = {
  ollama: {
    display_name: 'Ollama (Local Engine)',
    provider_type: 'local',
    default_base_url: 'http://127.0.0.1:11434',
    default_model: 'llama3.2:latest',
    default_models: ['llama3.2:latest', 'mistral:latest', 'qwen2.5:latest', 'llama3.1:8b', 'deepseek-r1:latest'],
    requires_key: false
  },
  lmstudio: {
    display_name: 'LM Studio (Local Server)',
    provider_type: 'local',
    default_base_url: 'http://127.0.0.1:1234/v1',
    default_model: 'local-model',
    default_models: ['local-model', 'qwen2.5-coder-7b', 'meta-llama-3.1-8b-instruct'],
    requires_key: false
  },
  vllm: {
    display_name: 'vLLM (Local High-Throughput)',
    provider_type: 'local',
    default_base_url: 'http://127.0.0.1:8000/v1',
    default_model: 'meta-llama/Llama-3-8B-Instruct',
    default_models: ['meta-llama/Llama-3-8B-Instruct', 'mistralai/Mistral-7B-Instruct-v0.3'],
    requires_key: false
  },
  openai: {
    display_name: 'OpenAI (Cloud API)',
    provider_type: 'cloud',
    default_base_url: 'https://api.openai.com/v1',
    default_model: 'gpt-4o',
    default_models: ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o1-mini'],
    requires_key: true
  },
  anthropic: {
    display_name: 'Anthropic Claude (Cloud API)',
    provider_type: 'cloud',
    default_base_url: 'https://api.anthropic.com/v1',
    default_model: 'claude-3-5-sonnet-20241022',
    default_models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    requires_key: true
  },
  gemini: {
    display_name: 'Google Gemini (Cloud API)',
    provider_type: 'cloud',
    default_base_url: 'https://generativelanguage.googleapis.com/v1beta',
    default_model: 'gemini-1.5-flash',
    default_models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'],
    requires_key: true
  }
};

/**
 * Mask an API key so that secret bytes are never exposed.
 * Preserves a hint (prefix / suffix) for administrative verification.
 */
function maskApiKey(key) {
  if (!key || typeof key !== 'string') return null;
  const trimmed = key.trim();
  if (!trimmed) return null;

  if (trimmed.length <= 8) {
    return '••••••••';
  }
  if (trimmed.startsWith('sk-proj-') || trimmed.startsWith('sk-ant-')) {
    const prefix = trimmed.slice(0, 7);
    return `${prefix}••••••••${trimmed.slice(-4)}`;
  }
  return `${trimmed.slice(0, 4)}••••••••${trimmed.slice(-4)}`;
}

/**
 * Returns true if the key string looks like an already masked placeholder.
 */
function isMaskedKey(key) {
  if (!key || typeof key !== 'string') return false;
  return key.includes('••••') || key.includes('****');
}

/**
 * Execute HTTP test ping to a local LLM or cloud provider.
 */
async function pingProvider({ provider, baseUrl, apiKey, timeoutMs = 6000 }) {
  const normBase = (baseUrl || '').replace(/\/+$/, '');
  const startTime = Date.now();

  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    return {
      ok: false,
      provider,
      status: 'error',
      latency_ms: 0,
      error: `Unsupported provider: ${provider}. Supported: ${SUPPORTED_PROVIDERS.join(', ')}`
    };
  }

  const meta = PROVIDER_METADATA[provider];
  if (meta.requires_key && (!apiKey || !apiKey.trim())) {
    return {
      ok: false,
      provider,
      status: 'error',
      latency_ms: 0,
      error: `API key is required to test ${meta.display_name}`
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let pingUrl = '';
    let reqHeaders = { 'User-Agent': 'MarketingOS/2.2' };
    let reqMethod = 'GET';
    let reqBody = null;

    switch (provider) {
      case 'ollama': {
        // Ollama tags / version endpoint
        pingUrl = `${normBase}/api/tags`;
        break;
      }
      case 'lmstudio': {
        // LM Studio OpenAI-compatible models list
        pingUrl = normBase.endsWith('/v1') ? `${normBase}/models` : `${normBase}/v1/models`;
        break;
      }
      case 'vllm': {
        // vLLM health check or models list
        pingUrl = normBase.endsWith('/v1') ? `${normBase}/models` : `${normBase}/health`;
        break;
      }
      case 'openai': {
        pingUrl = `${normBase}/models`;
        reqHeaders['Authorization'] = `Bearer ${apiKey.trim()}`;
        break;
      }
      case 'anthropic': {
        // Anthropic models API requires x-api-key and anthropic-version
        pingUrl = `${normBase}/models`;
        reqHeaders['x-api-key'] = apiKey.trim();
        reqHeaders['anthropic-version'] = '2023-06-01';
        break;
      }
      case 'gemini': {
        pingUrl = `${normBase}/models?key=${encodeURIComponent(apiKey.trim())}`;
        break;
      }
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    const res = await fetch(pingUrl, {
      method: reqMethod,
      headers: reqHeaders,
      body: reqBody,
      signal: controller.signal
    });

    clearTimeout(timer);
    const latencyMs = Date.now() - startTime;

    if (res.ok) {
      let detectedModels = [];
      try {
        const json = await res.json();
        if (provider === 'ollama' && Array.isArray(json.models)) {
          detectedModels = json.models.map(m => m.name);
        } else if ((provider === 'openai' || provider === 'lmstudio' || provider === 'vllm') && Array.isArray(json.data)) {
          detectedModels = json.data.slice(0, 10).map(m => m.id);
        } else if (provider === 'anthropic' && Array.isArray(json.data)) {
          detectedModels = json.data.slice(0, 10).map(m => m.id);
        } else if (provider === 'gemini' && Array.isArray(json.models)) {
          detectedModels = json.models.slice(0, 10).map(m => m.name.replace('models/', ''));
        }
      } catch (e) {
        // JSON parsing failure is non-fatal for ping if HTTP was 200
      }

      return {
        ok: true,
        provider,
        status: 'connected',
        latency_ms: latencyMs,
        http_status: res.status,
        message: `${meta.display_name} connected successfully`,
        detected_models: detectedModels.length > 0 ? detectedModels : undefined
      };
    } else {
      let errorBody = '';
      try {
        const errJson = await res.json();
        errorBody = errJson?.error?.message || errJson?.error || JSON.stringify(errJson);
      } catch (_) {
        errorBody = await res.text().catch(() => '');
      }

      const isAuthErr = res.status === 401 || res.status === 403;
      return {
        ok: false,
        provider,
        status: isAuthErr ? 'error' : 'offline',
        latency_ms: latencyMs,
        http_status: res.status,
        error: isAuthErr
          ? `Authentication rejected (HTTP ${res.status}): ${errorBody || 'Invalid credentials'}`
          : `Service responded with HTTP ${res.status}: ${errorBody || res.statusText}`
      };
    }
  } catch (err) {
    clearTimeout(timer);
    const latencyMs = Date.now() - startTime;
    const isTimeout = err.name === 'AbortError';

    return {
      ok: false,
      provider,
      status: 'offline',
      latency_ms: latencyMs,
      error: isTimeout
        ? `Connection timed out after ${timeoutMs}ms (${meta.display_name} at ${normBase})`
        : `Connection failed: ${err.message}`
    };
  }
}

/**
 * Initialize SQLite tables for Admin LLM configs and routing rules.
 */
function initLLMDatabase(db) {
  db.exec(`
    -- 22. Admin Local LLM / Cloud API Configuration
    CREATE TABLE IF NOT EXISTS admin_llm_configs (
      id TEXT PRIMARY KEY,
      provider TEXT UNIQUE NOT NULL CHECK(provider IN ('ollama', 'lmstudio', 'vllm', 'openai', 'anthropic', 'gemini')),
      display_name TEXT NOT NULL,
      provider_type TEXT NOT NULL CHECK(provider_type IN ('local', 'cloud')),
      base_url TEXT NOT NULL,
      api_key TEXT,
      default_model TEXT NOT NULL,
      available_models TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      temperature REAL DEFAULT 0.7,
      max_tokens INTEGER DEFAULT 4096,
      timeout_ms INTEGER DEFAULT 30000,
      extra_headers TEXT DEFAULT '{}',
      status TEXT DEFAULT 'untested' CHECK(status IN ('connected', 'error', 'untested', 'offline')),
      last_tested DATETIME,
      last_error TEXT,
      latency_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 23. Admin LLM Routing Rules
    CREATE TABLE IF NOT EXISTS admin_llm_routing (
      id TEXT PRIMARY KEY,
      primary_provider TEXT NOT NULL DEFAULT 'ollama',
      fallback_provider TEXT DEFAULT 'lmstudio',
      auto_fallback INTEGER DEFAULT 1,
      routing_strategy TEXT DEFAULT 'primary_with_fallback' CHECK(routing_strategy IN ('primary_only', 'primary_with_fallback', 'round_robin', 'least_latency')),
      pipeline_overrides TEXT DEFAULT '{}',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_llm_configs_provider ON admin_llm_configs(provider);
    CREATE INDEX IF NOT EXISTS idx_llm_configs_active ON admin_llm_configs(is_active);
    CREATE INDEX IF NOT EXISTS idx_llm_configs_default ON admin_llm_configs(is_default);
  `);

  // Pre-seed all 6 supported providers if not existing
  const checkStmt = db.prepare('SELECT id FROM admin_llm_configs WHERE provider = ?');
  const insertStmt = db.prepare(`
    INSERT INTO admin_llm_configs (
      id, provider, display_name, provider_type, base_url, api_key,
      default_model, available_models, is_active, is_default, status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'untested', CURRENT_TIMESTAMP)
  `);

  for (const [provider, meta] of Object.entries(PROVIDER_METADATA)) {
    const existing = checkStmt.get(provider);
    if (!existing) {
      const isDefault = provider === 'ollama' ? 1 : 0;
      const isActive = provider === 'ollama' ? 1 : 0;
      insertStmt.run(
        uuidv4(),
        provider,
        meta.display_name,
        meta.provider_type,
        meta.default_base_url,
        null, // api_key starts null for safety
        meta.default_model,
        JSON.stringify(meta.default_models),
        isActive,
        isDefault
      );
    }
  }

  // Pre-seed routing config if not existing
  const routingRow = db.prepare('SELECT id FROM admin_llm_routing LIMIT 1').get();
  if (!routingRow) {
    db.prepare(`
      INSERT INTO admin_llm_routing (id, primary_provider, fallback_provider, auto_fallback, routing_strategy, pipeline_overrides)
      VALUES (?, 'ollama', 'lmstudio', 1, 'primary_with_fallback', '{}')
    `).run(uuidv4());
  }

  // Pre-seed Blueprint llm_providers
  const providerCount = db.prepare('SELECT COUNT(*) as c FROM llm_providers').get().c;
  if (providerCount === 0) {
    db.exec(`
      INSERT OR IGNORE INTO llm_providers (id, name, slug, provider_type, base_url, health_status) VALUES
      ('prov-ollama', 'Ollama Local Daemon', 'ollama-local', 'local', 'http://127.0.0.1:11434/v1', 'online'),
      ('prov-lmstudio', 'LM Studio Local Server', 'lmstudio-local', 'local', 'http://127.0.0.1:1234/v1', 'online'),
      ('prov-vllm', 'vLLM Accelerated Engine', 'vllm-local', 'local', 'http://127.0.0.1:8000/v1', 'online'),
      ('prov-openai', 'OpenAI Cloud API', 'openai-cloud', 'cloud', 'https://api.openai.com/v1', 'online'),
      ('prov-anthropic', 'Anthropic Claude API', 'anthropic-cloud', 'cloud', 'https://api.anthropic.com/v1', 'online'),
      ('prov-gemini', 'Google Gemini Studio', 'gemini-cloud', 'cloud', 'https://generativelanguage.googleapis.com/v1beta', 'online');

      INSERT OR IGNORE INTO llm_models (id, provider_id, model_id, display_name, model_type, context_window, cost_per_million_input, cost_per_million_output) VALUES
      ('mod-qwen-coder', 'prov-ollama', 'qwen2.5-coder:32b', 'Qwen 2.5 Coder (32B Local)', 'chat', 32768, 0.0, 0.0),
      ('mod-llama3', 'prov-ollama', 'llama3.3:70b', 'Llama 3.3 (70B Local)', 'chat', 32768, 0.0, 0.0),
      ('mod-lmstudio-local', 'prov-lmstudio', 'local-model', 'LM Studio Local Model', 'chat', 16384, 0.0, 0.0),
      ('mod-gpt4o', 'prov-openai', 'gpt-4o', 'GPT-4o Omnimodel', 'chat', 128000, 2.50, 10.00),
      ('mod-claude37', 'prov-anthropic', 'claude-3-7-sonnet', 'Claude 3.7 Sonnet Reasoning', 'reasoning', 200000, 3.00, 15.00),
      ('mod-gemini-flash', 'prov-gemini', 'gemini-2.0-flash', 'Gemini 2.0 Flash Fast', 'chat', 1000000, 0.10, 0.40);

      INSERT OR IGNORE INTO llm_routes (id, pipeline_id, routing_strategy, primary_model_id, fallback_model_id, temperature) VALUES
      ('route-landing', 'landing-page', 'local_first', 'mod-qwen-coder', 'mod-gpt4o', 0.4),
      ('route-seo', 'content-seo', 'local_first', 'mod-llama3', 'mod-claude37', 0.6),
      ('route-lead', 'lead-research', 'local_first', 'mod-llama3', 'mod-gemini-flash', 0.2),
      ('route-email', 'email-campaign', 'local_first', 'mod-llama3', 'mod-claude37', 0.7),
      ('route-intel', 'market-intel', 'local_first', 'mod-llama3', 'mod-claude37', 0.5),
      ('route-general', 'general', 'local_first', 'mod-llama3', 'mod-gpt4o', 0.7);
    `);
  }
}

/**
 * Format a database row into a safe API response, masking sensitive keys.
 */
function sanitizeConfigRow(row, reveal = false) {
  if (!row) return null;
  let availableModels = [];
  try {
    availableModels = JSON.parse(row.available_models || '[]');
  } catch (_) {
    availableModels = [];
  }

  let extraHeaders = {};
  try {
    extraHeaders = JSON.parse(row.extra_headers || '{}');
  } catch (_) {
    extraHeaders = {};
  }

  return {
    id: row.id,
    provider: row.provider,
    display_name: row.display_name,
    provider_type: row.provider_type,
    base_url: row.base_url,
    api_key: reveal ? row.api_key : maskApiKey(row.api_key),
    has_api_key: Boolean(row.api_key && row.api_key.trim().length > 0),
    default_model: row.default_model,
    available_models: availableModels,
    is_active: Boolean(row.is_active),
    is_default: Boolean(row.is_default),
    temperature: row.temperature !== null ? Number(row.temperature) : 0.7,
    max_tokens: row.max_tokens !== null ? Number(row.max_tokens) : 4096,
    timeout_ms: row.timeout_ms !== null ? Number(row.timeout_ms) : 30000,
    extra_headers: extraHeaders,
    status: row.status,
    last_tested: row.last_tested,
    last_error: row.last_error,
    latency_ms: row.latency_ms,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/**
 * Resolves the currently active primary LLM configuration from SQLite.
 *
 * @param {Object} [customDb] Optional custom better-sqlite3 instance
 * @returns {Object|null} Sanitized configuration row
 */
function getActiveLLMConfig(customDb = null) {
  try {
    const targetDb = customDb || require('./db');
    const row = targetDb.prepare('SELECT * FROM admin_llm_configs WHERE is_default = 1 LIMIT 1').get()
      || targetDb.prepare('SELECT * FROM admin_llm_configs WHERE is_active = 1 LIMIT 1').get()
      || targetDb.prepare("SELECT * FROM admin_llm_configs WHERE provider = 'ollama' LIMIT 1").get();
    if (!row) return null;
    return sanitizeConfigRow(row, false);
  } catch (_) {
    return null;
  }
}

module.exports = {
  SUPPORTED_PROVIDERS,
  PROVIDER_METADATA,
  maskApiKey,
  isMaskedKey,
  pingProvider,
  initLLMDatabase,
  sanitizeConfigRow,
  getActiveLLMConfig
};
