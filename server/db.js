const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const isVercel = Boolean(process.env.VERCEL);
const dbPath = process.env.DATABASE_PATH || process.env.DB_PATH || (isVercel ? '/tmp/marketing-os.db' : path.join(__dirname, '..', 'data', 'marketing-os.db'));

try {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
} catch (err) {
  console.error(`[CRITICAL] Failed to create database directory: ${err.message}`);
}

let db;
try {
  db = new Database(dbPath);
  try {
    db.pragma('journal_mode = WAL');
  } catch (_) {
    try { db.pragma('journal_mode = DELETE'); } catch (_) {}
  }
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
} catch (err) {
  console.error(`[CRITICAL] Failed to initialize SQLite database at ${dbPath}: ${err.message}`);
  throw err;
}

// Enterprise Unified Schema for all 12 Marketing OS Modules
try {
  db.exec(`
  -- 1. Users & RBAC
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('super_admin','admin','manager','member','client')),
    avatar TEXT,
    department TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active','suspended','pending')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 2. Projects (Workspace boundaries)
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    client_name TEXT,
    goal TEXT,
    type TEXT DEFAULT 'full_lifecycle',
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft','in_progress','in_review','delivered','archived')),
    owner_id TEXT,
    progress INTEGER DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
    department TEXT DEFAULT 'creative',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE SET NULL
  );

  -- 3. Project Membership
  CREATE TABLE IF NOT EXISTS project_members (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role_in_project TEXT DEFAULT 'member' CHECK(role_in_project IN ('owner','lead','specialist','client','member','manager')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, user_id),
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- 4. Tasks & Pipeline Workflows
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    pipeline TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft','queued','running','in_progress','in_review','needs_fix','needs_attention','delivered')),
    stage TEXT DEFAULT 'plan' CHECK(stage IN ('plan','assign','execute','verify','report')),
    capability TEXT DEFAULT 'creative' CHECK(capability IN ('research','engineering','creative','coordination','reporting')),
    assignee_id TEXT,
    created_by TEXT,
    priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
    harness_files TEXT DEFAULT '[]',
    input_json TEXT DEFAULT '{}',
    output_json TEXT DEFAULT '{}',
    report_md TEXT DEFAULT '',
    n8n_execution_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(assignee_id) REFERENCES users(id) ON DELETE SET NULL
  );

  -- 5. Core Data Harness Files
  CREATE TABLE IF NOT EXISTS harness_files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    uploaded_by TEXT,
    parsed_summary TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  -- 6. Executive Reports & Verification Verdicts
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content_md TEXT NOT NULL,
    verdict TEXT DEFAULT 'pending' CHECK(verdict IN ('pending','approved','needs_fix')),
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  -- 7. Multi-Channel Campaigns (Module 05)
  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    objective TEXT NOT NULL,
    channels TEXT NOT NULL DEFAULT '["email"]',
    status TEXT DEFAULT 'planning' CHECK(status IN ('planning','active','paused','completed')),
    budget REAL DEFAULT 0.0,
    spend REAL DEFAULT 0.0,
    start_date DATE,
    end_date DATE,
    target_metrics TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  -- 8. Target Accounts / Companies (Module 06 & 07)
  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    domain TEXT,
    industry TEXT,
    headcount_range TEXT,
    location TEXT,
    verified_facts TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  -- 9. Leads & Prospect Intelligence (Module 06)
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    company_id TEXT,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    job_title TEXT,
    linkedin_url TEXT,
    icp_score INTEGER DEFAULT 0 CHECK(icp_score BETWEEN 0 AND 100),
    status TEXT DEFAULT 'new' CHECK(status IN ('new','enriched','contacted','qualified','unqualified')),
    source_evidence TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE SET NULL
  );

  -- 10. Deals & Revenue Pipeline (Module 07)
  CREATE TABLE IF NOT EXISTS deals (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    company_id TEXT,
    lead_id TEXT,
    title TEXT NOT NULL,
    stage TEXT DEFAULT 'lead' CHECK(stage IN ('lead','discovery','demo','proposal','negotiation','closed_won','closed_lost')),
    value REAL DEFAULT 0.0,
    probability INTEGER DEFAULT 20 CHECK(probability BETWEEN 0 AND 100),
    expected_close DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE SET NULL,
    FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE SET NULL
  );

  -- 11. Email Sequences (Module 08)
  CREATE TABLE IF NOT EXISTS email_sequences (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    campaign_id TEXT,
    name TEXT NOT NULL,
    trigger_event TEXT DEFAULT 'manual' CHECK(trigger_event IN ('manual','lead_created','form_submit','tag_added')),
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft','active','paused')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
  );

  -- 12. Email Steps within Sequences
  CREATE TABLE IF NOT EXISTS email_steps (
    id TEXT PRIMARY KEY,
    sequence_id TEXT NOT NULL,
    step_number INTEGER NOT NULL,
    delay_hours INTEGER DEFAULT 24,
    subject_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    requires_approval BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sequence_id) REFERENCES email_sequences(id) ON DELETE CASCADE
  );

  -- 13. Email Dispatch & Delivery Logs
  CREATE TABLE IF NOT EXISTS email_logs (
    id TEXT PRIMARY KEY,
    step_id TEXT,
    lead_id TEXT,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT DEFAULT 'staging' CHECK(status IN ('staging','approved','sent','delivered','failed','bounced')),
    provider_id TEXT,
    dispatched_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(step_id) REFERENCES email_steps(id) ON DELETE SET NULL,
    FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
  );

  -- 14. Content Editorial Calendar (Module 09)
  CREATE TABLE IF NOT EXISTS content_items (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    campaign_id TEXT,
    title TEXT NOT NULL,
    format TEXT NOT NULL CHECK(format IN ('blog_post','social_post','landing_page','video_script','ad_copy')),
    channel TEXT NOT NULL,
    status TEXT DEFAULT 'draft' CHECK(status IN ('brief','draft','review','scheduled','published')),
    publish_date DATETIME,
    content_body TEXT DEFAULT '',
    meta_json TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
  );

  -- 15. SEO Keywords (Module 03)
  CREATE TABLE IF NOT EXISTS seo_keywords (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    keyword TEXT NOT NULL,
    search_intent TEXT CHECK(search_intent IN ('informational','navigational','commercial','transactional')),
    monthly_volume INTEGER DEFAULT 0,
    difficulty INTEGER DEFAULT 0 CHECK(difficulty BETWEEN 0 AND 100),
    current_rank INTEGER,
    target_url TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  -- 16. Generative Engine Optimization (GEO) Queries (Module 03)
  CREATE TABLE IF NOT EXISTS geo_queries (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    prompt_query TEXT NOT NULL,
    engine TEXT NOT NULL CHECK(engine IN ('chatgpt','gemini','perplexity','claude','copilot')),
    brand_mentioned BOOLEAN DEFAULT FALSE,
    citation_url TEXT,
    sentiment TEXT CHECK(sentiment IN ('positive','neutral','negative','absent')),
    last_checked DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  -- 17. Operational Activity Audit Log
  CREATE TABLE IF NOT EXISTS activity (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    task_id TEXT,
    user_id TEXT,
    action TEXT NOT NULL,
    meta TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  -- 18. Structured Error & Incident Ledger (Global Engineering Rule)
  CREATE TABLE IF NOT EXISTS error_log (
    id TEXT PRIMARY KEY,
    correlation_id TEXT NOT NULL,
    category TEXT NOT NULL,
    code TEXT NOT NULL,
    message TEXT NOT NULL,
    stack_trace TEXT,
    context_json TEXT DEFAULT '{}',
    severity TEXT DEFAULT 'ERROR' CHECK(severity IN ('WARN','ERROR','FATAL')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 19. Encrypted Secrets Vault
  CREATE TABLE IF NOT EXISTS vault_items (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    label TEXT NOT NULL,
    type TEXT NOT NULL,
    value_enc TEXT NOT NULL,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  -- 20. Dedicated Saved Logins & Tool Registry (All Workflows)
  CREATE TABLE IF NOT EXISTS saved_logins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    website_url TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    api_key TEXT,
    notes TEXT,
    status TEXT DEFAULT 'connected' CHECK(status IN ('connected','active','needs_reconnect','pending_setup','testing')),
    is_active BOOLEAN DEFAULT 1,
    metadata TEXT DEFAULT '{}',
    last_tested DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 21. Project-Scoped RAG Document Chunks & Vector Store
  CREATE TABLE IF NOT EXISTS rag_chunks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    document_name TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER DEFAULT 0,
    keywords_json TEXT DEFAULT '[]',
    embedding_json TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  -- 22. Admin Local LLM / Cloud API Configuration
  CREATE TABLE IF NOT EXISTS admin_llm_configs (
    id TEXT PRIMARY KEY,
    provider TEXT UNIQUE NOT NULL CHECK(provider IN ('ollama', 'lmstudio', 'vllm', 'openai', 'anthropic', 'gemini', 'openrouter')),
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

  -- 24. Full Blueprint LLM Providers (Engine & Vendors)
  CREATE TABLE IF NOT EXISTS llm_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    provider_type TEXT NOT NULL CHECK(provider_type IN ('local', 'cloud', 'hybrid')),
    base_url TEXT NOT NULL,
    api_key_vault_id TEXT,
    is_active BOOLEAN DEFAULT 1,
    health_status TEXT DEFAULT 'unknown' CHECK(health_status IN ('online', 'degraded', 'offline', 'unknown')),
    latency_ms INTEGER DEFAULT 0,
    last_health_check DATETIME,
    max_concurrency INTEGER DEFAULT 4,
    config_json TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(api_key_vault_id) REFERENCES vault_items(id) ON DELETE SET NULL
  );

  -- 25. Blueprint LLM Models Registry
  CREATE TABLE IF NOT EXISTS llm_models (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    model_type TEXT NOT NULL CHECK(model_type IN ('chat', 'completion', 'embedding', 'vision', 'reasoning')),
    context_window INTEGER DEFAULT 8192,
    max_output_tokens INTEGER DEFAULT 4096,
    cost_per_million_input REAL DEFAULT 0.0,
    cost_per_million_output REAL DEFAULT 0.0,
    supports_tools BOOLEAN DEFAULT 1,
    supports_vision BOOLEAN DEFAULT 0,
    supports_streaming BOOLEAN DEFAULT 1,
    is_enabled BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(provider_id) REFERENCES llm_providers(id) ON DELETE CASCADE
  );

  -- 26. Blueprint Dynamic Pipeline Routing Rules
  CREATE TABLE IF NOT EXISTS llm_routes (
    id TEXT PRIMARY KEY,
    pipeline_id TEXT NOT NULL,
    task_priority TEXT DEFAULT 'normal' CHECK(task_priority IN ('low', 'normal', 'high', 'urgent')),
    routing_strategy TEXT DEFAULT 'local_first' CHECK(routing_strategy IN (
      'local_first', 'cloud_first', 'local_only', 'cloud_only', 'cost_optimized', 'latency_optimized'
    )),
    primary_model_id TEXT NOT NULL,
    fallback_model_id TEXT,
    temperature REAL DEFAULT 0.7 CHECK(temperature BETWEEN 0.0 AND 2.0),
    top_p REAL DEFAULT 0.9,
    timeout_ms INTEGER DEFAULT 30000,
    retry_limit INTEGER DEFAULT 2,
    system_prompt_override TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(primary_model_id) REFERENCES llm_models(id) ON DELETE RESTRICT,
    FOREIGN KEY(fallback_model_id) REFERENCES llm_models(id) ON DELETE SET NULL
  );

  -- 27. Blueprint LLM Execution & Telemetry Ledger
  CREATE TABLE IF NOT EXISTS llm_execution_logs (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    project_id TEXT,
    correlation_id TEXT NOT NULL,
    route_id TEXT,
    provider_slug TEXT NOT NULL,
    model_id TEXT NOT NULL,
    is_local BOOLEAN NOT NULL,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    latency_ms INTEGER NOT NULL,
    cost_usd REAL DEFAULT 0.0,
    status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'fallback_triggered', 'timed_out')),
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(route_id) REFERENCES llm_routes(id) ON DELETE SET NULL
  );

  -- 28. Blueprint Project Cost Quotas & Budget Guardrails
  CREATE TABLE IF NOT EXISTS llm_cost_quotas (
    id TEXT PRIMARY KEY,
    project_id TEXT UNIQUE,
    daily_budget_usd REAL DEFAULT 10.0,
    monthly_budget_usd REAL DEFAULT 150.0,
    current_day_spend REAL DEFAULT 0.0,
    current_month_spend REAL DEFAULT 0.0,
    enforce_local_failover_on_budget BOOLEAN DEFAULT 1,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  -- Performance Indexes
  CREATE INDEX IF NOT EXISTS idx_saved_logins_category ON saved_logins(category);
  CREATE INDEX IF NOT EXISTS idx_saved_logins_status ON saved_logins(status);
  CREATE INDEX IF NOT EXISTS idx_rag_chunks_project ON rag_chunks(project_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_pipeline ON tasks(pipeline);
  CREATE INDEX IF NOT EXISTS idx_leads_project ON leads(project_id);
  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  CREATE INDEX IF NOT EXISTS idx_deals_project ON deals(project_id);
  CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
  CREATE INDEX IF NOT EXISTS idx_campaigns_project ON campaigns(project_id);
  CREATE INDEX IF NOT EXISTS idx_content_project ON content_items(project_id);
  CREATE INDEX IF NOT EXISTS idx_content_date ON content_items(publish_date);
  CREATE INDEX IF NOT EXISTS idx_email_logs_lead ON email_logs(lead_id);
  CREATE INDEX IF NOT EXISTS idx_error_correlation ON error_log(correlation_id);
  CREATE INDEX IF NOT EXISTS idx_activity_project ON activity(project_id);
  CREATE INDEX IF NOT EXISTS idx_llm_configs_provider ON admin_llm_configs(provider);
  CREATE INDEX IF NOT EXISTS idx_llm_configs_active ON admin_llm_configs(is_active);
  CREATE INDEX IF NOT EXISTS idx_llm_configs_default ON admin_llm_configs(is_default);
  CREATE INDEX IF NOT EXISTS idx_llm_models_provider ON llm_models(provider_id);
  CREATE INDEX IF NOT EXISTS idx_llm_routes_pipeline ON llm_routes(pipeline_id, task_priority);
  CREATE INDEX IF NOT EXISTS idx_llm_exec_task ON llm_execution_logs(task_id);
  CREATE INDEX IF NOT EXISTS idx_llm_exec_project ON llm_execution_logs(project_id);
  CREATE INDEX IF NOT EXISTS idx_llm_exec_correlation ON llm_execution_logs(correlation_id);
  CREATE INDEX IF NOT EXISTS idx_llm_quotas_project ON llm_cost_quotas(project_id);

  -- 29. Webhook Retries & Dead-Letter Queue (Self-Healing Execution)
  CREATE TABLE IF NOT EXISTS webhook_retries (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    url TEXT NOT NULL,
    payload TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    next_retry_at DATETIME,
    last_error TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','succeeded','dead_letter')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_webhook_retries_status ON webhook_retries(status, next_retry_at);

  -- 30. Approvals (Human-in-the-Loop Governance Queue)
  CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    project_id TEXT,
    department TEXT NOT NULL CHECK(department IN ('research','sales','creative','engineering','coordination','reporting','leadership','ops')),
    agent_name TEXT NOT NULL,
    action_type TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    preview_data TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','revision_requested')),
    execution_status TEXT DEFAULT 'not_executed' CHECK(execution_status IN ('not_executed','staged','dispatched','externally_executed','execution_failed')),
    idempotency_key TEXT,
    executed_at DATETIME,
    execution_receipt TEXT,
    reviewer_id TEXT,
    reviewer_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status, department);

  -- 31. Agent Runs (Observable Execution Ledger for the 3 Core Agents)
  CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    project_id TEXT,
    agent_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    department TEXT NOT NULL CHECK(department IN ('research','sales','creative','engineering','coordination','reporting','leadership','ops')),
    skill_slug TEXT NOT NULL,
    provider TEXT,
    model TEXT,
    status TEXT NOT NULL CHECK(status IN ('running','succeeded','failed')),
    data_source TEXT NOT NULL CHECK(data_source IN ('live_llm','simulated_fallback')),
    attempt_count INTEGER DEFAULT 1,
    duration_ms INTEGER DEFAULT 0,
    error_message TEXT,
    metadata_json TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_agent_runs_task ON agent_runs(task_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent_id, status, created_at DESC);

  -- 32. External Integrations (Admin-Managed Real APIs: Web Search, Lead Discovery, Email, Ads, Social/Web)
  CREATE TABLE IF NOT EXISTS external_integrations (
    slug TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    category TEXT NOT NULL,
    provider TEXT DEFAULT '',
    endpoint_url TEXT DEFAULT '',
    api_key TEXT,
    config_json TEXT DEFAULT '{}',
    status TEXT DEFAULT 'not_configured' CHECK(status IN ('not_configured','connected','error')),
    last_tested DATETIME,
    last_error TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR IGNORE INTO external_integrations (slug, display_name, category, provider, endpoint_url, status) VALUES
    ('web_search', 'Live Web Search (Tavily / Serper)', 'research', 'tavily', 'https://api.tavily.com/search', 'not_configured'),
    ('lead_enrichment', 'Lead Discovery & Enrichment (Apollo / Hunter)', 'research', 'apollo', 'https://api.apollo.io/v1/mixed_people/search', 'not_configured'),
    ('email_dispatch', 'Email Delivery (Resend / SMTP Webhook)', 'sales', 'resend', 'https://api.resend.com/emails', 'not_configured'),
    ('ads_publish', 'Paid Ads Connector (Google / Meta Ads Webhook)', 'creative', 'webhook', '', 'not_configured'),
    ('social_publish', 'Social & Website Publish Webhook', 'creative', 'webhook', '', 'not_configured');

  -- 33. Agent Blueprints (Persistent Admin-Editable SOP & System Guidelines Injected Into Agents)
  CREATE TABLE IF NOT EXISTS agent_blueprints (
    agent_slug TEXT NOT NULL,
    tab_name TEXT NOT NULL,
    content TEXT DEFAULT '',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(agent_slug, tab_name)
  );

  -- 34. Local LLM Workers (Heartbeat & Health Registry for Vercel-to-Local Ollama Bridge)
  CREATE TABLE IF NOT EXISTS local_workers (
    worker_id TEXT PRIMARY KEY,
    hostname TEXT,
    provider TEXT DEFAULT 'ollama',
    model TEXT,
    ollama_status TEXT DEFAULT 'unknown',
    models_json TEXT DEFAULT '[]',
    status TEXT DEFAULT 'online',
    last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 35. Scheduled Email Campaigns (Timezone-Aware Smart Calendar & Auto-Send Queue)
  CREATE TABLE IF NOT EXISTS scheduled_email_campaigns (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    approval_id TEXT,
    campaign_name TEXT NOT NULL,
    subject TEXT NOT NULL,
    from_email TEXT DEFAULT '',
    lead_ids_json TEXT DEFAULT '[]',
    scheduled_at_utc TEXT NOT NULL,
    scheduled_local TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'America/Toronto',
    status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled','running','sent','partial','failed','cancelled','awaiting_approval')),
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    skipped_count INTEGER DEFAULT 0,
    last_error TEXT,
    result_json TEXT DEFAULT '{}',
    created_by TEXT,
    executed_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_sched_email_due ON scheduled_email_campaigns(status, scheduled_at_utc);

  -- 36. Lead Customized Proposals (Single Source of Truth for Outreach & Marketing Needs)
  CREATE TABLE IF NOT EXISTS lead_customized_proposals (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    lead_id TEXT NOT NULL,
    clinic_name TEXT,
    identified_gaps TEXT,
    custom_angle TEXT,
    recommended_offer TEXT,
    roi_projection TEXT,
    custom_cta TEXT,
    grounded_sources_json TEXT DEFAULT '[]',
    status TEXT DEFAULT 'grounded' CHECK(status IN ('grounded','customized','approved','archived')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, lead_id),
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_proposals_project ON lead_customized_proposals(project_id);
  CREATE INDEX IF NOT EXISTS idx_proposals_lead ON lead_customized_proposals(lead_id);

  -- 37. Lead WhatsApp Messages & Personalized Voice Notes
  CREATE TABLE IF NOT EXISTS lead_whatsapp_messages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    lead_id TEXT NOT NULL,
    clinic_name TEXT,
    phone TEXT,
    city TEXT,
    province TEXT,
    google_rating TEXT,
    review_count TEXT,
    identified_gaps TEXT,
    offer_summary TEXT,
    image_card_svg TEXT,
    image_card_url TEXT,
    voice_note_script TEXT,
    voice_note_duration_sec INTEGER DEFAULT 25,
    voice_note_audio_url TEXT,
    custom_audio_blob TEXT,
    audio_source TEXT DEFAULT 'master_human',
    whatsapp_text TEXT,
    wa_link TEXT,
    status TEXT DEFAULT 'ready' CHECK(status IN ('ready','staged','approved','sent')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, lead_id),
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_wa_project ON lead_whatsapp_messages(project_id);
  CREATE INDEX IF NOT EXISTS idx_wa_lead ON lead_whatsapp_messages(lead_id);

  -- 38. Deep Market Research Reports (Google Console, Keyword Planner, Tag Manager, SEO, GEO)
  CREATE TABLE IF NOT EXISTS market_research_reports (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    task_id TEXT,
    business_idea TEXT NOT NULL,
    target_industry TEXT,
    target_geo TEXT DEFAULT 'Global',
    competitor_urls TEXT DEFAULT '[]',
    target_audience TEXT DEFAULT '',
    tools_assigned TEXT DEFAULT '["google_search_console","keyword_planner","tag_manager","seo_engine","geo_matrix"]',
    opportunity_score INTEGER DEFAULT 85,
    executive_summary TEXT,
    market_sizing_json TEXT DEFAULT '{}',
    competitor_analysis_json TEXT DEFAULT '[]',
    opportunities_matrix_json TEXT DEFAULT '[]',
    gsc_data_json TEXT DEFAULT '{}',
    keyword_planner_data_json TEXT DEFAULT '{}',
    tag_manager_data_json TEXT DEFAULT '{}',
    seo_audit_json TEXT DEFAULT '{}',
    geo_matrix_json TEXT DEFAULT '{}',
    roadmap_json TEXT DEFAULT '{}',
    full_report_md TEXT,
    output_json TEXT DEFAULT '{}',
    allocated_logins_json TEXT DEFAULT '{}',
    browser_navigation_json TEXT DEFAULT '{}',
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_mr_project ON market_research_reports(project_id);
  CREATE INDEX IF NOT EXISTS idx_mr_task ON market_research_reports(task_id);
  `);

  // Safe runtime migrations for customizable guidelines and multi-format files
  try {
    const pragmaProjects = db.prepare("PRAGMA table_info(projects)").all();
    if (!pragmaProjects.some(c => c.name === 'guidelines')) {
      db.prepare("ALTER TABLE projects ADD COLUMN guidelines TEXT DEFAULT ''").run();
    }
    if (!pragmaProjects.some(c => c.name === 'deliverable_specs')) {
      db.prepare("ALTER TABLE projects ADD COLUMN deliverable_specs TEXT DEFAULT '{}'").run();
    }
    if (!pragmaProjects.some(c => c.name === 'custom_rules')) {
      db.prepare("ALTER TABLE projects ADD COLUMN custom_rules TEXT DEFAULT ''").run();
    }
    if (!pragmaProjects.some(c => c.name === 'updated_at')) {
      db.prepare("ALTER TABLE projects ADD COLUMN updated_at DATETIME DEFAULT NULL").run();
    }
    if (!pragmaProjects.some(c => c.name === 'department')) {
      db.prepare("ALTER TABLE projects ADD COLUMN department TEXT DEFAULT 'creative'").run();
    }

    const pragmaTasks = db.prepare("PRAGMA table_info(tasks)").all();
    if (!pragmaTasks.some(c => c.name === 'department')) {
      db.prepare("ALTER TABLE tasks ADD COLUMN department TEXT DEFAULT 'creative'").run();
    }
    if (!pragmaTasks.some(c => c.name === 'stage')) {
      db.prepare("ALTER TABLE tasks ADD COLUMN stage TEXT DEFAULT 'plan'").run();
    }
    if (!pragmaTasks.some(c => c.name === 'capability')) {
      db.prepare("ALTER TABLE tasks ADD COLUMN capability TEXT DEFAULT 'creative'").run();
    }

    // Phase 4 Governance Migration: separate approval_status from execution_status
    const pragmaApprovals = db.prepare("PRAGMA table_info(approvals)").all();
    if (!pragmaApprovals.some(c => c.name === 'execution_status')) {
      db.prepare("ALTER TABLE approvals ADD COLUMN execution_status TEXT DEFAULT 'not_executed'").run();
    }
    if (!pragmaApprovals.some(c => c.name === 'idempotency_key')) {
      db.prepare("ALTER TABLE approvals ADD COLUMN idempotency_key TEXT").run();
    }
    if (!pragmaApprovals.some(c => c.name === 'executed_at')) {
      db.prepare("ALTER TABLE approvals ADD COLUMN executed_at DATETIME").run();
    }
    if (!pragmaApprovals.some(c => c.name === 'execution_receipt')) {
      db.prepare("ALTER TABLE approvals ADD COLUMN execution_receipt TEXT").run();
    }

    const pragmaHarness = db.prepare("PRAGMA table_info(harness_files)").all();
    if (!pragmaHarness.some(c => c.name === 'file_category')) {
      db.prepare("ALTER TABLE harness_files ADD COLUMN file_category TEXT DEFAULT 'General Asset'").run();
    }

    const pragmaRag = db.prepare("PRAGMA table_info(rag_chunks)").all();
    if (!pragmaRag.some(c => c.name === 'category')) {
      db.prepare("ALTER TABLE rag_chunks ADD COLUMN category TEXT DEFAULT 'market_research'").run();
      try {
        db.prepare("CREATE INDEX IF NOT EXISTS idx_rag_chunks_category ON rag_chunks(project_id, category)").run();
      } catch (_) {}
    }

    const pragmaWa = db.prepare("PRAGMA table_info(lead_whatsapp_messages)").all();
    if (!pragmaWa.some(c => c.name === 'custom_audio_blob')) {
      db.prepare("ALTER TABLE lead_whatsapp_messages ADD COLUMN custom_audio_blob TEXT DEFAULT ''").run();
    }
    if (!pragmaWa.some(c => c.name === 'audio_source')) {
      db.prepare("ALTER TABLE lead_whatsapp_messages ADD COLUMN audio_source TEXT DEFAULT 'master_human'").run();
    }
    if (!pragmaWa.some(c => c.name === 'voice_ai_prompt_blocks')) {
      db.prepare("ALTER TABLE lead_whatsapp_messages ADD COLUMN voice_ai_prompt_blocks TEXT DEFAULT ''").run();
    }
    if (!pragmaWa.some(c => c.name === 'voice_ai_audit')) {
      db.prepare("ALTER TABLE lead_whatsapp_messages ADD COLUMN voice_ai_audit TEXT DEFAULT ''").run();
    }

    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS market_research_reports (
          id TEXT PRIMARY KEY,
          project_id TEXT,
          task_id TEXT,
          business_idea TEXT NOT NULL,
          target_industry TEXT,
          target_geo TEXT DEFAULT 'Global',
          competitor_urls TEXT DEFAULT '[]',
          target_audience TEXT DEFAULT '',
          tools_assigned TEXT DEFAULT '["google_search_console","keyword_planner","tag_manager","seo_engine","geo_matrix"]',
          opportunity_score INTEGER DEFAULT 85,
          executive_summary TEXT,
          market_sizing_json TEXT DEFAULT '{}',
          competitor_analysis_json TEXT DEFAULT '[]',
          opportunities_matrix_json TEXT DEFAULT '[]',
          gsc_data_json TEXT DEFAULT '{}',
          keyword_planner_data_json TEXT DEFAULT '{}',
          tag_manager_data_json TEXT DEFAULT '{}',
          seo_audit_json TEXT DEFAULT '{}',
          geo_matrix_json TEXT DEFAULT '{}',
          roadmap_json TEXT DEFAULT '{}',
          full_report_md TEXT,
          output_json TEXT DEFAULT '{}',
          created_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_mr_project ON market_research_reports(project_id);
        CREATE INDEX IF NOT EXISTS idx_mr_task ON market_research_reports(task_id);
      `);
    } catch (_) {}

    // Check & add columns for allocated logins and browser navigation
    try {
      const pragmaMR = db.prepare("PRAGMA table_info(market_research_reports)").all();
      if (!pragmaMR.some(c => c.name === 'allocated_logins_json')) {
        db.prepare("ALTER TABLE market_research_reports ADD COLUMN allocated_logins_json TEXT DEFAULT '{}'").run();
      }
      if (!pragmaMR.some(c => c.name === 'browser_navigation_json')) {
        db.prepare("ALTER TABLE market_research_reports ADD COLUMN browser_navigation_json TEXT DEFAULT '{}'").run();
      }
    } catch (_) {}

    // Ensure Google Tag Manager is seeded in saved_logins
    try {
      const existingGtm = db.prepare("SELECT id FROM saved_logins WHERE slug = 'google-tag-manager'").get();
      if (!existingGtm) {
        db.prepare(`
          INSERT INTO saved_logins (id, name, slug, category, website_url, username, password, api_key, notes, status, is_active, metadata, updated_at)
          VALUES ('gtm-session-01', 'Google Tag Manager', 'google-tag-manager', 'Analytics & Measurement', 'https://tagmanager.google.com', 'owner@example.com', '', null, 'Container tag management, server-side conversion telemetry, GA4 event triggers, and pixel health audits.', 'connected', 1, '{"container_id":"GTM-V589K2L","environment":"Live"}', CURRENT_TIMESTAMP)
        `).run();
      }
    } catch (_) {}

    // Multi-selection pipelines & deliverables + 3-tier Knowledge Bases (Helm, Project, Task)
    const pragmaProjectsExt = db.prepare("PRAGMA table_info(projects)").all();
    if (!pragmaProjectsExt.some(c => c.name === 'pipelines')) {
      db.prepare("ALTER TABLE projects ADD COLUMN pipelines TEXT DEFAULT '[]'").run();
    }
    if (!pragmaProjectsExt.some(c => c.name === 'deliverables')) {
      db.prepare("ALTER TABLE projects ADD COLUMN deliverables TEXT DEFAULT '[]'").run();
    }
    if (!pragmaProjectsExt.some(c => c.name === 'knowledge_notes')) {
      db.prepare("ALTER TABLE projects ADD COLUMN knowledge_notes TEXT DEFAULT ''").run();
    }

    const pragmaTasksExt = db.prepare("PRAGMA table_info(tasks)").all();
    if (!pragmaTasksExt.some(c => c.name === 'knowledge_notes')) {
      db.prepare("ALTER TABLE tasks ADD COLUMN knowledge_notes TEXT DEFAULT ''").run();
    }

    if (!pragmaHarness.some(c => c.name === 'scope')) {
      db.prepare("ALTER TABLE harness_files ADD COLUMN scope TEXT DEFAULT 'project'").run();
    }
    if (!pragmaHarness.some(c => c.name === 'task_id')) {
      db.prepare("ALTER TABLE harness_files ADD COLUMN task_id TEXT DEFAULT NULL").run();
    }

    if (!pragmaRag.some(c => c.name === 'scope')) {
      db.prepare("ALTER TABLE rag_chunks ADD COLUMN scope TEXT DEFAULT 'project'").run();
    }
    if (!pragmaRag.some(c => c.name === 'task_id')) {
      db.prepare("ALTER TABLE rag_chunks ADD COLUMN task_id TEXT DEFAULT NULL").run();
    }

    // Seed Helm System Project for Global Admin-Managed Knowledge Base
    try {
      db.prepare(`
        INSERT OR IGNORE INTO projects (id, name, client_name, goal, type, status, department)
        VALUES ('helm', 'Helm System Knowledge Base', 'Helm Operations', 'Global Master Knowledge Base for all agents and pipelines (Admin Managed)', 'helm_system', 'delivered', 'coordination')
      `).run();
    } catch (_) {}

    // Verify tasks table supports 'in_progress' and 'needs_attention'
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'").get();
    if (tableInfo && tableInfo.sql && (!tableInfo.sql.includes("'in_progress'") || !tableInfo.sql.includes('needs_attention'))) {
      db.pragma('foreign_keys = OFF');
      db.transaction(() => {
        let newSql = tableInfo.sql;
        if (!newSql.includes("'in_progress'")) {
          newSql = newSql.replace("'running'", "'running','in_progress'");
        }
        if (!newSql.includes('needs_attention')) {
          newSql = newSql.replace("'needs_fix'", "'needs_fix','needs_attention'");
        }
        db.prepare("CREATE TABLE tasks_migrated " + newSql.slice(newSql.indexOf('('))).run();
        db.prepare("INSERT INTO tasks_migrated SELECT * FROM tasks").run();
        db.prepare("DROP TABLE tasks").run();
        db.prepare("ALTER TABLE tasks_migrated RENAME TO tasks").run();
      })();
      db.pragma('foreign_keys = ON');
    }

    // Verify admin_llm_configs table supports 'openrouter'
    const llmConfigsInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='admin_llm_configs'").get();
    if (llmConfigsInfo && llmConfigsInfo.sql && !llmConfigsInfo.sql.includes("'openrouter'")) {
      db.pragma('foreign_keys = OFF');
      db.transaction(() => {
        let newSql = llmConfigsInfo.sql.replace(
          "CHECK(provider IN ('ollama', 'lmstudio', 'vllm', 'openai', 'anthropic', 'gemini'))",
          "CHECK(provider IN ('ollama', 'lmstudio', 'vllm', 'openai', 'anthropic', 'gemini', 'openrouter'))"
        );
        db.prepare("CREATE TABLE admin_llm_configs_migrated " + newSql.slice(newSql.indexOf('('))).run();
        db.prepare("INSERT INTO admin_llm_configs_migrated SELECT * FROM admin_llm_configs").run();
        db.prepare("DROP TABLE admin_llm_configs").run();
        db.prepare("ALTER TABLE admin_llm_configs_migrated RENAME TO admin_llm_configs").run();
        db.prepare("CREATE INDEX IF NOT EXISTS idx_llm_configs_provider ON admin_llm_configs(provider)").run();
        db.prepare("CREATE INDEX IF NOT EXISTS idx_llm_configs_active ON admin_llm_configs(is_active)").run();
        db.prepare("CREATE INDEX IF NOT EXISTS idx_llm_configs_default ON admin_llm_configs(is_default)").run();
      })();
      db.pragma('foreign_keys = ON');
    }

    // Check if approvals or agent_runs has old 3-department CHECK constraint
    const approvalsTable = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='approvals'").get();
    if (approvalsTable && approvalsTable.sql && !approvalsTable.sql.includes('engineering')) {
      db.pragma('foreign_keys = OFF');
      (() => {
        const newSql = approvalsTable.sql.replace(
          "CHECK(department IN ('research','sales','creative'))",
          "CHECK(department IN ('research','sales','creative','engineering','coordination','reporting','leadership','ops'))"
        );
        db.prepare("CREATE TABLE approvals_migrated " + newSql.slice(newSql.indexOf('('))).run();
        db.prepare("INSERT INTO approvals_migrated SELECT * FROM approvals").run();
        db.prepare("DROP TABLE approvals").run();
        db.prepare("ALTER TABLE approvals_migrated RENAME TO approvals").run();
        db.prepare("CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status, department)").run();
      })();
      db.pragma('foreign_keys = ON');
    }

    const agentRunsTable = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='agent_runs'").get();
    if (agentRunsTable && agentRunsTable.sql && !agentRunsTable.sql.includes('engineering')) {
      db.pragma('foreign_keys = OFF');
      (() => {
        const newSql = agentRunsTable.sql.replace(
          "CHECK(department IN ('research','sales','creative'))",
          "CHECK(department IN ('research','sales','creative','engineering','coordination','reporting','leadership','ops'))"
        );
        db.prepare("CREATE TABLE agent_runs_migrated " + newSql.slice(newSql.indexOf('('))).run();
        db.prepare("INSERT INTO agent_runs_migrated SELECT * FROM agent_runs").run();
        db.prepare("DROP TABLE agent_runs").run();
        db.prepare("ALTER TABLE agent_runs_migrated RENAME TO agent_runs").run();
        db.prepare("CREATE INDEX IF NOT EXISTS idx_agent_runs_task ON agent_runs(task_id, created_at DESC)").run();
        db.prepare("CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent_id, status, created_at DESC)").run();
      })();
      db.pragma('foreign_keys = ON');
    }

    // Add index for department task queries
    try {
      db.prepare("CREATE INDEX IF NOT EXISTS idx_tasks_dept ON tasks(department, project_id)").run();
      db.prepare("CREATE INDEX IF NOT EXISTS idx_tasks_stage ON tasks(stage)").run();
      db.prepare("CREATE INDEX IF NOT EXISTS idx_tasks_capability ON tasks(capability)").run();
    } catch (_) {}

    // Initialize Admin LLM configurations and routing rules
    const { initLLMDatabase } = require('./llmConfig');
    initLLMDatabase(db);

    // Auto-seed initial users and sample project if database is freshly created
    const { autoSeedIfEmpty } = require('./autoSeed');
    autoSeedIfEmpty(db);

    // Ensure Milestone 1 & test operational accounts exist and are seeded in development/test
    try {
      const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
      if (!isProd) {
        const bcrypt = require('bcryptjs');
        const { v4: uuidv4 } = require('uuid');
        const hash = (p) => bcrypt.hashSync(p, 10);
        const checkUser = db.prepare('SELECT id FROM users WHERE email = ?');
        const insertUser = db.prepare(
          'INSERT INTO users (id, name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?, ?)'
        );
        const defaultUsers = [
          ['Super Admin', 'admin@marketingos.local', hash('Admin123!'), 'super_admin', 'Leadership'],
          ['Sara Manager', 'manager@marketingos.local', hash('Manager123!'), 'manager', 'Growth'],
          ['Omar Member', 'member@marketingos.local', hash('Member123!'), 'member', 'Content'],
          ['Test Client (RBAC Gate)', 'client@marketingos.local', hash('Client123!'), 'client', 'Client'],
          ['Sales Lead', 'sales@marketingos.local', hash('Admin123!'), 'manager', 'Sales'],
          ['Creative Specialist', 'creative@marketingos.local', hash('Admin123!'), 'member', 'Creative'],
          ['Clinic Client', 'client@clinic.local', hash('Client123!'), 'client', 'Client']
        ];
        for (const [name, email, passHash, role, dept] of defaultUsers) {
          if (!checkUser.get(email)) {
            insertUser.run(uuidv4(), name, email, passHash, role, dept);
          }
        }
      }
    } catch (_) {}
  } catch (migErr) {
    console.warn(`[WARN] Migration check note: ${migErr.message}`);
  }
} catch (schemaErr) {
  console.error(`[CRITICAL] Error applying database schema: ${schemaErr.message}`);
  throw schemaErr;
}

// Wrap db.prepare to mirror write queries to Turso Cloud (if configured)
try {
  const turso = require('./turso');
  if (turso.isConfigured()) {
    const origPrepare = db.prepare.bind(db);
    // Exposed for critical writes that must bypass the fire-and-forget mirror
    // and await the cloud write explicitly (auth, registration, project creation).
    db.__origPrepare = origPrepare;
    db.prepare = function(sql) {
      const stmt = origPrepare(sql);
      const origRun = stmt.run.bind(stmt);
      stmt.run = function(...args) {
        const res = origRun(...args);
        if (/^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql)) {
          turso.mirrorWrite(sql, args);
        }
        return res;
      };
      return stmt;
    };
    console.log('[Turso] Cloud write-through mirroring active.');
  }
} catch (wrapErr) {
  console.warn(`[Turso] Wrapper note: ${wrapErr.message}`);
}

module.exports = db;
