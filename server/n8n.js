// Calls n8n webhook for a task with timeout, dual-stack localhost / 127.0.0.1 fallback, and clean return values.
async function sendWebhook(targetUrl, payload, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timer);
    const bodyText = await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, body: bodyText };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: err.name === 'AbortError' ? 'Request timed out after 10s' : err.message };
  }
}

async function triggerN8n(task, project, harness) {
  const primaryUrl = process.env.N8N_WEBHOOK_TASK || 'http://127.0.0.1:5678/webhook/marketing-os-task';
  const callbackUrl = `http://127.0.0.1:${process.env.PORT || 3000}/api/webhooks/n8n`;

  const payload = {
    task_id: task.id,
    project_id: task.project_id,
    pipeline: task.pipeline,
    title: task.title,
    description: task.description,
    input: JSON.parse(task.input_json || '{}'),
    harness: harness || [],
    project: {
      name: project?.name || '',
      goal: project?.goal || '',
      client: project?.client_name || ''
    },
    callback_url: callbackUrl,
    api_key: process.env.OS_API_KEY || 'local-dev-key-change-me',
    timestamp: new Date().toISOString()
  };

  // Attempt 1: Primary URL
  console.log(`[n8n-client] Attempting webhook POST to: ${primaryUrl}`);
  let result = await sendWebhook(primaryUrl, payload, 10000);
  if (result.ok) {
    console.log(`[n8n-client] Webhook succeeded with status ${result.status}`);
    return { ok: true, mode: 'n8n', status: result.status, body: result.body };
  }

  // Attempt 2: Fallback URL (toggle between localhost and 127.0.0.1)
  const fallbackUrl = primaryUrl.includes('127.0.0.1')
    ? primaryUrl.replace('127.0.0.1', 'localhost')
    : primaryUrl.replace('localhost', '127.0.0.1');

  if (fallbackUrl !== primaryUrl) {
    console.log(`[n8n-client] Primary failed (${result.error || result.status}). Retrying with fallback: ${fallbackUrl}`);
    result = await sendWebhook(fallbackUrl, payload, 10000);
    if (result.ok) {
      console.log(`[n8n-client] Fallback webhook succeeded with status ${result.status}`);
      return { ok: true, mode: 'n8n', status: result.status, body: result.body };
    }
  }

  console.warn(`[n8n-client] n8n unreachable: ${result.error || `HTTP ${result.status}`}`);
  return {
    ok: false,
    mode: 'n8n',
    error: result.error || `HTTP ${result.status}: ${result.body}`,
    note: 'n8n offline or unreachable. Local fallback will execute.'
  };
}

module.exports = { triggerN8n };
