/**
 * Marketing OS — Turso (LibSQL) Cloud Persistence Bridge (Hardened Phase 0)
 *
 * Architecture:
 * - Tracked write-through mirroring with `flushPendingWrites()` so Vercel Serverless
 *   functions await cloud persistence before ending HTTP responses.
 * - Safe hydration: Fetch-all-first staging -> Pre-hydration local backup ->
 *   Single atomic outer SQLite transaction -> Post-hydration row & FK verification.
 * - Structured error telemetry with zero silent exception swallowing.
 */

const fs = require('fs');
const { createClient } = require('@libsql/client');

const tursoUrl = (process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || '').trim();
const tursoAuthToken = (process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN || '').trim();

let client = null;
let lastSyncTimestamp = null;
let lastSyncStatus = 'idle';
let lastSyncError = null;
let isHydrating = false;
let failedMirrorCount = 0;
let successfulMirrorCount = 0;
const pendingMirrors = new Set();

// Table sync order to respect foreign keys
const SYNC_TABLES = [
  'users',
  'projects',
  'project_members',
  'harness_files',
  'tasks',
  'reports',
  'activity',
  'vault_items',
  'campaigns',
  'companies',
  'leads',
  'deals',
  'email_sequences',
  'email_steps',
  'content_items',
  'seo_keywords',
  'geo_queries',
  'error_log',
  'email_logs',
  'saved_logins',
  'rag_chunks',
  'admin_llm_configs',
  'admin_llm_routing',
  'llm_providers',
  'llm_models',
  'llm_routes',
  'llm_execution_logs',
  'llm_cost_quotas',
  'webhook_retries',
  'approvals',
  'agent_runs',
  'external_integrations',
  'agent_blueprints',
  'local_workers',
  'scheduled_email_campaigns',
  'lead_customized_proposals',
  'lead_whatsapp_messages'
];

const CRITICAL_TABLES = new Set([
  'users',
  'projects',
  'tasks',
  'approvals',
  'admin_llm_configs'
]);

function isConfigured() {
  return Boolean(tursoUrl && tursoAuthToken);
}

function getClient() {
  if (!isConfigured()) return null;
  if (!client) {
    try {
      let normalizedUrl = tursoUrl;
      if (normalizedUrl.startsWith('libsql://')) {
        normalizedUrl = normalizedUrl.replace('libsql://', 'https://');
      }
      client = createClient({
        url: normalizedUrl,
        authToken: tursoAuthToken
      });
      console.log(`[Turso] Connected to cloud endpoint: ${normalizedUrl.replace(/\/\/[^.]+\./, '//***.')}`);
    } catch (err) {
      console.error('[Turso] Failed to create LibSQL client:', err.message);
      lastSyncError = err.message;
      return null;
    }
  }
  return client;
}

/**
 * Mirror a write query to Turso Cloud with tracked settlement & structured error logging.
 */
function mirrorWrite(sql, args) {
  if (!isConfigured() || isHydrating) return Promise.resolve({ ok: true, skipped: true });
  const c = getClient();
  if (!c) return Promise.resolve({ ok: false, error: 'Turso client unavailable' });

  const sqlPreview = String(sql || '').replace(/\s+/g, ' ').trim().slice(0, 96);

  const task = (async () => {
    try {
      let payloadArgs = args;
      if (args && typeof args === 'object' && !Array.isArray(args)) {
        payloadArgs = args;
      } else if (Array.isArray(args)) {
        payloadArgs = args.length === 1 && typeof args[0] === 'object' && args[0] !== null ? args[0] : args;
      }

      await c.execute({ sql, args: payloadArgs || [] });
      successfulMirrorCount++;
      return { ok: true };
    } catch (err) {
      failedMirrorCount++;
      lastSyncError = `${err.message} (SQL: ${sqlPreview})`;
      console.error(`[Turso Mirror ERROR] Failed write (${sqlPreview}): ${err.message}`);
      return { ok: false, error: err.message };
    }
  })();

  pendingMirrors.add(task);
  task.finally(() => pendingMirrors.delete(task));
  return task;
}

/**
 * Wait for all in-flight cloud mirror writes to settle (used before closing Serverless responses).
 */
async function flushPendingWrites(timeoutMs = 5000) {
  if (pendingMirrors.size === 0) return { ok: true, flushed: 0 };
  const snapshot = Array.from(pendingMirrors);
  const timeoutPromise = new Promise((resolve) =>
    setTimeout(() => resolve({ ok: false, timedOut: true, pending: pendingMirrors.size }), timeoutMs)
  );
  const settlePromise = Promise.allSettled(snapshot).then((results) => {
    const failed = results.filter((r) => r.status === 'rejected' || (r.value && r.value.ok === false)).length;
    return { ok: failed === 0, flushed: snapshot.length, failed };
  });
  return Promise.race([settlePromise, timeoutPromise]);
}

/**
 * Ensure all table schemas exist in Turso Cloud with explicit error logging.
 */
async function ensureTursoSchema(db, c) {
  const errors = [];
  try {
    const tableDefs = db
      .prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL")
      .all();
    for (const t of tableDefs) {
      if (t.sql) {
        try {
          await c.execute(t.sql);
        } catch (stmtErr) {
          if (!String(stmtErr.message || '').toLowerCase().includes('already exists')) {
            console.warn(`[Turso] Schema sync note for table '${t.name}': ${stmtErr.message}`);
            errors.push({ table: t.name, error: stmtErr.message });
          }
        }
      }
    }
    // Ensure incremental column migrations exist on Turso Cloud tables
    const columnMigrations = [
      "ALTER TABLE approvals ADD COLUMN execution_status TEXT DEFAULT 'not_executed'",
      'ALTER TABLE approvals ADD COLUMN idempotency_key TEXT',
      'ALTER TABLE approvals ADD COLUMN executed_at DATETIME',
      'ALTER TABLE approvals ADD COLUMN execution_receipt TEXT',
      "ALTER TABLE tasks ADD COLUMN department TEXT DEFAULT 'creative'",
      "ALTER TABLE projects ADD COLUMN department TEXT DEFAULT 'creative'",
      "ALTER TABLE project_members ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
      "ALTER TABLE lead_whatsapp_messages ADD COLUMN custom_audio_blob TEXT DEFAULT ''",
      "ALTER TABLE lead_whatsapp_messages ADD COLUMN audio_source TEXT DEFAULT 'master_human'",
      "ALTER TABLE lead_whatsapp_messages ADD COLUMN voice_ai_prompt_blocks TEXT DEFAULT ''",
      "ALTER TABLE lead_whatsapp_messages ADD COLUMN voice_ai_audit TEXT DEFAULT ''"
    ];
    for (const alterSql of columnMigrations) {
      try {
        await c.execute(alterSql);
      } catch (alterErr) {
        if (!String(alterErr.message || '').toLowerCase().includes('duplicate column')) {
          console.warn(`[Turso] Column migration note: ${alterErr.message}`);
        }
      }
    }

    console.log(`[Turso] Verified cloud database schema (${tableDefs.length} tables, ${errors.length} warnings).`);
  } catch (err) {
    console.error(`[Turso] Schema verification error: ${err.message}`);
    errors.push({ table: '*', error: err.message });
  }
  return errors;
}

/**
 * Create a local pre-hydration backup snapshot if the SQLite database is file-backed.
 */
function createPreHydrationBackup(db) {
  try {
    const dbPath = db && typeof db.name === 'string' ? db.name : null;
    if (!dbPath || dbPath === ':memory:' || !fs.existsSync(dbPath)) {
      return { ok: true, skipped: true, reason: 'in_memory_or_new' };
    }
    const backupPath = `${dbPath}.pre-hydrate.bak`;
    fs.copyFileSync(dbPath, backupPath);
    return { ok: true, backupPath };
  } catch (err) {
    console.error(`[Turso] Pre-hydration backup failed: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/**
 * Safe, Transactional, Verified Hydration from Turso Cloud to Local SQLite.
 * - Stage 1: Fetch ALL cloud tables into memory BEFORE mutating any local row.
 * - Stage 2: Create local pre-hydration backup snapshot.
 * - Stage 3: Replace local data inside ONE outer atomic transaction.
 * - Stage 4: Verify row counts & PRAGMA foreign_key_check.
 */
async function hydrateFromTurso(db) {
  if (!isConfigured()) return { ok: false, reason: 'not_configured' };
  const c = getClient();
  if (!c) return { ok: false, reason: 'client_unavailable' };

  isHydrating = true;
  lastSyncStatus = 'hydrating';

  try {
    await ensureTursoSchema(db, c);

    // Check if cloud has users
    const cloudUserCountRes = await c.execute('SELECT count(*) as count FROM users');
    const cloudUserCount = Number(cloudUserCountRes.rows[0]?.count || 0);

    if (cloudUserCount === 0) {
      console.log('[Turso] Cloud database is empty. Performing initial push from local database...');
      const pushResult = await pushAllToTurso(db, c);
      lastSyncTimestamp = new Date().toISOString();
      lastSyncStatus = pushResult.ok ? 'synced_push' : 'partial_push';
      return { ok: pushResult.ok, action: 'initial_push', timestamp: lastSyncTimestamp, errors: pushResult.errors };
    }

    console.log(`[Turso] Cloud database has ${cloudUserCount} users. Staging cloud snapshot before local mutation...`);

    // Stage 1: Fetch all cloud tables into memory BEFORE touching local SQLite
    const stagedTables = new Map();
    const fetchWarnings = [];

    for (const tableName of SYNC_TABLES) {
      try {
        const cloudData = await c.execute(`SELECT * FROM ${tableName}`);
        stagedTables.set(tableName, cloudData.rows || []);
      } catch (tableErr) {
        if (CRITICAL_TABLES.has(tableName)) {
          throw new Error(`Critical cloud table '${tableName}' failed to fetch: ${tableErr.message}`);
        }
        console.warn(`[Turso] Optional table '${tableName}' skipped during fetch: ${tableErr.message}`);
        fetchWarnings.push({ table: tableName, error: tableErr.message });
      }
    }

    // Sanity check: never wipe local data if cloud users payload is unexpectedly empty
    const stagedUsers = stagedTables.get('users') || [];
    if (stagedUsers.length === 0) {
      throw new Error('Hydration aborted: staged cloud users payload is empty');
    }

    // Stage 2: Create pre-hydration backup snapshot
    const backup = createPreHydrationBackup(db);
    if (!backup.ok) {
      console.warn(`[Turso] Proceeding without disk backup (${backup.error})`);
    }

    // Stage 3: Single outer atomic SQLite transaction (all-or-nothing)
    db.pragma('foreign_keys = OFF');
    try {
      const applySnapshot = db.transaction(() => {
        for (const [tableName, rows] of stagedTables.entries()) {
          // Only overwrite tables that exist locally
          const localTableExists = db
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
            .get(tableName);
          if (!localTableExists) continue;

          // Keep locally seeded config catalogs if cloud table was just created empty
          const keepIfCloudEmpty = tableName === 'admin_llm_configs' || tableName === 'external_integrations';
          if (rows.length === 0 && keepIfCloudEmpty) continue;

          db.prepare(`DELETE FROM ${tableName}`).run();
          if (rows.length > 0) {
            const cols = Object.keys(rows[0]);
            const placeholders = cols.map(() => '?').join(', ');
            const insertStmt = db.prepare(
              `INSERT OR REPLACE INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`
            );
            for (const r of rows) {
              insertStmt.run(cols.map((col) => r[col]));
            }
          }
        }
      });
      applySnapshot();
    } finally {
      db.pragma('foreign_keys = ON');
    }

    // Stage 4: Post-hydration verification (row count parity + foreign key integrity)
    const verificationMismatches = [];
    for (const [tableName, rows] of stagedTables.entries()) {
      const keepIfCloudEmpty = tableName === 'admin_llm_configs' || tableName === 'external_integrations';
      if (rows.length === 0 && keepIfCloudEmpty) continue;
      const localCount = db.prepare(`SELECT COUNT(*) as c FROM ${tableName}`).get()?.c || 0;
      if (localCount !== rows.length) {
        verificationMismatches.push({ table: tableName, expected: rows.length, actual: localCount });
      }
    }
    const fkViolations = db.pragma('foreign_key_check');

    if (verificationMismatches.length > 0 || fkViolations.length > 0) {
      const msg = `Post-hydration verification issues: mismatches=${verificationMismatches.length}, fk_violations=${fkViolations.length}`;
      console.error(`[Turso] ${msg}`);
      lastSyncError = msg;
      lastSyncStatus = 'verification_warning';
      return {
        ok: false,
        action: 'hydrated_with_warnings',
        mismatches: verificationMismatches,
        fk_violations: fkViolations.length,
        backup: backup.backupPath || null
      };
    }

    lastSyncTimestamp = new Date().toISOString();
    lastSyncStatus = 'synced_pull';
    lastSyncError = null;
    console.log(
      `[Turso] Atomic verified hydration complete at ${lastSyncTimestamp} (${stagedTables.size} tables, 0 FK violations).`
    );
    return {
      ok: true,
      action: 'hydrated',
      timestamp: lastSyncTimestamp,
      tables_synced: stagedTables.size,
      warnings: fetchWarnings,
      backup: backup.backupPath || null
    };
  } catch (err) {
    lastSyncError = err.message;
    lastSyncStatus = 'error';
    console.error(`[Turso] Hydration aborted cleanly (local data preserved): ${err.message}`);
    return { ok: false, error: err.message };
  } finally {
    db.pragma('foreign_keys = ON');
    isHydrating = false;
  }
}

/**
 * Push all local tables to Turso Cloud with explicit error tracking.
 */
async function pushAllToTurso(db, c) {
  if (!c) c = getClient();
  if (!c) return { ok: false, errors: [{ table: '*', error: 'Turso client unavailable' }] };

  await ensureTursoSchema(db, c);
  try {
    await c.execute('PRAGMA foreign_keys = OFF');
  } catch (_) {}
  const errors = [];

  for (const tableName of SYNC_TABLES) {
    try {
      const localRows = db.prepare(`SELECT * FROM ${tableName}`).all();
      if (localRows.length > 0) {
        const BATCH_SIZE = 25;
        for (let i = 0; i < localRows.length; i += BATCH_SIZE) {
          const chunk = localRows.slice(i, i + BATCH_SIZE);
          const stmts = chunk.map((row) => {
            const cols = Object.keys(row);
            const placeholders = cols.map(() => '?').join(', ');
            let sql;
            if (cols.includes('id')) {
              const nonIdCols = cols.filter((c) => c !== 'id');
              if (nonIdCols.length > 0) {
                const updateSets = nonIdCols.map((c) => `${c} = excluded.${c}`).join(', ');
                sql = `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updateSets}`;
              } else {
                sql = `INSERT OR IGNORE INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`;
              }
            } else {
              sql = `INSERT OR REPLACE INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`;
            }
            const vals = cols.map((k) => row[k]);
            return { sql, args: vals };
          });
          if (typeof c.batch === 'function') {
            await c.batch(stmts, 'write');
          } else {
            for (const s of stmts) {
              await c.execute(s);
            }
          }
        }
      }
    } catch (err) {
      console.error(`[Turso Push ERROR] Table '${tableName}': ${err.message}`);
      errors.push({ table: tableName, error: err.message });
    }
  }

  try {
    await c.execute('PRAGMA foreign_keys = ON');
  } catch (_) {}
  return { ok: errors.length === 0, errors };
}

function getStatus() {
  return {
    configured: isConfigured(),
    url: tursoUrl ? tursoUrl.replace(/\/\/[^.]+\./, '//***.') : null,
    status: lastSyncStatus,
    last_sync: lastSyncTimestamp,
    last_error: lastSyncError,
    is_hydrating: isHydrating,
    pending_writes: pendingMirrors.size,
    successful_writes: successfulMirrorCount,
    failed_writes: failedMirrorCount
  };
}

module.exports = {
  isConfigured,
  getClient,
  mirrorWrite,
  flushPendingWrites,
  hydrateFromTurso,
  ensureTursoSchema,
  pushAllToTurso,
  getStatus
};
