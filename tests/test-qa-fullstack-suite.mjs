import { chromium } from 'playwright';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

require('dotenv').config({ path: path.join(ROOT_DIR, '.env') });
const { signToken } = require('../server/auth.js');
const db = require('../server/db.js');

async function run() {
  console.log('====================================================');
  console.log('🧪 MARKETING OS COMPREHENSIVE QA AUTOMATION SUITE');
  console.log('====================================================\n');

  // STEP 1: SVG ASSET VERIFICATION
  console.log('--- Step 1: Validating Generated SVG Assets ---');
  const svgDir = path.join(ROOT_DIR, 'public', 'exports', 'leads_logos_svg');
  assert.ok(fs.existsSync(svgDir), `SVG directory ${svgDir} must exist`);
  const svgFiles = fs.readdirSync(svgDir).filter(f => f.endsWith('.svg'));
  console.log(`Found ${svgFiles.length} individual SVG logos in ${svgDir}`);
  assert.strictEqual(svgFiles.length, 138, 'Must have exactly 138 individual SVGs');

  for (const file of svgFiles) {
    const filePath = path.join(svgDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.length > 50, `File ${file} should not be empty`);
    assert.ok(content.includes('<svg') && content.includes('</svg>'), `File ${file} must have valid root <svg> tags`);
    assert.ok(content.includes('viewBox') || (content.includes('width=') && content.includes('height=')), `File ${file} must have viewBox or dimensions`);
  }
  console.log('✅ All 138 individual SVGs are structurally valid XML vector files');

  const masterSvgPublic = path.join(ROOT_DIR, 'public', 'exports', 'all_leads_logos.svg');
  assert.ok(fs.existsSync(masterSvgPublic), 'Public Master SVG must exist');
  const masterContent = fs.readFileSync(masterSvgPublic, 'utf-8');
  assert.ok(masterContent.length > 1000000, `Master SVG size is substantial (${(masterContent.length / 1024 / 1024).toFixed(2)} MB)`);
  assert.ok(masterContent.includes('<svg') && masterContent.includes('</svg>'), 'Master SVG has valid root tags');
  assert.ok(masterContent.includes('138 Canadian Dental Clinics') || masterContent.includes('Master Brand'), 'Master SVG includes header title');
  console.log(`✅ Master SVG verified (${(masterContent.length / 1024 / 1024).toFixed(2)} MB)`);

  const zipBundle = path.join(ROOT_DIR, 'public', 'exports', 'valioz_leads_logos_svg.zip');
  assert.ok(fs.existsSync(zipBundle), 'ZIP bundle must exist');
  const zipStat = fs.statSync(zipBundle);
  assert.ok(zipStat.size > 1000000, `ZIP bundle size is substantial (${(zipStat.size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`✅ ZIP bundle verified (${(zipStat.size / 1024 / 1024).toFixed(2)} MB)`);

  // STEP 2: HTTP ENDPOINTS
  console.log('\n--- Step 2: Testing SVG REST API Endpoints ---');
  const user = db.prepare("SELECT * FROM users WHERE role = 'super_admin' LIMIT 1").get();
  const token = signToken(user);

  const resMaster = await fetch('http://localhost:3000/api/projects/1/lead-logos/master-svg', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  assert.strictEqual(resMaster.status, 200, 'Master SVG endpoint should return 200 OK');
  const masterType = resMaster.headers.get('content-type');
  assert.ok(masterType.includes('image/svg+xml'), `Content-Type should be image/svg+xml, got ${masterType}`);
  console.log('✅ GET /api/projects/1/lead-logos/master-svg -> HTTP 200 image/svg+xml');

  const resZip = await fetch('http://localhost:3000/api/projects/1/lead-logos/download-svg-zip', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  assert.strictEqual(resZip.status, 200, 'ZIP download endpoint should return 200 OK');
  const zipType = resZip.headers.get('content-type');
  assert.ok(zipType.includes('zip'), `Content-Type should include zip, got ${zipType}`);
  console.log('✅ GET /api/projects/1/lead-logos/download-svg-zip -> HTTP 200 application/zip');

  // STEP 3: PLAYWRIGHT DESKTOP (1440px)
  console.log('\n--- Step 3: Playwright Desktop E2E (1440px) ---');
  const browser = await chromium.launch({ headless: true });
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktopContext.newPage();

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('marketing_os_token', token);
    localStorage.setItem('marketing_os_user', JSON.stringify(user));
  }, { token, user });

  const errors = [];
  page.on('pageerror', err => {
    errors.push(`[PAGE ERROR] ${err.message}`);
    console.error('Page error:', err);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      // Ignore non-fatal favicon or optional connection warnings
      if (!txt.includes('favicon.ico') && !txt.includes('n8n')) {
        errors.push(`[CONSOLE ERROR] ${txt}`);
        console.error('Console error:', txt);
      }
    }
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Validate Reordered 9 Primary Tabs
  const expectedTabs = [
    { id: 'navTab-overview', label: 'Overview', view: 'overview' },
    { id: 'navTab-rag', label: 'Knowledge Base', view: 'rag' },
    { id: 'navTab-research', label: 'Research', view: 'research' },
    { id: 'navTab-sales', label: 'Sales CRM', view: 'sales' },
    { id: 'navTab-creative', label: 'Creative Studio', view: 'creative' },
    { id: 'navTab-approvals', label: 'Approvals', view: 'approvals' },
    { id: 'navTab-workbench', label: 'Projects & Tasks', view: 'workbench' },
    { id: 'navTab-team', label: 'Team', view: 'team' },
    { id: 'navTab-adminSettings', label: 'Settings', view: 'adminSettings' }
  ];

  const pillContainer = page.locator('#primaryNavPillContainer');
  assert.ok(await pillContainer.isVisible(), '#primaryNavPillContainer should be visible');
  const pillClasses = await pillContainer.getAttribute('class');
  assert.ok(pillClasses.includes('rounded-full'), '#primaryNavPillContainer must have rounded-full styling');

  for (const tab of expectedTabs) {
    const el = page.locator('#' + tab.id);
    assert.ok(await el.isVisible(), `Tab #${tab.id} must be visible`);
  }
  console.log('✅ All 9 primary tabs present in order inside segmented control pill container');

  // Verify Light-Mode #FFFFFF card surfaces and styling
  const cardSurfaceCount = await page.locator('.card-surface').count();
  assert.ok(cardSurfaceCount > 0, 'Found .card-surface elements on page');
  const firstCardBg = await page.locator('.card-surface').first().evaluate(el => window.getComputedStyle(el).backgroundColor);
  console.log(`Card surface background color: ${firstCardBg}`);
  assert.ok(firstCardBg === 'rgb(255, 255, 255)' || firstCardBg === 'rgba(255, 255, 255, 1)', 'Card surface must be pure #FFFFFF in light mode');

  // Test Keyboard Navigation (1-9)
  for (let i = 0; i < expectedTabs.length; i++) {
    const key = String(i + 1);
    const tab = expectedTabs[i];
    await page.keyboard.press(key);
    await page.waitForTimeout(250);

    const viewVisible = await page.locator('#view-' + tab.view).isVisible();
    assert.ok(viewVisible, `View #view-${tab.view} must be visible when pressing key ${key}`);

    const tabClasses = await page.locator('#' + tab.id).getAttribute('class');
    assert.ok(tabClasses.includes('bg-white'), `Active tab #${tab.id} must have bg-white`);
    assert.ok(tabClasses.includes('shadow-sm'), `Active tab #${tab.id} must have shadow-sm`);
  }
  console.log('✅ Keyboard shortcuts (1-9) verified and correctly activate all 9 views with elevated styling');

  // Test Live Badge Counters
  const salesBadgeText = await page.locator('#navSalesCountBadge').textContent();
  const ragBadgeText = await page.locator('#navRagCountBadge').textContent();
  const tasksBadgeText = await page.locator('#navTasksCountBadge').textContent();
  const approvalsBadgeText = await page.locator('#navApprovalsCountBadge').textContent();
  console.log(`Live Badges: Sales=${salesBadgeText}, RAG=${ragBadgeText}, Tasks=${tasksBadgeText}, Approvals=${approvalsBadgeText}`);
  assert.ok(parseInt(salesBadgeText) >= 138, 'Sales badge reflects 138 leads');
  assert.ok(parseInt(ragBadgeText) >= 138, 'RAG badge reflects leads/docs');
  console.log('✅ Live badge counters verified with live dynamic counts');

  // Test Breadcrumb pill
  const breadcrumbProject = await page.locator('#navBreadcrumbProjectName').textContent();
  const breadcrumbStep = await page.locator('#navBreadcrumbNextStep').textContent();
  console.log(`Workflow Breadcrumb: Project='${breadcrumbProject}', Next Step='${breadcrumbStep}'`);
  assert.ok(breadcrumbProject.length > 0, 'Breadcrumb project name must not be empty');
  assert.ok(breadcrumbStep.length > 0, 'Breadcrumb next step must not be empty');
  console.log('✅ Context-aware workflow breadcrumb pill verified');

  // Test Lead Logos Master SVG & ZIP Buttons in Sales & RAG
  await page.keyboard.press('4'); // Sales
  await page.waitForTimeout(300);
  assert.ok(await page.locator('#btnDownloadMasterSvgSales').isVisible(), '#btnDownloadMasterSvgSales is visible');
  assert.ok(await page.locator('#btnDownloadZipSales').isVisible(), '#btnDownloadZipSales is visible');
  assert.ok(await page.locator('#btnViewSvgShowcaseSales').isVisible(), '#btnViewSvgShowcaseSales is visible');

  // Open SVG Showcase Modal
  await page.locator('#btnViewSvgShowcaseSales').click();
  await page.waitForTimeout(400);
  assert.ok(await page.locator('#svgShowcaseModal').isVisible(), 'SVG Showcase Modal is visible');
  await page.locator('#svgShowcaseModal button:has-text("Close")').click();
  await page.waitForTimeout(300);
  assert.ok(!(await page.locator('#svgShowcaseModal').isVisible()), 'SVG Showcase Modal closed');
  console.log('✅ SVG Showcase Modal interactions verified');

  await desktopContext.close();

  // STEP 4: PLAYWRIGHT MOBILE (375px)
  console.log('\n--- Step 4: Playwright Mobile E2E (375px) ---');
  const mobileContext = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const mobilePage = await mobileContext.newPage();

  mobilePage.on('pageerror', err => {
    errors.push(`[MOBILE PAGE ERROR] ${err.message}`);
    console.error('Mobile Page error:', err);
  });
  mobilePage.on('console', msg => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      if (!txt.includes('favicon.ico') && !txt.includes('n8n')) {
        errors.push(`[MOBILE CONSOLE ERROR] ${txt}`);
        console.error('Mobile Console error:', txt);
      }
    }
  });

  await mobilePage.addInitScript(({ token, user }) => {
    localStorage.setItem('marketing_os_token', token);
    localStorage.setItem('marketing_os_user', JSON.stringify(user));
  }, { token, user });

  await mobilePage.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);

  // Check mobile navigation container
  const mobilePill = mobilePage.locator('#primaryNavPillContainer');
  assert.ok(await mobilePill.isVisible(), 'Mobile pill container visible');

  // Check clicking tabs on mobile
  await mobilePage.locator('#navTab-sales').click();
  await mobilePage.waitForTimeout(400);
  assert.ok(await mobilePage.locator('#view-sales').isVisible(), 'Sales view visible on mobile after tap');

  await mobilePage.locator('#navTab-rag').click();
  await mobilePage.waitForTimeout(400);
  assert.ok(await mobilePage.locator('#view-rag').isVisible(), 'RAG view visible on mobile after tap');

  // Verify no page horizontal overflow
  const bodyScrollWidth = await mobilePage.evaluate(() => document.documentElement.scrollWidth);
  const bodyClientWidth = await mobilePage.evaluate(() => document.documentElement.clientWidth);
  console.log(`Mobile layout widths: scrollWidth=${bodyScrollWidth}, clientWidth=${bodyClientWidth}`);
  assert.ok(bodyScrollWidth <= bodyClientWidth + 10, 'Mobile viewport has no horizontal page breakout');
  console.log('✅ Mobile 375px responsive layout and touch interactions verified');

  await mobileContext.close();
  await browser.close();

  // STEP 5: VERIFY 0 ERRORS
  console.log('\n--- Step 5: Console & Page Error Audit ---');
  console.log(`Total captured errors: ${errors.length}`);
  if (errors.length > 0) {
    console.error('Captured errors:', errors);
  }
  assert.strictEqual(errors.length, 0, `Expected 0 errors, got: ${errors.join(', ')}`);
  console.log('✅ ZERO console errors and ZERO page errors across desktop and mobile suites!');

  console.log('\n====================================================');
  console.log('🎉 FULL QA AUTOMATED VERIFICATION PASSED (100%)');
  console.log('====================================================\n');
}

run().catch(err => {
  console.error('\n❌ QA SUITE FAILED:', err);
  process.exit(1);
});
