/**
 * tests/e2e/tier6-deep-market-research.test.js
 * Comprehensive verification of the 5-Tool Deep Market Research Engine
 * Tools: Google Search Console, Keyword Planner, Tag Manager, SEO Engine, GEO Matrix
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupE2EServer, loginAs, assertNoSlop } = require('./harness');

describe('Tier 6: 5-Tool Deep Market Research Engine for Any Business Idea', () => {
  let server;
  let adminAuth;
  let createdReportId;

  before(async () => {
    server = await setupE2EServer();
    adminAuth = await loginAs(server.baseUrl, 'admin');
  });

  after(async () => {
    if (server && server.cleanup) {
      server.cleanup();
    }
  });

  it('TEST-MR-01: Rejects research request when business_idea is missing or blank', async () => {
    const res = await fetch(`${server.baseUrl}/api/market-research`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        business_idea: '   ',
        target_geo: 'Canada'
      })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('business_idea is required'));
  });

  it('TEST-MR-02: Executes Deep Market Research for an arbitrary business idea across all 5 assigned tools', async () => {
    const res = await fetch(`${server.baseUrl}/api/market-research`, {
      method: 'POST',
      headers: adminAuth.headers,
      body: JSON.stringify({
        business_idea: 'AI-Powered Cold Outreach Engine for B2B SaaS',
        target_geo: 'United States (National - NY, CA, FL, TX)',
        target_audience: 'B2B SaaS Founders & Sales Leaders',
        competitors: ['Apollo.io', 'Instantly.ai', 'Lemlist'],
        tools_assigned: ['google_search_console', 'keyword_planner', 'tag_manager', 'seo_engine', 'geo_matrix']
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.ok(data.report, 'Must return saved report record');
    assert.ok(data.task_id, 'Must return associated task id');
    createdReportId = data.report.id;

    const out = data.output;
    assert.ok(out, 'Must contain structured output JSON');
    assert.strictEqual(out.business_idea, 'AI-Powered Cold Outreach Engine for B2B SaaS');

    // Verify all 5 assigned tools are present
    assert.deepStrictEqual(out.tools_assigned, [
      'google_search_console',
      'keyword_planner',
      'tag_manager',
      'seo_engine',
      'geo_matrix'
    ]);

    // Tool 1: Google Search Console
    assert.ok(out.google_search_console, 'Google Search Console block must exist');
    assert.ok(out.google_search_console.top_queries.length >= 2, 'GSC top queries must exist');
    assert.ok(out.google_search_console.quick_leap_opportunities.length >= 1, 'GSC leap opportunities must exist');

    // Tool 2: Google Keyword Planner
    assert.ok(out.google_keyword_planner, 'Google Keyword Planner block must exist');
    assert.ok(out.google_keyword_planner.high_intent_keywords.length >= 2, 'GKP keyword clusters must exist');
    assert.ok(out.google_keyword_planner.high_intent_keywords[0].low_cpc, 'GKP must have low range CPC');
    assert.ok(out.google_keyword_planner.high_intent_keywords[0].high_cpc, 'GKP must have high range CPC');

    // Tool 3: Google Tag Manager
    assert.ok(out.google_tag_manager, 'Google Tag Manager block must exist');
    assert.ok(out.google_tag_manager.audited_tags.length >= 2, 'GTM audited tags must exist');
    assert.ok(out.google_tag_manager.funnel_leak_risk, 'GTM funnel leak risk must be documented');

    // Tool 4: SEO Competitor & KGR Engine
    assert.ok(out.seo_competitor_audit, 'SEO Competitor block must exist');
    assert.ok(out.seo_competitor_audit.kgr_fast_wins.length >= 2, 'KGR fast wins must exist');
    assert.ok(out.seo_competitor_audit.kgr_fast_wins[0].kgr < 0.25, 'KGR score must be under 0.25');

    // Tool 5: GEO Search Matrix
    assert.ok(out.geo_search_matrix, 'GEO Search Matrix block must exist');
    assert.ok(out.geo_search_matrix.regional_breakdown.length >= 2, 'Regional breakdown must exist');
    assert.ok(out.geo_search_matrix.regional_breakdown[0].demand_index > 0, 'Demand index must be > 0');

    // Competitors & Opportunities
    assert.ok(out.competitor_analysis.length >= 2, 'At least 2 competitors analyzed');
    assert.ok(out.opportunities_matrix.length >= 2, 'At least 2 strategic opportunities documented');

    // Report Markdown Contract
    assert.ok(data.report_md.includes('**Verdict:** Ready to Deliver'), 'Report must end with Ready to Deliver verdict');
    assert.ok(data.report_md.includes('Google Search Console (GSC) Intelligence'), 'Report must document GSC');
    assert.ok(data.report_md.includes('Google Keyword Planner (GKP)'), 'Report must document GKP');
    assert.ok(data.report_md.includes('Google Tag Manager (GTM)'), 'Report must document GTM');
    assert.ok(data.report_md.includes('SEO Competitor Teardown'), 'Report must document SEO');
    assert.ok(data.report_md.includes('GEO & Regional Search Intent Matrix'), 'Report must document GEO');

    assertNoSlop(data.report_md);
  });

  it('TEST-MR-03: Fetches saved market research reports via GET /api/market-research', async () => {
    const res = await fetch(`${server.baseUrl}/api/market-research`, {
      headers: adminAuth.headers
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.ok(Array.isArray(data.reports));
    assert.ok(data.reports.length >= 1, 'Must contain at least 1 saved report');

    const matched = data.reports.find(r => r.id === createdReportId);
    assert.ok(matched, 'Created report must be found in list');
    assert.strictEqual(matched.business_idea, 'AI-Powered Cold Outreach Engine for B2B SaaS');
  });

  it('TEST-MR-04: Fetches single market research report by ID via GET /api/market-research/:id', async () => {
    const res = await fetch(`${server.baseUrl}/api/market-research/${createdReportId}`, {
      headers: adminAuth.headers
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.ok(data.report);
    assert.strictEqual(data.report.id, createdReportId);
    assert.strictEqual(data.report.business_idea, 'AI-Powered Cold Outreach Engine for B2B SaaS');
  });
});
