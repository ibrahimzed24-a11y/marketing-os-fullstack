/**
 * Marketing OS — Autonomy Policy Matrix & External Execution Controls (Phase 4)
 *
 * Strictly separates three independent technical states:
 *   1. task_status       : Agent artifact completion (draft -> running -> in_review -> delivered)
 *   2. approval_status   : Human sign-off (pending -> approved / rejected / revision_requested)
 *   3. execution_status  : Real external side-effect state
 *                          (not_executed -> staged -> dispatched -> externally_executed | execution_failed)
 *
 * Updating a DB status NEVER implies an email was sent or an ad campaign launched.
 */

const POLICY_MATRIX = [
  { operation: 'research', pipelines: ['market-intel', 'lead-research', 'content-seo', 'geo-research'], policy: 'automatic', requiresApproval: false, initialExecutionStatus: 'not_executed' },
  { operation: 'lead_qualification', pipelines: ['lead_qualification', 'lead-qualification'], policy: 'automatic', requiresApproval: false, initialExecutionStatus: 'not_executed' },
  { operation: 'email_drafting', pipelines: ['email-draft'], policy: 'automatic', requiresApproval: false, initialExecutionStatus: 'not_executed' },
  { operation: 'sending_emails', pipelines: ['email-campaign', 'email_send', 'outreach_dispatch'], policy: 'human_approval', requiresApproval: true, initialExecutionStatus: 'not_executed' },
  { operation: 'social_content_creation', pipelines: ['social-content'], policy: 'automatic', requiresApproval: false, initialExecutionStatus: 'not_executed' },
  { operation: 'publishing_content', pipelines: ['social_publish', 'social-publish'], policy: 'human_approval', requiresApproval: true, initialExecutionStatus: 'not_executed' },
  { operation: 'google_ads_setup', pipelines: ['ads-creative', 'ads_setup'], policy: 'automatic', requiresApproval: false, initialExecutionStatus: 'not_executed' },
  { operation: 'launching_campaigns_spending', pipelines: ['ad_launch', 'budget_spend', 'budget_allocation'], policy: 'human_approval', requiresApproval: true, initialExecutionStatus: 'not_executed' },
  { operation: 'website_changes', pipelines: ['landing-page', 'website_deploy', 'website_publish'], policy: 'stage_then_approve', requiresApproval: true, initialExecutionStatus: 'staged' },
  { operation: 'final_client_delivery', pipelines: ['final_delivery', 'deliverable_signoff'], policy: 'human_approval', requiresApproval: true, initialExecutionStatus: 'not_executed' }
];

function evaluatePolicy(actionOrPipeline = '') {
  const key = String(actionOrPipeline || '').toLowerCase().trim();
  for (const rule of POLICY_MATRIX) {
    if (
      rule.operation === key ||
      rule.pipelines.some((p) => p === key || key.includes(p.replace(/_/g, ' ')) || key.includes(p))
    ) {
      return rule;
    }
  }
  return {
    operation: 'custom_external_action',
    pipelines: [],
    policy: 'human_approval',
    requiresApproval: true,
    initialExecutionStatus: 'not_executed'
  };
}

const { decryptSecret } = require('./cryptoVault');

/**
 * Resolve configured external connector (from Admin External Integrations DB or env vars).
 * Returns null if no real external integration is configured (so we never fake execution!).
 */
function resolveExternalConnector(approval, customDb = null) {
  const text = `${approval.action_type || ''} ${approval.title || ''} ${approval.department || ''}`.toLowerCase();
  let slug = 'social_publish';
  let envUrl = process.env.EXTERNAL_EXECUTION_WEBHOOK_URL || null;

  if (text.includes('email') || text.includes('outreach')) {
    slug = 'email_dispatch';
    envUrl = process.env.EXTERNAL_EMAIL_WEBHOOK_URL || null;
  } else if (text.includes('ad') || text.includes('budget') || text.includes('campaign')) {
    slug = 'ads_publish';
    envUrl = process.env.EXTERNAL_ADS_WEBHOOK_URL || null;
  } else if (text.includes('social') || text.includes('publish') || text.includes('landing') || text.includes('website')) {
    slug = 'social_publish';
    envUrl = process.env.EXTERNAL_SOCIAL_WEBHOOK_URL || process.env.EXTERNAL_WEBSITE_DEPLOY_HOOK || null;
  }

  try {
    const targetDb = customDb || require('./db');
    const row = targetDb.prepare('SELECT * FROM external_integrations WHERE slug = ?').get(slug);
    if (row && row.endpoint_url && row.endpoint_url.trim()) {
      const decryptedKey = row.api_key ? decryptSecret(row.api_key) : null;
      const isResend = row.provider === 'resend' || row.endpoint_url.includes('api.resend.com');
      // Only treat as configured when an API key is provided for API providers, or a custom webhook URL is explicitly set
      if (isResend && decryptedKey) {
        return { url: row.endpoint_url.trim(), apiKey: decryptedKey, provider: 'resend', slug };
      }
      if (!isResend && row.status === 'connected') {
        return { url: row.endpoint_url.trim(), apiKey: decryptedKey, provider: row.provider || 'webhook', slug };
      }
    }
  } catch (err) {
    console.warn(`[approvalPolicy] Integration lookup note: ${err.message}`);
  }

  if (envUrl) {
    return { url: envUrl, apiKey: null, provider: 'webhook', slug };
  }
  return null;
}

/**
 * Execute an already-approved action via a real external connector with idempotency key.
 * If no external connector is configured by the Admin, keeps execution_status as 'staged'
 * and explicitly reports externally_executed: false (ZERO hallucinated/fake dispatches).
 */
async function dispatchExternalAction(approval, { idempotencyKey, connectorUrlOverride = null, db: customDb = null } = {}) {
  const resolved = connectorUrlOverride
    ? { url: connectorUrlOverride, apiKey: null, provider: 'webhook', slug: 'override' }
    : resolveExternalConnector(approval, customDb);
  const now = new Date().toISOString();

  if (!resolved || !resolved.url) {
    return {
      ok: true,
      externally_executed: false,
      execution_status: 'staged',
      receipt: {
        mode: 'staged_no_external_connector',
        externally_executed: false,
        idempotency_key: idempotencyKey,
        timestamp: now,
        note: 'Human approval verified and action staged. No external integration is configured by Admin in Settings → External Integrations; no external side effect was triggered.'
      }
    };
  }

  const connectorUrl = resolved.url;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const headers = {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    };
    if (resolved.apiKey) {
      headers['Authorization'] = `Bearer ${resolved.apiKey}`;
    }

    const res = await fetch(connectorUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        approval_id: approval.id,
        task_id: approval.task_id,
        project_id: approval.project_id,
        department: approval.department,
        action_type: approval.action_type,
        title: approval.title,
        preview_data: approval.preview_data,
        idempotency_key: idempotencyKey,
        dispatched_at: now
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    const bodyText = await res.text().catch(() => '');
    if (!res.ok) {
      return {
        ok: false,
        externally_executed: false,
        execution_status: 'execution_failed',
        error: `External connector returned HTTP ${res.status}`,
        receipt: {
          connector_url: connectorUrl,
          status_code: res.status,
          body: bodyText.slice(0, 300),
          idempotency_key: idempotencyKey,
          timestamp: now
        }
      };
    }

    return {
      ok: true,
      externally_executed: true,
      execution_status: 'externally_executed',
      receipt: {
        connector_url: connectorUrl,
        status_code: res.status,
        body: bodyText.slice(0, 300),
        idempotency_key: idempotencyKey,
        timestamp: now
      }
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      ok: false,
      externally_executed: false,
      execution_status: 'execution_failed',
      error: err.name === 'AbortError' ? 'External connector timed out after 10s' : err.message,
      receipt: {
        connector_url: connectorUrl,
        idempotency_key: idempotencyKey,
        timestamp: now,
        error: err.message
      }
    };
  }
}

module.exports = {
  POLICY_MATRIX,
  evaluatePolicy,
  resolveExternalConnector,
  dispatchExternalAction
};
