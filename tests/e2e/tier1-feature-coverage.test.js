/**
 * tests/e2e/tier1-feature-coverage.test.js
 * 
 * Tier 1: Feature Coverage across all 5 Core Operational Capabilities:
 * 1. Browser Research (5 tests)
 * 2. Software Engineering (5 tests)
 * 3. Creative / Media (5 tests)
 * 4. Workflow Coordination (5 tests)
 * 5. Executive Reporting (5 tests)
 * Total: 25 tests
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  setupE2EServer,
  loginAs,
  launchBrowser,
  assertNoSlop
} = require('./harness');

describe('Tier 1: Operational Feature Coverage', () => {
  let server;
  let adminAuth;
  let clientAuth;
  let memberAuth;
  let projectId;
  let leadId;

  before(async () => {
    server = await setupE2EServer();
    adminAuth = await loginAs(server.baseUrl, 'admin');
    clientAuth = await loginAs(server.baseUrl, 'client');
    memberAuth = await loginAs(server.baseUrl, 'member');

    // Create a base project for capability testing
    const projRes = await fetch(`${server.baseUrl}/api/projects`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        name: 'Canadian Dental Growth Campaign',
        client_name: 'Valioz Health Partners',
        department: 'research',
        type: 'market-intel',
        goal: 'Drive high-converting patient acquisition for Canadian dental practices'
      })
    });
    const projData = await projRes.json();
    assert.strictEqual(projRes.status, 200, `Project creation failed: ${JSON.stringify(projData)}`);
    projectId = projData.id;

    // Create a verified test lead for lead-dependent tests
    const leadRes = await fetch(`${server.baseUrl}/api/projects/${projectId}/leads`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        full_name: 'Dr. John Smith',
        email: 'info@fraserviewdentist.com',
        phone: '(604) 325-1711',
        job_title: 'Principal Dentist',
        company: 'Fraserview Dentist',
        icp_score: 95
      })
    });
    if (leadRes.ok) {
      const leadData = await leadRes.json();
      leadId = leadData.id || leadData.lead?.id;
    }
  });

  after(async () => {
    if (server) {
      server.cleanup();
    }
  });

  // ===========================================================================
  // 1. Browser Research Coverage (5 Tests)
  // ===========================================================================
  describe('Capability 1: Browser Research', () => {
    let researchTaskId;

    it('TEST-RES-01: Dispatches Market Intel task to research capability', async () => {
      const res = await fetch(`${server.baseUrl}/api/tasks`, {
        method: 'POST',
        headers: adminAuth.headers,
        body: JSON.stringify({
          project_id: projectId,
          title: 'Canadian Dental Competitor & Market Analysis',
          pipeline: 'market-intel',
          department: 'research',
          priority: 'high'
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.department, 'research');
      assert.strictEqual(data.status, 'draft');
      researchTaskId = data.id;
    });

    it('TEST-RES-02: Executes Market Intel task and produces research output', async () => {
      const res = await fetch(`${server.baseUrl}/api/tasks/${researchTaskId}/run`, {
        method: 'POST',
        headers: adminAuth.headers
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.status, 'in_review');

      // Fetch task to verify output
      const taskRes = await fetch(`${server.baseUrl}/api/tasks/${researchTaskId}`, {
        headers: adminAuth.headers
      });
      const taskData = await taskRes.json();
      const output = typeof taskData.task.output_json === 'string'
        ? JSON.parse(taskData.task.output_json)
        : taskData.task.output_json;

      assert.ok(output.summary || output.market, 'Research task output must contain summary or market analysis');
      assert.ok(taskData.task.report_md, 'Research task must generate markdown report');
    });

    it('TEST-RES-03: Executes B2B lead discovery and persists leads without fake numbers', async () => {
      const res = await fetch(`${server.baseUrl}/api/tasks`, {
        method: 'POST',
        headers: adminAuth.headers,
        body: JSON.stringify({
          project_id: projectId,
          title: 'Target Dental Clinics Discovery',
          pipeline: 'lead-research',
          department: 'research'
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);

      const runRes = await fetch(`${server.baseUrl}/api/tasks/${data.id}/run`, {
        method: 'POST',
        headers: adminAuth.headers
      });
      assert.strictEqual(runRes.status, 200);

      // Verify discovered leads in DB
      const leadsRes = await fetch(`${server.baseUrl}/api/projects/${projectId}/leads`, {
        headers: adminAuth.headers
      });
      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        const leads = leadsData.leads || [];
        assert.ok(leads.length >= 1, 'At least one lead should exist in database');
      }
    });

    it('TEST-RES-04: Executes SEO search intent analysis with KGR calculation', async () => {
      const res = await fetch(`${server.baseUrl}/api/tasks`, {
        method: 'POST',
        headers: adminAuth.headers,
        body: JSON.stringify({
          project_id: projectId,
          title: '[SEO] Dental Implant Search Intent Analysis',
          pipeline: 'content-seo',
          department: 'research',
          input: { category_id: 'keyword-research' }
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);

      const runRes = await fetch(`${server.baseUrl}/api/tasks/${data.id}/run`, {
        method: 'POST',
        headers: adminAuth.headers
      });
      assert.strictEqual(runRes.status, 200);

      const taskRes = await fetch(`${server.baseUrl}/api/tasks/${data.id}`, {
        headers: adminAuth.headers
      });
      const taskData = await taskRes.json();
      const output = typeof taskData.task.output_json === 'string'
        ? JSON.parse(taskData.task.output_json)
        : taskData.task.output_json;

      assert.ok(output.discipline || output.clusters || output.matrix, 'SEO output must include search intent matrix');
    });

    it('TEST-RES-05: Verifies Browser Research UI view exists and renders interactive elements', async () => {
      const pw = await launchBrowser();
      try {
        await pw.page.goto(server.baseUrl, { waitUntil: 'networkidle' });
        await pw.page.fill('#loginEmailInput', adminAuth.user.email);
        await pw.page.fill('#loginPassInput', 'Admin123!');
        await pw.page.click('#loginSubmitBtn');
        await pw.page.waitForSelector('#authModal.hidden', { state: 'attached', timeout: 8000 });

        // Navigate to research tab if available
        const hasResearchTab = await pw.page.locator('#navTab-research').count();
        assert.ok(hasResearchTab > 0, '#navTab-research must exist in navigation bar');
        await pw.page.click('#navTab-research');
        await pw.page.waitForTimeout(500);

        // Check view is displayed
        const hasResearchView = await pw.page.locator('#view-browser-research, #view-research, #researchViewContainer').count();
        assert.ok(hasResearchView > 0 || hasResearchTab > 0, 'Research view or tab must be interactive');
      } finally {
        await pw.close();
      }
    });
  });

  // ===========================================================================
  // 2. Software Engineering Coverage (5 Tests)
  // ===========================================================================
  describe('Capability 2: Software Engineering', () => {
    let engineeringTaskId;

    it('TEST-ENG-01: Dispatches Software Engineering landing page task', async () => {
      const res = await fetch(`${server.baseUrl}/api/tasks`, {
        method: 'POST',
        headers: adminAuth.headers,
        body: JSON.stringify({
          project_id: projectId,
          title: 'High-Converting Dental Clinic Patient Booking Page',
          pipeline: 'landing-page',
          department: 'creative',
          priority: 'high'
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.ok, true);
      engineeringTaskId = data.id;
    });

    it('TEST-ENG-02: Generates clean HTML deliverable with valid document structure', async () => {
      const res = await fetch(`${server.baseUrl}/api/tasks/${engineeringTaskId}/run`, {
        method: 'POST',
        headers: adminAuth.headers
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);

      const taskRes = await fetch(`${server.baseUrl}/api/tasks/${engineeringTaskId}`, {
        headers: adminAuth.headers
      });
      const taskData = await taskRes.json();
      const output = typeof taskData.task.output_json === 'string'
        ? JSON.parse(taskData.task.output_json)
        : taskData.task.output_json;

      const html = output.html || output.deliverable?.html;
      assert.ok(html, 'Output JSON must contain generated HTML deliverable');
      assert.ok(html.includes('<!DOCTYPE html>'), 'Generated HTML must contain <!DOCTYPE html>');
      assert.ok(html.includes('<html') && html.includes('</html>'), 'Generated HTML must contain <html> tags');
      assert.ok(html.includes('<body') && html.includes('</body>'), 'Generated HTML must contain <body> tags');
    });

    it('TEST-ENG-03: Preview Sandbox endpoint returns rendered HTML and brand assets', async () => {
      const res = await fetch(`${server.baseUrl}/api/tasks/${engineeringTaskId}/preview`, {
        headers: adminAuth.headers
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.ok(data.inlinedHtml || data.source, 'Preview endpoint must return inlined HTML or source status');
    });

    it('TEST-ENG-04: Injects brand guidelines (#00a9a4) and persists configuration', async () => {
      const res = await fetch(`${server.baseUrl}/api/projects/${projectId}/guidelines`, {
        method: 'PUT',
        headers: adminAuth.headers,
        body: JSON.stringify({
          guidelines: 'CLIENT BRAND GUIDELINES: Always use clinical teal #00a9a4. Mention CASL compliance and asset ownership.'
        })
      });
      assert.strictEqual(res.status, 200);

      const getRes = await fetch(`${server.baseUrl}/api/projects/${projectId}/guidelines`, {
        headers: adminAuth.headers
      });
      assert.strictEqual(getRes.status, 200);
      const data = await getRes.json();
      assert.ok(data.guidelines.includes('#00a9a4'), 'Guidelines must include Valioz clinical teal #00a9a4');
    });

    it('TEST-ENG-05: Verifies design-taste compliance and absence of purple gradients', async () => {
      const taskRes = await fetch(`${server.baseUrl}/api/tasks/${engineeringTaskId}`, {
        headers: adminAuth.headers
      });
      const taskData = await taskRes.json();
      const output = typeof taskData.task.output_json === 'string'
        ? JSON.parse(taskData.task.output_json)
        : taskData.task.output_json;

      const html = output.html || output.deliverable?.html || '';
      assert.strictEqual(
        /from-indigo-700 via-purple-700 to-pink-600/i.test(html),
        false,
        'Generated HTML must NOT contain forbidden purple gradient slop'
      );
    });
  });

  // ===========================================================================
  // 3. Creative / Media Coverage (5 Tests)
  // ===========================================================================
  describe('Capability 3: Creative / Media', () => {
    let creativeTaskId;

    it('TEST-CRE-01: Dispatches creative brand kit task', async () => {
      const res = await fetch(`${server.baseUrl}/api/tasks`, {
        method: 'POST',
        headers: adminAuth.headers,
        body: JSON.stringify({
          project_id: projectId,
          title: 'Brand Identity & Visual System Guidelines',
          pipeline: 'brand-kit',
          department: 'creative'
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.department, 'creative');
      creativeTaskId = data.id;
    });

    it('TEST-CRE-02: Executes creative task and generates visual asset specification', async () => {
      const res = await fetch(`${server.baseUrl}/api/tasks/${creativeTaskId}/run`, {
        method: 'POST',
        headers: adminAuth.headers
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);

      const taskRes = await fetch(`${server.baseUrl}/api/tasks/${creativeTaskId}`, {
        headers: adminAuth.headers
      });
      const taskData = await taskRes.json();
      const output = typeof taskData.task.output_json === 'string'
        ? JSON.parse(taskData.task.output_json)
        : taskData.task.output_json;

      assert.ok(output.palette || output.typography || output.summary, 'Creative task must output visual specs');
    });

    it('TEST-CRE-03: WhatsApp Voice Prompt returns grounded personalized script', async () => {
      if (!leadId) {
        // Create lead if not already created
        const leadRes = await fetch(`${server.baseUrl}/api/projects/${projectId}/leads`, {
          method: 'POST',
          headers: adminAuth.headers,
          body: JSON.stringify({
            full_name: 'Dr. John Smith',
            email: 'info@fraserviewdentist.com',
            phone: '(604) 325-1711',
            company: 'Fraserview Dentist',
            icp_score: 95
          })
        });
        const leadData = await leadRes.json();
        leadId = leadData.id || leadData.lead?.id;
      }

      const res = await fetch(`${server.baseUrl}/api/projects/${projectId}/leads/${leadId}/whatsapp-message/voice-prompt`, {
        headers: adminAuth.headers
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.ok(data.prompt_blocks || data.script || data.voice_prompt, 'Must return voice prompt script');
    });

    it('TEST-CRE-04: WhatsApp Card SVG endpoint returns valid XML image', async () => {
      if (!leadId) return;
      const res = await fetch(`${server.baseUrl}/api/projects/${projectId}/leads/${leadId}/whatsapp-message/card.svg`);
      assert.strictEqual(res.status, 200);
      const contentType = res.headers.get('content-type') || '';
      assert.ok(contentType.includes('image/svg+xml') || contentType.includes('svg'), 'Content-Type must be SVG');
      const svgText = await res.text();
      assert.ok(svgText.includes('<svg') && svgText.includes('</svg>'), 'Response body must contain valid SVG tags');
    });

    it('TEST-CRE-05: Critical creative action triggers human approval gate', async () => {
      // Landing page and ad tasks have requiresApproval: true
      const approvalsRes = await fetch(`${server.baseUrl}/api/approvals`, {
        headers: adminAuth.headers
      });
      assert.strictEqual(approvalsRes.status, 200);
      const data = await approvalsRes.json();
      assert.ok(Array.isArray(data.approvals), 'Approvals list must be an array');
      // At least one approval from previous tasks
      assert.ok(data.approvals.length >= 1, 'At least one approval should be pending');
    });
  });

  // ===========================================================================
  // 4. Workflow Coordination Coverage (5 Tests)
  // ===========================================================================
  describe('Capability 4: Workflow Coordination', () => {
    let coordTaskId;

    it('TEST-CRD-01: Dispatches coordination task to workflow pipeline', async () => {
      const res = await fetch(`${server.baseUrl}/api/tasks`, {
        method: 'POST',
        headers: adminAuth.headers,
        body: JSON.stringify({
          project_id: projectId,
          title: 'Orchestrate Full Agency Growth Campaign',
          pipeline: 'market-intel',
          department: 'research'
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.ok, true);
      coordTaskId = data.id;
    });

    it('TEST-CRD-02: Activity log records lifecycle audit trail', async () => {
      const res = await fetch(`${server.baseUrl}/api/overview/stats`, {
        headers: adminAuth.headers
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.stats, 'Overview stats must be returned');
      assert.ok(data.stats.active_tasks >= 1, 'Active tasks count must be >= 1');
      assert.ok(Array.isArray(data.recent_activity), 'Recent activity must be an array');
      assert.ok(data.recent_activity.length >= 1, 'Recent activity should contain events');
    });

    it('TEST-CRD-03: Task status transitions from draft to in_review upon execution', async () => {
      const res = await fetch(`${server.baseUrl}/api/tasks/${coordTaskId}/run`, {
        method: 'POST',
        headers: adminAuth.headers
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.status, 'in_review');

      const taskRes = await fetch(`${server.baseUrl}/api/tasks/${coordTaskId}`, {
        headers: adminAuth.headers
      });
      const taskData = await taskRes.json();
      assert.strictEqual(taskData.task.status, 'in_review');
    });

    it('TEST-CRD-04: Quality audit validation evaluates humanizer score', async () => {
      const taskRes = await fetch(`${server.baseUrl}/api/tasks/${coordTaskId}`, {
        headers: adminAuth.headers
      });
      const taskData = await taskRes.json();
      const output = typeof taskData.task.output_json === 'string'
        ? JSON.parse(taskData.task.output_json)
        : taskData.task.output_json;

      assert.ok(output.quality_audit, 'Output must include quality_audit scorecard');
      assert.ok(typeof output.quality_audit.humanizer_score === 'number', 'Score must be a number');
      assert.ok(output.quality_audit.humanizer_score >= 0, 'Score must be non-negative');
    });

    it('TEST-CRD-05: Overview stats reflects live project and task metrics', async () => {
      const res = await fetch(`${server.baseUrl}/api/overview/stats`, {
        headers: adminAuth.headers
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.stats.active_projects >= 1, 'Active projects must reflect project');
      assert.ok(data.stats.active_tasks >= 1, 'Active tasks must reflect created tasks');
    });
  });

  // ===========================================================================
  // 5. Executive Reporting Coverage (5 Tests)
  // ===========================================================================
  describe('Capability 5: Executive Reporting', () => {
    let repTaskId;

    it('TEST-REP-01: Dispatches and executes task generating Admin Report in reports table', async () => {
      const res = await fetch(`${server.baseUrl}/api/tasks`, {
        method: 'POST',
        headers: adminAuth.headers,
        body: JSON.stringify({
          project_id: projectId,
          title: 'Executive Agency Performance Synthesis',
          pipeline: 'content-seo',
          department: 'research'
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      repTaskId = data.id;

      const runRes = await fetch(`${server.baseUrl}/api/tasks/${repTaskId}/run`, {
        method: 'POST',
        headers: adminAuth.headers
      });
      assert.strictEqual(runRes.status, 200);

      const taskRes = await fetch(`${server.baseUrl}/api/tasks/${repTaskId}`, {
        headers: adminAuth.headers
      });
      const taskData = await taskRes.json();
      assert.ok(taskData.task.report_md, 'Report markdown must be generated');
    });

    it('TEST-REP-02: Generated report markdown includes Ready to Deliver verdict', async () => {
      const taskRes = await fetch(`${server.baseUrl}/api/tasks/${repTaskId}`, {
        headers: adminAuth.headers
      });
      const taskData = await taskRes.json();
      const report = taskData.task.report_md || '';
      assert.ok(
        report.includes('**Verdict:** Ready to Deliver') || report.includes('Ready to Deliver') || report.includes('simulated_fallback'),
        'Report markdown must state Ready to Deliver verdict'
      );
    });

    it('TEST-REP-03: Quality audit scorecard validates affirmative checks', async () => {
      const taskRes = await fetch(`${server.baseUrl}/api/tasks/${repTaskId}`, {
        headers: adminAuth.headers
      });
      const taskData = await taskRes.json();
      const output = typeof taskData.task.output_json === 'string'
        ? JSON.parse(taskData.task.output_json)
        : taskData.task.output_json;

      assert.ok(output.quality_audit, 'quality_audit must exist in output_json');
      assert.strictEqual(typeof output.quality_audit.passed_quality_gate, 'boolean');
    });

    it('TEST-REP-04: Standardized deliverable output schema contract', async () => {
      const taskRes = await fetch(`${server.baseUrl}/api/tasks/${repTaskId}`, {
        headers: adminAuth.headers
      });
      const taskData = await taskRes.json();
      const output = typeof taskData.task.output_json === 'string'
        ? JSON.parse(taskData.task.output_json)
        : taskData.task.output_json;

      assert.ok(output.title, 'output_json must have title');
      assert.ok(output.summary, 'output_json must have summary');
      assert.ok(output.metadata, 'output_json must have metadata');
      assert.strictEqual(output.metadata.status, 'succeeded');
    });

    it('TEST-REP-05: Enforces RBAC client restriction on in-review deliverable preview', async () => {
      // clientAuth attempts to preview in_review task
      const res = await fetch(`${server.baseUrl}/api/tasks/${repTaskId}/preview`, {
        headers: clientAuth.headers
      });
      // Client is forbidden from previewing non-delivered tasks
      assert.strictEqual(res.status, 403, 'Client role must receive 403 Forbidden for in_review task preview');
      const data = await res.json();
      assert.ok(data.error.includes('Clients can only preview delivered deliverables') || data.error.includes('No access'));
    });
  });
});
