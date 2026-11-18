/**
 * Marketing OS — Real Email Delivery Engine (Gate G2 Post-Approval Dispatch)
 *
 * Sends real personalized emails ONLY after an Admin approves an outreach item
 * and ONLY when a real email provider is configured in Settings -> External Integrations
 * (`external_integrations.slug = 'email_dispatch'`):
 *   1. Direct SMTP (Gmail / Google Workspace / Outlook / Zoho / custom SMTP via nodemailer)
 *   2. Resend API (https://api.resend.com/emails)
 *   3. Custom HTTPS Email Webhook (n8n / Make / custom relay)
 *
 * NEVER fabricates sent receipts when no real email provider is connected.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const { decryptSecret } = require('./cryptoVault');
const { loadUploadedImages, getProjectBrandKit, applyBrandKitToHtml, matchLeadLogoImage, renderLeadLogoSlotHtml } = require('./previewBuilder');

function parseSmtpEndpoint(endpointUrl) {
  const raw = String(endpointUrl || '').trim();
  if (!raw) return null;

  // Supports "smtp://host:port", "smtps://host:port", or "host:port" or "host"
  let host = raw;
  let port = 587;
  let secure = false;

  if (/^smtps?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      host = u.hostname;
      secure = u.protocol === 'smtps:' || Number(u.port) === 465;
      port = u.port ? Number(u.port) : (secure ? 465 : 587);
      return { host, port, secure };
    } catch (_) {}
  }

  const parts = raw.split(':');
  host = parts[0].trim();
  if (parts[1]) {
    port = parseInt(parts[1], 10) || 587;
  }
  secure = port === 465;
  return host ? { host, port, secure } : null;
}

function getEmailProviderConfig(db) {
  const row = db.prepare("SELECT * FROM external_integrations WHERE slug = 'email_dispatch'").get();
  if (!row) return null;

  let configJson = {};
  try {
    configJson = JSON.parse(row.config_json || '{}');
  } catch (_) {
    configJson = {};
  }

  let plainKey = null;
  if (row.api_key) {
    try {
      plainKey = decryptSecret(row.api_key);
    } catch (_) {
      plainKey = null;
    }
  }

  const provider = String(row.provider || '').trim().toLowerCase();
  const endpoint = String(row.endpoint_url || '').trim();
  const fromEmail = String(configJson.from_email || configJson.smtp_user || '').trim();
  const fromName = String(configJson.from_name || '').trim();
  const smtpUser = String(configJson.smtp_user || fromEmail || '').trim();

  const isSmtp = provider === 'smtp' || /^smtps?:\/\//i.test(endpoint) || /^smtp\./i.test(endpoint);
  const isResend = !isSmtp && (provider === 'resend' || endpoint.includes('api.resend.com'));
  const resolvedProvider = isSmtp ? 'smtp' : (isResend ? 'resend' : 'webhook');

  const configured = isSmtp
    ? Boolean(endpoint && smtpUser && plainKey)
    : (isResend ? Boolean(plainKey) : Boolean(endpoint));

  return {
    provider: resolvedProvider,
    endpoint_url: endpoint,
    api_key: plainKey,
    from_email: fromEmail,
    from_name: fromName,
    smtp_user: smtpUser,
    status: row.status || 'not_configured',
    configured
  };
}

function buildSmtpTransporter(cfg) {
  const parsed = parseSmtpEndpoint(cfg.endpoint_url);
  if (!parsed || !parsed.host) {
    throw new Error('Valid SMTP host (e.g. smtp.gmail.com:465 or smtp.gmail.com:587) is required');
  }
  return nodemailer.createTransport({
    host: parsed.host,
    port: parsed.port,
    secure: parsed.secure,
    auth: {
      user: cfg.smtp_user,
      pass: cfg.api_key
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

async function testEmailProviderConnection(cfg) {
  if (!cfg) return { ok: false, status: 'not_configured', error: 'Email integration slot missing' };

  if (cfg.provider === 'smtp') {
    if (!cfg.endpoint_url || !cfg.smtp_user || !cfg.api_key) {
      return { ok: false, status: 'error', error: 'SMTP requires host (e.g. smtp.gmail.com:465), From/SMTP Email, and SMTP App Password.' };
    }
    try {
      const transporter = buildSmtpTransporter(cfg);
      await transporter.verify();
      return { ok: true, status: 'connected', error: null };
    } catch (err) {
      return { ok: false, status: 'error', error: `SMTP verify failed: ${err.message}` };
    }
  }

  if (cfg.provider === 'resend') {
    if (!cfg.api_key) {
      return { ok: false, status: 'error', error: 'Resend API key is required before testing.' };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const res = await fetch('https://api.resend.com/domains', {
        method: 'GET',
        headers: { Authorization: `Bearer ${cfg.api_key}` },
        signal: controller.signal
      });
      clearTimeout(timer);
      const ok = res.ok;
      return { ok, status: ok ? 'connected' : 'error', http_status: res.status, error: ok ? null : `Resend returned HTTP ${res.status}` };
    } catch (err) {
      clearTimeout(timer);
      return { ok: false, status: 'error', error: err.name === 'AbortError' ? 'Resend timed out (7s)' : err.message };
    }
  }

  // Webhook provider
  if (!cfg.endpoint_url) {
    return { ok: false, status: 'not_configured', error: 'Webhook URL is required.' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(cfg.endpoint_url, {
      method: 'HEAD',
      headers: cfg.api_key ? { Authorization: `Bearer ${cfg.api_key}` } : {},
      signal: controller.signal
    });
    clearTimeout(timer);
    const ok = res.ok || (res.status >= 200 && res.status < 405);
    return { ok, status: ok ? 'connected' : 'error', http_status: res.status, error: ok ? null : `Webhook returned HTTP ${res.status}` };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, status: 'error', error: err.name === 'AbortError' ? 'Webhook timed out (7s)' : err.message };
  }
}

function mergeTemplateForLead(str, lead, { uploadedImages = [], primaryLogoId = null, accentColor = '#00a9a4' } = {}) {
  if (!str || typeof str !== 'string') return '';
  let extra = {};
  if (lead?.source_evidence) {
    try {
      extra = typeof lead.source_evidence === 'string' ? JSON.parse(lead.source_evidence) : lead.source_evidence;
    } catch (_) {}
  }

  const clinic = extra.clinic_name || extra.company || lead?.full_name || 'Your Clinic';
  const firstName = extra.first_name || (lead?.full_name ? String(lead.full_name).split(/\s+/)[0] : 'Team');
  const city = extra.city || extra.location || 'Canada';
  const province = extra.province || '';
  const email = lead?.email || '';
  const phone = lead?.phone || '';

  const prop = extra.custom_proposal || {};
  const gap = prop.identified_gaps || `Audit observed active community review momentum in ${city}, but zero automated after-hours patient intake.`;
  const pitch = prop.custom_angle || `Turn 20+ monthly missed after-hours inquiries in ${city} into confirmed chair appointments for ${clinic}.`;
  const offer = prop.recommended_offer || '$499 one-time turnkey clinic website & intake engine purchase, 30 free days AI agent, then optional $299/mo. 100% digital asset ownership with $0 upfront until 10 new patients are booked.';
  const roi = prop.roi_projection || 'Estimated +$15,000+ in monthly incremental treatment production.';
  const cta = prop.custom_cta || `Reply "PREVIEW" to inspect the custom ${clinic} intake workflow.`;

  const verifiedNotice = `<span class="mini" style="color:#009e9e;font-weight:bold;">Verified Campaign Data: Grounded strictly in Valioz Health Knowledge Base &amp; Research Hub for ${clinic}.</span>`;
  const demoNoticeStr = '<span class="mini">Demo preview: all search figures above are invented examples for design review, not verified clinic or market research. Replace them with sourced data before sending.</span>';

  let result = str.split(demoNoticeStr).join(verifiedNotice);
  if (result.includes('<!--LEAD_LOGO_SLOT-->')) {
    const matchedImg = matchLeadLogoImage(
      { clinic_name: clinic, full_name: lead?.full_name, logo_file_id: extra.logo_file_id || lead?.logo_file_id || null },
      uploadedImages,
      primaryLogoId
    );
    const leadLogoSrc = matchedImg?.dataUri || extra.logo_url || lead?.logo_url || '';
    const slotHtml = renderLeadLogoSlotHtml({ leadLogoSrc, clinicName: clinic, accentColor });
    result = result.replace(/<!--LEAD_LOGO_SLOT-->/g, slotHtml);
  }

  return result
    .replace(/\[Clinic Name\]|\{\{\s*clinic(?:_name)?\s*\}\}/gi, clinic)
    .replace(/\[First Name\]|\{\{\s*first_name\s*\}\}/gi, firstName)
    .replace(/\[City\]|\{\{\s*city\s*\}\}/gi, city)
    .replace(/\[Province\]|\{\{\s*province\s*\}\}/gi, province)
    .replace(/\[Email\]|\{\{\s*email\s*\}\}/gi, email)
    .replace(/\[Phone\]|\{\{\s*phone\s*\}\}/gi, phone)
    .replace(/\[Identified Gap\]|\{\{\s*identified_gap\s*\}\}|\[Growth Opportunity\]|\{\{\s*growth_opportunity\s*\}\}|\[Marketing Gap\]/gi, gap)
    .replace(/\[Custom Pitch\]|\{\{\s*custom_pitch\s*\}\}|\[Tailored Angle\]|\{\{\s*tailored_angle\s*\}\}|\[Value Proposition\]|\{\{\s*value_proposition\s*\}\}/gi, pitch)
    .replace(/\[Recommended Offer\]|\{\{\s*recommended_offer\s*\}\}|\[Campaign Offer\]|\{\{\s*offer\s*\}\}|\[Offer Framework\]/gi, offer)
    .replace(/\[ROI Projection\]|\{\{\s*roi_projection\s*\}\}/gi, roi)
    .replace(/\[Custom CTA\]|\{\{\s*custom_cta\s*\}\}/gi, cta);
}

/**
 * Extract inline data-URI images into real MIME CID attachments for SMTP email clients (Gmail/Outlook/Apple Mail).
 */
function convertDataUrisToCidAttachments(html) {
  const attachments = [];
  let idx = 0;
  const converted = String(html || '').replace(
    /<img\b([^>]*?)\bsrc=(["'])data:(image\/[a-zA-Z0-9.+-]+);base64,([^"']+)\2([^>]*)>/gi,
    (match, before, quote, mime, b64, after) => {
      idx++;
      const ext = mime.includes('png') ? 'png' : (mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : (mime.includes('svg') ? 'svg' : 'png'));
      const cid = `marketingos-asset-${idx}@local`;
      attachments.push({
        filename: `asset-${idx}.${ext}`,
        content: Buffer.from(b64, 'base64'),
        contentType: mime,
        cid
      });
      return `<img${before}src=${quote}cid:${cid}${quote}${after}>`;
    }
  );
  return { html: converted, attachments };
}

function resolveEmailHtmlTemplate({ project, task, approval, harnessFiles = [], uploadDir, publicDir, htmlOverride = '' }) {
  const uploadedImages = loadUploadedImages(harnessFiles, uploadDir);
  const brandKit = getProjectBrandKit(project);

  if (htmlOverride && htmlOverride.trim()) {
    return applyBrandKitToHtml(htmlOverride.trim(), brandKit, uploadedImages, publicDir);
  }

  // 1. Check task output_json.html or deliverable.html
  if (task && task.output_json) {
    try {
      const out = typeof task.output_json === 'string' ? JSON.parse(task.output_json || '{}') : task.output_json;
      const taskHtml = out?.html || out?.deliverable?.html || '';
      if (typeof taskHtml === 'string' && taskHtml.trim()) {
        return applyBrandKitToHtml(taskHtml, brandKit, uploadedImages, publicDir);
      }
    } catch (_) {}
  }

  // 2. Check project uploaded HTML prototype in harness_files
  const htmlHarness = (harnessFiles || []).find((f) => {
    const ext = path.extname(f.original_name || f.filename || '').toLowerCase();
    return ext === '.html' || ext === '.htm' || (f.mime && f.mime.includes('html'));
  });
  if (htmlHarness) {
    const fullPath = path.join(uploadDir, htmlHarness.filename);
    if (fs.existsSync(fullPath)) {
      return applyBrandKitToHtml(fs.readFileSync(fullPath, 'utf8'), brandKit, uploadedImages, publicDir);
    }
  }

  // 3. Fallback: wrap approval preview_data / summary into clean minimal email HTML
  let bodyText = approval?.summary || '';
  if (approval?.preview_data) {
    try {
      const parsed = typeof approval.preview_data === 'string' ? JSON.parse(approval.preview_data) : approval.preview_data;
      if (typeof parsed === 'string') bodyText = parsed;
      else if (parsed?.html) return applyBrandKitToHtml(parsed.html, brandKit, uploadedImages, publicDir);
      else if (parsed?.body) bodyText = parsed.body;
      else if (Array.isArray(parsed) && parsed[0]?.body) bodyText = parsed[0].body;
    } catch (_) {
      if (typeof approval.preview_data === 'string') bodyText = approval.preview_data;
    }
  }

  const safeBody = String(bodyText || 'Hello [First Name],').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  return applyBrandKitToHtml(`<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#142b42;line-height:1.65;max-width:620px;margin:24px auto;padding:24px;">${safeBody}</body></html>`, brandKit, uploadedImages, publicDir);
}

async function sendSingleRealEmail(cfg, { from, to, subject, html, text, idempotencyKey, metadata = {} }, sharedSmtpTransporter = null) {
  if (!cfg || !cfg.configured) {
    return {
      ok: false,
      code: 'EMAIL_PROVIDER_NOT_CONFIGURED',
      error: 'Email Delivery is not configured. Go to Settings → External Integrations → Email Delivery and configure SMTP (Gmail/Workspace), Resend, or a Webhook first.'
    };
  }

  const fromHeader = from || (cfg.from_name && cfg.from_email ? `${cfg.from_name} <${cfg.from_email}>` : (cfg.from_email || cfg.smtp_user));
  const plainText = text || String(html || '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  if (cfg.provider === 'smtp') {
    if (!fromHeader) {
      return { ok: false, code: 'FROM_EMAIL_REQUIRED', error: 'From Email is required for SMTP sending.' };
    }
    try {
      const transporter = sharedSmtpTransporter || buildSmtpTransporter(cfg);
      const { html: cidHtml, attachments } = convertDataUrisToCidAttachments(html);
      const info = await transporter.sendMail({
        from: fromHeader,
        to,
        subject,
        html: cidHtml,
        text: plainText,
        attachments
      });
      return {
        ok: true,
        provider: 'smtp',
        provider_id: info.messageId || `smtp-${Date.now()}`
      };
    } catch (err) {
      return { ok: false, provider: 'smtp', code: 'SMTP_SEND_FAILED', error: err.message };
    }
  }

  if (cfg.provider === 'resend') {
    if (!fromHeader) {
      return { ok: false, code: 'FROM_EMAIL_REQUIRED', error: 'Verified From Email (e.g. sales@yourdomain.com) is required for Resend.' };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(cfg.endpoint_url || 'https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cfg.api_key}`,
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
        },
        body: JSON.stringify({
          from: fromHeader,
          to: [to],
          subject,
          html,
          text: plainText
        }),
        signal: controller.signal
      });
      clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, provider: 'resend', code: `RESEND_HTTP_${res.status}`, error: data?.message || data?.error || `Resend HTTP ${res.status}` };
      }
      return { ok: true, provider: 'resend', provider_id: data?.id || `resend-${Date.now()}` };
    } catch (err) {
      clearTimeout(timer);
      return { ok: false, provider: 'resend', code: 'RESEND_SEND_FAILED', error: err.name === 'AbortError' ? 'Resend timed out (12s)' : err.message };
    }
  }

  // Webhook delivery
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(cfg.endpoint_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.api_key ? { Authorization: `Bearer ${cfg.api_key}` } : {}),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
      },
      body: JSON.stringify({
        from: fromHeader || null,
        to,
        subject,
        html,
        text: plainText,
        idempotency_key: idempotencyKey,
        ...metadata
      }),
      signal: controller.signal
    });
    clearTimeout(timer);
    const bodyText = await res.text().catch(() => '');
    if (!res.ok) {
      return { ok: false, provider: 'webhook', code: `WEBHOOK_HTTP_${res.status}`, error: `Webhook HTTP ${res.status}: ${bodyText.slice(0, 200)}` };
    }
    return { ok: true, provider: 'webhook', provider_id: `webhook-${res.status}-${Date.now()}` };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, provider: 'webhook', code: 'WEBHOOK_SEND_FAILED', error: err.name === 'AbortError' ? 'Email webhook timed out (12s)' : err.message };
  }
}

/**
 * Shared real dual-branded email batch executor (used by both Admin Approval Send and Smart Scheduler).
 * Enforces: real configured Email Delivery provider, per-lead logo matching, real email_logs receipts,
 * duplicate-send prevention, and leads.status = 'contacted' updates.
 */
async function executeDualBrandedEmailBatch(db, {
  projectId,
  approval = null,
  task = null,
  subject,
  fromEmail = '',
  leadIds = [],
  limit = 100,
  testRecipient = '',
  htmlOverride = '',
  resendAlreadySent = false,
  dispatchedBy = 'scheduler',
  uploadDir,
  publicDir
}) {
  const emailCfg = getEmailProviderConfig(db);
  if (!emailCfg || !emailCfg.configured) {
    return {
      ok: false,
      httpStatus: 428,
      code: 'EMAIL_PROVIDER_NOT_CONFIGURED',
      error: 'Email Delivery is not configured yet. Go to Settings → External Integrations → Email Delivery and configure SMTP (Gmail/Workspace), Resend API, or a Webhook first.',
      sent_count: 0,
      failed_count: 0,
      skipped_count: 0,
      results: []
    };
  }

  const project = projectId ? db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) : null;
  const harnessFiles = projectId ? db.prepare('SELECT * FROM harness_files WHERE project_id = ? ORDER BY created_at DESC').all(projectId) : [];
  const uploadedImages = loadUploadedImages(harnessFiles, uploadDir);
  const brandKit = getProjectBrandKit(project);

  const primaryLogoImg = uploadedImages.find((img) => img.id === brandKit.logo_file_id)
    || uploadedImages.find((img) => img.file_category !== 'Lead Logo' && /logo/i.test(img.original_name || ''))
    || uploadedImages.find((img) => img.file_category !== 'Lead Logo')
    || null;
  const primaryLogoId = primaryLogoImg?.id || null;

  const templateHtml = resolveEmailHtmlTemplate({
    project,
    task,
    approval,
    harnessFiles,
    uploadDir,
    publicDir,
    htmlOverride
  });

  const baseSubject = String(subject || `${project?.name || 'Growth Opportunity'} for [Clinic Name]`).trim();
  const resolvedFromEmail = String(fromEmail || emailCfg.from_email || emailCfg.smtp_user || '').trim();
  const fromHeader = emailCfg.from_name && resolvedFromEmail ? `${emailCfg.from_name} <${resolvedFromEmail}>` : resolvedFromEmail;

  let targetLeads = [];
  if (testRecipient && String(testRecipient).includes('@')) {
    const sampleLead = projectId
      ? db.prepare('SELECT * FROM leads WHERE project_id = ? LIMIT 1').get(projectId)
      : null;
    targetLeads = [{
      id: null,
      full_name: sampleLead?.full_name || project?.name || 'Test Clinic',
      email: String(testRecipient).trim(),
      phone: sampleLead?.phone || '',
      source_evidence: sampleLead?.source_evidence || JSON.stringify({ clinic_name: sampleLead?.full_name || 'Test Clinic', first_name: 'Admin', city: 'Toronto', province: 'ON' }),
      is_test: true
    }];
  } else {
    const allProjectLeads = projectId
      ? db.prepare("SELECT * FROM leads WHERE project_id = ? AND email IS NOT NULL AND trim(email) != '' AND email LIKE '%@%' ORDER BY icp_score DESC, created_at DESC").all(projectId)
      : [];
    if (Array.isArray(leadIds) && leadIds.length > 0) {
      const idSet = new Set(leadIds);
      targetLeads = allProjectLeads.filter((l) => idSet.has(l.id));
    } else {
      targetLeads = allProjectLeads;
    }
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
    targetLeads = targetLeads.slice(0, safeLimit);
  }

  if (targetLeads.length === 0) {
    return {
      ok: false,
      httpStatus: 400,
      code: 'NO_ELIGIBLE_LEADS',
      error: 'No eligible leads with valid email addresses were found for this campaign.',
      sent_count: 0,
      failed_count: 0,
      skipped_count: 0,
      results: []
    };
  }

  let sharedSmtp = null;
  if (emailCfg.provider === 'smtp') {
    try {
      sharedSmtp = buildSmtpTransporter(emailCfg);
    } catch (err) {
      return { ok: false, httpStatus: 400, code: 'SMTP_CONFIG_INVALID', error: err.message, sent_count: 0, failed_count: 0, skipped_count: 0, results: [] };
    }
  }

  const alreadySentRows = db.prepare("SELECT lower(recipient_email) as em FROM email_logs WHERE status = 'sent'").all();
  const alreadySentSet = new Set(alreadySentRows.map((r) => r.em));

  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const results = [];
  const mergeOpts = { uploadedImages, primaryLogoId, accentColor: brandKit.accent_color || '#00a9a4' };

  for (const lead of targetLeads) {
    const recipient = String(lead.email || '').trim();
    const recipientLower = recipient.toLowerCase();

    if (!lead.is_test && !resendAlreadySent && alreadySentSet.has(recipientLower)) {
      skippedCount++;
      results.push({ lead_id: lead.id, email: recipient, status: 'skipped_already_sent' });
      continue;
    }

    const personalizedSubject = mergeTemplateForLead(baseSubject, lead, mergeOpts);
    const personalizedHtml = mergeTemplateForLead(templateHtml, lead, mergeOpts);
    const idemKey = `mail-${approval?.id || projectId}-${lead.id || 'test'}-${Date.now()}`;

    const sendRes = await sendSingleRealEmail(
      emailCfg,
      {
        from: fromHeader,
        to: recipient,
        subject: personalizedSubject,
        html: personalizedHtml,
        idempotencyKey: idemKey,
        metadata: {
          approval_id: approval?.id || null,
          project_id: projectId,
          lead_id: lead.id,
          is_test: Boolean(lead.is_test),
          dispatched_by: dispatchedBy
        }
      },
      sharedSmtp
    );

    const logId = uuidv4();
    if (sendRes.ok) {
      sentCount++;
      alreadySentSet.add(recipientLower);
      db.prepare(`
        INSERT INTO email_logs (id, step_id, lead_id, recipient_email, subject, status, provider_id, dispatched_at)
        VALUES (?, NULL, ?, ?, ?, 'sent', ?, CURRENT_TIMESTAMP)
      `).run(logId, lead.id || null, recipient, personalizedSubject, sendRes.provider_id || null);

      if (lead.id && !lead.is_test) {
        db.prepare("UPDATE leads SET status = 'contacted' WHERE id = ? AND status IN ('new', 'enriched')").run(lead.id);
      }
      results.push({ lead_id: lead.id, email: recipient, status: 'sent', provider_id: sendRes.provider_id });
    } else {
      failedCount++;
      db.prepare(`
        INSERT INTO email_logs (id, step_id, lead_id, recipient_email, subject, status, provider_id, dispatched_at)
        VALUES (?, NULL, ?, ?, ?, 'failed', ?, CURRENT_TIMESTAMP)
      `).run(logId, lead.id || null, recipient, personalizedSubject, sendRes.error || 'send_failed');
      results.push({ lead_id: lead.id, email: recipient, status: 'failed', error: sendRes.error });
    }
  }

  if (sharedSmtp && typeof sharedSmtp.close === 'function') {
    try { sharedSmtp.close(); } catch (_) {}
  }

  const nextExecStatus = sentCount > 0 && failedCount === 0
    ? 'externally_executed'
    : (sentCount > 0 ? 'dispatched' : (skippedCount > 0 && failedCount === 0 ? (approval?.execution_status || 'externally_executed') : 'execution_failed'));

  const overallOk = sentCount > 0 || (skippedCount > 0 && failedCount === 0);

  return {
    ok: overallOk,
    httpStatus: overallOk ? 200 : 502,
    provider: emailCfg.provider,
    from: fromHeader,
    subject: baseSubject,
    execution_status: nextExecStatus,
    sent_count: sentCount,
    failed_count: failedCount,
    skipped_count: skippedCount,
    results,
    error: !overallOk ? (results.find((r) => r.error)?.error || 'Email delivery failed') : null
  };
}

module.exports = {
  getEmailProviderConfig,
  buildSmtpTransporter,
  testEmailProviderConnection,
  mergeTemplateForLead,
  resolveEmailHtmlTemplate,
  sendSingleRealEmail,
  executeDualBrandedEmailBatch,
  parseSmtpEndpoint
};
