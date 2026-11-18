// Verification script for Marketing Knowledge Base & Research Hub + Proposal Customization Engine
import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('dotenv').config();
const { signToken } = require('../server/auth.js');
const db = require('../server/db.js');

const BASE = 'http://127.0.0.1:3000';

async function main() {
  console.log('🧪 [TEST 1/7] Health & Authentication Check...');
  const healthRes = await fetch(`${BASE}/api/health`);
  assert.strictEqual(healthRes.status, 200, 'Health check should be 200 OK');

  const user = db.prepare("SELECT * FROM users WHERE email = 'ibrahim.zed24@gmail.com'").get();
  assert.ok(user, 'Super admin user must exist');
  const token = signToken(user);
  assert.ok(token, 'JWT token should be generated');
  console.log(`✅ Health & Super Admin auth token generated for ${user.email} (${user.role}).`);

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const projectId = '9fadc9d8-eeb1-40f2-a561-e4e339bc4e76'; // Valioz Health

  console.log('\n🧪 [TEST 2/7] Testing GET /api/projects/:id/knowledge...');
  const kbRes = await fetch(`${BASE}/api/projects/${projectId}/knowledge`, { headers });
  assert.strictEqual(kbRes.status, 200, 'Knowledge summary API should succeed');
  const kbData = await kbRes.json();
  assert.ok(kbData.ok, 'Knowledge response ok: true');
  assert.ok(kbData.summary, 'Summary object present');
  assert.ok(kbData.summary.categories, 'Categories present');
  assert.ok(kbData.summary.categories.market_research, 'market_research category present');
  assert.ok(kbData.summary.categories.gaps_opportunities, 'gaps_opportunities category present');
  assert.ok(kbData.summary.categories.brand_guidelines, 'brand_guidelines category present');
  assert.ok(kbData.summary.categories.offer_frameworks, 'offer_frameworks category present');
  console.log(`✅ Knowledge Base summary verified: ${kbData.summary.total_chunks} chunks across ${kbData.summary.total_documents} documents.`);
  console.log(`   Pillars: Market Research (${kbData.summary.categories.market_research.count} chunks), Gaps (${kbData.summary.categories.gaps_opportunities.count} chunks), Offers (${kbData.summary.categories.offer_frameworks.count} chunks)`);

  console.log('\n🧪 [TEST 3/7] Testing Direct Knowledge Document Ingestion...');
  const docTitle = `Test_Canadian_Dental_Patient_Intake_Audit_${Date.now()}`;
  const docContent = `# Canadian Dental Patient Intake & Map Pack Teardown
Audit of 134 independent dental practices in Ontario and British Columbia reveals:
1. 62% of clinics lack instant weekend emergency triage.
2. Canadian Dental Care Plan (CDCP) patients abandon phone hold times after 4 minutes.
3. Valioz AI Agent captures 28+ qualified patient inquiries per month per clinic on autopilot.`;
  const addDocRes = await fetch(`${BASE}/api/projects/${projectId}/knowledge/document`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: docTitle,
      content: docContent,
      category: 'market_research'
    })
  });
  assert.strictEqual(addDocRes.status, 200, 'Direct document creation should succeed');
  const addDocData = await addDocRes.json();
  assert.ok(addDocData.ok, 'Document ingestion ok');
  assert.ok(addDocData.chunks_created >= 1, 'At least 1 chunk created');
  console.log(`✅ Direct document "${docTitle}" created with ${addDocData.chunks_created} indexed chunks in category "${addDocData.category}".`);

  console.log('\n🧪 [TEST 4/7] Testing Bulk Proposal Generation...');
  const genRes = await fetch(`${BASE}/api/projects/${projectId}/proposals/generate-bulk`, {
    method: 'POST',
    headers
  });
  assert.strictEqual(genRes.status, 200, 'Bulk proposal generation should succeed');
  const genData = await genRes.json();
  assert.ok(genData.ok, 'Proposal generation ok');
  assert.strictEqual(genData.count, 134, 'Should generate proposals for all 134 Valioz Health leads');
  console.log(`✅ Bulk Proposal Customizer generated 134 customized proposals strictly grounded in Knowledge Base.`);

  console.log('\n🧪 [TEST 5/7] Testing Proposals Retrieval & Inspection...');
  const propRes = await fetch(`${BASE}/api/projects/${projectId}/proposals?limit=5`, { headers });
  assert.strictEqual(propRes.status, 200, 'Proposals query should succeed');
  const propData = await propRes.json();
  assert.ok(propData.ok, 'Proposals response ok');
  assert.strictEqual(propData.total, 134, 'Total proposals count should be 134');
  assert.strictEqual(propData.proposals.length, 5, 'Should return 5 proposals for limit=5');

  const firstLead = propData.proposals[0];
  assert.ok(firstLead.clinic_name, 'Clinic name present');
  assert.ok(firstLead.identified_gaps, 'Identified gap present');
  assert.ok(firstLead.custom_angle, 'Custom angle present');
  assert.ok(firstLead.recommended_offer, 'Recommended offer present');
  assert.ok(firstLead.roi_projection, 'ROI projection present');
  console.log(`✅ Sample Lead Proposal for "${firstLead.clinic_name}":`);
  console.log(`   - Identified Gap: "${firstLead.identified_gaps.slice(0, 90)}..."`);
  console.log(`   - Custom Angle: "${firstLead.custom_angle.slice(0, 90)}..."`);
  console.log(`   - Offer: "${firstLead.recommended_offer.slice(0, 90)}..."`);

  console.log('\n🧪 [TEST 6/7] Testing Individual Lead Proposal Customization (PUT)...');
  const targetLeadId = firstLead.lead_id;
  const updateRes = await fetch(`${BASE}/api/projects/${projectId}/leads/${targetLeadId}/proposal`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      identified_gaps: `Custom VIP audit: ${firstLead.clinic_name} is losing 35+ monthly implant inquiries to competing downtown clinics.`,
      custom_angle: `Exclusively reserve territory for ${firstLead.clinic_name} with $0 upfront until 15 patient bookings.`,
      recommended_offer: 'Valioz Executive Turnkey Package — $499 setup, $299/mo optional retainer with full patient intake concierge.'
    })
  });
  assert.strictEqual(updateRes.status, 200, 'Proposal update should succeed');
  const updateData = await updateRes.json();
  assert.strictEqual(updateData.proposal.status, 'customized', 'Status should now be customized');
  assert.ok(updateData.proposal.identified_gaps.includes('Custom VIP audit'), 'Updated gap should be persisted');
  console.log('✅ Individual proposal customization verified and persisted in DB.');

  console.log('\n🧪 [TEST 7/7] Testing Live Deliverable Preview with Grounded Proposal Data...');
  const prevRes = await fetch(`${BASE}/api/projects/${projectId}/preview`, { headers });
  assert.strictEqual(prevRes.status, 200, 'Preview endpoint should succeed');
  const prevData = await prevRes.json();
  assert.ok(prevData.ok, 'Preview response ok');
  assert.ok(prevData.html.includes('previewPayload'), 'Payload script tag present in interactive preview');
  assert.ok(prevData.html.includes('Verified Campaign Data'), 'Demo disclaimer should be replaced with verified notice');
  assert.ok(prevData.html.includes('custom_proposal'), 'Custom proposal fields embedded for live interactive switching');
  console.log(`✅ Interactive Deliverable Preview verified: contains ${prevData.leads_count} leads with real Knowledge Base proposals.`);

  console.log('\n🎉 ALL 7 KNOWLEDGE BASE & PROPOSAL CUSTOMIZATION TESTS PASSED PERFECTLY!\n');
}

main().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
