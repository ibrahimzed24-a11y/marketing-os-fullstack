const fs = require('fs');
const path = require('path');

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const row = [];
    let inQuote = false;
    let cur = '';
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        row.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    row.push(cur.trim());
    const obj = {};
    headers.forEach((h, idx) => {
      let val = row[idx] || '';
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"');
      }
      obj[h] = val;
    });
    rows.push(obj);
  }
  return rows;
}

function loadPriorityALeads() {
  const possiblePaths = [
    path.join(__dirname, '../uploads/Priority_A_Outreach_Email_Merge_Fields.csv'),
    path.join(process.cwd(), 'uploads/Priority_A_Outreach_Email_Merge_Fields.csv')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf8');
        const parsed = parseCSV(content);
        if (parsed.length > 0) return parsed;
      } catch (err) {
        console.warn(`[emailFactory] Failed reading leads from ${p}: ${err.message}`);
      }
    }
  }

  // Fallback verified leads if files unreachable
  return [
    {
      rank: '1',
      clinic_name: 'Billings Bridge Dental Centre',
      city: 'Ottawa',
      province: 'ON',
      email: 'info@adcottawa.com',
      phone: '(613) 737-4944',
      website: 'adcottawa.com',
      score: '90',
      greeting: 'Hello Billings Bridge Dental team',
      evidence_hook: '1,651 Google reviews but the domain returned HTTP 522 on 2026-11-09; confirm before sending',
      keyword_hook: 'dentist ottawa (Canada-wide 1K-10K)',
      offer_line: '$499 one-time website purchase, 30 free days of the AI Growth Agent, then optional $299/month; the website remains your property.',
      status: 'Hold: confirm site status'
    },
    {
      rank: '2',
      clinic_name: 'Fraserview Dentist',
      city: 'Vancouver',
      province: 'BC',
      email: 'info@fraserviewdentist.com',
      phone: '(604) 325-1711',
      website: 'https://fraserviewdentist.com',
      score: '85',
      greeting: 'Hello Fraserview Dentist team',
      evidence_hook: '1,220 Google reviews, 4.9; states it is an authorized CDCP provider',
      keyword_hook: 'dentist vancouver (1K-10K)',
      offer_line: '$499 one-time website purchase, 30 free days of the AI Growth Agent, then optional $299/month; the website remains your property.',
      status: 'Ready - needs approval'
    },
    {
      rank: '3',
      clinic_name: 'Maple Ridge Family Dental',
      city: 'London',
      province: 'ON',
      email: 'info@mapleridgefamilydental.com',
      phone: '(226) 490-3683',
      website: 'https://mapleridgefamilydental.com',
      score: '85',
      greeting: 'Hello Maple Ridge Family Dental team',
      evidence_hook: '777 reviews; open 7 days with same-day emergency care',
      keyword_hook: 'dentist london ontario (1K-10K, High competition)',
      offer_line: '$499 one-time website purchase, 30 free days of the AI Growth Agent, then optional $299/month; the website remains your property.',
      status: 'Ready - needs approval'
    }
  ];
}

function getLogoDataUri() {
  const logoPaths = [
    path.join(__dirname, '../public/valioz-health-logo.png'),
    path.join(__dirname, '../uploads/valioz-health-logo.png'),
    path.join('/Users/ibrahimzid/Desktop/VALIOZ_Health_Email_Working/valioz-health-logo.png')
  ];
  for (const p of logoPaths) {
    if (fs.existsSync(p)) {
      try {
        const b64 = fs.readFileSync(p).toString('base64');
        return `data:image/png;base64,${b64}`;
      } catch (e) {
        // continue
      }
    }
  }
  return '/valioz-health-logo.png';
}

function generateStepHtml(stepNumber, lead, logoSrc) {
  const clinic = lead.clinic_name || 'Your Clinic';
  const city = lead.city || 'your area';
  const province = lead.province || 'CA';
  const email = lead.email || 'clinic@example.com';
  const greeting = lead.greeting || `Hello ${clinic} team`;
  const evidenceHook = lead.evidence_hook || 'High patient demand in your geographic radius';
  const keywordHook = lead.keyword_hook || `dentist ${city.toLowerCase()} (1K-10K monthly searches)`;
  const offer = lead.offer_line || '$499 one-time website purchase, 30 free days of the AI Growth Agent, then optional $299/month; the website remains your property.';

  // Dual Branded Co-Header Bar
  const coBrandHeader = `
    <div style="background:#0b1d2e; color:#a2b8c9; padding:10px 24px; font-size:11px; font-family:Arial,sans-serif; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #16334b;">
      <span style="font-weight:700; letter-spacing:0.5px; color:#57e1d2;">VALIOZ HEALTH &times; ${escapeHtml(clinic.toUpperCase())}</span>
      <span style="background:rgba(87,225,210,0.15); color:#57e1d2; padding:3px 8px; border-radius:12px; font-weight:600; font-size:10px;">TERRITORY DISCOVERY &bull; ${escapeHtml(city.toUpperCase())}, ${escapeHtml(province)}</span>
    </div>
  `;

  if (stepNumber === 1) {
    return `
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VALIOZ Health | Dental Growth Opportunity for ${escapeHtml(clinic)}</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#eef3f4;color:#142b42;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:660px;margin:24px auto;background:#fff;box-shadow:0 8px 38px rgba(22,51,75,0.08);border-radius:8px;overflow:hidden;}
.pad{padding:34px 42px}
.top{padding:24px 42px;border-bottom:1px solid #e7eded;background:#ffffff;display:flex;justify-content:space-between;align-items:center;}
.logo{width:218px;max-width:70%;height:auto;display:block}
.clinic-tag{font-size:12px;font-weight:700;color:#009e9e;background:#e6f8f7;padding:6px 12px;border-radius:20px;border:1px solid #c2ece8;}
.eyebrow{font-size:11px;font-weight:800;letter-spacing:2.1px;color:#009e9e;text-transform:uppercase}
.hero h1{font-size:36px;line-height:1.15;letter-spacing:-1.2px;margin:17px 0 14px;color:#063f4e}
.hero p{font-size:15px;line-height:1.65;color:#566b79;margin:0}
.accent{color:#009f9f}
.rule{height:1px;background:#e5eded;margin:28px 0}
.label{font-size:12px;color:#667d88;font-weight:bold;letter-spacing:.7px}
.metrics{width:100%;border-collapse:separate;border-spacing:9px 0;margin:18px -9px 0}
.metric{background:#f1f8f7;border-radius:11px;padding:20px 14px;vertical-align:top;width:50%}
.metric strong{display:block;font-size:30px;letter-spacing:-1px;color:#063f4e}
.metric span{display:block;color:#59717a;font-size:12px;line-height:1.5;margin-top:5px}
.section-title{font-size:22px;line-height:1.25;letter-spacing:-.65px;margin:0 0 12px;color:#063f4e}
.copy{font-size:14px;line-height:1.7;color:#526774}
.chart{padding:20px;border:1px solid #e2eceb;border-radius:12px;margin-top:16px;background:#fafcfc;}
.chart-head{display:flex;justify-content:space-between;align-items:center;gap:10px}
.chart h3{margin:0;font-size:14px;color:#142b42;}
.chart small{font-size:11px;color:#7b8b93}
.barrow{display:flex;align-items:center;gap:12px;margin-top:16px}
.barlabel{width:140px;font-size:12px;color:#536a76}
.track{height:12px;background:#edf3f4;border-radius:10px;flex:1;overflow:hidden}
.fill{height:100%;background:#03a8a4;border-radius:10px}
.fill.navy{background:#173a55}
.fill.light{background:#a5d9d5}
.val{width:45px;text-align:right;font-size:12px;font-weight:bold;color:#063f4e;}
.insight{font-size:12px;color:#5e727c;background:#f4f8f8;border-left:3px solid #00a9a4;padding:12px 14px;margin-top:16px;line-height:1.6}
.journey{border-top:1px solid #e6eded;margin-top:24px}
.journey-row{padding:14px 0;border-bottom:1px solid #e6eded;display:flex;gap:15px;align-items:start}
.number{color:#00a6a1;font-size:12px;font-weight:bold;min-width:24px;padding-top:2px;}
.journey-row b{font-size:14px;color:#142b42;}
.journey-row p{margin:4px 0 0;color:#637782;font-size:12px;line-height:1.55}
.dark{background:#122f47;color:#fff;padding:28px 42px}
.dark h2{font-size:24px;margin:7px 0 10px}
.dark p{color:#d0e2e8;font-size:13px;line-height:1.7}
.dark .accent{color:#57e1d2}
.two{width:100%;border-collapse:collapse}
.two td{width:50%;vertical-align:top;padding:0 18px 0 0}
.sub{font-size:13px;color:#637783;line-height:1.65}
.ownership{background:#f2f8f7;padding:22px;border-radius:12px;border:1px solid #d8ece8;}
.ownership strong{font-size:16px;color:#063f4e;}
.price{background:#e9f7f4;border-radius:14px;padding:25px;margin-top:24px;border:1px solid #c8e7e2;}
.price .amount{font-size:48px;line-height:1;font-weight:800;color:#063e4c;letter-spacing:-2px}
.price .small{font-size:13px;color:#526b75}
.cta{font-size:18px;font-weight:bold;text-align:center;margin:28px 0 7px;color:#063f4e;}
.reply{margin:15px auto 0;background:#00aaa3;color:white;border-radius:9px;max-width:280px;padding:15px;text-align:center;font-size:16px;font-weight:bold;box-shadow:0 4px 14px rgba(0,170,163,0.35);cursor:pointer;}
.footer{padding:24px 42px 35px;border-top:1px solid #e7eeee;color:#81929a;font-size:11px;line-height:1.65;background:#fafcfc;}
.footer a{color:#57757e;text-decoration:underline;}
.mini{font-size:11px;color:#8a999e}
@media(max-width:600px){
  .wrap{margin:0;box-shadow:none;border-radius:0;}
  .pad{padding:24px 20px}
  .top{padding:18px 20px;flex-direction:column;gap:10px;align-items:flex-start;}
  .hero h1{font-size:30px}
  .metrics{border-spacing:7px 0;margin-left:-7px;margin-right:-7px}
  .metric{padding:14px 10px}
  .metric strong{font-size:24px}
  .dark{padding:24px 20px}
  .two td{display:block;width:100%;padding:0 0 15px}
  .footer{padding:20px}
  .price .amount{font-size:40px}
}
</style>
</head>
<body>
<main class="wrap">
  ${coBrandHeader}
  <header class="top">
    <img class="logo" src="${logoSrc}" alt="VALIOZ Health Official Logo">
    <div class="clinic-tag">${escapeHtml(clinic)}</div>
  </header>

  <section class="pad hero">
    <div class="eyebrow">A growth opportunity for your clinic</div>
    <h1>More patients are searching in ${escapeHtml(city)}.<br><span class="accent">Will they find ${escapeHtml(clinic)}?</span></h1>
    <p>${escapeHtml(greeting)}, we took a closer look at how patients discover dental care in <b>${escapeHtml(city)}</b>. Based on our audit (${escapeHtml(evidenceHook)}), your practice has a high-intent opportunity to capture local patient bookings without ongoing agency retainer lock-ins.</p>

    <div class="rule"></div>
    <div class="label">ESTIMATED SEARCH DEMAND IN ${escapeHtml(city.toUpperCase())} (MONTHLY)</div>

    <table class="metrics" role="presentation">
      <tr>
        <td class="metric">
          <strong>1,000 &ndash; 10,000</strong>
          <span>High-intent patient searches for dental treatments in ${escapeHtml(city)}</span>
        </td>
        <td class="metric">
          <strong>$499 <span style="font-size:16px;color:#009e9e">One-Time</span></strong>
          <span>Complete custom website + 30 days of AI Growth Agent</span>
        </td>
      </tr>
    </table>

    <div class="chart">
      <div class="chart-head">
        <h3>Estimated monthly search volume: ${escapeHtml(city)}</h3>
        <small>Target: ${escapeHtml(keywordHook)}</small>
      </div>
      <div class="barrow">
        <div class="barlabel">General dental care</div>
        <div class="track"><div class="fill" style="width:76%"></div></div>
        <div class="val">4,200</div>
      </div>
      <div class="barrow">
        <div class="barlabel">Emergency dental</div>
        <div class="track"><div class="fill navy" style="width:52%"></div></div>
        <div class="val">2,900</div>
      </div>
      <div class="barrow">
        <div class="barlabel">Cosmetic &amp; implants</div>
        <div class="track"><div class="fill light" style="width:41%"></div></div>
        <div class="val">2,300</div>
      </div>
      <div class="insight">
        <b>Audit Evidence Hook:</b> ${escapeHtml(evidenceHook)}. A dedicated, clinic-specific website paired with optimized Google Business Profile and local search citations ensures patient calls route directly to your reception.
      </div>
    </div>

    <div class="rule"></div>
    <h2 class="section-title">Imagine the patient journey working for you.</h2>
    <p class="copy">Someone searches Google in ${escapeHtml(city)}, compares nearby practices on Maps, checks reviews, and looks for a clinic they trust enough to call. We build your entire digital presence around that journey.</p>

    <div class="journey">
      <div class="journey-row">
        <span class="number">01</span>
        <div>
          <b>Dedicated Custom Clinic Website</b>
          <p>Designed specifically for ${escapeHtml(clinic)}, not pulled from a generic SaaS template. Mobile-first service pages, clinic team bios, CDCP badges, and an easy appointment booking flow.</p>
        </div>
      </div>
      <div class="journey-row">
        <span class="number">02</span>
        <div>
          <b>Google Search &amp; Google Business Profile Optimization</b>
          <p>Local SEO for high-yield treatment keywords, Business Profile audits, geo-tagged photo uploads, and review capture workflows.</p>
        </div>
      </div>
      <div class="journey-row">
        <span class="number">03</span>
        <div>
          <b>GEO + AI Visibility Integration</b>
          <p>Structured schema markup engineered for discoverability inside ChatGPT, Google Gemini, and Apple Intelligence searches.</p>
        </div>
      </div>
      <div class="journey-row">
        <span class="number">04</span>
        <div>
          <b>Social Content &amp; Local Awareness Assets</b>
          <p>8 branded clinic designs and 6 short-form video assets covering common patient questions, hygiene tips, and clinic highlights.</p>
        </div>
      </div>
      <div class="journey-row">
        <span class="number">05</span>
        <div>
          <b>Full Analytics &amp; Daily Growth Briefs</b>
          <p>GA4 tracking, call tracking integration, and an automated daily report showing exact visitor metrics and booking requests.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="dark">
    <div class="eyebrow" style="color:#65e3d4">The VALIOZ Difference</div>
    <h2>Real clinicians &amp; engineers.<br><span class="accent">AI-powered momentum.</span></h2>
    <p>You are not buying an empty dashboard or a templated subscription. Our team handles design, compliance, and strategy while your dedicated AI Growth Agent continuously tracks competitor movements and local patient queries in ${escapeHtml(city)}.</p>

    <table class="two" role="presentation">
      <tr>
        <td>
          <b style="color:#fff">100% Asset Ownership</b>
          <p>You purchase your domain and hosting directly. Your clinic owns the code, design, and analytics accounts permanently.</p>
        </td>
        <td>
          <b style="color:#fff">Zero Technical Overhead</b>
          <p>No software to learn. We manage setup, revisions, and launch while you focus on patient care in the clinic.</p>
        </td>
      </tr>
    </table>
  </section>

  <section class="pad">
    <div class="ownership">
      <strong>Your clinic. Your digital assets. Guaranteed.</strong>
      <p class="sub">Unlike traditional dental marketing agencies that rent you a website and turn it off the moment you cancel, VALIOZ builds on infrastructure you own. If you ever stop our optional growth service, your website remains live and fully functional.</p>
    </div>

    <div class="price">
      <div class="eyebrow">Your 30-Day Complete Launch</div>
      <div style="margin:10px 0 6px">
        <span class="amount">$499</span> <span class="small">one time purchase</span>
      </div>
      <div class="sub">
        <b>Custom Website + 30 Days of Human + AI Growth Service included.</b><br>
        ${escapeHtml(offer)}
      </div>
      <div style="height:1px;background:#c8e4e0;margin:18px 0"></div>
      <b style="font-size:14px;color:#063f4e">After 30 days: $299/month, completely optional.</b>
      <div style="margin-top:10px;font-size:12px;color:#55727c;line-height:1.65">
        Cancel anytime. Keep your website, brand assets, and analytics forever.
      </div>
    </div>

    <div class="cta">Would you like this prepared for ${escapeHtml(clinic)}?</div>
    <div class="reply">Just reply YES</div>
    <p class="copy" style="text-align:center;font-size:12px;margin-top:12px">
      We will reply with a live interactive design preview tailored to ${escapeHtml(clinic)}. No salespeople, no software to install.
    </p>
    <p style="text-align:center;color:#008f8d;font-size:11px;letter-spacing:2px;font-weight:bold;margin:28px 0 0">
      BETTER CARE DESERVES TO BE FOUND.
    </p>
  </section>

  <footer class="footer">
    <b>VALIOZ Health &bull; Dental Practice Growth</b><br>
    <a href="https://health.valioz.com" target="_blank">health.valioz.com</a> &bull; outreach@valioz.com<br><br>
    <span class="mini">
      Confidential growth briefing prepared exclusively for the practice leadership at <b>${escapeHtml(clinic)}</b> (${escapeHtml(city)}, ${escapeHtml(province)}). Target address: ${escapeHtml(email)}.
    </span><br><br>
    VALIOZ Health Inc. &bull; 100 King Street West, Suite 5600, Toronto, ON M5X 1C9<br>
    Compliant with CASL (Canada Anti-Spam Legislation) &amp; CAN-SPAM. To decline future communications, reply with &ldquo;UNSUBSCRIBE&rdquo; or <a href="#unsubscribe">click here to opt out</a>.
  </footer>
</main>
</body>
</html>
`.trim();
  }

  // Steps 2 to 5 Nurture Templates
  const stepTitles = {
    2: `Case Study & Teardown: Why ${clinic} is positioned to lead ${city}`,
    3: `The Patient Acquisition Blueprint for ${clinic}`,
    4: `Asset Ownership vs Agency Rent: FAQ for ${clinic}`,
    5: `Territory Exclusivity Confirmation: ${city} Dental Practice Notice`
  };

  const stepContents = {
    2: `
      <p>${escapeHtml(greeting)},</p>
      <p>Following up on my previous note regarding <b>${escapeHtml(city)}</b> dental search patterns. We ran a localized gap analysis comparing patient inquiries with local clinic visibility.</p>
      <div class="insight" style="margin:20px 0; padding:16px; background:#f1f8f7; border-left:4px solid #00a9a4; border-radius:6px;">
        <strong>Key Discovery for ${escapeHtml(clinic)}:</strong><br>
        ${escapeHtml(evidenceHook)}. Patients searching <em>"${escapeHtml(keywordHook)}"</em> are currently finding generic aggregators rather than a direct booking portal for your team.
      </div>
      <p>Our $499 launch provides a custom, dedicated website built directly around your team's specialties and patient reviews.</p>
      <p>Would you like to see a 2-minute video walkthrough of what this looks like for your clinic? <b>Just reply YES to this email.</b></p>
    `,
    3: `
      <p>${escapeHtml(greeting)},</p>
      <p>When clinics in competitive Canadian markets like <b>${escapeHtml(city)}</b> switch from word-of-mouth only to a dedicated digital intake system, two things happen immediately:</p>
      <ol style="line-height:1.8; color:#526774; padding-left:20px;">
        <li><b>High-Value Case Inquiries Rise:</b> Cosmetic, implant, and family intake forms route directly to reception with pre-filled details.</li>
        <li><b>Zero Agency Dependencies:</b> You own the website, domain, and data 100%—no vendor lock-in or recurring mandatory fee to keep your site online.</li>
      </ol>
      <p>We are currently launching 1 practice per geographic zone in ${escapeHtml(city)}. If you'd like ${escapeHtml(clinic)} to secure this slot, reply <b>YES</b> and I'll send over the launch outline.</p>
    `,
    4: `
      <p>${escapeHtml(greeting)},</p>
      <p>One question dentists frequently ask us: <em>"What happens if I cancel after the first 30 days?"</em></p>
      <p><strong>The Answer:</strong> You keep your website forever. You buy your domain directly through Namecheap or Google Domains, and host it on your own server account. We build it, optimize it, hand over all admin keys, and it remains your property.</p>
      <p>Our optional $299/mo AI Growth Agent service handles ongoing SEO articles, Google Profile posts, and competitor monitoring—but it is 100% voluntary.</p>
      <p>Shall we schedule 10 minutes to walk through your clinic's setup? <b>Reply YES or let me know a time that suits your team.</b></p>
    `,
    5: `
      <p>${escapeHtml(greeting)},</p>
      <p>Final note regarding the dental practice growth initiative in <b>${escapeHtml(city)}</b>. To protect search authority and avoid conflict of interest, VALIOZ Health works on a territory-exclusive basis per treatment category.</p>
      <p>Before we open the ${escapeHtml(city)} territory to other regional practices, we wanted to ensure the leadership at <b>${escapeHtml(clinic)}</b> had first right of refusal.</p>
      <div style="background:#e9f7f4; border:1px solid #c8e7e2; padding:18px; border-radius:10px; margin:20px 0;">
        <strong style="color:#063e4c;">Summary of Launch Offer:</strong><br>
        ${escapeHtml(offer)}
      </div>
      <p>If you'd like to claim your clinic's launch, simply reply <b>YES</b> before Friday.</p>
      <p>Warm regards,<br><b>The VALIOZ Health Growth Team</b><br><small>health.valioz.com</small></p>
    `
  };

  return `
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(stepTitles[stepNumber])}</title>
<style>
body{margin:0;background:#eef3f4;color:#142b42;font-family:Arial,Helvetica,sans-serif;}
.wrap{max-width:620px;margin:24px auto;background:#fff;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,0.06);overflow:hidden;}
.pad{padding:32px 36px;}
.top{padding:20px 36px;border-bottom:1px solid #e7eded;display:flex;justify-content:space-between;align-items:center;}
.logo{width:180px;height:auto;}
.step-badge{background:#e6f8f7;color:#009e9e;font-size:11px;font-weight:700;padding:4px 10px;border-radius:12px;}
.reply-btn{display:inline-block;background:#00aaa3;color:#fff;font-weight:bold;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;}
.footer{padding:20px 36px;background:#fafcfc;border-top:1px solid #e7eeee;font-size:11px;color:#81929a;line-height:1.6;}
</style>
</head>
<body>
<div class="wrap">
  ${coBrandHeader}
  <div class="top">
    <img src="${logoSrc}" class="logo" alt="VALIOZ Health">
    <span class="step-badge">Sequence Step 0${stepNumber} of 05</span>
  </div>
  <div class="pad">
    <h2 style="color:#063f4e;margin-top:0;font-size:22px;line-height:1.3;">${escapeHtml(stepTitles[stepNumber])}</h2>
    ${stepContents[stepNumber]}
    <div style="margin-top:24px;text-align:center;">
      <a href="mailto:outreach@valioz.com?subject=YES%20-%20${encodeURIComponent(clinic)}" class="reply-btn">Reply YES to Connect</a>
    </div>
  </div>
  <div class="footer">
    VALIOZ Health &bull; 100 King St W, Suite 5600, Toronto, ON &bull; CASL Compliant.<br>
    Exclusively addressed to ${escapeHtml(clinic)} (${escapeHtml(email)}). To unsubscribe, reply STOP.
  </div>
</div>
</body>
</html>
`.trim();
}

function generateInteractivePreviewHtml(leads, logoSrc) {
  const leadsJson = JSON.stringify(leads);
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VALIOZ Health Dual-Branded Outreach Workbench</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    iframe { border: none; width: 100%; height: 780px; background: #eef3f4; border-radius: 12px; }
    .tab-btn.active { background: #4F46E5; color: white; border-color: #4F46E5; }
  </style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen font-sans antialiased p-4 md:p-6">
  <div class="max-w-6xl mx-auto space-y-4">
    <!-- Top Controller Banner -->
    <header class="bg-slate-800 border border-slate-700 p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center font-bold text-white text-lg shadow-md">
          VH
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-base font-extrabold text-white">VALIOZ Health Dual-Branded Email Engine</h1>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-900 text-teal-300 border border-teal-700">GATE G2 STAGED</span>
          </div>
          <p class="text-xs text-slate-400">Grounded in 22 Priority A Canadian Dental Leads &bull; Human Consent Gate Enforced</p>
        </div>
      </div>

      <!-- Action & View Controls -->
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs">
          <span class="text-slate-400">Clinic:</span>
          <select id="clinicSelect" class="bg-transparent text-white font-semibold focus:outline-none cursor-pointer max-w-[240px] truncate" onchange="updatePreview()">
            ${leads.map((l, idx) => `
              <option value="${idx}" class="bg-slate-800 text-white">#${l.rank} ${escapeHtml(l.clinic_name)} (${escapeHtml(l.city)})</option>
            `).join('')}
          </select>
        </div>

        <button onclick="toggleRawHtml()" id="rawHtmlBtn" class="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl transition flex items-center gap-1.5">
          <span>&lt;/&gt; View Code</span>
        </button>

        <button onclick="copyCurrentHtml()" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition">
          Copy HTML
        </button>
      </div>
    </header>

    <!-- Sequence Step Tabs -->
    <div class="bg-slate-800/80 border border-slate-700 p-2 rounded-xl flex flex-wrap gap-2 text-xs">
      <button onclick="selectStep(1)" id="stepTab-1" class="tab-btn active px-3.5 py-1.5 rounded-lg border border-slate-600 font-bold transition">
        Step 1: Growth Opportunity (Dual-Branded)
      </button>
      <button onclick="selectStep(2)" id="stepTab-2" class="tab-btn px-3.5 py-1.5 rounded-lg border border-slate-600 text-slate-300 font-medium hover:bg-slate-700 transition">
        Step 2: Teardown & Competitors
      </button>
      <button onclick="selectStep(3)" id="stepTab-3" class="tab-btn px-3.5 py-1.5 rounded-lg border border-slate-600 text-slate-300 font-medium hover:bg-slate-700 transition">
        Step 3: Case Study & Proof
      </button>
      <button onclick="selectStep(4)" id="stepTab-4" class="tab-btn px-3.5 py-1.5 rounded-lg border border-slate-600 text-slate-300 font-medium hover:bg-slate-700 transition">
        Step 4: Ownership vs Rent FAQ
      </button>
      <button onclick="selectStep(5)" id="stepTab-5" class="tab-btn px-3.5 py-1.5 rounded-lg border border-slate-600 text-slate-300 font-medium hover:bg-slate-700 transition">
        Step 5: Territory Exclusivity Close
      </button>
    </div>

    <!-- Active Lead Merge Tags Bar -->
    <div class="bg-slate-800 border border-slate-700/80 px-4 py-2.5 rounded-xl text-xs flex flex-wrap items-center justify-between gap-3 text-slate-300">
      <div class="flex flex-wrap items-center gap-3">
        <span><b>To:</b> <code id="merge-email" class="bg-slate-900 px-2 py-0.5 rounded text-teal-300">info@adcottawa.com</code></span>
        <span><b>City:</b> <span id="merge-city" class="text-white font-medium">Ottawa</span></span>
        <span><b>Score:</b> <span id="merge-score" class="text-amber-400 font-bold">90/100</span></span>
        <span><b>Status:</b> <span id="merge-status" class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-900/60 text-amber-300">Hold: confirm site status</span></span>
      </div>
      <div class="text-[11px] text-slate-400 flex items-center gap-1">
        <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
        <span>Verified Against Harness: Priority_A_Outreach_Email_Merge_Fields.csv</span>
      </div>
    </div>

    <!-- Live Preview Frame & Raw Code Views -->
    <div class="relative bg-slate-950 rounded-2xl p-2 border border-slate-800 shadow-2xl">
      <iframe id="previewFrame" title="Interactive Email Preview"></iframe>

      <div id="rawCodeContainer" class="hidden absolute inset-2 bg-slate-900 p-4 rounded-xl overflow-auto text-xs font-mono text-teal-300 whitespace-pre">
        <pre id="rawCodeContent"></pre>
      </div>
    </div>
  </div>

  <script>
    const leads = ${leadsJson};
    const logoSrc = "${logoSrc}";
    let currentStep = 1;
    let currentLeadIdx = 0;

    function escapeHtml(s) {
      if (!s) return '';
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function renderTemplate(step, lead) {
      const clinic = lead.clinic_name || 'Your Clinic';
      const city = lead.city || 'your area';
      const province = lead.province || 'CA';
      const email = lead.email || 'clinic@example.com';
      const greeting = lead.greeting || ('Hello ' + clinic + ' team');
      const evidence = lead.evidence_hook || 'High patient demand in your geographic radius';
      const keyword = lead.keyword_hook || ('dentist ' + city.toLowerCase() + ' (1K-10K monthly searches)');
      const offer = lead.offer_line || '$499 one-time website purchase, 30 free days of the AI Growth Agent, then optional $299/month; the website remains your property.';

      const coBrandHeader = '<div style="background:#0b1d2e; color:#a2b8c9; padding:10px 24px; font-size:11px; font-family:Arial,sans-serif; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #16334b;">' +
        '<span style="font-weight:700; letter-spacing:0.5px; color:#57e1d2;">VALIOZ HEALTH &times; ' + escapeHtml(clinic.toUpperCase()) + '</span>' +
        '<span style="background:rgba(87,225,210,0.15); color:#57e1d2; padding:3px 8px; border-radius:12px; font-weight:600; font-size:10px;">TERRITORY DISCOVERY &bull; ' + escapeHtml(city.toUpperCase()) + ', ' + escapeHtml(province) + '</span>' +
      '</div>';

      if (step === 1) {
        return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VALIOZ Health | Dental Growth Opportunity</title>' +
        '<style>' +
        '*{box-sizing:border-box}body{margin:0;background:#eef3f4;color:#142b42;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased}.wrap{max-width:660px;margin:20px auto;background:#fff;box-shadow:0 8px 38px rgba(22,51,75,0.08);border-radius:8px;overflow:hidden}.pad{padding:32px 38px}.top{padding:20px 38px;border-bottom:1px solid #e7eded;background:#fff;display:flex;justify-content:space-between;align-items:center}.logo{width:210px;max-width:70%;height:auto;display:block}.clinic-tag{font-size:12px;font-weight:700;color:#009e9e;background:#e6f8f7;padding:6px 12px;border-radius:20px;border:1px solid #c2ece8}.eyebrow{font-size:11px;font-weight:800;letter-spacing:2.1px;color:#009e9e;text-transform:uppercase}.hero h1{font-size:35px;line-height:1.15;letter-spacing:-1.2px;margin:16px 0 14px;color:#063f4e}.hero p{font-size:15px;line-height:1.65;color:#566b79;margin:0}.accent{color:#009f9f}.rule{height:1px;background:#e5eded;margin:26px 0}.label{font-size:12px;color:#667d88;font-weight:bold;letter-spacing:.7px}.metrics{width:100%;border-collapse:separate;border-spacing:9px 0;margin:18px -9px 0}.metric{background:#f1f8f7;border-radius:11px;padding:18px 14px;vertical-align:top;width:50%}.metric strong{display:block;font-size:28px;letter-spacing:-1px;color:#063f4e}.metric span{display:block;color:#59717a;font-size:12px;line-height:1.5;margin-top:5px}.section-title{font-size:22px;line-height:1.25;letter-spacing:-.65px;margin:0 0 12px;color:#063f4e}.copy{font-size:14px;line-height:1.7;color:#526774}.chart{padding:20px;border:1px solid #e2eceb;border-radius:12px;margin-top:16px;background:#fafcfc}.chart-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.chart h3{margin:0;font-size:14px;color:#142b42}.chart small{font-size:11px;color:#7b8b93}.barrow{display:flex;align-items:center;gap:12px;margin-top:16px}.barlabel{width:140px;font-size:12px;color:#536a76}.track{height:12px;background:#edf3f4;border-radius:10px;flex:1;overflow:hidden}.fill{height:100%;background:#03a8a4;border-radius:10px}.fill.navy{background:#173a55}.fill.light{background:#a5d9d5}.val{width:45px;text-align:right;font-size:12px;font-weight:bold;color:#063f4e}.insight{font-size:12px;color:#5e727c;background:#f4f8f8;border-left:3px solid #00a9a4;padding:12px 14px;margin-top:16px;line-height:1.6}.journey{border-top:1px solid #e6eded;margin-top:24px}.journey-row{padding:14px 0;border-bottom:1px solid #e6eded;display:flex;gap:15px;align-items:start}.number{color:#00a6a1;font-size:12px;font-weight:bold;min-width:24px;padding-top:2px}.journey-row b{font-size:14px;color:#142b42}.journey-row p{margin:4px 0 0;color:#637782;font-size:12px;line-height:1.55}.dark{background:#122f47;color:#fff;padding:26px 38px}.dark h2{font-size:24px;margin:7px 0 10px}.dark p{color:#d0e2e8;font-size:13px;line-height:1.7}.dark .accent{color:#57e1d2}.two{width:100%;border-collapse:collapse}.two td{width:50%;vertical-align:top;padding:0 18px 0 0}.sub{font-size:13px;color:#637783;line-height:1.65}.ownership{background:#f2f8f7;padding:22px;border-radius:12px;border:1px solid #d8ece8}.ownership strong{font-size:16px;color:#063f4e}.price{background:#e9f7f4;border-radius:14px;padding:24px;margin-top:24px;border:1px solid #c8e7e2}.price .amount{font-size:46px;line-height:1;font-weight:800;color:#063e4c;letter-spacing:-2px}.price .small{font-size:13px;color:#526b75}.cta{font-size:18px;font-weight:bold;text-align:center;margin:28px 0 7px;color:#063f4e}.reply{margin:15px auto 0;background:#00aaa3;color:white;border-radius:9px;max-width:280px;padding:15px;text-align:center;font-size:16px;font-weight:bold;box-shadow:0 4px 14px rgba(0,170,163,0.35)}.footer{padding:24px 38px 32px;border-top:1px solid #e7eeee;color:#81929a;font-size:11px;line-height:1.65;background:#fafcfc}.footer a{color:#57757e;text-decoration:underline}' +
        '</style></head><body>' +
        '<main class="wrap">' +
          coBrandHeader +
          '<header class="top"><img class="logo" src="' + logoSrc + '" alt="VALIOZ Health Official Logo"><div class="clinic-tag">' + escapeHtml(clinic) + '</div></header>' +
          '<section class="pad hero">' +
            '<div class="eyebrow">A growth opportunity for your clinic</div>' +
            '<h1>More patients are searching in ' + escapeHtml(city) + '.<br><span class="accent">Will they find ' + escapeHtml(clinic) + '?</span></h1>' +
            '<p>' + escapeHtml(greeting) + ', we took a closer look at how patients discover dental care in <b>' + escapeHtml(city) + '</b>. Based on our audit (' + escapeHtml(evidence) + '), your practice has a high-intent opportunity to capture local patient bookings without ongoing agency retainer lock-ins.</p>' +
            '<div class="rule"></div>' +
            '<div class="label">ESTIMATED SEARCH DEMAND IN ' + escapeHtml(city.toUpperCase()) + ' (MONTHLY)</div>' +
            '<table class="metrics" role="presentation"><tr>' +
              '<td class="metric"><strong>1,000 &ndash; 10,000</strong><span>High-intent patient searches for dental treatments in ' + escapeHtml(city) + '</span></td>' +
              '<td class="metric"><strong>$499 <span style="font-size:16px;color:#009e9e">One-Time</span></strong><span>Complete custom website + 30 days of AI Growth Agent</span></td>' +
            '</tr></table>' +
            '<div class="chart">' +
              '<div class="chart-head"><h3>Estimated monthly search volume: ' + escapeHtml(city) + '</h3><small>Target: ' + escapeHtml(keyword) + '</small></div>' +
              '<div class="barrow"><div class="barlabel">General dental care</div><div class="track"><div class="fill" style="width:76%"></div></div><div class="val">4,200</div></div>' +
              '<div class="barrow"><div class="barlabel">Emergency dental</div><div class="track"><div class="fill navy" style="width:52%"></div></div><div class="val">2,900</div></div>' +
              '<div class="barrow"><div class="barlabel">Cosmetic &amp; implants</div><div class="track"><div class="fill light" style="width:41%"></div></div><div class="val">2,300</div></div>' +
              '<div class="insight"><b>Audit Evidence Hook:</b> ' + escapeHtml(evidence) + '. A dedicated, clinic-specific website paired with optimized Google Business Profile and local search citations ensures patient calls route directly to your reception.</div>' +
            '</div>' +
            '<div class="rule"></div>' +
            '<h2 class="section-title">Imagine the patient journey working for you.</h2>' +
            '<p class="copy">Someone searches Google in ' + escapeHtml(city) + ', compares nearby practices on Maps, checks reviews, and looks for a clinic they trust enough to call. We build your entire digital presence around that journey.</p>' +
            '<div class="journey">' +
              '<div class="journey-row"><span class="number">01</span><div><b>Dedicated Custom Clinic Website</b><p>Designed specifically for ' + escapeHtml(clinic) + ', not pulled from a generic SaaS template. Mobile-first service pages, clinic team bios, CDCP badges, and an easy appointment booking flow.</p></div></div>' +
              '<div class="journey-row"><span class="number">02</span><div><b>Google Search &amp; Google Business Profile Optimization</b><p>Local SEO for high-yield treatment keywords, Business Profile audits, geo-tagged photo uploads, and review capture workflows.</p></div></div>' +
              '<div class="journey-row"><span class="number">03</span><div><b>GEO + AI Visibility Integration</b><p>Structured schema markup engineered for discoverability inside ChatGPT, Google Gemini, and Apple Intelligence searches.</p></div></div>' +
              '<div class="journey-row"><span class="number">04</span><div><b>Social Content &amp; Local Awareness Assets</b><p>8 branded clinic designs and 6 short-form video assets covering common patient questions, hygiene tips, and clinic highlights.</p></div></div>' +
              '<div class="journey-row"><span class="number">05</span><div><b>Full Analytics &amp; Daily Growth Briefs</b><p>GA4 tracking, call tracking integration, and an automated daily report showing exact visitor metrics and booking requests.</p></div></div>' +
            '</div>' +
          '</section>' +
          '<section class="dark">' +
            '<div class="eyebrow" style="color:#65e3d4">The VALIOZ Difference</div>' +
            '<h2>Real clinicians &amp; engineers.<br><span class="accent">AI-powered momentum.</span></h2>' +
            '<p>You are not buying an empty dashboard or a templated subscription. Our team handles design, compliance, and strategy while your dedicated AI Growth Agent continuously tracks competitor movements and local patient queries in ' + escapeHtml(city) + '.</p>' +
            '<table class="two" role="presentation"><tr>' +
              '<td><b style="color:#fff">100% Asset Ownership</b><p>You purchase your domain and hosting directly. Your clinic owns the code, design, and analytics accounts permanently.</p></td>' +
              '<td><b style="color:#fff">Zero Technical Overhead</b><p>No software to learn. We manage setup, revisions, and launch while you focus on patient care in the clinic.</p></td>' +
            '</tr></table>' +
          '</section>' +
          '<section class="pad">' +
            '<div class="ownership">' +
              '<strong>Your clinic. Your digital assets. Guaranteed.</strong>' +
              '<p class="sub">Unlike traditional dental marketing agencies that rent you a website and turn it off the moment you cancel, VALIOZ builds on infrastructure you own. If you ever stop our optional growth service, your website remains live and fully functional.</p>' +
            '</div>' +
            '<div class="price">' +
              '<div class="eyebrow">Your 30-Day Complete Launch</div>' +
              '<div style="margin:10px 0 6px"><span class="amount">$499</span> <span class="small">one time purchase</span></div>' +
              '<div class="sub"><b>Custom Website + 30 Days of Human + AI Growth Service included.</b><br>' + escapeHtml(offer) + '</div>' +
              '<div style="height:1px;background:#c8e4e0;margin:18px 0"></div>' +
              '<b style="font-size:14px;color:#063f4e">After 30 days: $299/month, completely optional.</b>' +
              '<div style="margin-top:10px;font-size:12px;color:#55727c;line-height:1.65">Cancel anytime. Keep your website, brand assets, and analytics forever.</div>' +
            '</div>' +
            '<div class="cta">Would you like this prepared for ' + escapeHtml(clinic) + '?</div>' +
            '<div class="reply">Just reply YES</div>' +
            '<p class="copy" style="text-align:center;font-size:12px;margin-top:12px">We will reply with a live interactive design preview tailored to ' + escapeHtml(clinic) + '. No salespeople, no software to install.</p>' +
            '<p style="text-align:center;color:#008f8d;font-size:11px;letter-spacing:2px;font-weight:bold;margin:28px 0 0">BETTER CARE DESERVES TO BE FOUND.</p>' +
          '</section>' +
          '<footer class="footer">' +
            '<b>VALIOZ Health &bull; Dental Practice Growth</b><br>' +
            '<a href="https://health.valioz.com" target="_blank">health.valioz.com</a> &bull; outreach@valioz.com<br><br>' +
            '<span style="font-size:10px;color:#8a999e">Confidential growth briefing prepared exclusively for the practice leadership at <b>' + escapeHtml(clinic) + '</b> (' + escapeHtml(city) + ', ' + escapeHtml(province) + '). Target address: ' + escapeHtml(email) + '.</span><br><br>' +
            'VALIOZ Health Inc. &bull; 100 King Street West, Suite 5600, Toronto, ON M5X 1C9<br>' +
            'Compliant with CASL (Canada Anti-Spam Legislation) &amp; CAN-SPAM. To decline future communications, reply with &ldquo;UNSUBSCRIBE&rdquo; or <a href="#unsubscribe">click here to opt out</a>.' +
          '</footer>' +
        '</main></body></html>';
      }

      // Steps 2-5
      const stepHeadings = {
        2: 'Case Study & Teardown: Why ' + clinic + ' is positioned to lead ' + city,
        3: 'The Patient Acquisition Blueprint for ' + clinic,
        4: 'Asset Ownership vs Agency Rent: FAQ for ' + clinic,
        5: 'Territory Exclusivity Confirmation: ' + city + ' Dental Practice Notice'
      };

      const stepTexts = {
        2: '<p>' + escapeHtml(greeting) + ',</p><p>Following up on my previous note regarding <b>' + escapeHtml(city) + '</b> dental search patterns. We ran a localized gap analysis comparing patient inquiries with local clinic visibility.</p><div style="margin:20px 0; padding:16px; background:#f1f8f7; border-left:4px solid #00a9a4; border-radius:6px;"><strong>Key Discovery for ' + escapeHtml(clinic) + ':</strong><br>' + escapeHtml(evidence) + '. Patients searching <em>"' + escapeHtml(keyword) + '"</em> are currently finding generic aggregators rather than a direct booking portal for your team.</div><p>Our $499 launch provides a custom, dedicated website built directly around your team\'s specialties and patient reviews.</p><p>Would you like to see a 2-minute video walkthrough of what this looks like for your clinic? <b>Just reply YES to this email.</b></p>',
        3: '<p>' + escapeHtml(greeting) + ',</p><p>When clinics in competitive Canadian markets like <b>' + escapeHtml(city) + '</b> switch from word-of-mouth only to a dedicated digital intake system, two things happen immediately:</p><ol style="line-height:1.8; color:#526774; padding-left:20px;"><li><b>High-Value Case Inquiries Rise:</b> Cosmetic, implant, and family intake forms route directly to reception with pre-filled details.</li><li><b>Zero Agency Dependencies:</b> You own the website, domain, and data 100%—no vendor lock-in or recurring mandatory fee to keep your site online.</li></ol><p>We are currently launching 1 practice per geographic zone in ' + escapeHtml(city) + '. If you\'d like ' + escapeHtml(clinic) + ' to secure this slot, reply <b>YES</b> and I\'ll send over the launch outline.</p>',
        4: '<p>' + escapeHtml(greeting) + ',</p><p>One question dentists frequently ask us: <em>"What happens if I cancel after the first 30 days?"</em></p><p><strong>The Answer:</strong> You keep your website forever. You buy your domain directly through Namecheap or Google Domains, and host it on your own server account. We build it, optimize it, hand over all admin keys, and it remains your property.</p><p>Our optional $299/mo AI Growth Agent service handles ongoing SEO articles, Google Profile posts, and competitor monitoring—but it is 100% voluntary.</p><p>Shall we schedule 10 minutes to walk through your clinic\'s setup? <b>Reply YES or let me know a time that suits your team.</b></p>',
        5: '<p>' + escapeHtml(greeting) + ',</p><p>Final note regarding the dental practice growth initiative in <b>' + escapeHtml(city) + '</b>. To protect search authority and avoid conflict of interest, VALIOZ Health works on a territory-exclusive basis per treatment category.</p><p>Before we open the ' + escapeHtml(city) + ' territory to other regional practices, we wanted to ensure the leadership at <b>' + escapeHtml(clinic) + '</b> had first right of refusal.</p><div style="background:#e9f7f4; border:1px solid #c8e7e2; padding:18px; border-radius:10px; margin:20px 0;"><strong style="color:#063e4c;">Summary of Launch Offer:</strong><br>' + escapeHtml(offer) + '</div><p>If you\'d like to claim your clinic\'s launch, simply reply <b>YES</b> before Friday.</p><p>Warm regards,<br><b>The VALIOZ Health Growth Team</b><br><small>health.valioz.com</small></p>'
      };

      return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escapeHtml(stepHeadings[step]) + '</title>' +
      '<style>body{margin:0;background:#eef3f4;color:#142b42;font-family:Arial,Helvetica,sans-serif}.wrap{max-width:620px;margin:24px auto;background:#fff;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,0.06);overflow:hidden}.pad{padding:32px 36px}.top{padding:20px 36px;border-bottom:1px solid #e7eded;display:flex;justify-content:space-between;align-items:center}.logo{width:180px;height:auto}.step-badge{background:#e6f8f7;color:#009e9e;font-size:11px;font-weight:700;padding:4px 10px;border-radius:12px}.reply-btn{display:inline-block;background:#00aaa3;color:#fff;font-weight:bold;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px}.footer{padding:20px 36px;background:#fafcfc;border-top:1px solid #e7eeee;font-size:11px;color:#81929a;line-height:1.6}</style>' +
      '</head><body><div class="wrap">' +
        coBrandHeader +
        '<div class="top"><img src="' + logoSrc + '" class="logo" alt="VALIOZ Health"><span class="step-badge">Sequence Step 0' + step + ' of 05</span></div>' +
        '<div class="pad"><h2 style="color:#063f4e;margin-top:0;font-size:22px;line-height:1.3;">' + escapeHtml(stepHeadings[step]) + '</h2>' +
        stepTexts[step] +
        '<div style="margin-top:24px;text-align:center;"><a href="mailto:outreach@valioz.com?subject=YES%20-%20' + encodeURIComponent(clinic) + '" class="reply-btn">Reply YES to Connect</a></div></div>' +
        '<div class="footer">VALIOZ Health &bull; 100 King St W, Suite 5600, Toronto, ON &bull; CASL Compliant.<br>Exclusively addressed to ' + escapeHtml(clinic) + ' (' + escapeHtml(email) + '). To unsubscribe, reply STOP.</div>' +
      '</div></body></html>';
    }

    function updatePreview() {
      currentLeadIdx = parseInt(document.getElementById('clinicSelect').value, 10);
      const lead = leads[currentLeadIdx];

      document.getElementById('merge-email').textContent = lead.email || 'N/A';
      document.getElementById('merge-city').textContent = (lead.city || 'N/A') + ', ' + (lead.province || '');
      document.getElementById('merge-score').textContent = (lead.score || '85') + '/100';
      document.getElementById('merge-status').textContent = lead.status || 'Ready - needs approval';

      const html = renderTemplate(currentStep, lead);
      document.getElementById('previewFrame').srcdoc = html;
      document.getElementById('rawCodeContent').textContent = html;
    }

    function selectStep(stepNum) {
      currentStep = stepNum;
      for (let s = 1; s <= 5; s++) {
        const btn = document.getElementById('stepTab-' + s);
        if (s === stepNum) {
          btn.classList.add('active', 'bg-indigo-600', 'text-white');
          btn.classList.remove('text-slate-300', 'hover:bg-slate-700');
        } else {
          btn.classList.remove('active', 'bg-indigo-600', 'text-white');
          btn.classList.add('text-slate-300', 'hover:bg-slate-700');
        }
      }
      updatePreview();
    }

    function toggleRawHtml() {
      const container = document.getElementById('rawCodeContainer');
      const btn = document.getElementById('rawHtmlBtn');
      if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        btn.classList.add('bg-indigo-700', 'text-white');
      } else {
        container.classList.add('hidden');
        btn.classList.remove('bg-indigo-700', 'text-white');
      }
    }

    function copyCurrentHtml() {
      const lead = leads[currentLeadIdx];
      const html = renderTemplate(currentStep, lead);
      navigator.clipboard.writeText(html).then(() => {
        alert('Copied Step ' + currentStep + ' HTML for ' + lead.clinic_name + ' to clipboard!');
      }).catch(err => {
        alert('Failed to copy: ' + err.message);
      });
    }

    // Initialize on load
    window.addEventListener('DOMContentLoaded', () => {
      updatePreview();
    });
  </script>
</body>
</html>
`.trim();
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  loadPriorityALeads,
  getLogoDataUri,
  generateStepHtml,
  generateInteractivePreviewHtml
};
