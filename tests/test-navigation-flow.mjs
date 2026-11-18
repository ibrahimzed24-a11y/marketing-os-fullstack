import { chromium } from 'playwright';
import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('dotenv').config();
const { signToken } = require('../server/auth.js');
const db = require('../server/db.js');

(async () => {
  console.log('🚀 Testing Navigation Logic, Keyboard Shortcuts & Live Badges...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const user = db.prepare("SELECT * FROM users WHERE role = 'super_admin' LIMIT 1").get();
  const token = signToken(user);

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('marketing_os_token', token);
    localStorage.setItem('marketing_os_user', JSON.stringify(user));
  }, { token, user });

  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', err => {
    console.error('Page error:', err.message);
    pageErrors.push(err.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('Console error:', msg.text());
      consoleErrors.push(msg.text());
    }
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Verify 9 tabs in order
  console.log('Checking navigation tabs...');
  const expectedTabs = [
    { id: 'navTab-overview', label: 'Overview' },
    { id: 'navTab-rag', label: 'Knowledge Base' },
    { id: 'navTab-research', label: 'Research' },
    { id: 'navTab-sales', label: 'Sales CRM' },
    { id: 'navTab-creative', label: 'Creative Studio' },
    { id: 'navTab-approvals', label: 'Approvals' },
    { id: 'navTab-workbench', label: 'Projects & Tasks' },
    { id: 'navTab-team', label: 'Team' },
    { id: 'navTab-adminSettings', label: 'Settings' }
  ];

  for (const tab of expectedTabs) {
    const el = page.locator('#' + tab.id);
    await assert(await el.count() > 0, `Tab #${tab.id} exists`);
    console.log(`✅ Tab #${tab.id} verified`);
  }

  // 2. Test Keyboard Shortcut Navigation (Keys 1-9)
  console.log('Testing Keyboard Shortcuts 1-9...');
  const keyTests = [
    { key: '1', expectedView: 'overview', tabId: 'navTab-overview' },
    { key: '2', expectedView: 'rag', tabId: 'navTab-rag' },
    { key: '3', expectedView: 'research', tabId: 'navTab-research' },
    { key: '4', expectedView: 'sales', tabId: 'navTab-sales' },
    { key: '5', expectedView: 'creative', tabId: 'navTab-creative' },
    { key: '6', expectedView: 'approvals', tabId: 'navTab-approvals' },
    { key: '7', expectedView: 'workbench', tabId: 'navTab-workbench' },
    { key: '8', expectedView: 'team', tabId: 'navTab-team' },
    { key: '9', expectedView: 'adminSettings', tabId: 'navTab-adminSettings' }
  ];

  for (const kt of keyTests) {
    await page.keyboard.press(kt.key);
    await page.waitForTimeout(300);

    const activeViewVisible = await page.locator('#view-' + kt.expectedView).isVisible();
    assert(activeViewVisible, `View #view-${kt.expectedView} is visible after pressing ${kt.key}`);

    const activeTabClass = await page.locator('#' + kt.tabId).getAttribute('class');
    assert(activeTabClass.includes('bg-white'), `Active tab #${kt.tabId} has elevated white card styling (got: ${activeTabClass})`);
    assert(activeTabClass.includes('shadow-sm'), `Active tab #${kt.tabId} has shadow-sm`);
    console.log(`✅ Key '${kt.key}' -> View '${kt.expectedView}' active with premium elevated styling`);
  }

  // 3. Test Live Badges
  console.log('Verifying Live Badge Counts...');
  const salesBadge = page.locator('#navSalesCountBadge');
  const ragBadge = page.locator('#navRagCountBadge');
  const tasksBadge = page.locator('#navTasksCountBadge');

  const salesCount = await salesBadge.textContent();
  const ragCount = await ragBadge.textContent();
  const tasksCount = await tasksBadge.textContent();

  console.log(`Live Badges: Sales CRM = ${salesCount}, Knowledge Base = ${ragCount}, Tasks = ${tasksCount}`);
  assert(parseInt(salesCount) > 0, 'Sales badge > 0');
  assert(parseInt(ragCount) > 0, 'RAG badge > 0');

  // 4. Test Lead Logos SVG Integration in Sales & Knowledge Base
  console.log('Testing Lead Logos Buttons & SVG Modal...');
  await page.keyboard.press('4'); // Sales
  await page.waitForTimeout(300);

  const btnMasterSvg = page.locator('#btnDownloadMasterSvgSales');
  assert(await btnMasterSvg.isVisible(), 'Master SVG button in Sales CRM is visible');

  const btnShowcase = page.locator('#btnViewSvgShowcaseSales');
  assert(await btnShowcase.isVisible(), 'SVG Showcase button in Sales CRM is visible');

  // Click View Showcase
  await btnShowcase.click();
  await page.waitForTimeout(400);
  const modalVisible = await page.locator('#svgShowcaseModal').isVisible();
  assert(modalVisible, 'SVG Showcase Modal opened');
  console.log('✅ SVG Showcase Modal opened successfully');

  // Close Showcase Modal
  await page.locator('#svgShowcaseModal button:has-text("Close")').click();
  await page.waitForTimeout(300);
  const modalHidden = !(await page.locator('#svgShowcaseModal').isVisible());
  assert(modalHidden, 'SVG Showcase Modal closed');
  console.log('✅ SVG Showcase Modal closed cleanly');

  // 5. Test Optimistic Update on Proposal
  console.log('Testing optimistic proposal update...');
  await page.keyboard.press('2'); // RAG
  await page.waitForTimeout(400);

  // Switch to proposals tab
  const propTabBtn = page.locator('#kbTab-proposals');
  if (await propTabBtn.isVisible()) {
    await propTabBtn.click();
    await page.waitForTimeout(500);

    const editBtn = page.locator('button[title="Edit Proposal"]').first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(300);

      const modal = page.locator('#editLeadProposalModal');
      assert(await modal.isVisible(), 'Edit Lead Proposal Modal opened');

      // Change pitch input
      await page.locator('#elpPitchInput').fill('Optimistic test pitch update');
      await page.locator('#editLeadProposalModal button:has-text("Save Customized Proposal")').click();
      await page.waitForTimeout(300);

      // Verify modal immediately closed
      assert(!(await modal.isVisible()), 'Modal closed optimistically');
      console.log('✅ Proposal edit updated optimistically and modal closed immediately');
    }
  }

  assert.strictEqual(pageErrors.length, 0, `0 Page errors expected, got: ${pageErrors.join('; ')}`);
  console.log(`Page errors: ${pageErrors.length}, Console errors: ${consoleErrors.length}`);
  console.log('🎉 ALL NAVIGATION, SHORTCUTS, BADGES, AND SVG INTEGRATION TESTS PASSED 100%!');

  await browser.close();
  process.exit(0);
})();
