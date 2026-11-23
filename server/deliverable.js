// Deliverable artifact persistence for Stage-5 delivery
// Survives the task runner: every delivered payload (landing pages, leads,
// market reports, WhatsApp cards, email campaigns, ad sets) is written to
// uploads/artifacts/<projectId>/<taskId>_<type>[.json]/<filename> and registered
// in the `artifacts` table so the project deliverable panel can list + download.

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Register one deliverable artifact for a task. Idempotent: a second call for the
// same (projectId, taskId, type) updates the file + artifact row.
function saveDeliverableArtifact(db, projectId, taskId, type, payload, filename, options = {}) {
  const overrideId = options.id || null;
  const id = overrideId || uuidv4();
  const u = path.join('uploads', 'artifacts', projectId);
  if (!fs.existsSync(u)) fs.mkdirSync(u, { recursive: true });
  const ext = typeof filename === 'string' && /\.[a-z0-9]{2,5}$/i.test(filename) ? filename.match(/\.[a-z0-9]{2,5}$/i)[0].toLowerCase() : '.json';
  const safe = String(filename).replace(/[^a-z0-9._-]/gi, '_').toLowerCase();
  const file = path.join(u, `${id}_${safe}`);
  fs.writeFileSync(file, typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2), 'utf-8');

  const existing = db.prepare('SELECT id FROM artifacts WHERE project_id=? AND task_id=? AND type=?').get(projectId, taskId, type);
  const now = new Date().toISOString();
  if (existing) {
    db.prepare(`UPDATE artifacts SET file_path=?, filename=?, type=?, size_bytes=?, updated_at=?, content=?
                 WHERE id=?`).run(file, filename, type, fs.statSync(file).size, now, typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2), id);
  } else {
    db.prepare(`INSERT INTO artifacts (id, project_id, task_id, type, filename, file_path, size_bytes, content, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, projectId, taskId, type, filename, file, fs.statSync(file).size, typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2), now);
  }
  return { id, filename, size_bytes: fs.statSync(file).size, download_url: `/api/artifacts/${id}/download` };
}

// List artifacts for one project (used by the deliverable panel).
function getProjectDeliverables(db, projectId) {
  return db.prepare('SELECT id, task_id, type, filename, size_bytes, created_at FROM artifacts WHERE project_id=? ORDER BY created_at DESC').all(projectId);
}

module.exports = { saveDeliverableArtifact, getProjectDeliverables };
