// ==========================================
// Browser Research Engine
// Playwright headless navigation + extraction + 5-tool ping telemetry + session/artifact capture.
// Used by the @browser-researcher agent (skill: web_research) and exposed via
// POST /api/browser/navigation.
// ==========================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const { testPingHandler } = require('./index'); // re-use the same ping policy as the LLM-config test endpoint

const TIMEOUTS = {
  navigation: 30000,
  content: 20000,
  screenshot: 10000,
  ping: 15000
};

class BrowserEngine {
  constructor() {
    this.browser = null;
  }

  // One shared browser per process, launched on first use.
  async launch() {
    if (this.browser) return this.browser;
    const { chromium } = require('playwright');
    const executablePath = chromium.executablePath();
    if (!executablePath || !fs.existsSync(executablePath)) {
      throw new Error(`[browserEngine] Chromium executable not found at ${executablePath}. Run: npx playwright install chromium`);
    }
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    return this.browser;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // ---- Navigation + extraction ----

  async navigate(projectId, url, notes = '') {
    const browser = await this.launch();
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      bypassCSP: false
    });
    const start = Date.now();
    let title = null;
    let domSummary = null;
    let content = null;
    let status = null;
    let error = null;
    let artifacts = [];

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.navigation });
      await page.waitForTimeout(700); // let fonts/render settle

      // Capture nav trail record first (the source of record for the harvest)
      const nav = await this.recordSession(projectId, 'browser-researcher', url, notes, {
        status: 'navigated',
        timing_ms: Date.now() - start
      });
      status = 'ok';

      // Page title
      title = (await page.title()).slice(0, 300);

      // DOM/ARIA outline + headings (structured extraction, not a full DOM dump)
      domSummary = await this.extractDom(page);

      // Visible text content (capped to keep payloads small)
      const fullText = await page.textContent('body');
      content = fullText.slice(0, 24000);

      // Fallback: if the page returned almost nothing, take a full DOM snapshot
      if (!title && !domSummary) {
        const snapshot = await page.evaluate(() => {
          const main = document.querySelector('main, body') || document.documentElement;
          return {
            tagName: main.tagName,
            id: main.id || null,
            className: main.className || null,
            outerHTML: main.outerHTML.slice(0, 6000)
          };
        });
        domSummary = { note: 'minimal-page', snapshot };
      }

      // Screenshot for the artifact panel (kept small; no mask = full frame)
      const screenshot = await page.screenshot({ type: 'png' });
      const artifact = await this.captureArtifact(projectId, null, 'page_screenshot', screenshot, `nav_${crypto.randomUUID()}.png`);
      artifacts.push(artifact);

      return {
        ok: true,
        id: nav.id,
        projectId,
        url,
        title,
        status,
        timing_ms: Date.now() - start,
        dom_summary: domSummary,
        content_preview: content,
        artifact_ids: artifacts.map(a => a.id),
        error: null
      };
    } catch (err) {
      error = this.normalizeError(err);
      return {
        ok: false,
        projectId,
        url,
        status: 'failed',
        error,
        timing_ms: Date.now() - start
      };
    } finally {
      await page.close();
    }
  }

  // ---- DOM / ARIA outline extraction (structured, bounded) ----
  async extractDom(page) {
    try {
      const out = await page.evaluate(() => {
        const roles = [];
        const headingCounts = {};
        const links = [];
        const tables = [];
        const ariaRoot = document.body ? document.body : document.documentElement;

        const walk = (el, depth = 0) => {
          if (depth > 3) return;
          const role = (el.getAttribute('role') || (el.matches('[role]') ? 'region' : null));
          // Skip decorative-only roles
          if (role === 'presentation' || role === 'none') return;
          if (role) roles.push({ role, text: (el.textContent || '').trim().slice(0, 80), depth });

          const tag = (el.tagName || '').toLowerCase();
          if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
            headingCounts[tag] = (headingCounts[tag] || 0) + 1;
          }
          if (tag === 'a' && el.getAttribute('href') && el.textContent?.trim()) {
            links.push({ href: el.getAttribute('href').slice(0, 120), text: el.textContent.trim().slice(0, 80) });
          }
          if (tag === 'table') {
            tables.push({ rows: el.rows?.length || 0, cols: el.rows?.[0]?.cells?.length || 0, caption: el.querySelector('caption')?.textContent?.slice(0, 80) || null });
          }
          // Descendants, breath-limited
          const children = el.children && el.children.length ? Array.from(el.children) : [];
          for (let i = 0; i < children.length && depth < 2; i++) walk(children[i], depth + 1);
        };
        walk(ariaRoot);

        // Heading outline (first 40)
        const headings = [];
        document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
          if (headings.length < 40) headings.push({ tag: h.tagName.toLowerCase(), text: h.textContent.trim().slice(0, 120) });
        });

        return {
          roles: roles.slice(0, 120),
          headings: headings.slice(0, 40),
          heading_counts: headingCounts,
          links: links.slice(0, 80),
          tables: tables.slice(0, 20),
          lang: document.documentElement?.lang || null,
          viewport: `${window.innerWidth}x${window.innerHeight}`
        };
      });
      return out;
    } catch (err) {
      return { note: 'dom-extract-failed', error: err.message };
    }
  }

  // ---- SERP forensic (typed queries) ----
  async serpForensic(projectId, queries) {
    const results = [];
    for (const q of (queries || [])) {
      const url = `https://www.google.com/search?q=${encodeURIComponent(String(q))}`;
      const page = await this.launch().then(b => b.newPage());
      let snapshot = null;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.navigation });
        await page.waitForTimeout(1200);
        const list = await page.evaluate(() => {
          const out = [];
          document.querySelectorAll('div[data-ved] a, h3 a, .yuRU bf, .yuRu a').forEach(a => {
            const txt = a.textContent?.trim();
            const href = a.getAttribute('href') || '';
            if (txt && href && out.length < 8) out.push({ title: txt, href, position: out.length + 1 });
          });
          return out;
        });
        snapshot = await page.screenshot({ type: 'png', mask: () => [] });
        await page.close();
        results.push({
          query: String(q),
          url,
          count: list.length,
          rows: list,
          has_screenshot: !!snapshot
        });
      } catch (err) {
        await page.close();
        results.push({ query: String(q), url, count: 0, error: this.normalizeError(err) });
      }
    }
    // Session record behind the scenes
    return results;
  }

  // ---- Pricing table forensic scrape ----
  async pricingTableScrape(projectId, url) {
    const browser = await this.launch();
    const page = await browser.newPage();
    let rows = [];
    let note = null;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.navigation });
      await page.waitForTimeout(1500);
      const tableData = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('table').forEach((table, ti) => {
          const rows2 = [];
          table.querySelectorAll('tr').forEach(tr => {
            const cells = Array.from(tr.querySelectorAll('th, td')).map(c => c.textContent.trim().replace(/\s+/g, ' ').slice(0, 60));
            if (cells.length) rows2.push(cells);
          });
          if (rows2.length > 1) out.push({ table_index: ti + 1, rows: rows2 });
        });
        return out;
      });
      rows = tableData.filter(t => t.rows.length >= 1);
      note = tableData.length ? `${tableData.length} table(s) found` : 'no data tables';
    } catch (err) {
      note = `nav failed: ${this.normalizeError(err).slice(0, 120)}`;
    } finally {
      await page.close();
    }
    await this.recordSession(projectId, 'browser-researcher', url, 'pricing_table_scrape', { status: 'scraped', notes: note });
    return { url, rows, note };
  }

  // ---- 5-tool HTTP ping telemetry (same reachability policy as the saved-logins test endpoint) ----
  async pingTools(projectId, logins) {
    const results = [];
    for (const login of logins || []) {
      const url = login.website_url || login.url;
      const start = Date.now();
      let reachable = false;
      let httpStatus = 0;
      let statusMessage = '';
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), TIMEOUTS.ping);
        const resp = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          signal: ctrl.signal
        });
        clearTimeout(timeout);
        reachable = resp.status < 500;
        httpStatus = resp.status;
        statusMessage = `HTTP ${resp.status} ${resp.statusText || 'OK'}`;
      } catch (err) {
        reachable = false;
        statusMessage = err.message;
      }
      const latency = Date.now() - start;
      const status = reachable ? 'connected' : 'needs_reconnect';
      // Persist the test result
      db.prepare('UPDATE saved_logins SET status = ?, last_tested = ? WHERE id = ?').run(status, new Date().toISOString(), login.id);
      results.push({ id: login.id, slug: login.slug || null, name: login.name, category: login.category, url, status, latency_ms: latency, http_status: httpStatus, message: statusMessage });
    }
    // Trail record for the session
    await this.recordSession(null, 'browser-researcher', '5-tool ping telemetry', `pings: ${results.map(r => r.slug).join(', ')}`, { tool_pings: results });
    return results;
  }

  // ---- Session trail (the record of what the browser saw) ----
  async recordSession(projectId, agent, url, notes, meta = {}) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO browser_sessions (id, project_id, agent, url, title, notes, dom_summary, content, status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, projectId, agent, url, null, notes, JSON.stringify(meta), null, 'recorded', now, now);
    return { id };
  }

  // ---- Artifact capture (downloadable artifacts store, item 3) ----
  async captureArtifact(projectId, taskId, type, buffer, filename) {
    const id = crypto.randomUUID();
    const dir = path.join(__dirname, '..', 'uploads', 'artifacts', projectId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const safe = filename.replace(/[^a-z0-9._-]/gi, '_').toLowerCase();
    const file = path.join(dir, `${id}_${safe}`);
    fs.writeFileSync(file, buffer);
    db.prepare(`INSERT INTO artifacts (id, project_id, task_id, type, filename, file_path, size_bytes, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, projectId, taskId, type, filename, file, Buffer.byteLength(buffer), new Date().toISOString());
    return { id, filename: path.basename(file), type, size_bytes: Buffer.byteLength(buffer) };
  }

  normalizeError(err) {
    return { message: err?.message || String(err), code: err?.code || err?.name || 'NAVIGATION_ERROR' };
  }
}

module.exports = new BrowserEngine();
