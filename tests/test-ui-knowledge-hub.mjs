import { chromium } from 'playwright';
import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('dotenv').config();
const { signToken } = require('../server/auth.js');
const db = require('../server/db.js');

async function run() {
  console.log('🚀 Launching headless Chromium to test Knowledge Base UI...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const user = db.prepare("SELECT * FROM users WHERE email = 'owner@example.com'").get();
  const token = signToken(user);

  const errors = [];
  page.on('pageerror', err => {
    errors.push(`[PAGE ERROR] ${err.message} \nStack: ${err.stack}`);
    console.error('Captured page error:', err);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`[CONSOLE ERROR] ${msg.text()}`);
  });

  // Inject token into localStorage before page loads
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('marketing_os_token', token);
    localStorage.setItem('marketing_os_user', JSON.stringify(user));
  }, { token, user });

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  console.log('Clicking Knowledge Base top navbar tab (#navTab-rag)...');
  await page.click('#navTab-rag');
  await page.waitForTimeout(1000);

  // 1. Verify View 6 (#view-rag) is active
  const ragViewVisible = await page.isVisible('#view-rag');
  assert.ok(ragViewVisible, 'Knowledge Base view (#view-rag) should be visible');
  console.log('✅ Knowledge Base view is visible');

  // 2. Check 5 core pillars metric stat cards
  const mrText = await page.textContent('#statMarketResearch');
  const gapsText = await page.textContent('#statGaps');
  const propText = await page.textContent('#statProposals');
  console.log(`✅ Metric cards rendered: Market Research: ${mrText}, Gaps: ${gapsText}, Proposals: ${propText}`);

  // 3. Switch to Per-Lead Proposals Tab
  console.log('Switching to Per-Lead Customized Proposals tab...');
  await page.click('#kbTabBtn-proposals');
  
  console.log('Waiting for proposals rows to load...');
  await page.waitForSelector('#kbProposalsTableBody tr td div.font-bold', { timeout: 10000 });

  const proposalsTableVisible = await page.isVisible('#kbTabPane-proposals');
  assert.ok(proposalsTableVisible, 'Proposals tab pane should be visible');

  // Verify rows rendered
  const rows = await page.$$('#kbProposalsTableBody tr');
  assert.ok(rows.length > 0, `Proposals table should render rows (found ${rows.length})`);
  console.log(`✅ Proposals table rendered ${rows.length} lead proposal rows`);

  // 4. Click "Edit" on the first lead proposal
  console.log('Opening Edit Proposal Modal for lead #1...');
  const firstEditBtn = await page.$('#kbProposalsTableBody tr:first-child button:has-text("Edit")');
  assert.ok(firstEditBtn, 'Edit button should exist on first row');
  await firstEditBtn.click();
  await page.waitForTimeout(500);

  const modalVisible = await page.isVisible('#editLeadProposalModal');
  assert.ok(modalVisible, 'Edit Lead Proposal Modal should be visible');

  const gapsVal = await page.inputValue('#elpGapsInput');
  const pitchVal = await page.inputValue('#elpPitchInput');
  const offerVal = await page.inputValue('#elpOfferInput');
  assert.ok(gapsVal.length > 5, 'Identified Gaps input should have content');
  assert.ok(pitchVal.length > 5, 'Custom Pitch input should have content');
  assert.ok(offerVal.length > 5, 'Recommended Offer input should have content');
  console.log('✅ Edit Lead Proposal Modal populated correctly with grounded data');

  // Close modal
  await page.click('#editLeadProposalModal button:has-text("Cancel")');
  await page.waitForTimeout(300);

  // 5. Test Knowledge Upload Modal
  console.log('Testing Knowledge Upload Modal...');
  await page.click('#kbTabBtn-docs');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Upload Research / Doc")');
  await page.waitForTimeout(400);

  const kuModalVisible = await page.isVisible('#knowledgeUploadModal');
  assert.ok(kuModalVisible, 'Knowledge Upload Modal should be visible');
  await page.click('#knowledgeUploadModal button:has-text("Cancel")');
  await page.waitForTimeout(300);
  console.log('✅ Knowledge Upload Modal opens and closes cleanly');

  // Verify zero errors
  const criticalErrors = errors.filter(e => !e.includes('favicon') && !e.includes('not configured'));
  console.log(`Page errors: ${criticalErrors.length}`);
  if (criticalErrors.length > 0) {
    console.warn('Errors encountered:', criticalErrors);
  }
  assert.strictEqual(criticalErrors.length, 0, 'There should be 0 critical browser console/page errors');

  await browser.close();
  console.log('🎉 PLAYWRIGHT CHROMIUM UI VERIFICATION PASSED 100%!\n');
}

run().catch(err => {
  console.error('❌ Chromium UI test failed:', err);
  process.exit(1);
});
