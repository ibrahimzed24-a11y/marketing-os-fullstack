const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const dbPath = process.env.DATABASE_PATH || './data/marketing-os.db';
fs.mkdirSync(path.dirname(dbPath), {recursive:true});
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('super_admin','admin','manager','member','client')),
  avatar TEXT, department TEXT, status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, client_name TEXT, goal TEXT, type TEXT,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','in_progress','in_review','delivered','archived')),
  owner_id TEXT, progress INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(owner_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS project_members (
  id TEXT PRIMARY KEY, project_id TEXT, user_id TEXT, role_in_project TEXT DEFAULT 'member',
  UNIQUE(project_id, user_id), FOREIGN KEY(project_id) REFERENCES projects(id), FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL,
  pipeline TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'draft' CHECK(status IN ('draft','queued','running','in_review','needs_fix','delivered')),
  assignee_id TEXT, created_by TEXT, priority TEXT DEFAULT 'medium',
  harness_files TEXT DEFAULT '[]', input_json TEXT DEFAULT '{}',
  output_json TEXT DEFAULT '{}', report_md TEXT DEFAULT '',
  n8n_execution_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);
CREATE TABLE IF NOT EXISTS harness_files (
  id TEXT PRIMARY KEY, project_id TEXT, filename TEXT, original_name TEXT, mime TEXT, size INTEGER,
  uploaded_by TEXT, parsed_summary TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY, task_id TEXT, project_id TEXT, title TEXT, content_md TEXT,
  verdict TEXT DEFAULT 'pending' CHECK(verdict IN ('pending','approved','needs_fix')),
  created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY, project_id TEXT, task_id TEXT, user_id TEXT, action TEXT, meta TEXT DEFAULT '{}', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS vault_items (
  id TEXT PRIMARY KEY, project_id TEXT, label TEXT, type TEXT, value_enc TEXT, created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);
module.exports = db;
