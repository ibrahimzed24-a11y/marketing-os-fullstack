/**
 * Marketing OS — Timezone-Aware Email Campaign Scheduler & Auto-Sender
 *
 * Runs a real background tick (and exposes `runDueScheduledCampaigns` for
 * manual/cron execution) that automatically dispatches approved dual-branded
 * email campaigns at their exact scheduled date, time, and IANA timezone.
 *
 * Rules:
 *   - Gate G2 Enforced: never auto-sends an unapproved campaign (marks 'awaiting_approval').
 *   - Zero Fake Sends: fails honestly if Email Delivery is not configured in Settings.
 *   - Atomic Claiming: prevents duplicate sends even under concurrent ticks.
 */

const { v4: uuidv4 } = require('uuid');
const { executeDualBrandedEmailBatch } = require('./emailDispatcher');

let schedulerTimer = null;
let isTicking = false;
let lastTickAt = null;

function isValidTimeZone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz.trim() });
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Convert a wall-clock date/time in an IANA timezone (e.g. "2026-11-19", "09:30", "America/Toronto")
 * to an exact UTC ISO string, accurately respecting Daylight Saving Time (DST).
 */
function zonedDateTimeToUtcIso(dateStr, timeStr, timeZone = 'America/Toronto') {
  const tz = isValidTimeZone(timeZone) ? timeZone.trim() : 'UTC';
  const dMatch = String(dateStr || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tMatch = String(timeStr || '').trim().match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!dMatch || !tMatch) {
    throw new Error('Invalid date (YYYY-MM-DD) or time (HH:MM) format');
  }

  const year = parseInt(dMatch[1], 10);
  const month = parseInt(dMatch[2], 10);
  const day = parseInt(dMatch[3], 10);
  const hour = parseInt(tMatch[1], 10);
  const minute = parseInt(tMatch[2], 10);
  const second = parseInt(tMatch[3] || '0', 10);

  const desiredWallMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  // Two-pass fixed-point adjustment cleanly resolves exact offset across DST boundaries
  let guessMs = desiredWallMs;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(fmt.formatToParts(new Date(guessMs)).map((p) => [p.type, p.value]));
    const renderedWallMs = Date.UTC(
      parseInt(parts.year, 10),
      parseInt(parts.month, 10) - 1,
      parseInt(parts.day, 10),
      parseInt(parts.hour, 10) % 24,
      parseInt(parts.minute, 10),
      parseInt(parts.second, 10)
    );
    const diff = desiredWallMs - renderedWallMs;
    guessMs += diff;
    if (diff === 0) break;
  }

  return new Date(guessMs).toISOString();
}

async function executeScheduledCampaignRow(db, sched, { uploadDir, publicDir }) {
  // 1. Gate G2 Check: Campaign MUST be linked to an approved approval item
  let approval = null;
  if (sched.approval_id) {
    approval = db.prepare('SELECT * FROM approvals WHERE id = ?').get(sched.approval_id);
  }
  if (!approval || approval.status !== 'approved') {
    const msg = !approval
      ? 'No linked approval record found. Approve a campaign in Approvals before sending.'
      : `Awaiting Admin approval (current approval status: ${approval.status}).`;
    db.prepare(`
      UPDATE scheduled_email_campaigns
      SET status = 'awaiting_approval', last_error = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(msg, sched.id);
    return { id: sched.id, status: 'awaiting_approval', message: msg };
  }

  const task = approval.task_id ? db.prepare('SELECT * FROM tasks WHERE id = ?').get(approval.task_id) : null;
  let leadIds = [];
  try {
    leadIds = JSON.parse(sched.lead_ids_json || '[]');
  } catch (_) {
    leadIds = [];
  }

  const batchRes = await executeDualBrandedEmailBatch(db, {
    projectId: sched.project_id,
    approval,
    task,
    subject: sched.subject,
    fromEmail: sched.from_email || '',
    leadIds: Array.isArray(leadIds) ? leadIds : [],
    limit: 100,
    dispatchedBy: `scheduler:${sched.created_by || 'auto'}`,
    uploadDir,
    publicDir
  });

  const finalStatus = batchRes.ok
    ? (batchRes.failed_count > 0 ? 'partial' : 'sent')
    : 'failed';
  const executedAt = new Date().toISOString();

  db.transaction(() => {
    db.prepare(`
      UPDATE scheduled_email_campaigns
      SET status = ?, sent_count = ?, failed_count = ?, skipped_count = ?, last_error = ?,
          result_json = ?, executed_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      finalStatus,
      batchRes.sent_count || 0,
      batchRes.failed_count || 0,
      batchRes.skipped_count || 0,
      batchRes.error || null,
      JSON.stringify({
        provider: batchRes.provider || null,
        results: (batchRes.results || []).slice(0, 100)
      }),
      executedAt,
      sched.id
    );

    if (approval && batchRes.sent_count > 0) {
      db.prepare(`
        UPDATE approvals
        SET execution_status = ?, executed_at = COALESCE(?, executed_at), execution_receipt = ?
        WHERE id = ?
      `).run(
        batchRes.execution_status || 'externally_executed',
        executedAt,
        JSON.stringify({
          scheduled_campaign_id: sched.id,
          provider: batchRes.provider,
          sent_count: batchRes.sent_count,
          failed_count: batchRes.failed_count,
          skipped_count: batchRes.skipped_count,
          executed_at: executedAt
        }),
        approval.id
      );
    }

    db.prepare('INSERT INTO activity (id, project_id, task_id, user_id, action, meta) VALUES (?, ?, ?, ?, ?, ?)')
      .run(
        uuidv4(),
        sched.project_id,
        approval?.task_id || null,
        null,
        `scheduled_email_${finalStatus}`,
        JSON.stringify({
          schedule_id: sched.id,
          campaign_name: sched.campaign_name,
          timezone: sched.timezone,
          sent_count: batchRes.sent_count || 0,
          failed_count: batchRes.failed_count || 0,
          error: batchRes.error || null
        })
      );
  })();

  return {
    id: sched.id,
    status: finalStatus,
    sent_count: batchRes.sent_count || 0,
    failed_count: batchRes.failed_count || 0,
    skipped_count: batchRes.skipped_count || 0,
    error: batchRes.error || null
  };
}

async function runDueScheduledCampaigns(db, { uploadDir, publicDir }) {
  if (isTicking) return { ok: true, skipped: true, reason: 'tick_in_progress', processed: [] };
  isTicking = true;
  lastTickAt = new Date().toISOString();
  const processed = [];

  try {
    // 1. Re-enable any 'awaiting_approval' schedules whose linked approval is now approved
    try {
      db.prepare(`
        UPDATE scheduled_email_campaigns
        SET status = 'scheduled', last_error = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE status = 'awaiting_approval'
          AND approval_id IN (SELECT id FROM approvals WHERE status = 'approved')
      `).run();
    } catch (_) {}

    // 2. Find due campaigns (scheduled_at_utc <= now)
    const nowIso = new Date().toISOString();
    const due = db.prepare(`
      SELECT * FROM scheduled_email_campaigns
      WHERE status = 'scheduled' AND scheduled_at_utc <= ?
      ORDER BY scheduled_at_utc ASC
      LIMIT 10
    `).all(nowIso);

    for (const row of due) {
      // Atomic claim to prevent duplicate execution
      const claim = db.prepare("UPDATE scheduled_email_campaigns SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'scheduled'")
        .run(row.id);
      if (!claim || claim.changes !== 1) continue;

      const res = await executeScheduledCampaignRow(db, row, { uploadDir, publicDir });
      processed.push(res);
    }

    return { ok: true, checked_at: nowIso, processed };
  } catch (err) {
    console.error(`[email-scheduler ERROR] Tick failed: ${err.message}`);
    return { ok: false, error: err.message, processed };
  } finally {
    isTicking = false;
  }
}

function startEmailScheduler(db, { uploadDir, publicDir, intervalMs = 15000 }) {
  if (schedulerTimer) return;
  schedulerTimer = setInterval(() => {
    runDueScheduledCampaigns(db, { uploadDir, publicDir }).catch((err) => {
      console.error(`[email-scheduler ERROR] ${err.message}`);
    });
  }, intervalMs);
  if (typeof schedulerTimer.unref === 'function') schedulerTimer.unref();
  console.log(`[email-scheduler] Smart Email Auto-Scheduler active (interval: ${intervalMs}ms)`);
}

function stopEmailScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

function getEmailSchedulerStatus() {
  return {
    is_running: Boolean(schedulerTimer),
    last_tick_at: lastTickAt
  };
}

module.exports = {
  isValidTimeZone,
  zonedDateTimeToUtcIso,
  executeScheduledCampaignRow,
  runDueScheduledCampaigns,
  startEmailScheduler,
  stopEmailScheduler,
  getEmailSchedulerStatus
};
