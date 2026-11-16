const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH || './data/marketing-os.db';

try {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
} catch (err) {
  console.error(`[CRITICAL] Failed to create database directory: ${err.message}`);
}

let db;
try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE SET NULL
  );

  -- 3. Project Membership
  CREATE TABLE IF NOT EXISTS project_members (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role_in_project TEXT DEFAULT 'member' CHECK(role_in_project IN ('owner','lead','specialist','client','member')),
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
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft','queued','running','in_review','needs_fix','delivered')),
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

    const pragmaHarness = db.prepare("PRAGMA table_info(harness_files)").all();
    if (!pragmaHarness.some(c => c.name === 'file_category')) {
      db.prepare("ALTER TABLE harness_files ADD COLUMN file_category TEXT DEFAULT 'General Asset'").run();
    }
  } catch (migErr) {
    console.warn(`[WARN] Migration check note: ${migErr.message}`);
  }
} catch (schemaErr) {
  console.error(`[CRITICAL] Error applying database schema: ${schemaErr.message}`);
  throw schemaErr;
}

module.exports = db;
