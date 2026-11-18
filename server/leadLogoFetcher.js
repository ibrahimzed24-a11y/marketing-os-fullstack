/**
 * Marketing OS — Automated Real Clinic/Lead Logo Fetcher
 *
 * Fetches real, publicly accessible logos/icons directly from each lead's
 * website URL (`direct_clinic_url` / `website`), verifies image binary magic
 * bytes (never saves HTML error pages or bot-challenge pages), saves them as
 * named campaign assets (`file_category = 'Lead Logo'`) in `harness_files`,
 * and binds each logo to its lead in `leads.source_evidence` for immediate
 * side-by-side rendering in dual-branded email previews and campaigns.
 *
 * Security & Honesty:
 *   - Strict SSRF protection (blocks localhost, private RFC1918, link-local IPs).
 *   - Never fabricates or generates fake logos when a site is offline/blocked.
 *   - Bounded concurrency & per-request timeouts.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const activeFetchJobs = new Map(); // projectId -> job status object

function slugifyClinicName(name) {
  return String(name || 'clinic')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'clinic';
}

function isSafePublicHttpUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return null;
    }
    return u.toString();
  } catch (_) {
    return null;
  }
}

function resolveRelativeUrl(candidate, baseUrl) {
  if (!candidate || typeof candidate !== 'string') return null;
  const cleaned = candidate.trim().replace(/&amp;/g, '&');
  if (!cleaned || /^data:/i.test(cleaned) || /^javascript:/i.test(cleaned)) return null;
  try {
    const abs = new URL(cleaned, baseUrl).toString();
    return isSafePublicHttpUrl(abs);
  } catch (_) {
    return null;
  }
}

function detectValidImageBuffer(buf, contentType = '') {
  if (!buf || buf.length < 60) return null;
  const ct = String(contentType || '').toLowerCase();

  // Reject HTML pages returned with 200 OK
  const headText = buf.subarray(0, Math.min(buf.length, 512)).toString('utf8').trimStart();
  if (/^<!doctype\s+html|^<html\b/i.test(headText)) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { ext: '.png', mime: 'image/png' };
  }
  // JPEG: FF D8 FF
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: '.jpg', mime: 'image/jpeg' };
  }
  // GIF: GIF87a / GIF89a
  if (buf.length >= 6 && buf.subarray(0, 4).toString('ascii') === 'GIF8') {
    return { ext: '.gif', mime: 'image/gif' };
  }
  // WEBP: RIFF....WEBP
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { ext: '.webp', mime: 'image/webp' };
  }
  // SVG XML
  if ((ct.includes('svg') || /^<\?xml|^<svg\b/i.test(headText)) && /<svg\b/i.test(headText)) {
    const fullStr = buf.toString('utf8');
    if (fullStr.includes('</svg>') && !/<script\b/i.test(fullStr)) {
      return { ext: '.svg', mime: 'image/svg+xml' };
    }
  }
  // ICO: 00 00 01 00
  if (buf.length >= 4 && buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00) {
    return { ext: '.ico', mime: 'image/x-icon' };
  }
  return null;
}

function extractLogoCandidatesFromHtml(html, baseUrl) {
  const candidates = [];
  const seen = new Set();

  const addCandidate = (rawUrl, score, kind) => {
    const url = resolveRelativeUrl(rawUrl, baseUrl);
    if (!url || seen.has(url)) return;
    const lower = url.toLowerCase();
    // Skip obvious non-logos (tracking pixels, social icons, stock badges)
    if (/facebook|twitter|instagram|linkedin|youtube|tiktok|gravatar|wp-emoji|analytics|doubleclick|pixel|spacer|blank\./i.test(lower)) {
      return;
    }
    seen.add(url);
    let finalScore = score;
    if (/\.svg(\?|$)/i.test(lower)) finalScore += 18;
    else if (/\.png(\?|$)/i.test(lower)) finalScore += 14;
    else if (/\.webp(\?|$)/i.test(lower)) finalScore += 10;
    else if (/\.ico(\?|$)/i.test(lower)) finalScore -= 8;
    candidates.push({ url, score: finalScore, kind });
  };

  // Extract <header> / <nav> slice for higher-confidence logo matching
  const headerMatch = html.match(/<header\b[\s\S]*?<\/header>/i);
  const headerHtml = headerMatch ? headerMatch[0] : html.slice(0, 18000);

  // 1. <img> tags with logo signals (prefer inside <header>, also scan full page)
  const scanImgs = (chunk, inHeader) => {
    const imgRe = /<img\b([^>]+)>/gi;
    let m;
    while ((m = imgRe.exec(chunk)) !== null) {
      const attrs = m[1];
      const src = (attrs.match(/\b(?:src|data-src|data-lazy-src)=(["'])([^"']+)\1/i) || [])[2] || '';
      const alt = (attrs.match(/\balt=(["'])([^"']*)\1/i) || [])[2] || '';
      const cls = (attrs.match(/\bclass=(["'])([^"']*)\1/i) || [])[2] || '';
      const id = (attrs.match(/\bid=(["'])([^"']*)\1/i) || [])[2] || '';
      if (!src) continue;
      const combined = `${src} ${alt} ${cls} ${id}`.toLowerCase();
      if (/logo|brand|site-icon|custom-logo|navbar-brand|header-logo/i.test(combined)) {
        addCandidate(src, inHeader ? 100 : 75, inHeader ? 'header_logo_img' : 'page_logo_img');
      } else if (inHeader && /\.(svg|png|webp)(\?|$)/i.test(src)) {
        addCandidate(src, 55, 'header_img');
      }
    }
  };
  scanImgs(headerHtml, true);
  scanImgs(html, false);

  // 2. <link rel="apple-touch-icon" | "icon">
  const linkRe = /<link\b([^>]+)>/gi;
  let lm;
  while ((lm = linkRe.exec(html.slice(0, 30000))) !== null) {
    const attrs = lm[1];
    const rel = ((attrs.match(/\brel=(["'])([^"']+)\1/i) || [])[2] || '').toLowerCase();
    const href = (attrs.match(/\bhref=(["'])([^"']+)\1/i) || [])[2] || '';
    if (!href) continue;
    if (rel.includes('apple-touch-icon')) {
      addCandidate(href, 50, 'apple_touch_icon');
    } else if (rel.includes('icon') && !rel.includes('manifest')) {
      addCandidate(href, 35, 'link_icon');
    }
  }

  // 3. OpenGraph og:image ONLY if URL looks like a logo (avoid giant clinic stock photos)
  const ogMatch = html.match(/<meta\b[^>]*property=(["'])og:image\1[^>]*content=(["'])([^"']+)\2/i)
    || html.match(/<meta\b[^>]*content=(["'])([^"']+)\1[^>]*property=(["'])og:image\3/i);
  if (ogMatch) {
    const ogUrl = ogMatch[3] || ogMatch[2];
    if (ogUrl && /logo/i.test(ogUrl)) {
      addCandidate(ogUrl, 60, 'og_logo');
    }
  }

  // 4. Clean root fallback
  addCandidate('/apple-touch-icon.png', 20, 'root_apple_icon');
  addCandidate('/favicon.ico', 10, 'root_favicon');

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 8);
}

async function fetchWithTimeout(url, timeoutMs = 8000, accept = '*/*') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': accept
      },
      signal: controller.signal
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function fetchRealLogoForWebsite(websiteUrl) {
  const safeUrl = isSafePublicHttpUrl(websiteUrl);
  if (!safeUrl) {
    return { ok: false, reason: 'invalid_or_unsafe_url' };
  }

  let html = '';
  let finalUrl = safeUrl;
  try {
    const res = await fetchWithTimeout(safeUrl, 8500, 'text/html,application/xhtml+xml,*/*');
    finalUrl = res.url || safeUrl;
    if (!res.ok) {
      return { ok: false, reason: `website_http_${res.status}` };
    }
    const ct = String(res.headers.get('content-type') || '').toLowerCase();
    // If URL itself points directly to an image
    if (ct.startsWith('image/')) {
      const buf = Buffer.from(await res.arrayBuffer());
      const imgInfo = detectValidImageBuffer(buf, ct);
      if (imgInfo && buf.length <= 2 * 1024 * 1024) {
        return { ok: true, buffer: buf, ext: imgInfo.ext, mime: imgInfo.mime, sourceUrl: finalUrl, kind: 'direct_image' };
      }
    }
    html = (await res.text()).slice(0, 250000);
  } catch (err) {
    return { ok: false, reason: err.name === 'AbortError' ? 'website_timeout' : `website_error:${err.message.slice(0, 80)}` };
  }

  // Detect Cloudflare / bot challenge pages honestly — NEVER bypass!
  if (/just a moment\.\.\.|cf-browser-verification|challenges\.cloudflare\.com/i.test(html.slice(0, 4000))) {
    return { ok: false, reason: 'bot_protection_blocked' };
  }

  const candidates = extractLogoCandidatesFromHtml(html, finalUrl);
  for (const cand of candidates) {
    try {
      const imgRes = await fetchWithTimeout(cand.url, 7500, 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8');
      if (!imgRes.ok) continue;
      const cl = parseInt(imgRes.headers.get('content-length') || '0', 10);
      if (cl > 2 * 1024 * 1024) continue;
      const buf = Buffer.from(await imgRes.arrayBuffer());
      if (buf.length > 2 * 1024 * 1024 || buf.length < 150) continue;
      const imgInfo = detectValidImageBuffer(buf, imgRes.headers.get('content-type'));
      if (!imgInfo) continue;

      return {
        ok: true,
        buffer: buf,
        ext: imgInfo.ext,
        mime: imgInfo.mime,
        sourceUrl: imgRes.url || cand.url,
        kind: cand.kind
      };
    } catch (_) {
      continue;
    }
  }

  // Fallback: check for clean inline <svg> logo directly inside <header>
  const headerMatch = html.match(/<header\b[\s\S]*?<\/header>/i);
  if (headerMatch) {
    const svgRe = /<svg\b[^>]*>[\s\S]{80,60000}?<\/svg>/gi;
    let sm;
    while ((sm = svgRe.exec(headerMatch[0])) !== null) {
      const svgText = sm[0];
      if (/<script\b/i.test(svgText)) continue;
      if (/logo|brand/i.test(svgText.slice(0, 300)) && /<(?:path|polygon|circle|rect|text)\b/i.test(svgText)) {
        const normalizedSvg = svgText.includes('xmlns=')
          ? svgText
          : svgText.replace(/^<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
        const buf = Buffer.from(normalizedSvg, 'utf8');
        return {
          ok: true,
          buffer: buf,
          ext: '.svg',
          mime: 'image/svg+xml',
          sourceUrl: finalUrl,
          kind: 'inline_header_svg'
        };
      }
    }
  }

  return { ok: false, reason: 'no_public_logo_found' };
}

function getLogoFetchJobStatus(projectId) {
  return activeFetchJobs.get(projectId) || {
    project_id: projectId,
    running: false,
    total: 0,
    processed: 0,
    fetched: 0,
    failed: 0,
    skipped: 0,
    started_at: null,
    completed_at: null,
    results: []
  };
}

/**
 * Automated Project Lead Logo Fetcher:
 * Iterates through project leads with a website URL (`direct_clinic_url` / `website`)
 * that do not yet have a logo (unless forceRefresh=true), downloads their real public
 * website logos, saves them as named `Lead Logo` files in `harness_files`, and links
 * each logo into `leads.source_evidence.logo_file_id`.
 */
async function fetchAndAttachLogosForProject(db, {
  projectId,
  uploadDir,
  userId = null,
  concurrency = 5,
  maxLeads = 200,
  forceRefresh = false
}) {
  const existingJob = activeFetchJobs.get(projectId);
  if (existingJob && existingJob.running) {
    return existingJob;
  }

  const leads = db.prepare('SELECT * FROM leads WHERE project_id = ? ORDER BY icp_score DESC, created_at DESC LIMIT ?').all(projectId, maxLeads);
  const queue = [];
  let skippedAlreadyHasLogo = 0;
  let skippedNoWebsite = 0;

  for (const lead of leads) {
    let ev = {};
    try { ev = JSON.parse(lead.source_evidence || '{}'); } catch (_) {}
    if (!forceRefresh && ev.logo_file_id) {
      skippedAlreadyHasLogo++;
      continue;
    }
    const website = ev.website || ev.direct_clinic_url || '';
    if (!website || !String(website).trim()) {
      skippedNoWebsite++;
      continue;
    }
    queue.push({ lead, ev, website: String(website).trim() });
  }

  const job = {
    project_id: projectId,
    running: true,
    total: queue.length,
    processed: 0,
    fetched: 0,
    failed: 0,
    skipped: skippedAlreadyHasLogo + skippedNoWebsite,
    skipped_already_has_logo: skippedAlreadyHasLogo,
    skipped_no_website: skippedNoWebsite,
    started_at: new Date().toISOString(),
    completed_at: null,
    results: []
  };
  activeFetchJobs.set(projectId, job);

  if (queue.length === 0) {
    job.running = false;
    job.completed_at = new Date().toISOString();
    return job;
  }

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const insertFileStmt = db.prepare(`
    INSERT INTO harness_files (id, project_id, filename, original_name, mime, size, uploaded_by, parsed_summary, file_category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Lead Logo')
  `);
  const updateLeadStmt = db.prepare('UPDATE leads SET source_evidence = ? WHERE id = ?');

  let cursor = 0;
  const workerCount = Math.min(Math.max(concurrency, 1), queue.length);

  const runWorker = async () => {
    while (cursor < queue.length) {
      const idx = cursor++;
      const item = queue[idx];
      const clinicName = item.ev.clinic_name || item.lead.full_name || `clinic-${idx + 1}`;
      const slug = slugifyClinicName(clinicName);

      try {
        const res = await fetchRealLogoForWebsite(item.website);
        if (res.ok && res.buffer) {
          const originalName = `${slug}-logo${res.ext}`;
          const storedFilename = `${slug}_logo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${res.ext}`;
          const destPath = path.join(uploadDir, storedFilename);
          fs.writeFileSync(destPath, res.buffer);

          const fileId = uuidv4();
          const summary = `Auto-fetched real logo for ${clinicName} from ${res.sourceUrl} (${(res.buffer.length / 1024).toFixed(1)} KB, ${res.kind})`;

          const nextEv = {
            ...item.ev,
            logo_file_id: fileId,
            logo_file_name: originalName,
            logo_source_url: res.sourceUrl,
            logo_kind: res.kind,
            logo_fetched_at: new Date().toISOString()
          };

          db.transaction(() => {
            insertFileStmt.run(
              fileId,
              projectId,
              storedFilename,
              originalName,
              res.mime,
              res.buffer.length,
              userId || null,
              summary
            );
            updateLeadStmt.run(JSON.stringify(nextEv), item.lead.id);
          })();

          job.fetched++;
          job.results.push({
            lead_id: item.lead.id,
            clinic_name: clinicName,
            website: item.website,
            status: 'fetched',
            file_name: originalName,
            kind: res.kind,
            bytes: res.buffer.length
          });
        } else {
          job.failed++;
          job.results.push({
            lead_id: item.lead.id,
            clinic_name: clinicName,
            website: item.website,
            status: 'unavailable',
            reason: res.reason || 'no_public_logo_found'
          });
        }
      } catch (err) {
        job.failed++;
        job.results.push({
          lead_id: item.lead.id,
          clinic_name: clinicName,
          website: item.website,
          status: 'error',
          reason: err.message
        });
      } finally {
        job.processed++;
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  job.running = false;
  job.completed_at = new Date().toISOString();

  try {
    db.prepare('INSERT INTO activity (id, project_id, user_id, action, meta) VALUES (?, ?, ?, ?, ?)')
      .run(
        uuidv4(),
        projectId,
        userId || null,
        'lead_logos_auto_fetched',
        JSON.stringify({
          total: job.total,
          fetched: job.fetched,
          failed: job.failed,
          skipped: job.skipped
        })
      );
  } catch (_) {}

  return job;
}

module.exports = {
  slugifyClinicName,
  isSafePublicHttpUrl,
  detectValidImageBuffer,
  extractLogoCandidatesFromHtml,
  fetchRealLogoForWebsite,
  fetchAndAttachLogosForProject,
  getLogoFetchJobStatus
};
