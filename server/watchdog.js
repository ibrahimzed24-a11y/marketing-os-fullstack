/**
 * Marketing OS — Self-Healing Execution Watchdog
 *
 * Capabilities:
 * 1. SLA Stall Detection: Detects tasks stuck in 'queued' or 'running' beyond SLA threshold (default 300s).
 * 2. Graceful Transition: Transitions stalled tasks to 'needs_attention' with admin alerts in error_log and reports.
 * 3. Webhook Exponential Backoff Retries: Queues and retries failed n8n/external webhook calls (1s, 4s, 16s).
 * 4. Dead-Letter Queue: Automatically dead-letters unrecoverable webhooks after max retries.
 * 5. Telemetry & Observability: Exposes operational status and task counters.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('./db');

let watchdogTimer = null;
let isScanning = false;
let lastScanAt = null;
let scanCount = 0;
let stuckTasksRecoveredTotal = 0;
let deadLettersTotal = 0;

const DEFAULT_SLA_SECONDS = parseInt(process.env.TASK_SLA_SECONDS || '300', 10);
const DEFAULT_SCAN_INTERVAL_MS = parseInt(process.env.WATCHDOG_INTERVAL_MS || '30000', 10);

/**
 * Scans for tasks that have remained in 'queued' or 'running' past SLA timeout.
 * Transitions stuck tasks to 'needs_attention', records error_log, activity, and admin report.
 *
 * @param {number} slaSeconds SLA threshold in seconds
 * @returns {Array<Object>} List of recovered tasks
 */
function scanStuckTasks(slaSeconds = DEFAULT_SLA_SECONDS) {
  const cutoffSeconds = Math.max(1, slaSeconds);

  // Identify tasks stuck in queued or running past cutoff
  const stuckTasks = db.prepare(`
    SELECT id, project_id, title, pipeline, status, updated_at,
           CAST((strftime('%s', 'now') - strftime('%s', updated_at)) AS INTEGER) AS duration_seconds
    FROM tasks
    WHERE status IN ('queued', 'running')
      AND (strftime('%s', 'now') - strftime('%s', updated_at)) >= ?
  `).all(cutoffSeconds);

  const recovered = [];

  for (const task of stuckTasks) {
    try {
      db.transaction(() => {
        const alertReport = [
          '# ⚠️ Watchdog SLA Timeout Alert',
          `- **Task ID:** \`${task.id}\``,
          `- **Title:** ${task.title}`,
          `- **Pipeline:** \`${task.pipeline}\``,
          `- **Previous Status:** \`${task.status}\``,
          `- **Stuck Duration:** ${task.duration_seconds} seconds (SLA threshold: ${cutoffSeconds}s)`,
          `- **Action Taken:** Automatically transitioned to \`needs_attention\` for administrative intervention.`,
          '',
          '### Root Cause Analysis',
          'The task execution exceeded the configured SLA window without receiving a progress update or completion callback.',
          'Possible causes: external n8n node failure, network partition, or execution stall.',
          '',
          '### Remediation Options',
          '1. Verify n8n workflow execution status or local fallback runner logs.',
          '2. Click **Retry Task** to re-dispatch via `/api/tasks/:id/run`.',
          '3. Update task parameters or harness inputs if payload caused downstream failure.'
        ].join('\n');

        // Atomically transition task to needs_attention
        db.prepare(`
          UPDATE tasks
          SET status = 'needs_attention',
              report_md = CASE WHEN report_md IS NULL OR report_md = '' THEN ? ELSE report_md || '\n\n' || ? END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status IN ('queued', 'running')
        `).run(alertReport, alertReport, task.id);

        // Record high-visibility error_log
        db.prepare(`
          INSERT INTO error_log (id, correlation_id, category, code, message, severity, context_json)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          uuidv4(),
          task.id,
          'TASK_WATCHDOG',
          'TASK_SLA_EXCEEDED',
          `Task "${task.title}" (${task.id}) hung in state "${task.status}" for ${task.duration_seconds}s (SLA: ${cutoffSeconds}s).`,
          'WARN',
          JSON.stringify({
            task_id: task.id,
            pipeline: task.pipeline,
            previous_status: task.status,
            duration_seconds: task.duration_seconds,
            sla_threshold_seconds: cutoffSeconds
          })
        );

        // Record audit activity
        db.prepare(`
          INSERT INTO activity (id, project_id, task_id, user_id, action, meta)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          uuidv4(),
          task.project_id,
          task.id,
          'system-watchdog',
          'task_stalled_sla_exceeded',
          JSON.stringify({
            previous_status: task.status,
            new_status: 'needs_attention',
            duration_seconds: task.duration_seconds
          })
        );

        // Insert report for admin visibility
        db.prepare(`
          INSERT INTO reports (id, task_id, project_id, title, content_md, verdict, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          uuidv4(),
          task.id,
          task.project_id,
          `⚠️ SLA Timeout: ${task.title}`,
          alertReport,
          'needs_fix',
          'system-watchdog'
        );
      })();

      stuckTasksRecoveredTotal++;
      recovered.push({
        id: task.id,
        title: task.title,
        previous_status: task.status,
        duration_seconds: task.duration_seconds
      });
      console.warn(`[watchdog] Stuck task recovered: ${task.id} (${task.title}) hung in ${task.status} for ${task.duration_seconds}s -> needs_attention`);
    } catch (err) {
      console.error(`[watchdog] Failed to recover stuck task ${task.id}: ${err.message}`);
    }
  }

  return recovered;
}

/**
 * Enqueues an outgoing webhook dispatch for exponential backoff retries.
 */
function enqueueWebhookDispatch(taskId, targetUrl, payload, maxAttempts = 3) {
  const id = uuidv4();
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  db.prepare(`
    INSERT INTO webhook_retries (id, task_id, url, payload, attempt_count, max_attempts, next_retry_at, status)
    VALUES (?, ?, ?, ?, 0, ?, datetime('now'), 'pending')
  `).run(id, taskId, targetUrl, payloadStr, maxAttempts);
  return id;
}

/**
 * Processes pending webhook retries with exponential backoff (1s, 4s, 16s).
 * If max attempts reached, marks as 'dead_letter' and alerts admins.
 */
async function processWebhookRetries() {
  const pendingRetries = db.prepare(`
    SELECT * FROM webhook_retries
    WHERE status = 'pending'
      AND (next_retry_at IS NULL OR datetime(next_retry_at) <= datetime('now'))
    ORDER BY created_at ASC
    LIMIT 20
  `).all();

  const results = [];

  for (const retry of pendingRetries) {
    const attempt = retry.attempt_count + 1;
    let success = false;
    let errorMsg = '';

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(retry.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: retry.payload,
        signal: controller.signal
      });
      clearTimeout(timer);

      if (res.ok) {
        success = true;
      } else {
        const body = await res.text().catch(() => '');
        errorMsg = `HTTP ${res.status}: ${body.slice(0, 200)}`;
      }
    } catch (err) {
      errorMsg = err.name === 'AbortError' ? 'Request timed out after 10s' : err.message;
    }

    if (success) {
      db.prepare(`
        UPDATE webhook_retries
        SET status = 'succeeded', attempt_count = ?, last_error = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(attempt, retry.id);
      results.push({ id: retry.id, task_id: retry.task_id, status: 'succeeded', attempt });
    } else {
      if (attempt >= retry.max_attempts) {
        // Dead-letter transition
        db.transaction(() => {
          db.prepare(`
            UPDATE webhook_retries
            SET status = 'dead_letter', attempt_count = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(attempt, errorMsg, retry.id);

          // Mark task as needs_attention if it was running or queued
          db.prepare(`
            UPDATE tasks
            SET status = 'needs_attention', updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status IN ('queued', 'running')
          `).run(retry.task_id);

          db.prepare(`
            INSERT INTO error_log (id, correlation_id, category, code, message, severity, context_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            uuidv4(),
            retry.task_id,
            'WEBHOOK_DISPATCH',
            'WEBHOOK_DEAD_LETTER',
            `Webhook dispatch to ${retry.url} dead-lettered after ${attempt} attempts: ${errorMsg}`,
            'ERROR',
            JSON.stringify({ retry_id: retry.id, task_id: retry.task_id, url: retry.url, attempts: attempt, last_error: errorMsg })
          );

          db.prepare(`
            INSERT INTO activity (id, project_id, task_id, user_id, action, meta)
            VALUES (?, (SELECT project_id FROM tasks WHERE id = ?), ?, 'system-watchdog', 'webhook_dead_letter', ?)
          `).run(
            uuidv4(),
            retry.task_id,
            retry.task_id,
            JSON.stringify({ url: retry.url, attempts: attempt, error: errorMsg })
          );
        })();

        deadLettersTotal++;
        results.push({ id: retry.id, task_id: retry.task_id, status: 'dead_letter', attempt, error: errorMsg });
        console.error(`[watchdog] Webhook dead-lettered for task ${retry.task_id} after ${attempt} attempts: ${errorMsg}`);
      } else {
        // Exponential backoff: 4^(attempt) seconds (Attempt 1: 4s, Attempt 2: 16s)
        const backoffSeconds = Math.min(3600, Math.pow(4, attempt));
        db.prepare(`
          UPDATE webhook_retries
          SET attempt_count = ?, last_error = ?,
              next_retry_at = datetime('now', '+' || ? || ' seconds'),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(attempt, errorMsg, backoffSeconds, retry.id);
        results.push({ id: retry.id, task_id: retry.task_id, status: 'retrying', attempt, next_retry_in_sec: backoffSeconds });
      }
    }
  }

  return results;
}

/**
 * Full watchdog scan tick (recovering stuck tasks & processing retry queues).
 */
async function runWatchdogScan(slaSeconds = DEFAULT_SLA_SECONDS) {
  if (isScanning) return { running: true, skipped: true };
  isScanning = true;
  lastScanAt = new Date().toISOString();
  scanCount++;

  try {
    const recoveredTasks = scanStuckTasks(slaSeconds);
    const retryResults = await processWebhookRetries();
    return {
      success: true,
      scanned_at: lastScanAt,
      recovered_tasks: recoveredTasks,
      webhook_retries: retryResults
    };
  } catch (err) {
    console.error(`[watchdog] Scan cycle error: ${err.message}`);
    return { success: false, error: err.message };
  } finally {
    isScanning = false;
  }
}

function startWatchdog(intervalMs = DEFAULT_SCAN_INTERVAL_MS, slaSeconds = DEFAULT_SLA_SECONDS) {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
  }
  console.log(`[watchdog] Self-healing watchdog started (interval: ${intervalMs}ms, SLA: ${slaSeconds}s)`);
  watchdogTimer = setInterval(() => {
    runWatchdogScan(slaSeconds).catch(err => {
      console.error(`[watchdog] Uncaught error in watchdog tick: ${err.message}`);
    });
  }, intervalMs);

  // Run initial scan asynchronously after 2 seconds
  setTimeout(() => runWatchdogScan(slaSeconds), 2000);

  return {
    stop: stopWatchdog,
    getStatus: getWatchdogStatus
  };
}

function stopWatchdog() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
    console.log('[watchdog] Self-healing watchdog stopped.');
  }
}

function getWatchdogStatus() {
  const queuedCount = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'queued'").get()?.count || 0;
  const runningCount = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'running'").get()?.count || 0;
  const inReviewCount = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'in_review'").get()?.count || 0;
  const deliveredCount = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'delivered'").get()?.count || 0;
  const needsAttentionCount = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status IN ('needs_attention', 'needs_fix')").get()?.count || 0;

  const pendingRetriesCount = db.prepare("SELECT COUNT(*) as count FROM webhook_retries WHERE status = 'pending'").get()?.count || 0;
  const deadLettersCount = db.prepare("SELECT COUNT(*) as count FROM webhook_retries WHERE status = 'dead_letter'").get()?.count || 0;

  return {
    active: watchdogTimer !== null,
    is_running: watchdogTimer !== null,
    scan_interval_ms: DEFAULT_SCAN_INTERVAL_MS,
    sla_timeout_seconds: DEFAULT_SLA_SECONDS,
    last_scan_at: lastScanAt,
    scan_cycles_completed: scanCount,
    metrics: {
      queued_tasks: queuedCount,
      running_tasks: runningCount,
      in_review_tasks: inReviewCount,
      delivered_tasks: deliveredCount,
      needs_attention_tasks: needsAttentionCount,
      stuck_tasks_recovered_total: stuckTasksRecoveredTotal,
      pending_webhook_retries: pendingRetriesCount,
      dead_letter_webhooks: deadLettersCount
    }
  };
}

module.exports = {
  startWatchdog,
  stopWatchdog,
  runWatchdogScan,
  scanStuckTasks,
  enqueueWebhookDispatch,
  processWebhookRetries,
  getWatchdogStatus,
  DEFAULT_SLA_SECONDS
};
