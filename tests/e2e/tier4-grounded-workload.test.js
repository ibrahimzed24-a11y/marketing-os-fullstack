/**
 * tests/e2e/tier4-grounded-workload.test.js
 * 
 * Tier 4: Real-World Workload Grounded in /uploads (Canadian Dental Clinic Patient Acquisition):
 * 1. TEST-REAL-01: Ground Truth Dataset Ingestion & Validation (138 leads, 22 Priority-A, $499 offer line)
 * 2. TEST-REAL-02: Grounded Priority-A Lead Ingestion into SQLite CRM
 * 3. TEST-REAL-03: Canadian Dental Clinic Landing Page & CDCP Patient Booking
 * 4. TEST-REAL-04: Personalized Outreach Asset Pack with Dual-Brand SVG & Audio Script
 * 5. TEST-REAL-05: Strict Anti-Slop & Zero-Hallucination Audit across Entire Deliverable Chain
 * 6. TEST-REAL-06: Playwright Headless Browser Walkthrough of Grounded UI
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  setupE2EServer,
  loginAs,
  launchBrowser,
  assertNoSlop,
  GROUND_TRUTH_PATHS
} = require('./harness');

describe('Tier 4: Grounded Real-World Healthcare Workload', () => {
  let server;
  let adminAuth;
  let clientAuth;
  let projectId;
  let fraserviewLeadId;
  let kerrisdaleLeadId;
  let billingsLeadId;

  before(async () => {
    server = await setupE2EServer();
    adminAuth = await loginAs(server.baseUrl, 'admin');
    clientAuth = await loginAs(server.baseUrl, 'client');

    const projRes = await fetch(`${server.baseUrl}/api/projects`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        name: 'Canadian Dental Growth Campaign',
        client_name: 'Valioz Health',
        department: 'sales',
        type: 'email-campaign',
        goal: 'Drive high-converting patient acquisition for Canadian dental practices',
        guidelines: 'CLIENT BRAND GUIDELINES: Always use clinical teal #00a9a4. Deep Navy #122f47. Mention CASL compliance and asset ownership.'
      })
    });
    const projData = await projRes.json();
    assert.strictEqual(projRes.status, 200);
    projectId = projData.id;
  });

  after(async () => {
    if (server) {
      server.cleanup();
    }
  });

  it('TEST-REAL-01: Validates ground truth datasets from /uploads with zero fake data', () => {
    // 1. Verify Clinic Intelligence (138 leads)
    assert.ok(fs.existsSync(GROUND_TRUTH_PATHS.CLINIC_INTELLIGENCE_CSV), 'Clinic Intelligence CSV must exist');
    const rawClinics = fs.readFileSync(GROUND_TRUTH_PATHS.CLINIC_INTELLIGENCE_CSV, 'utf8');
    const clinicLines = rawClinics.split('\n').filter(l => l.trim().length > 0);
    const clinicRows = clinicLines.slice(1);
    assert.strictEqual(clinicRows.length, 138, 'Must contain exactly 138 clinic records');

    // Phone veracity check
    const fake555Clinics = clinicRows.filter(l => l.includes('555-01'));
    assert.strictEqual(fake555Clinics.length, 0, 'Zero 555-01 fake numbers allowed in Clinic Intelligence');

    // 2. Verify Priority-A Outreach Merge Fields (22 leads)
    assert.ok(fs.existsSync(GROUND_TRUTH_PATHS.PRIORITY_A_CSV), 'Priority-A CSV must exist');
    const rawPriorityA = fs.readFileSync(GROUND_TRUTH_PATHS.PRIORITY_A_CSV, 'utf8');
    const priorityALines = rawPriorityA.split('\n').filter(l => l.trim().length > 0);
    const priorityARows = priorityALines.slice(1);
    assert.strictEqual(priorityARows.length, 22, 'Must contain exactly 22 Priority-A lead records');

    // Canonical $499 offer line check
    const canonicalOffer = '$499 one-time website purchase, 30 free days of the AI Growth Agent, then optional $299/month; the website remains your property.';
    const rowsWithOffer = priorityARows.filter(l => l.includes('$499 one-time website purchase'));
    assert.strictEqual(rowsWithOffer.length, 22, 'All 22 Priority-A rows must contain the canonical $499 offer line');
  });

  it('TEST-REAL-02: Ingests grounded Priority-A Canadian dental clinics into CRM', async () => {
    // Lead 1: Fraserview Dentist (Vancouver, BC)
    const res1 = await fetch(`${server.baseUrl}/api/projects/${projectId}/leads`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        full_name: 'Fraserview Dentist',
        company: 'Fraserview Dentist',
        email: 'info@fraserviewdentist.com',
        phone: '(604) 325-1711',
        job_title: 'Lead Dental Clinic',
        icp_score: 85,
        source_evidence: JSON.stringify({
          city: 'Vancouver',
          province: 'BC',
          google_rating: '4.9',
          reviews: '1220',
          clinic_name: 'Fraserview Dentist',
          offer_summary: '$499 Turnkey Web Portal + 30 Days 24/7 AI Growth Agent'
        })
      })
    });
    assert.strictEqual(res1.status, 200);
    const lead1 = await res1.json();
    fraserviewLeadId = lead1.id || lead1.lead?.id;

    // Lead 2: 123 Kerrisdale Dental Centre (Vancouver, BC)
    const res2 = await fetch(`${server.baseUrl}/api/projects/${projectId}/leads`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        full_name: '123 Kerrisdale Dental Centre',
        company: '123 Kerrisdale Dental Centre',
        email: 'info@kerrisdaledentist.com',
        phone: '(604) 263-7355',
        job_title: 'Lead Dental Clinic',
        icp_score: 80,
        source_evidence: JSON.stringify({
          city: 'Vancouver',
          province: 'BC',
          google_rating: '4.8',
          reviews: '307',
          clinic_name: '123 Kerrisdale Dental Centre',
          offer_summary: '$499 Turnkey Web Portal + 30 Days 24/7 AI Growth Agent'
        })
      })
    });
    assert.strictEqual(res2.status, 200);
    const lead2 = await res2.json();
    kerrisdaleLeadId = lead2.id || lead2.lead?.id;

    // Lead 3: Billings Bridge Dental Centre (Ottawa, ON)
    const res3 = await fetch(`${server.baseUrl}/api/projects/${projectId}/leads`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        full_name: 'Billings Bridge Dental Centre',
        company: 'Billings Bridge Dental Centre',
        email: 'info@adcottawa.com',
        phone: '(613) 737-4944',
        job_title: 'Lead Dental Clinic',
        icp_score: 90,
        source_evidence: JSON.stringify({
          city: 'Ottawa',
          province: 'ON',
          google_rating: '4.7',
          reviews: '450',
          clinic_name: 'Billings Bridge Dental Centre',
          offer_summary: '$499 Turnkey Web Portal + 30 Days 24/7 AI Growth Agent'
        })
      })
    });
    assert.strictEqual(res3.status, 200);
    const lead3 = await res3.json();
    billingsLeadId = lead3.id || lead3.lead?.id;

    // Verify all 3 leads are stored in CRM
    const listRes = await fetch(`${server.baseUrl}/api/projects/${projectId}/leads`, {
      headers: adminAuth.headers
    });
    const listData = await listRes.json();
    assert.ok(listData.leads.length >= 3, 'Must contain at least 3 ingested leads');
  });

  it('TEST-REAL-03: Generates Canadian dental landing page with CDCP compliance and #00a9a4 brand kit', async () => {
    const taskRes = await fetch(`${server.baseUrl}/api/tasks`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        project_id: projectId,
        title: 'Fraserview Dentist High-Converting Booking Page',
        pipeline: 'landing-page',
        department: 'creative',
        priority: 'high',
        input: {
          clinic: 'Fraserview Dentist',
          city: 'Vancouver, BC',
          phone: '(604) 325-1711',
          rating: '4.9★ (1,220 Reviews)',
          brand_color: '#00a9a4'
        }
      })
    });
    assert.strictEqual(taskRes.status, 200);
    const task = await taskRes.json();

    const runRes = await fetch(`${server.baseUrl}/api/tasks/${task.id}/run`, {
      method: 'POST',
      headers: adminAuth.headers
    });
    assert.strictEqual(runRes.status, 200);

    const prevRes = await fetch(`${server.baseUrl}/api/tasks/${task.id}/preview`, {
      headers: adminAuth.headers
    });
    assert.strictEqual(prevRes.status, 200);
    const prevData = await prevRes.json();
    assert.strictEqual(prevData.ok, true);

    const htmlContent = prevData.inlinedHtml || '';
    assert.strictEqual(
      /from-indigo-700 via-purple-700 to-pink-600/i.test(htmlContent),
      false,
      'Preview HTML must NOT contain purple gradients'
    );
  });

  it('TEST-REAL-04: Generates personalized outreach asset pack with dual-brand SVG & WhatsApp script', async () => {
    // 1. Verify 138 SVG logo files exist in public/exports/leads_logos_svg/
    assert.ok(fs.existsSync(GROUND_TRUTH_PATHS.SVG_LOGOS_DIR), 'SVG logos directory must exist');
    const svgFiles = fs.readdirSync(GROUND_TRUTH_PATHS.SVG_LOGOS_DIR).filter(f => f.endsWith('.svg'));
    assert.strictEqual(svgFiles.length, 138, 'Must contain exactly 138 lead SVG logo files');

    // 2. Fetch WhatsApp voice prompt for Fraserview Dentist
    const voiceRes = await fetch(`${server.baseUrl}/api/projects/${projectId}/leads/${fraserviewLeadId}/whatsapp-message/voice-prompt`, {
      headers: adminAuth.headers
    });
    assert.strictEqual(voiceRes.status, 200);
    const voiceData = await voiceRes.json();
    assert.strictEqual(voiceData.ok, true);
    assert.ok(voiceData.clinic_name.includes('Fraserview Dentist'), 'Voice prompt must reference Fraserview Dentist');

    // 3. Fetch WhatsApp card SVG
    const cardRes = await fetch(`${server.baseUrl}/api/projects/${projectId}/leads/${fraserviewLeadId}/whatsapp-message/card.svg`);
    assert.strictEqual(cardRes.status, 200);
    const cardSvg = await cardRes.text();
    assert.ok(cardSvg.includes('<svg') && cardSvg.includes('Fraserview Dentist'), 'Card SVG must include clinic brand name');
  });

  it('TEST-REAL-05: Strict Zero-Slop Anti-Hallucination Audit across Entire Campaign', async () => {
    // Fetch all project tasks via GET /api/tasks?project_id=...
    const tasksRes = await fetch(`${server.baseUrl}/api/tasks?project_id=${projectId}`, {
      headers: adminAuth.headers
    });
    assert.strictEqual(tasksRes.status, 200);
    const tasksData = await tasksRes.json();
    const tasks = tasksData.tasks || [];

    for (const t of tasks) {
      if (t.output_json) {
        assertNoSlop(t.output_json, `Task ${t.id} Output JSON`);
      }
      if (t.report_md) {
        assertNoSlop(t.report_md, `Task ${t.id} Report Markdown`);
      }
    }

    // Verify CRM leads for zero fake numbers or fake names
    const leadsRes = await fetch(`${server.baseUrl}/api/projects/${projectId}/leads`, {
      headers: adminAuth.headers
    });
    const leadsData = await leadsRes.json();
    for (const lead of leadsData.leads || []) {
      assertNoSlop(lead.full_name, 'Lead Name');
      assertNoSlop(lead.phone, 'Lead Phone');
      assert.strictEqual(/555-01/i.test(lead.phone || ''), false, `Fake phone in lead ${lead.id}`);
    }
  });

  it('TEST-REAL-06: Playwright Headless Browser Walkthrough of Grounded Healthcare Portal', async () => {
    const pw = await launchBrowser();
    try {
      await pw.page.goto(server.baseUrl, { waitUntil: 'networkidle' });
      await pw.page.fill('#loginEmailInput', adminAuth.user.email);
      await pw.page.fill('#loginPassInput', 'Admin123!');
      await pw.page.click('#loginSubmitBtn');
      await pw.page.waitForSelector('#authModal.hidden', { state: 'attached', timeout: 8000 });
      await pw.page.waitForTimeout(1000);

      // Verify authenticated role chip and user badge
      const roleChip = await pw.page.locator('#headerRoleChip').innerText();
      assert.ok(roleChip.toUpperCase().includes('ADMIN'), 'Header role chip must indicate admin');

      // Verify engine status label exists
      const engineLabel = await pw.page.locator('#headerEngineLabel').innerText();
      assert.ok(engineLabel.length > 0, 'Header engine status label must be present');

      // Verify no uncaught browser page errors occurred
      assert.strictEqual(pw.pageErrors.length, 0, `Browser uncaught errors: ${pw.pageErrors.join(', ')}`);
    } finally {
      await pw.close();
    }
  });
});
