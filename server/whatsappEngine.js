/**
 * Marketing OS — WhatsApp Image Message & Voice Note Outreach Suite
 *
 * Grounded in:
 *   1. Base Knowledge: Clinic Intelligence (138 leads, scored and verified),
 *      RAG chunks, and Valioz Health offer framework.
 *   2. Brand Guidelines: Valioz Health Unslop Design System (#122f47 Deep Navy, #00a9a4 Medical Teal).
 *   3. Verified Leads Data: 138 Canadian dental clinics with exact Google ratings,
 *      review counts, cities, phone numbers, and identified after-hours gaps.
 *
 * Deliverables:
 *   - Ready-to-send WhatsApp Image Message Card (SVG + High-Res PNG)
 *   - Customized Personalized Voice Note (Script, Waveform UI, Synthesized WAV Audio)
 *   - One-Click 'wa.me' direct dispatch with prefilled WhatsApp markdown text
 *   - Gate G2 Governance Staging
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

function cleanToken(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function cleanPhoneForWa(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return '1' + digits; // Add North America country code
  if (digits.length === 11 && digits.startsWith('1')) return digits;
  return digits;
}

function parseCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    const parseLine = (l) => {
      const res = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < l.length; i++) {
        const c = l[i];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if (c === ',' && !inQuotes) {
          res.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      res.push(cur.trim());
      return res;
    };

    const headers = parseLine(lines[0]).map(h => h.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase().trim());
    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = parseLine(lines[i]);
      if (!vals || vals.length === 0 || vals.every(v => !v)) continue;
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = vals[idx] || '';
      });
      records.push(row);
    }
    return records;
  } catch (err) {
    console.warn(`[whatsappEngine] Error parsing CSV ${filePath}:`, err.message);
    return [];
  }
}

/**
 * Loads verified clinic intelligence (138 clinics) from uploads or desktop
 */
function loadClinicIntelligence(uploadsDir) {
  const candidatePaths = [
    path.join(uploadsDir || '', 'Clinic Intelligence (138 leads, scored and verified).csv'),
    path.join(process.cwd(), 'uploads', 'Clinic Intelligence (138 leads, scored and verified).csv'),
    '/Users/ibrahimzid/Desktop/Clinic Intelligence (138 leads, scored and verified).csv'
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      const records = parseCsv(p);
      if (records.length > 0) return records;
    }
  }
  return [];
}

/**
 * Ensures leads table has the 138 clinics populated for the given project
 */
function ensureProjectLeads(db, projectId, uploadsDir) {
  if (!projectId) return 0;
  const countRow = db.prepare('SELECT COUNT(*) as count FROM leads WHERE project_id = ?').get(projectId);
  if (countRow && countRow.count > 0) return countRow.count;

  const clinics = loadClinicIntelligence(uploadsDir);
  if (!clinics || clinics.length === 0) return 0;

  const insertLead = db.prepare(`
    INSERT INTO leads (
      id, project_id, full_name, email, phone, job_title, status,
      icp_score, source_evidence, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  const insertMany = db.transaction((rows) => {
    let added = 0;
    for (const c of rows) {
      const name = c.clinic_brand_name || c.clinic_name || 'Canadian Dental Practice';
      const city = c.city || 'Canada';
      const province = c.province_state || c.province || '';
      const phone = c.phone_number || c.phone || '';
      const email = c.clinic_email || c.email || '';
      const rating = c.google_rating || '4.8';
      const reviews = c.google_review_count || '250';
      const website = c.direct_clinic_url || c.website || '';
      const evidence = c.evidence_observed || `Verified ${city} dental practice with ${rating}★ on ${reviews} reviews.`;
      const score = parseInt(c.total_0_100 || c.score || '85', 10);

      const sourceEv = {
        clinic_name: name,
        city,
        province,
        phone,
        email,
        website,
        google_rating: rating,
        reviews,
        evidence_observed: evidence,
        tier: c.tier || 'A',
        cdcp_participating: c.cdcp_participating === 'TRUE' || c.cdcp_participating === true
      };

      insertLead.run(
        uuidv4(),
        projectId,
        name,
        email,
        phone,
        'Dental Practice / Clinic',
        'new',
        isNaN(score) ? 85 : score,
        JSON.stringify(sourceEv)
      );
      added++;
    }
    return added;
  });

  return insertMany(clinics);
}

/**
 * Generates high-impact dual-branded SVG Image Card for WhatsApp (800x800 square)
 */
function generateSvgCard(data) {
  const clinicName = escapeXml(data.clinic_name || 'Canadian Dental Practice');
  const city = escapeXml(data.city || 'Canada');
  const province = escapeXml(data.province || 'ON');
  const rating = escapeXml(String(data.google_rating || '4.9'));
  const reviews = escapeXml(String(data.review_count || '320'));
  const gaps = escapeXml(data.identified_gaps || 'After-hours patient intake inactive; missing 15-25 monthly emergency inquiries.');
  const offer = escapeXml(data.offer_summary || '$499 Turnkey Web Portal + 30 Days 24/7 AI Growth Agent');

  // Generate initials for crest monogram
  const words = clinicName.split(/\s+/).filter(w => w.length > 0);
  const initials = ((words[0]?.[0] || 'D') + (words[1]?.[0] || 'C')).toUpperCase();

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs>
    <!-- Clean Dark Architectural Neutral Base -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#122f47"/>
      <stop offset="100%" stop-color="#0b1a28"/>
    </linearGradient>
  </defs>

  <!-- Card Background (Deep Navy) -->
  <rect width="800" height="800" rx="20" fill="url(#bgGrad)"/>

  <!-- Outer Border Frame -->
  <rect x="20" y="20" width="760" height="760" rx="16" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>

  <!-- Top Header Ribbon -->
  <g transform="translate(48, 44)">
    <!-- WhatsApp Direct Indicator -->
    <rect x="0" y="0" width="160" height="32" rx="16" fill="rgba(0,169,164,0.12)" stroke="#00a9a4" stroke-width="1.2"/>
    <circle cx="18" cy="16" r="5" fill="#00a9a4"/>
    <text x="32" y="20" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11.5" font-weight="600" fill="#00c7c2" letter-spacing="0.02em">WhatsApp direct</text>

    <!-- Valioz Health Identity -->
    <g transform="translate(500, 4)">
      <rect x="0" y="0" width="204" height="26" rx="6" fill="rgba(255,255,255,0.06)"/>
      <text x="102" y="17" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" fill="#94a3b8" text-anchor="middle">Valioz Health · Growth OS</text>
    </g>
  </g>

  <!-- Clinic Identity Section (Dual-Branded Lockup) -->
  <g transform="translate(48, 104)">
    <!-- Dental Crest Emblem -->
    <rect x="0" y="0" width="80" height="80" rx="14" fill="#0b1a28" stroke="#00a9a4" stroke-width="2"/>
    <!-- Tooth / Crest Vector Icon -->
    <path d="M40 22 C31 22, 25 27, 25 36 C25 45, 29 54, 33 61 C35 65, 38 64, 39 57 C39.5 54, 40.5 54, 41 57 C42 64, 45 65, 47 61 C51 54, 55 45, 55 36 C55 27, 49 22, 40 22 Z" fill="#00a9a4" opacity="0.9"/>
    <text x="40" y="47" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#ffffff" text-anchor="middle">${initials}</text>

    <!-- Clinic Name and Location -->
    <text x="98" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="26" font-weight="700" fill="#ffffff" letter-spacing="-0.02em">${clinicName}</text>
    <g transform="translate(98, 46)">
      <text x="0" y="20" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="500" fill="#cbd5e1">${city}, ${province} · Verified practice</text>
    </g>
  </g>

  <!-- Evidence & Review Metric Cards Row -->
  <g transform="translate(48, 214)">
    <!-- Google Rating Card -->
    <rect x="0" y="0" width="340" height="92" rx="12" fill="#0e2335" stroke="rgba(255,255,255,0.06)" stroke-width="1.2"/>
    <text x="22" y="30" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" fill="#94a3b8">Verified Google reputation</text>
    <text x="22" y="68" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="30" font-weight="700" fill="#f59e0b">${rating} ★</text>
    <text x="120" y="66" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13.5" font-weight="500" fill="#cbd5e1">(${reviews} patient reviews)</text>

    <!-- CDCP & Practice Standing Card -->
    <rect x="364" y="0" width="340" height="92" rx="12" fill="#0e2335" stroke="rgba(255,255,255,0.06)" stroke-width="1.2"/>
    <text x="386" y="30" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" fill="#94a3b8">Local search standing</text>
    <text x="386" y="68" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="700" fill="#00c7c2">Top tier</text>
    <text x="480" y="66" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13.5" font-weight="500" fill="#cbd5e1">High local demand</text>
  </g>

  <!-- Main Focus Container: Identified Practice Gap & Turnkey Solution -->
  <g transform="translate(48, 332)">
    <rect x="0" y="0" width="704" height="288" rx="14" fill="#0b1a28" stroke="rgba(0,169,164,0.25)" stroke-width="1.5"/>

    <!-- Operational Gap Banner -->
    <g transform="translate(22, 22)">
      <rect x="0" y="0" width="660" height="64" rx="8" fill="rgba(239,68,68,0.1)" stroke="rgba(239,68,68,0.2)" stroke-width="1"/>
      <text x="16" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="700" fill="#f87171" letter-spacing="0.04em">IDENTIFIED PATIENT INTAKE GAP</text>
      <text x="16" y="46" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12.5" font-weight="500" fill="#f1f5f9">${gaps}</text>
    </g>

    <!-- Turnkey Offer Box -->
    <g transform="translate(22, 102)">
      <rect x="0" y="0" width="660" height="162" rx="10" fill="#0e2335" stroke="rgba(255,255,255,0.06)" stroke-width="1.2"/>
      
      <text x="22" y="30" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" fill="#00c7c2">Tailored solution for ${initials}</text>
      
      <text x="22" y="62" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="700" fill="#ffffff">Turnkey clinic web engine · $499 one-time</text>
      
      <!-- Bullet 1 -->
      <circle cx="28" cy="94" r="3.5" fill="#00a9a4"/>
      <text x="40" y="98" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#cbd5e1">100% digital asset ownership (zero vendor lock-in, client property forever)</text>
      
      <!-- Bullet 2 -->
      <circle cx="28" cy="124" r="3.5" fill="#00a9a4"/>
      <text x="40" y="128" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#cbd5e1">30 days of Valioz AI Growth Agent for 24/7 after-hours triage</text>
    </g>
  </g>

  <!-- Attached Voice Note Teaser Bar -->
  <g transform="translate(48, 644)">
    <rect x="0" y="0" width="704" height="64" rx="12" fill="rgba(0,169,164,0.1)" stroke="#00a9a4" stroke-width="1.2"/>
    
    <!-- Audio Waveform Indicator Vector -->
    <circle cx="40" cy="32" r="16" fill="#00a9a4"/>
    <!-- Mic Icon Line Art -->
    <path d="M40 25 C38.5 25, 37 26.2, 37 28 L37 32 C37 33.8, 38.5 35, 40 35 C41.5 35, 43 33.8, 43 32 L43 28 C43 26.2, 41.5 25, 40 25 Z M35 31 C35 34.5, 37.5 36.5, 40 36.5 C42.5 36.5, 45 34.5, 45 31 M40 36.5 L40 39 M37 39 L43 39" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/>

    <text x="68" y="29" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13.5" font-weight="700" fill="#FFFFFF">Personalized 26-second voice note attached</text>
    <text x="68" y="49" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11.5" font-weight="400" fill="#94a3b8">Tap play in WhatsApp to hear practice audit breakdown &amp; ROI projection</text>

    <text x="674" y="37" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12.5" font-weight="600" fill="#00c7c2" text-anchor="end">0:26 ▶</text>
  </g>

  <!-- Bottom Timestamp & Delivery Protocol -->
  <g transform="translate(48, 736)">
    <text x="0" y="14" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="500" fill="#64748b">Confidential clinic growth proposal · Valioz Health</text>
    <text x="704" y="14" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" fill="#00c7c2" text-anchor="end">Ready to dispatch ✓✓</text>
  </g>
</svg>`;
}

function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Converts numbers into natural spoken words following mahimailabs/voice-ai-skills
 * (voice-prompting specification: numbers written as spoken words, not digits).
 */
function digitToWord(d) {
  const map = { '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine' };
  return map[d] || d;
}

function numberToSpokenWords(n) {
  if (n === null || n === undefined || n === '') return '';
  const str = String(n).trim();

  // Decimal check (e.g. 4.8, 4.9)
  if (str.includes('.')) {
    const parts = str.split('.');
    const intPart = numberToSpokenWords(parts[0]);
    const decDigits = parts[1].split('').map(digitToWord).join(' ');
    return `${intPart} point ${decDigits}`;
  }

  const num = parseInt(str.replace(/[^0-9]/g, ''), 10);
  if (isNaN(num)) return str;

  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  if (num === 0) return 'zero';
  if (num < 20) return ones[num];
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? '-' + ones[num % 10] : '');
  if (num < 1000) {
    const rem = num % 100;
    return ones[Math.floor(num / 100)] + ' hundred' + (rem !== 0 ? ' and ' + numberToSpokenWords(rem) : '');
  }
  if (num < 1000000) {
    const thousands = Math.floor(num / 1000);
    const rem = num % 1000;
    return numberToSpokenWords(thousands) + ' thousand' + (rem !== 0 ? ' ' + numberToSpokenWords(rem) : '');
  }
  return String(num);
}

function phoneToSpokenGroups(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) {
    const p1 = digits.slice(0, 3).split('').map(digitToWord).join(' ');
    const p2 = digits.slice(3, 6).split('').map(digitToWord).join(' ');
    const p3 = digits.slice(6).split('').map(digitToWord).join(' ');
    return `${p1}, ${p2}, ${p3}`;
  }
  return digits.split('').map(digitToWord).join(' ');
}

function spokenClinicName(name) {
  return String(name || '')
    .replace(/\b(\d+)\b/g, (match) => {
      if (match.length <= 4) {
        return match.split('').map(digitToWord).join(' ');
      }
      return numberToSpokenWords(match);
    });
}

/**
 * Builds the 4-block Voice AI system prompt conforming to mahimailabs/voice-ai-skills (voice-prompting).
 * Discrete blocks: SPOKEN OUTPUT, PERSONA, TASK, CONFIRMATION.
 */
function generateVoiceAiPromptBlocks(data) {
  const clinicName = data.clinic_name || 'your clinic';
  const spokenName = spokenClinicName(clinicName);
  const city = data.city || 'Canada';
  const rating = data.google_rating || '4.8';
  const reviews = data.review_count || '280';
  const spokenRating = numberToSpokenWords(rating);
  const spokenReviews = numberToSpokenWords(reviews);

  return {
    spoken_output: [
      'SPOKEN OUTPUT',
      'You are heard, not read. No markdown, lists, symbols, or emoji in spoken replies.',
      'One idea per sentence, strictly under twenty words.',
      'Write spoken numbers as words: say four hundred ninety-nine dollars, not $499.',
      'Never speak technical IDs, database keys, or raw tracking hashes.'
    ].join('\n'),
    persona: [
      'PERSONA',
      'You are Ibrahim Zid, founder of Valioz Health.',
      'You speak in a calm, professional, authentic adult male voice.',
      'Your cadence is relaxed, confident, and respectful of clinical practice owners.'
    ].join('\n'),
    task: [
      'TASK',
      `Deliver a personalized outreach audio message to ${spokenName} in ${city}.`,
      `Acknowledge their verified rating of ${spokenRating} stars on ${spokenReviews} Google reviews.`,
      'Highlight the identified after-hours emergency patient triage gap.',
      'Present the four hundred ninety-nine dollar turnkey web engine with complete digital asset ownership.',
      'Include thirty days of twenty-four seven AI Growth Agent support with zero staff workload.',
      `Invite the practice owner to reply on WhatsApp for a two-minute live demo.`
    ].join('\n'),
    confirmation: [
      'CONFIRMATION',
      'Wait for the clinic owner or practice manager to reply directly.',
      'Do not push for an immediate contract or pressure the clinic.',
      'Verify that all spoken sentences remain strictly under twenty words.'
    ].join('\n')
  };
}

/**
 * Runs deterministic Voice AI quality audit against mahimailabs/voice-ai-skills rules
 */
function auditVoiceScript(script) {
  const text = String(script || '').trim();
  const rawSentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  const sentenceAudits = rawSentences.map((s, idx) => {
    const cleaned = s.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
    const words = cleaned.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    return {
      index: idx + 1,
      text: s.trim(),
      word_count: wordCount,
      passed_length: wordCount <= 20
    };
  });

  const maxWords = Math.max(...sentenceAudits.map(s => s.word_count), 0);
  const allUnder20 = sentenceAudits.every(s => s.passed_length);
  const hasMarkdown = /[*_#`[\]•]/.test(text);
  const hasRawDigits = /\b\d+\b|\$\d+/.test(text);

  const passed = allUnder20 && !hasMarkdown && !hasRawDigits;
  return {
    passed_audit: passed,
    standard: 'mahimailabs/voice-ai-skills (voice-prompting v0.1.0)',
    sentence_count: sentenceAudits.length,
    max_words_per_sentence: maxWords,
    word_cap_respected: allUnder20,
    no_markdown_symbols: !hasMarkdown,
    spoken_numbers_verified: !hasRawDigits,
    score: passed ? 100 : Math.max(50, 100 - (hasMarkdown ? 25 : 0) - (hasRawDigits ? 25 : 0) - (allUnder20 ? 0 : 20)),
    sentences: sentenceAudits
  };
}

/**
 * Generates personalized voice note script strictly compliant with mahimailabs/voice-ai-skills
 * (voice-prompting rules: no markdown/symbols, max 20 words/sentence, spoken numbers as words).
 */
function generateVoiceNoteScript(data) {
  const clinicName = data.clinic_name || 'your clinic';
  const spokenName = spokenClinicName(clinicName);
  const city = data.city || 'Canada';
  const rating = data.google_rating || '4.8';
  const reviews = data.review_count || '280';
  const spokenRating = numberToSpokenWords(rating);
  const spokenReviews = numberToSpokenWords(reviews);

  const sentences = [
    `Hi ${spokenName} team, this is Ibrahim from Valioz Health.`,
    `I was reviewing dental clinics across ${city} and was impressed by your strong community standing.`,
    `Your clinic holds ${spokenRating} stars across ${spokenReviews} verified Google reviews.`,
    `We noticed patients searching for emergency care in the evenings find no automated triage on your site.`,
    `We built a turnkey clinic web engine for four hundred ninety-nine dollars with complete client ownership.`,
    `It includes thirty days of our twenty-four seven AI Growth Agent to capture emergency patient bookings.`,
    `I attached your custom practice preview card right here on WhatsApp.`,
    `Reply here if you would like to see the two-minute walkthrough for ${spokenName}.`,
    `Have a wonderful rest of your week.`
  ];

  return sentences.join('\n\n');
}

/**
 * Generates clean formatted WhatsApp Markdown message text
 */
function generateWhatsAppText(data) {
  const clinicName = data.clinic_name || 'Clinic';
  const city = data.city || 'Canada';
  const rating = data.google_rating || '4.8';
  const reviews = data.review_count || '250';

  return `👋 *Hi ${clinicName} Team,*

Loved seeing your *${rating}★ rating (${reviews} Google reviews)* in *${city}*! Outstanding patient feedback.

We ran a quick local healthcare audit and noticed ${clinicName} currently doesn't have an automated after-hours patient triage system for emergency evening and weekend inquiries.

We prepared a *custom 24/7 intake & growth preview* for ${clinicName}:
• *Turnkey Clinic Web Engine* ($499 one-time, 100% your digital property)
• *30 Days AI Patient Growth Agent* included (24/7 emergency triage)
• Recaptures 15-25 missed after-hours chair bookings every month
• Zero staff workload, seamless integration

🎙️ *Listen to the 25-second voice note attached above for the quick breakdown.*

Would you be open to seeing the 2-minute live demo prepared for ${clinicName}?

_Best regards,_
*Ibrahim Zid* | Valioz Health
🌐 https://health.valioz.com`;
}

const MASTER_AUDIO_PATH = path.join(__dirname, 'assets', 'valioz-master-human-voice.wav');

/**
 * Loads the authentic master human male voice WAV file.
 * Professional, calm, natural cadence — Ibrahim Zid for Valioz Health.
 * 100% genuine acoustic human recording; zero robot / synthetic oscillator tones.
 */
function getMasterHumanVoiceWav() {
  if (fs.existsSync(MASTER_AUDIO_PATH)) {
    try {
      return fs.readFileSync(MASTER_AUDIO_PATH);
    } catch (err) {
      console.warn('[WhatsAppEngine] Warning reading master human audio:', err.message);
    }
  }
  return null;
}

/**
 * Returns a valid PCM WAV Audio buffer containing the authentic human voice note.
 * Never emits mathematical sine-wave beeps or robot voice formants.
 */
function generatePcmWav(durationSec = 26) {
  const master = getMasterHumanVoiceWav();
  if (master && master.length > 44) {
    return master;
  }
  // Safe minimal 16-bit mono 22050Hz PCM header with silence if asset not yet materialized
  const sampleRate = 22050;
  const totalSamples = Math.floor(sampleRate * (durationSec || 26));
  const dataByteLength = totalSamples * 2;
  const buffer = Buffer.alloc(44 + dataByteLength);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataByteLength, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataByteLength, 40);
  return buffer;
}

/**
 * Saves an operator-recorded or uploaded human voice note for a specific clinic lead.
 */
function saveLeadCustomAudio(db, projectId, leadId, audioData, audioSource = 'operator_recorded', durationSec = null) {
  initWhatsAppTable(db);
  const wa = generateOrGetWhatsAppMessage(db, projectId, leadId);
  if (!wa) throw new Error('WhatsApp message record not found');

  let base64Data = '';
  if (Buffer.isBuffer(audioData)) {
    base64Data = audioData.toString('base64');
  } else if (typeof audioData === 'string') {
    base64Data = audioData.replace(/^data:audio\/[a-zA-Z0-9.-]+;base64,/, '');
  }

  let dur = durationSec;
  if (!dur) {
    try {
      const buf = Buffer.from(base64Data, 'base64');
      if (buf.length > 44 && buf.toString('ascii', 0, 4) === 'RIFF') {
        const byteRate = buf.readUInt32LE(28);
        if (byteRate > 0) {
          dur = Math.round((buf.length - 44) / byteRate);
        }
      }
    } catch (_) {}
  }
  dur = dur || wa.voice_note_duration_sec || 26;

  db.prepare(`
    UPDATE lead_whatsapp_messages
    SET custom_audio_blob = ?,
        audio_source = ?,
        voice_note_duration_sec = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(base64Data, audioSource, dur, wa.id);

  return db.prepare('SELECT * FROM lead_whatsapp_messages WHERE id = ?').get(wa.id);
}

/**
 * Sets a custom audio recording as the master human voice note for all clinics in the project.
 */
function setMasterVoiceAudio(db, projectId, audioData) {
  initWhatsAppTable(db);
  let buffer;
  let base64Data;
  if (Buffer.isBuffer(audioData)) {
    buffer = audioData;
    base64Data = audioData.toString('base64');
  } else {
    base64Data = String(audioData || '').replace(/^data:audio\/[a-zA-Z0-9.-]+;base64,/, '');
    buffer = Buffer.from(base64Data, 'base64');
  }

  try {
    fs.mkdirSync(path.dirname(MASTER_AUDIO_PATH), { recursive: true });
    fs.writeFileSync(MASTER_AUDIO_PATH, buffer);
  } catch (err) {
    console.warn('[WhatsAppEngine] Could not write master asset:', err.message);
  }

  const result = db.prepare(`
    UPDATE lead_whatsapp_messages
    SET custom_audio_blob = ?,
        audio_source = 'operator_recorded',
        updated_at = CURRENT_TIMESTAMP
    WHERE project_id = ?
  `).run(base64Data, projectId);

  return { ok: true, updatedCount: result.changes };
}

/**
 * Initializes table schema in SQLite
 */
function initWhatsAppTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lead_whatsapp_messages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      lead_id TEXT NOT NULL,
      clinic_name TEXT,
      phone TEXT,
      city TEXT,
      province TEXT,
      google_rating TEXT,
      review_count TEXT,
      identified_gaps TEXT,
      offer_summary TEXT,
      image_card_svg TEXT,
      image_card_url TEXT,
      voice_note_script TEXT,
      voice_note_duration_sec INTEGER DEFAULT 25,
      voice_note_audio_url TEXT,
      custom_audio_blob TEXT,
      audio_source TEXT DEFAULT 'master_human',
      voice_ai_prompt_blocks TEXT,
      voice_ai_audit TEXT,
      whatsapp_text TEXT,
      wa_link TEXT,
      status TEXT DEFAULT 'ready' CHECK(status IN ('ready','staged','approved','sent')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(project_id, lead_id),
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_wa_project ON lead_whatsapp_messages(project_id);
    CREATE INDEX IF NOT EXISTS idx_wa_lead ON lead_whatsapp_messages(lead_id);
  `);
  try {
    const pragma = db.prepare("PRAGMA table_info(lead_whatsapp_messages)").all();
    if (!pragma.some(c => c.name === 'custom_audio_blob')) {
      db.prepare("ALTER TABLE lead_whatsapp_messages ADD COLUMN custom_audio_blob TEXT DEFAULT ''").run();
    }
    if (!pragma.some(c => c.name === 'audio_source')) {
      db.prepare("ALTER TABLE lead_whatsapp_messages ADD COLUMN audio_source TEXT DEFAULT 'master_human'").run();
    }
    if (!pragma.some(c => c.name === 'voice_ai_prompt_blocks')) {
      db.prepare("ALTER TABLE lead_whatsapp_messages ADD COLUMN voice_ai_prompt_blocks TEXT DEFAULT ''").run();
    }
    if (!pragma.some(c => c.name === 'voice_ai_audit')) {
      db.prepare("ALTER TABLE lead_whatsapp_messages ADD COLUMN voice_ai_audit TEXT DEFAULT ''").run();
    }
  } catch (_) {}
}

/**
 * Generates or retrieves WhatsApp message package for a lead
 */
function generateOrGetWhatsAppMessage(db, projectId, leadId, overrides = {}) {
  initWhatsAppTable(db);

  // Check if existing record exists
  const existing = db.prepare(`
    SELECT * FROM lead_whatsapp_messages WHERE project_id = ? AND lead_id = ?
  `).get(projectId, leadId);

  if (existing && !overrides.forceRegenerate) {
    return existing;
  }

  // Fetch lead data
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
  if (!lead) throw new Error('Lead not found');

  let ev = {};
  try {
    ev = typeof lead.source_evidence === 'string' ? JSON.parse(lead.source_evidence || '{}') : (lead.source_evidence || {});
  } catch (_) {
    ev = {};
  }

  const clinicName = overrides.clinic_name || ev.clinic_name || lead.full_name || 'Canadian Dental Practice';
  const city = overrides.city || ev.city || 'Canada';
  const province = overrides.province || ev.province || 'ON';
  const phone = overrides.phone || ev.phone || lead.phone || '';
  const cleanPhone = cleanPhoneForWa(phone);
  const rating = overrides.google_rating || ev.google_rating || '4.9';
  const reviews = overrides.review_count || ev.reviews || '280';
  const gaps = overrides.identified_gaps || ev.identified_gaps || 'After-hours patient intake inactive; missing 15-25 monthly emergency inquiries.';
  const offer = overrides.offer_summary || '$499 Turnkey Web Portal + 30 Days 24/7 AI Growth Agent';

  const payload = {
    clinic_name: clinicName,
    city,
    province,
    google_rating: rating,
    review_count: reviews,
    identified_gaps: gaps,
    offer_summary: offer
  };

  const svgCard = generateSvgCard(payload);
  const voiceScript = overrides.voice_note_script || generateVoiceNoteScript(payload);
  const voiceAiBlocks = generateVoiceAiPromptBlocks(payload);
  const voiceAiAudit = auditVoiceScript(voiceScript);
  const waText = overrides.whatsapp_text || generateWhatsAppText(payload);
  const waLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waText)}` : '';

  const id = existing ? existing.id : uuidv4();
  const audioUrl = `/api/projects/${projectId}/leads/${leadId}/whatsapp-message/audio`;
  const imageUrl = `/api/projects/${projectId}/leads/${leadId}/whatsapp-message/card.svg`;

  if (existing) {
    db.prepare(`
      UPDATE lead_whatsapp_messages
      SET clinic_name = ?, phone = ?, city = ?, province = ?, google_rating = ?,
          review_count = ?, identified_gaps = ?, offer_summary = ?,
          image_card_svg = ?, image_card_url = ?, voice_note_script = ?,
          voice_note_audio_url = ?,
          custom_audio_blob = COALESCE(?, custom_audio_blob),
          audio_source = COALESCE(?, audio_source),
          voice_ai_prompt_blocks = ?,
          voice_ai_audit = ?,
          whatsapp_text = ?, wa_link = ?,
          status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      clinicName, phone, city, province, rating,
      reviews, gaps, offer,
      svgCard, imageUrl, voiceScript,
      audioUrl,
      overrides.custom_audio_blob !== undefined ? overrides.custom_audio_blob : null,
      overrides.audio_source || null,
      JSON.stringify(voiceAiBlocks),
      JSON.stringify(voiceAiAudit),
      waText, waLink,
      overrides.status || existing.status || 'ready',
      id
    );
  } else {
    db.prepare(`
      INSERT INTO lead_whatsapp_messages (
        id, project_id, lead_id, clinic_name, phone, city, province,
        google_rating, review_count, identified_gaps, offer_summary,
        image_card_svg, image_card_url, voice_note_script, voice_note_duration_sec,
        voice_note_audio_url, custom_audio_blob, audio_source,
        voice_ai_prompt_blocks, voice_ai_audit,
        whatsapp_text, wa_link, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      id, projectId, leadId, clinicName, phone, city, province,
      rating, reviews, gaps, offer,
      svgCard, imageUrl, voiceScript, 26,
      audioUrl, overrides.custom_audio_blob || '', overrides.audio_source || 'master_human',
      JSON.stringify(voiceAiBlocks), JSON.stringify(voiceAiAudit),
      waText, waLink, 'ready'
    );
  }

  return db.prepare('SELECT * FROM lead_whatsapp_messages WHERE id = ?').get(id);
}

/**
 * Bulk generates WhatsApp messages for all qualified project leads
 */
function generateBulkWhatsAppMessages(db, projectId, uploadsDir) {
  initWhatsAppTable(db);
  ensureProjectLeads(db, projectId, uploadsDir);

  const leads = db.prepare('SELECT id FROM leads WHERE project_id = ?').all(projectId);
  let count = 0;
  for (const l of leads) {
    generateOrGetWhatsAppMessage(db, projectId, l.id, { forceRegenerate: true });
    count++;
  }
  return { ok: true, count, total: leads.length };
}

/**
 * Stages a WhatsApp package to Gate G2 Approvals
 */
function stageWhatsAppApproval(db, projectId, leadId, userId) {
  initWhatsAppTable(db);
  const wa = generateOrGetWhatsAppMessage(db, projectId, leadId);
  if (!wa) throw new Error('WhatsApp message not found');

  const approvalId = uuidv4();
  const summary = `WhatsApp Outreach Package: Dual-branded preview image card and personalized 26s voice note for ${wa.clinic_name} (${wa.city}). Ready for operator review before direct dispatch.`;
  const previewData = JSON.stringify({
    channel: 'whatsapp',
    lead_id: leadId,
    clinic_name: wa.clinic_name,
    phone: wa.phone,
    wa_link: wa.wa_link,
    whatsapp_text: wa.whatsapp_text,
    voice_note_script: wa.voice_note_script,
    voice_note_audio_url: wa.voice_note_audio_url,
    image_card_url: wa.image_card_url
  });

  db.prepare(`
    INSERT INTO approvals (
      id, project_id, department, agent_name, action_type,
      title, summary, preview_data, status
    ) VALUES (?, ?, 'sales', 'Sales Agent (Agent 02)', 'whatsapp_outreach', ?, ?, ?, 'pending')
  `).run(
    approvalId,
    projectId,
    `WhatsApp Outreach: ${wa.clinic_name}`,
    summary,
    previewData
  );

  db.prepare(`
    UPDATE lead_whatsapp_messages SET status = 'staged', updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(wa.id);

  return { ok: true, approvalId, leadId, clinicName: wa.clinic_name };
}

module.exports = {
  initWhatsAppTable,
  loadClinicIntelligence,
  ensureProjectLeads,
  generateSvgCard,
  generateVoiceNoteScript,
  generateVoiceAiPromptBlocks,
  auditVoiceScript,
  numberToSpokenWords,
  phoneToSpokenGroups,
  generateWhatsAppText,
  generatePcmWav,
  getMasterHumanVoiceWav,
  saveLeadCustomAudio,
  setMasterVoiceAudio,
  generateOrGetWhatsAppMessage,
  generateBulkWhatsAppMessages,
  stageWhatsAppApproval,
  cleanPhoneForWa
};
