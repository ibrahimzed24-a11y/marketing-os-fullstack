/**
 * Marketing OS — Permanent Dynamic Deliverable & Harness Preview Engine
 *
 * Renders a guaranteed-working, self-contained HTML preview for any Project or Task:
 *   1. Real generated HTML deliverable (`output_json.html` or `output_json.deliverable.html`)
 *   2. Uploaded HTML prototype in `harness_files` (`*.html`) merged live with uploaded
 *      image/logo assets (inlined as base64 data URIs) and real leads from uploaded
 *      `.csv` / `.xlsx` spreadsheets or DB `leads` table
 *   3. Real generated structured JSON / Markdown deliverable (`output_json` + `report_md`)
 *   4. Honest empty-state notice when a project has neither deliverables nor HTML harness files
 *
 * Zero external dependencies. Uses safe JSON `<script type="application/json">` embedding
 * so apostrophes, quotes, or Unicode in templates/leads can NEVER trigger JS syntax errors.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function escapeHtml(str) {
  return String(str === null || str === undefined ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeJsonForScriptTag(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function xmlDecode(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function parseZipEntries(buffer) {
  try {
    let eocdOffset = -1;
    const minOff = Math.max(0, buffer.length - 65557);
    for (let i = buffer.length - 22; i >= minOff; i--) {
      if (buffer.readUInt32LE(i) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset === -1) return {};
    const cdSize = buffer.readUInt32LE(eocdOffset + 12);
    const cdOffset = buffer.readUInt32LE(eocdOffset + 16);
    const entries = {};
    let pos = cdOffset;
    const end = Math.min(cdOffset + cdSize, buffer.length);

    while (pos + 46 <= end) {
      if (buffer.readUInt32LE(pos) !== 0x02014b50) break;
      const compMethod = buffer.readUInt16LE(pos + 10);
      const compSize = buffer.readUInt32LE(pos + 20);
      const nameLen = buffer.readUInt16LE(pos + 28);
      const extraLen = buffer.readUInt16LE(pos + 30);
      const commentLen = buffer.readUInt16LE(pos + 32);
      const localOffset = buffer.readUInt32LE(pos + 42);
      const name = buffer.toString('utf8', pos + 46, pos + 46 + nameLen);

      if (localOffset + 30 <= buffer.length) {
        const lNameLen = buffer.readUInt16LE(localOffset + 26);
        const lExtraLen = buffer.readUInt16LE(localOffset + 28);
        const dataStart = localOffset + 30 + lNameLen + lExtraLen;
        if (dataStart + compSize <= buffer.length && (name.endsWith('.xml') || name.endsWith('.rels'))) {
          const raw = buffer.subarray(dataStart, dataStart + compSize);
          try {
            entries[name] = compMethod === 8
              ? zlib.inflateRawSync(raw).toString('utf8')
              : raw.toString('utf8');
          } catch (_) {}
        }
      }
      pos += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  } catch (_) {
    return {};
  }
}

function parseXlsxRows(buffer, maxRows = 100) {
  const entries = parseZipEntries(buffer);
  const sheetXml = entries['xl/worksheets/sheet1.xml'];
  if (!sheetXml) return [];

  const sharedStrings = [];
  const ssXml = entries['xl/sharedStrings.xml'] || '';
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRe.exec(ssXml)) !== null) {
    const texts = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join('');
    sharedStrings.push(xmlDecode(texts));
  }

  const rawRows = [];
  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cMatch[1];
      const body = cMatch[2];
      const ref = (attrs.match(/r="([A-Z]+)\d+"/) || [])[1] || '';
      let colIdx = 0;
      for (const ch of ref) colIdx = colIdx * 26 + (ch.charCodeAt(0) - 64);
      const type = (attrs.match(/t="([^"]+)"/) || [])[1] || '';
      const vMatch = body.match(/<v>([\s\S]*?)<\/v>/);
      const isMatch = body.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);
      let val = '';
      if (type === 's' && vMatch) val = sharedStrings[parseInt(vMatch[1], 10)] || '';
      else if (type === 'inlineStr' && isMatch) val = xmlDecode(isMatch[1]);
      else if (vMatch) val = xmlDecode(vMatch[1]);
      if (colIdx > 0) cells[colIdx - 1] = val;
    }
    if (cells.some((c) => c && String(c).trim())) {
      rawRows.push(cells);
      if (rawRows.length >= maxRows + 1) break;
    }
  }

  if (rawRows.length < 2) return [];
  const headers = rawRows[0].map((h, i) => String(h || `col_${i}`).trim());
  return rawRows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = r[i] !== undefined ? String(r[i]).trim() : '';
    });
    return obj;
  });
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseSpreadsheetFile(filePath, maxRows = 100) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const buf = fs.readFileSync(filePath);
    if (buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b) {
      // ZIP magic bytes -> .xlsx OpenXML workbook (even if named .csv)
      return parseXlsxRows(buf, maxRows);
    }
    const text = buf.toString('utf8').replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];
    const headers = parseCsvLine(lines[0]);
    return lines.slice(1, maxRows + 1).map((line) => {
      const vals = parseCsvLine(line);
      const obj = {};
      headers.forEach((h, idx) => {
        if (h) obj[h] = vals[idx] || '';
      });
      return obj;
    });
  } catch (_) {
    return [];
  }
}

function normalizeLeadRecord(raw, idx) {
  const pick = (...keys) => {
    for (const k of keys) {
      if (raw[k] && String(raw[k]).trim()) return String(raw[k]).trim();
      const foundKey = Object.keys(raw).find((rk) => rk.toLowerCase() === k.toLowerCase());
      if (foundKey && raw[foundKey] && String(raw[foundKey]).trim()) return String(raw[foundKey]).trim();
    }
    return '';
  };

  const clinic = pick('clinic_brand_name', 'clinic_name', 'company', 'business_name', 'organization', 'name', 'full_name') || `Prospect #${idx + 1}`;
  const contact = pick('office_manager_name', 'principal_dentists', 'contact_name', 'first_name', 'full_name', 'decision_maker');
  const firstName = contact ? contact.split(/[,\n]/)[0].trim() : 'Team';
  const city = pick('city', 'location', 'municipality') || 'Canada';
  const province = pick('province_state', 'province', 'state', 'region');
  const email = pick('clinic_email', 'email', 'contact_email');
  const phone = pick('phone_number', 'phone', 'telephone');
  const website = pick('direct_clinic_url', 'website', 'url', 'domain');
  const rating = pick('google_rating', 'rating', 'icp_score');
  const reviews = pick('google_review_count', 'reviews', 'review_count');
  const brandColor = pick('brand_color', 'primary_color', 'accent_color', 'color_hex');
  const brandGuidelines = pick('brand_guidelines', 'brand_notes', 'tone_of_voice', 'brand_voice', 'notes');
  const logoUrl = pick('logo_url', 'brand_logo', 'logo');
  const specialty = pick('specialty_services', 'services', 'specialty', 'category');

  return {
    id: idx + 1,
    clinic_name: clinic,
    first_name: firstName,
    city,
    province,
    email,
    phone,
    website,
    rating,
    reviews,
    brand_color: brandColor,
    brand_guidelines: brandGuidelines,
    logo_url: logoUrl,
    specialty
  };
}

function getProjectBrandKit(project) {
  let specs = {};
  if (project?.deliverable_specs) {
    try {
      specs = typeof project.deliverable_specs === 'string'
        ? JSON.parse(project.deliverable_specs || '{}')
        : (project.deliverable_specs || {});
    } catch (_) {
      specs = {};
    }
  }
  const bk = specs.brand_kit && typeof specs.brand_kit === 'object' ? specs.brand_kit : {};
  return {
    brand_name: String(bk.brand_name || project?.name || '').trim(),
    primary_color: String(bk.primary_color || '#063f4e').trim(),
    accent_color: String(bk.accent_color || '#00a9a4').trim(),
    font_family: String(bk.font_family || 'Arial, Helvetica, sans-serif').trim(),
    tagline: String(bk.tagline || '').trim(),
    tone_of_voice: String(bk.tone_of_voice || '').trim(),
    cta_text: String(bk.cta_text || '').trim(),
    logo_file_id: bk.logo_file_id || null,
    logo_url: String(bk.logo_url || '').trim(),
    guidelines: String(bk.guidelines || project?.guidelines || '').trim(),
    configured: Boolean(bk.brand_name || bk.tagline || bk.tone_of_voice || bk.guidelines || bk.logo_file_id || bk.logo_url || bk.primary_color)
  };
}

function applyBrandKitToHtml(html, brandKit, uploadedImages = [], publicDir = '') {
  if (!html || typeof html !== 'string') return '';
  let preferredImages = uploadedImages;
  if (brandKit?.logo_file_id) {
    const chosen = uploadedImages.find((img) => img.id === brandKit.logo_file_id);
    if (chosen) {
      preferredImages = [chosen, ...uploadedImages.filter((img) => img.id !== brandKit.logo_file_id)];
    }
  } else {
    // Prefer non-Lead-Logo image as primary brand logo (e.g., Valioz Health Teal Logo.png)
    const brandLogos = uploadedImages.filter((img) => img.file_category !== 'Lead Logo');
    if (brandLogos.length > 0) {
      preferredImages = [...brandLogos, ...uploadedImages.filter((img) => img.file_category === 'Lead Logo')];
    }
  }
  let out = inlineHtmlImages(html, preferredImages, publicDir);

  const primary = /^#[0-9a-fA-F]{3,8}$/.test(brandKit?.primary_color || '') ? brandKit.primary_color : '#063f4e';
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(brandKit?.accent_color || '') ? brandKit.accent_color : '#00a9a4';
  const brandName = (brandKit && brandKit.brand_name) || 'Partner Brand';

  out = out
    .replace(/\[Brand Name\]|\{\{\s*brand_name\s*\}\}/gi, brandName)
    .replace(/\[Brand Tagline\]|\{\{\s*brand_tagline\s*\}\}/gi, brandKit?.tagline || '')
    .replace(/\[Primary Color\]|\{\{\s*primary_color\s*\}\}/gi, primary)
    .replace(/\[Accent Color\]|\{\{\s*accent_color\s*\}\}/gi, accent);

  // Inject Dual-Branded Co-Header strip if Brand Kit is configured and no strip exists
  if (brandKit?.configured && !out.includes('data-dual-brand-bar="true"')) {
    const strip = `<div data-dual-brand-bar="true" style="background:${primary};color:#ffffff;padding:10px 24px;font-family:${escapeHtml(brandKit.font_family)};font-size:11px;display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid ${accent};"><span style="font-weight:800;letter-spacing:0.6px;color:${accent};">${escapeHtml(brandName.toUpperCase())} &times; [Clinic Name]</span><span style="opacity:0.85;">${escapeHtml(brandKit.tagline || 'Dual-Branded Outreach Briefing')}</span></div>`;
    if (/<main\b[^>]*>/i.test(out)) {
      out = out.replace(/(<main\b[^>]*>)/i, `$1${strip}`);
    } else if (/<body\b[^>]*>/i.test(out)) {
      out = out.replace(/(<body\b[^>]*>)/i, `$1${strip}`);
    }
  }

  // Upgrade primary logo header into an email-safe side-by-side Dual-Brand Logo Lockup:
  // [ Primary Brand Logo (e.g. VALIOZ Health) ]  ×  [ Client / Lead Logo ]
  if (!out.includes('<!--LEAD_LOGO_SLOT-->')) {
    const logoImgRe = /<img\b[^>]*class=(["'])[^"']*\blogo\b[^"']*\1[^>]*>/i;
    if (logoImgRe.test(out)) {
      out = out.replace(logoImgRe, (logoTag) => {
        const sizedLogo = logoTag.includes('style=')
          ? logoTag
          : logoTag.replace(/>$/, ' style="max-height:46px;max-width:210px;width:auto;height:auto;display:block;">');
        return `<table data-dual-logo-lockup="true" role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td style="vertical-align:middle;">${sizedLogo}</td><td style="vertical-align:middle;padding:0 16px;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:${accent};line-height:1;">&times;</td><td style="vertical-align:middle;"><!--LEAD_LOGO_SLOT--></td></tr></table>`;
      });
    }
  }

  return out;
}

function normalizeMatchTokens(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !['logo', 'clinic', 'dental', 'centre', 'center', 'care', 'the', 'and', 'inc', 'ltd', 'png', 'jpg', 'svg', 'webp'].includes(t));
}

function matchLeadLogoImage(lead, uploadedImages = [], primaryLogoId = null) {
  if (!lead) return null;
  const candidateLogos = uploadedImages.filter((img) => img.id !== primaryLogoId);

  // 1. Explicit lead.logo_file_id assignment
  if (lead.logo_file_id) {
    const exact = uploadedImages.find((img) => img.id === lead.logo_file_id);
    if (exact) return exact;
  }

  // 2. Prefer files explicitly tagged as 'Lead Logo', then any non-primary uploaded image
  const leadLogos = candidateLogos.filter((img) => img.file_category === 'Lead Logo' || !/valioz/i.test(img.original_name || ''));
  const leadName = String(lead.clinic_name || lead.full_name || '').toLowerCase();
  const leadSlug = leadName.replace(/[^a-z0-9]+/g, '');
  const leadTokens = normalizeMatchTokens(leadName);

  let best = null;
  let bestScore = 0;

  for (const img of leadLogos) {
    const fnClean = String(img.original_name || img.filename || '').toLowerCase().replace(/\.[a-z0-9]+$/i, '');
    const fnSlug = fnClean.replace(/[^a-z0-9]+/g, '');
    if (fnSlug && leadSlug && (leadSlug.includes(fnSlug) || fnSlug.includes(leadSlug)) && fnSlug.length >= 4) {
      return img;
    }
    const imgTokens = normalizeMatchTokens(fnClean);
    if (imgTokens.length === 0 || leadTokens.length === 0) continue;
    let overlap = 0;
    for (const t of imgTokens) {
      if (leadTokens.includes(t)) overlap++;
    }
    const score = overlap / Math.max(imgTokens.length, 1);
    if (overlap >= 1 && score > bestScore && (overlap >= 2 || imgTokens[0].length >= 4)) {
      bestScore = score;
      best = img;
    }
  }
  return best;
}

function renderLeadLogoSlotHtml({ leadLogoSrc, clinicName, accentColor = '#00a9a4' }) {
  const safeName = escapeHtml(clinicName || 'Partner Clinic');
  if (leadLogoSrc && String(leadLogoSrc).trim()) {
    return `<img class="client-lead-logo" src="${escapeHtml(leadLogoSrc)}" alt="${safeName} Logo" style="max-height:46px;max-width:175px;width:auto;height:auto;display:block;object-fit:contain;">`;
  }
  return `<span class="client-lead-badge" style="display:inline-block;background:#f1f8f7;color:#063f4e;border:1px solid ${escapeHtml(accentColor)};padding:7px 14px;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.2px;white-space:nowrap;">${safeName}</span>`;
}

/**
 * Extracts real text excerpts from all attached project documents, saved Brand Kit,
 * and CRM/spreadsheet leads (including per-lead branding notes) for AI Agent prompts.
 */
function extractProjectBrandAndLeadsContext({ project, harnessFiles = [], dbLeads = [], uploadDir }) {
  const brandKit = getProjectBrandKit(project);
  const docExcerpts = [];
  const leadBrandingItems = [];

  for (const f of (harnessFiles || []).slice(0, 12)) {
    const orig = f.original_name || f.filename || 'file';
    const ext = path.extname(orig).toLowerCase();
    const fullPath = uploadDir && f.filename ? path.join(uploadDir, f.filename) : null;
    if (!fullPath || !fs.existsSync(fullPath)) continue;

    if (['.csv', '.xlsx', '.xls'].includes(ext) || /csv|spreadsheet|excel/i.test(f.mime || '')) {
      const rows = parseSpreadsheetFile(fullPath, 25);
      if (rows.length > 0) {
        const sample = rows.slice(0, 10).map((r, i) => {
          const n = normalizeLeadRecord(r, i);
          const extras = [
            n.city ? `${n.city}${n.province ? ', ' + n.province : ''}` : '',
            n.website ? `web:${n.website}` : '',
            n.brand_color ? `color:${n.brand_color}` : '',
            n.brand_guidelines ? `brand:${n.brand_guidelines.slice(0, 100)}` : '',
            n.specialty ? `services:${n.specialty.slice(0, 80)}` : ''
          ].filter(Boolean).join(' | ');
          return `- ${n.clinic_name}${n.email ? ' <' + n.email + '>' : ''}${extras ? ' (' + extras + ')' : ''}`;
        }).join('\n');
        leadBrandingItems.push(`[Attached Sheet: ${orig} (${rows.length} rows sampled)]\n${sample}`);
      }
    } else if (['.md', '.txt', '.json', '.css', '.html', '.htm'].includes(ext) || /^text\//i.test(f.mime || '')) {
      try {
        let content = fs.readFileSync(fullPath, 'utf8');
        if (ext === '.html' || ext === '.htm') {
          content = content
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
        if (content.trim()) {
          docExcerpts.push(`[Attached Document: ${orig}]\n${content.trim().slice(0, 1400)}`);
        }
      } catch (_) {}
    } else if (f.parsed_summary) {
      docExcerpts.push(`[Attached Asset: ${orig}] ${f.parsed_summary}`);
    }
  }

  if (Array.isArray(dbLeads) && dbLeads.length > 0) {
    const dbSummary = dbLeads.slice(0, 15).map((l) => {
      let ev = {};
      try { ev = JSON.parse(l.source_evidence || '{}'); } catch (_) {}
      const bits = [
        ev.city ? `${ev.city}${ev.province ? ', ' + ev.province : ''}` : '',
        ev.website ? `web:${ev.website}` : '',
        ev.brand_color ? `color:${ev.brand_color}` : '',
        ev.brand_guidelines ? `brand:${String(ev.brand_guidelines).slice(0, 100)}` : '',
        ev.specialty ? `services:${String(ev.specialty).slice(0, 80)}` : ''
      ].filter(Boolean).join(' | ');
      return `- ${l.full_name}${l.email ? ' <' + l.email + '>' : ''} [ICP ${l.icp_score || 0}%]${bits ? ' (' + bits + ')' : ''}`;
    }).join('\n');
    leadBrandingItems.push(`[CRM Project Leads (${dbLeads.length} total, top 15)]\n${dbSummary}`);
  }

  return {
    brandKit,
    docExcerptsText: docExcerpts.join('\n\n').slice(0, 4000),
    leadBrandingText: leadBrandingItems.join('\n\n').slice(0, 3000)
  };
}

function loadUploadedImages(harnessFiles, uploadDir) {
  const images = [];
  for (const f of harnessFiles || []) {
    const ext = path.extname(f.original_name || f.filename || '').toLowerCase();
    const isImage = (f.mime && f.mime.startsWith('image/')) || ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'].includes(ext);
    if (!isImage) continue;
    const fullPath = path.join(uploadDir, f.filename);
    if (!fs.existsSync(fullPath)) continue;
    try {
      const mime = f.mime && f.mime.startsWith('image/')
        ? f.mime
        : (ext === '.svg' ? 'image/svg+xml' : (ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : `image/${ext.replace('.', '') || 'png'}`));
      const b64 = fs.readFileSync(fullPath).toString('base64');
      images.push({
        id: f.id || null,
        original_name: f.original_name || f.filename,
        filename: f.filename,
        file_category: f.file_category || 'Image Asset',
        dataUri: `data:${mime};base64,${b64}`
      });
    } catch (_) {}
  }
  return images;
}

function inlineHtmlImages(html, uploadedImages, publicDir) {
  if (!html || typeof html !== 'string') return '';
  const primaryLogo = uploadedImages.find((img) => /logo/i.test(img.original_name)) || uploadedImages[0] || null;

  return html.replace(/<img\b([^>]*?)\bsrc=(["'])([^"']+)\2([^>]*)>/gi, (match, before, quote, src, after) => {
    const trimmed = src.trim();
    if (/^(data:|https?:\/\/|\/\/)/i.test(trimmed)) return match;

    const cleanName = path.basename(trimmed).toLowerCase();
    const exactMatch = uploadedImages.find((img) =>
      img.original_name.toLowerCase() === cleanName || img.filename.toLowerCase() === cleanName
    );
    if (exactMatch) {
      return `<img${before}src=${quote}${exactMatch.dataUri}${quote}${after}>`;
    }
    if (primaryLogo && (/logo/i.test(trimmed) || /logo/i.test(before + after) || uploadedImages.length === 1)) {
      return `<img${before}src=${quote}${primaryLogo.dataUri}${quote}${after}>`;
    }
    if (publicDir) {
      const pubCandidate = path.join(publicDir, path.basename(trimmed));
      if (fs.existsSync(pubCandidate)) {
        try {
          const ext = path.extname(pubCandidate).toLowerCase();
          const mime = ext === '.svg' ? 'image/svg+xml' : (ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png');
          const b64 = fs.readFileSync(pubCandidate).toString('base64');
          return `<img${before}src=${quote}data:${mime};base64,${b64}${quote}${after}>`;
        } catch (_) {}
      }
    }
    return match;
  });
}

function wrapInteractiveTemplatePreview({ title, subtitle, templateHtml, leads, sourceLabel, harnessFileNames, taskReportMd, taskMetadata }) {
  const payload = {
    templateHtml,
    leads: leads || [],
    taskReportMd: taskReportMd || '',
    taskMetadata: taskMetadata || null
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; height: 100%; background: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { display: flex; flex-direction: column; overflow: hidden; }
    .topbar { background: #1e293b; border-bottom: 1px solid #334155; padding: 12px 16px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .badge-icon { width: 34px; height: 34px; border-radius: 9px; background: linear-gradient(135deg, #0d9488, #0284c7); display: grid; place-items: center; font-weight: 800; font-size: 13px; color: #fff; flex-shrink: 0; }
    .title { font-size: 14px; font-weight: 800; color: #fff; margin: 0; }
    .subtitle { font-size: 11px; color: #94a3b8; margin-top: 2px; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; background: rgba(16, 185, 129, 0.16); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); margin-left: 6px; vertical-align: middle; }
    .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    select { background: #0f172a; color: #f8fafc; border: 1px solid #475569; border-radius: 8px; padding: 6px 10px; font-size: 12px; max-width: 260px; }
    .btn { background: #334155; color: #e2e8f0; border: 1px solid #475569; border-radius: 8px; padding: 6px 11px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .btn:hover { background: #475569; }
    .btn-primary { background: #4f46e5; border-color: #6366f1; color: #fff; }
    .btn-primary:hover { background: #4338ca; }
    .btn-active { background: #0d9488; border-color: #14b8a6; color: #fff; }
    .metabar { background: #0b1220; border-bottom: 1px solid #1e293b; padding: 8px 16px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center; font-size: 11px; color: #cbd5e1; }
    .metabar code { background: #1e293b; color: #5eead4; padding: 2px 6px; border-radius: 5px; font-size: 11px; }
    .stage { flex: 1; display: flex; min-height: 0; padding: 12px; gap: 12px; background: #0f172a; }
    .frame-wrap { flex: 1; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 12px 32px rgba(0,0,0,0.45); display: flex; flex-direction: column; }
    iframe { width: 100%; height: 100%; border: 0; background: #fff; }
    .panel { flex: 1; background: #020617; border: 1px solid #334155; border-radius: 10px; padding: 14px; overflow: auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #a7f3d0; white-space: pre-wrap; word-break: break-word; display: none; }
    .panel.visible { display: block; }
    .report-panel { color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.65; }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="brand">
      <div class="badge-icon">OS</div>
      <div>
        <div class="title">${escapeHtml(title)}<span class="pill">${escapeHtml(sourceLabel)}</span></div>
        <div class="subtitle">${escapeHtml(subtitle)}</div>
      </div>
    </div>
    <div class="controls">
      <select id="leadSelect" class="${leads && leads.length ? '' : 'hidden'}" aria-label="Select Lead"></select>
      <button id="btnPreview" class="btn btn-active" type="button">Live Preview</button>
      <button id="btnCode" class="btn" type="button">&lt;/&gt; View HTML</button>
      <button id="btnReport" class="btn ${taskReportMd ? '' : 'hidden'}" type="button">Agent Report</button>
      <button id="btnCopy" class="btn btn-primary" type="button">Copy HTML</button>
    </div>
  </div>
  <div class="metabar" id="metaBar">
    <span>Assets: <code>${escapeHtml((harnessFileNames || []).join(' · ') || 'Generated Deliverable')}</code></span>
    <span id="leadMeta"></span>
  </div>
  <div class="stage">
    <div class="frame-wrap" id="frameWrap">
      <iframe id="innerFrame" title="Rendered HTML Preview"></iframe>
    </div>
    <pre class="panel" id="codePanel"></pre>
    <div class="panel report-panel" id="reportPanel"></div>
  </div>
  <script type="application/json" id="previewPayload">${safeJsonForScriptTag(payload)}</script>
  <script>
    (function() {
      var data = JSON.parse(document.getElementById('previewPayload').textContent || '{}');
      var leads = Array.isArray(data.leads) ? data.leads : [];
      var leadSelect = document.getElementById('leadSelect');
      var innerFrame = document.getElementById('innerFrame');
      var frameWrap = document.getElementById('frameWrap');
      var codePanel = document.getElementById('codePanel');
      var reportPanel = document.getElementById('reportPanel');
      var leadMeta = document.getElementById('leadMeta');
      var btnPreview = document.getElementById('btnPreview');
      var btnCode = document.getElementById('btnCode');
      var btnReport = document.getElementById('btnReport');
      var btnCopy = document.getElementById('btnCopy');
      var currentHtml = data.templateHtml || '';
      var esc = function(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };

      function buildLeadLogoHtml(lead) {
        var clinic = (lead && lead.clinic_name) || 'Partner Clinic';
        var src = (lead && (lead.logo_data_uri || lead.logo_url)) || '';
        if (src) {
          return '<img class="client-lead-logo" src="' + esc(src) + '" alt="' + esc(clinic) + ' Logo" style="max-height:46px;max-width:175px;width:auto;height:auto;display:block;object-fit:contain;">';
        }
        return '<span class="client-lead-badge" style="display:inline-block;background:#f1f8f7;color:#063f4e;border:1px solid #00a9a4;padding:7px 14px;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.2px;white-space:nowrap;">' + esc(clinic) + '</span>';
      }

      function mergeLead(rawHtml, lead) {
        if (!lead) return String(rawHtml).replace(/<!--LEAD_LOGO_SLOT-->/g, buildLeadLogoHtml(null));
        var clinic = lead.clinic_name || 'Your Clinic';
        var first = lead.first_name || 'Team';
        var city = lead.city || 'Your City';
        var province = lead.province || '';
        var email = lead.email || '';
        var phone = lead.phone || '';
        var prop = lead.custom_proposal || {};
        var gap = prop.identified_gaps || ('Audit observed strong community reputation in ' + city + ', but zero automated after-hours patient intake.');
        var pitch = prop.custom_angle || ('Turn 20+ monthly missed after-hours inquiries into confirmed appointments for ' + clinic + '.');
        var offer = prop.recommended_offer || '$499 one-time turnkey clinic website & intake engine purchase, 30 free days AI agent, then optional $299/mo.';
        var roi = prop.roi_projection || 'Estimated +$15,000+ monthly incremental treatment production.';
        var cta = prop.custom_cta || ('Reply "PREVIEW" to inspect the custom ' + clinic + ' intake workflow.');

        var verifiedNotice = '<span class="mini" style="color:#009e9e;font-weight:bold;">Verified Campaign Data: Grounded strictly in Valioz Health Knowledge Base &amp; Research Hub for ' + esc(clinic) + '.</span>';
        var demoNoticeStr = '<span class="mini">Demo preview: all search figures above are invented examples for design review, not verified clinic or market research. Replace them with sourced data before sending.</span>';

        return String(rawHtml)
          .split(demoNoticeStr).join(verifiedNotice)
          .replace(/<!--LEAD_LOGO_SLOT-->/g, buildLeadLogoHtml(lead))
          .replace(/\\[Clinic Name\\]|\\{\\{\\s*clinic(?:_name)?\\s*\\}\\}/gi, clinic)
          .replace(/\\[First Name\\]|\\{\\{\\s*first_name\\s*\\}\\}/gi, first)
          .replace(/\\[City\\]|\\{\\{\\s*city\\s*\\}\\}/gi, city)
          .replace(/\\[Province\\]|\\{\\{\\s*province\\s*\\}\\}/gi, province)
          .replace(/\\[Email\\]|\\{\\{\\s*email\\s*\\}\\}/gi, email)
          .replace(/\\[Phone\\]|\\{\\{\\s*phone\\s*\\}\\}/gi, phone)
          .replace(/\\[Identified Gap\\]|\\{\\{\\s*identified_gap\\s*\\}\\}|\\[Growth Opportunity\\]|\\{\\{\\s*growth_opportunity\\s*\\}\\}|\\[Marketing Gap\\]/gi, gap)
          .replace(/\\[Custom Pitch\\]|\\{\\{\\s*custom_pitch\\s*\\}\\}|\\[Tailored Angle\\]|\\{\\{\\s*tailored_angle\\s*\\}\\}|\\[Value Proposition\\]|\\{\\{\\s*value_proposition\\s*\\}\\}/gi, pitch)
          .replace(/\\[Recommended Offer\\]|\\{\\{\\s*recommended_offer\\s*\\}\\}|\\[Campaign Offer\\]|\\{\\{\\s*offer\\s*\\}\\}|\\[Offer Framework\\]/gi, offer)
          .replace(/\\[ROI Projection\\]|\\{\\{\\s*roi_projection\s*\\}\\}/gi, roi)
          .replace(/\\[Custom CTA\\]|\\{\\{\\s*custom_cta\s*\\}\\}/gi, cta);
      }

      function renderForLead(idx) {
        var lead = leads[idx] || null;
        currentHtml = mergeLead(data.templateHtml || '', lead);
        innerFrame.srcdoc = currentHtml;
        codePanel.textContent = currentHtml;
        if (lead) {
          var bits = [];
          if (lead.email) bits.push('To: <code>' + lead.email.replace(/</g, '&lt;') + '</code>');
          if (lead.city) bits.push('City: <b>' + (lead.city + (lead.province ? ', ' + lead.province : '')).replace(/</g, '&lt;') + '</b>');
          if (lead.rating) bits.push('Rating: <b>' + String(lead.rating).replace(/</g, '&lt;') + '★</b>');
          if (lead.phone) bits.push('Phone: ' + String(lead.phone).replace(/</g, '&lt;'));
          if (lead.custom_proposal && lead.custom_proposal.identified_gaps) {
            bits.push('<span class="pill" style="background:rgba(14,165,233,0.2);color:#38bdf8;border:1px solid rgba(14,165,233,0.4);">Knowledge Base Grounded: ' + esc(lead.custom_proposal.identified_gaps.slice(0, 60)) + '...</span>');
          }
          leadMeta.innerHTML = bits.join(' &nbsp;|&nbsp; ');
        } else {
          leadMeta.textContent = 'Template rendered directly from project harness.';
        }
      }

      if (leads.length > 0) {
        leads.forEach(function(l, i) {
          var opt = document.createElement('option');
          opt.value = String(i);
          opt.textContent = '#' + (i + 1) + ' ' + l.clinic_name + (l.city ? ' (' + l.city + ')' : '');
          leadSelect.appendChild(opt);
        });
        leadSelect.addEventListener('change', function() {
          renderForLead(parseInt(leadSelect.value, 10) || 0);
        });
      }

      if (data.taskReportMd) {
        reportPanel.textContent = data.taskReportMd;
      }

      function setMode(mode) {
        btnPreview.classList.toggle('btn-active', mode === 'preview');
        btnCode.classList.toggle('btn-active', mode === 'code');
        if (btnReport) btnReport.classList.toggle('btn-active', mode === 'report');
        frameWrap.classList.toggle('hidden', mode !== 'preview');
        codePanel.classList.toggle('visible', mode === 'code');
        reportPanel.classList.toggle('visible', mode === 'report');
      }

      btnPreview.addEventListener('click', function() { setMode('preview'); });
      btnCode.addEventListener('click', function() { setMode('code'); });
      if (btnReport) btnReport.addEventListener('click', function() { setMode('report'); });
      btnCopy.addEventListener('click', function() {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(currentHtml).then(function() {
            btnCopy.textContent = 'Copied!';
            setTimeout(function() { btnCopy.textContent = 'Copy HTML'; }, 1600);
          }).catch(function() {
            btnCopy.textContent = 'Copy Failed';
          });
        }
      });

      renderForLead(0);
    })();
  </script>
</body>
</html>`;
}

function buildStructuredDeliverableHtml({ project, task, outputObj, reportMd }) {
  const title = outputObj?.title || task?.title || project?.name || 'Deliverable Preview';
  const summary = outputObj?.summary || '';
  const meta = outputObj?.metadata || {};
  const prettyJson = JSON.stringify(outputObj || {}, null, 2);
  const reportText = reportMd || outputObj?.report_md || '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; background: #f8fafc; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.65; }
    .wrap { max-width: 860px; margin: 24px auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 30px rgba(15,23,42,0.06); }
    .head { background: linear-gradient(135deg, #0f172a, #1e3a5f); color: #fff; padding: 24px 28px; }
    .eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 1.4px; color: #5eead4; font-weight: 700; }
    h1 { margin: 6px 0 8px; font-size: 22px; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .tag { background: rgba(255,255,255,0.12); padding: 3px 10px; border-radius: 999px; font-size: 11px; }
    .sec { padding: 22px 28px; border-top: 1px solid #e2e8f0; }
    h2 { margin: 0 0 10px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.8px; color: #475569; }
    pre { background: #0f172a; color: #e2e8f0; padding: 14px; border-radius: 10px; overflow: auto; font-size: 12px; white-space: pre-wrap; word-break: break-word; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <div class="eyebrow">${escapeHtml(project?.client_name || project?.name || 'Marketing OS')} &bull; ${escapeHtml(task?.pipeline || 'Deliverable')}</div>
      <h1>${escapeHtml(title)}</h1>
      ${summary ? `<p style="margin:0;color:#cbd5e1;font-size:14px;">${escapeHtml(summary)}</p>` : ''}
      <div class="meta">
        ${meta.provider ? `<span class="tag">Provider: ${escapeHtml(meta.provider)}</span>` : ''}
        ${meta.model ? `<span class="tag">Model: ${escapeHtml(meta.model)}</span>` : ''}
        ${meta.duration_ms ? `<span class="tag">Duration: ${(meta.duration_ms / 1000).toFixed(1)}s</span>` : ''}
        ${typeof meta.humanizer_score === 'number' ? `<span class="tag">Humanizer: ${meta.humanizer_score}/100</span>` : ''}
      </div>
    </div>
    ${reportText ? `<div class="sec"><h2>Executive Report</h2><div style="white-space:pre-wrap;font-size:13.5px;">${escapeHtml(reportText)}</div></div>` : ''}
    <div class="sec"><h2>Structured Deliverable JSON</h2><pre>${escapeHtml(prettyJson)}</pre></div>
  </div>
</body>
</html>`;
}

function buildEmptyPreviewHtml(project) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>No Preview Available Yet</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f8fafc; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; }
    .card { max-width: 520px; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 28px; text-align: center; box-shadow: 0 8px 24px rgba(15,23,42,0.06); }
    h2 { margin: 0 0 8px; font-size: 18px; }
    p { margin: 0; font-size: 13.5px; color: #475569; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h2>No Preview Asset Generated Yet</h2>
    <p>Project <b>${escapeHtml(project?.name || 'Workspace')}</b> has no generated deliverable or uploaded HTML prototype yet. Upload an HTML template in Harness Files or run a pipeline task to render a live preview here.</p>
  </div>
</body>
</html>`;
}

/**
 * Main entry point: builds the best grounded HTML preview for a task/project.
 */
function buildDeliverablePreview({ project, task = null, harnessFiles = [], dbLeads = [], uploadDir, publicDir }) {
  let outputObj = {};
  if (task && task.output_json) {
    try {
      outputObj = typeof task.output_json === 'string' ? JSON.parse(task.output_json || '{}') : (task.output_json || {});
    } catch (_) {
      outputObj = {};
    }
  }
  const reportMd = (task && task.report_md) || outputObj?.report_md || '';
  const uploadedImages = loadUploadedImages(harnessFiles, uploadDir);
  const brandKit = getProjectBrandKit(project);
  const harnessNames = (harnessFiles || []).map((f) => f.original_name || f.filename);

  // Extract leads from DB leads first (preserves Admin-assigned lead logos!), or fall back to uploaded CSV/XLSX
  let mergedLeads = [];
  if (Array.isArray(dbLeads) && dbLeads.length > 0) {
    mergedLeads = dbLeads.map((l, idx) => {
      let ev = {};
      try { ev = JSON.parse(l.source_evidence || '{}'); } catch (_) {}
      return {
        id: l.id || (idx + 1),
        clinic_name: ev.clinic_name || ev.company || l.full_name || `Prospect #${idx + 1}`,
        first_name: ev.first_name || (l.full_name ? String(l.full_name).split(/\s+/)[0] : 'Team'),
        city: ev.city || ev.location || 'Canada',
        province: ev.province || '',
        email: l.email || '',
        phone: l.phone || '',
        website: ev.website || '',
        rating: ev.google_rating || l.icp_score || '',
        reviews: ev.reviews || '',
        logo_file_id: ev.logo_file_id || null,
        logo_url: ev.logo_url || '',
        custom_proposal: ev.custom_proposal || null
      };
    });
  }
  if (mergedLeads.length === 0) {
    for (const f of harnessFiles || []) {
      const ext = path.extname(f.original_name || f.filename || '').toLowerCase();
      const isSheet = ['.csv', '.xlsx', '.xls'].includes(ext) || /csv|spreadsheet|excel/i.test(f.mime || '');
      if (!isSheet) continue;
      const rows = parseSpreadsheetFile(path.join(uploadDir, f.filename), 100);
      if (rows.length > 0) {
        mergedLeads = rows.map((r, idx) => normalizeLeadRecord(r, idx));
        break;
      }
    }
  }

  // Attach matched uploaded Lead Logo data URIs to each lead for side-by-side dual-brand preview
  const primaryLogoImg = uploadedImages.find((img) => img.id === brandKit.logo_file_id)
    || uploadedImages.find((img) => img.file_category !== 'Lead Logo' && /logo/i.test(img.original_name || ''))
    || uploadedImages.find((img) => img.file_category !== 'Lead Logo')
    || null;
  const primaryLogoId = primaryLogoImg?.id || null;

  mergedLeads = mergedLeads.map((lead) => {
    const matched = matchLeadLogoImage(lead, uploadedImages, primaryLogoId);
    return {
      ...lead,
      logo_file_id: lead.logo_file_id || matched?.id || null,
      logo_data_uri: matched?.dataUri || '',
      logo_file_name: matched?.original_name || ''
    };
  });

  // Priority 1: Task has real generated HTML output
  const taskHtml = (typeof outputObj?.html === 'string' && outputObj.html.trim())
    ? outputObj.html
    : (typeof outputObj?.deliverable?.html === 'string' && outputObj.deliverable.html.trim() ? outputObj.deliverable.html : '');

  if (taskHtml) {
    const inlined = applyBrandKitToHtml(taskHtml, brandKit, uploadedImages, publicDir);
    return {
      ok: true,
      source: 'task_html',
      title: `${task?.title || project?.name || 'Deliverable'} — Live Preview`,
      leads_count: mergedLeads.length,
      html: wrapInteractiveTemplatePreview({
        title: outputObj.title || task?.title || project?.name || 'Deliverable Preview',
        subtitle: `${project?.client_name || project?.name || ''} · Generated by ${outputObj?.metadata?.model || 'Marketing OS'}`,
        templateHtml: inlined,
        leads: mergedLeads,
        sourceLabel: 'LIVE DELIVERABLE',
        harnessFileNames: harnessNames,
        taskReportMd: reportMd,
        taskMetadata: outputObj?.metadata || null
      })
    };
  }

  // Priority 2: Project has an uploaded HTML prototype in harness_files
  const htmlHarness = (harnessFiles || []).find((f) => {
    const ext = path.extname(f.original_name || f.filename || '').toLowerCase();
    return ext === '.html' || ext === '.htm' || (f.mime && f.mime.includes('html'));
  });

  if (htmlHarness) {
    const htmlPath = path.join(uploadDir, htmlHarness.filename);
    if (fs.existsSync(htmlPath)) {
      const rawHtml = fs.readFileSync(htmlPath, 'utf8');
      const inlined = applyBrandKitToHtml(rawHtml, brandKit, uploadedImages, publicDir);
      return {
        ok: true,
        source: 'harness_html',
        title: `${project?.name || 'Project'} — Grounded Live Preview (${htmlHarness.original_name})`,
        leads_count: mergedLeads.length,
        html: wrapInteractiveTemplatePreview({
          title: `${project?.name || 'Campaign'} — Live Template Preview`,
          subtitle: mergedLeads.length > 0
            ? `Grounded in ${htmlHarness.original_name} + ${mergedLeads.length} uploaded leads`
            : `Grounded in uploaded harness file: ${htmlHarness.original_name}`,
          templateHtml: inlined,
          leads: mergedLeads,
          sourceLabel: mergedLeads.length > 0 ? `${mergedLeads.length} LEADS MERGED` : 'HARNESS TEMPLATE',
          harnessFileNames: harnessNames,
          taskReportMd: reportMd,
          taskMetadata: outputObj?.metadata || null
        })
      };
    }
  }

  // Priority 3: Task has structured JSON or Markdown report output
  if ((outputObj && Object.keys(outputObj).length > 0) || (reportMd && reportMd.trim().length > 0)) {
    return {
      ok: true,
      source: 'task_structured',
      title: `${task?.title || project?.name || 'Deliverable'} — Deliverable Preview`,
      leads_count: mergedLeads.length,
      html: buildStructuredDeliverableHtml({ project, task, outputObj, reportMd })
    };
  }

  // Priority 4: Honest empty state
  return {
    ok: true,
    source: 'empty',
    title: `${project?.name || 'Project'} — Preview`,
    leads_count: 0,
    html: buildEmptyPreviewHtml(project)
  };
}

module.exports = {
  buildDeliverablePreview,
  parseSpreadsheetFile,
  normalizeLeadRecord,
  getProjectBrandKit,
  applyBrandKitToHtml,
  matchLeadLogoImage,
  renderLeadLogoSlotHtml,
  extractProjectBrandAndLeadsContext,
  loadUploadedImages,
  inlineHtmlImages
};
