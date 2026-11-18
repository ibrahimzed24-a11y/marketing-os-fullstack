/**
 * Marketing OS — Unified Agent Execution Framework (Phase 2)
 * 
 * Implements the shared execution runtime for the 3 Core Operational Agents:
 *   1. Research Agent (Agent 01 - Research Department)
 *   2. Sales Agent (Agent 02 - Sales Department)
 *   3. Creative Director Agent (Agent 03 - Creative Studio & Ops)
 * 
 * Execution Loop:
 *   Receive Task -> Load Project & Harness Files -> Select SOP ->
 *   Dynamic Execution -> Standardized Output JSON + Report MD ->
 *   Evaluate External Action -> Queue in Approvals if Action is Critical.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { getActiveLLMConfig } = require('./llmConfig');
const { invokeLLM } = require('./llmClient');
const { decryptSecret } = require('./cryptoVault');
let rag = null;
try {
  rag = require('./rag');
} catch (err) {
  console.warn(`[agentFramework] RAG module unavailable: ${err.message}`);
}

// =============================================================================
// BASE AGENT (Shared Execution Architecture)
// =============================================================================

class BaseAgent {
  constructor({ id, name, department, roleTitle, systemDirective }) {
    this.id = id;
    this.name = name;
    this.department = department;
    this.roleTitle = roleTitle;
    this.systemDirective = systemDirective;
    this.skills = {};
  }

  registerSkill(slug, config) {
    this.skills[slug] = config;
  }

  getSkill(slug) {
    return this.skills[slug] || null;
  }

  /**
   * Evaluates whether this task produces an external action requiring human approval
   */
  requiresHumanApproval(task, sopSlug) {
    // Actions that send messages, publish content, spend money, or modify live code require approval
    const criticalActions = [
      'outreach_dispatch', 'email_send', 'ad_launch', 'social_publish',
      'website_deploy', 'budget_allocation', 'deliverable_signoff'
    ];
    const skill = this.getSkill(sopSlug);
    if (skill && skill.requiresApproval) return true;

    const taskText = `${task.title} ${task.description || ''} ${task.pipeline || ''}`.toLowerCase();
    return criticalActions.some(action => taskText.includes(action.replace('_', ' ')));
  }

  /**
   * Formats the ground truth context from uploaded files and project guidelines
   */
  buildGroundedContext(project, harnessFiles = []) {
    let context = `[PROJECT CONTEXT]\n`;
    context += `Project Name: ${project?.name || 'General Campaign'}\n`;
    context += `Client / Brand: ${project?.client_name || 'Enterprise Brand'}\n`;
    context += `Strategic Goal: ${project?.goal || 'Drive pipeline growth & high-conversion engagement'}\n`;
    
    if (project?.guidelines) {
      context += `Brand & Execution Guidelines:\n${project.guidelines}\n`;
    }
    if (project?.custom_rules) {
      context += `Custom Constraints:\n${project.custom_rules}\n`;
    }

    if (harnessFiles && harnessFiles.length > 0) {
      context += `\n[VERIFIED ASSETS & HARNESS FILES]\n`;
      harnessFiles.forEach((file, idx) => {
        context += `${idx + 1}. ${file.original_name || file.filename} (${file.mime || 'asset'}): ${file.parsed_summary || 'Ground truth data verified'}\n`;
      });
    }

    return context;
  }
}

// =============================================================================
// 1. RESEARCH AGENT (Agent 01 - Research Department)
// =============================================================================

class ResearchAgent extends BaseAgent {
  constructor() {
    super({
      id: 'agent-01',
      name: 'Research Agent',
      department: 'research',
      roleTitle: 'Senior Market & Intelligence Researcher',
      systemDirective: 'Gather, analyze, and synthesize verified market intelligence, competitor audits, decision-maker lead discoveries, and SEO/GEO search intent matrices. Always ground findings in client specifications.'
    });

    this.registerSkill('market_intel', {
      name: 'Market Intelligence & Industry Audit',
      requiresApproval: false,
      execute: (task, project, harness, input) => this.executeMarketIntel(task, project, harness, input)
    });

    this.registerSkill('lead_research', {
      name: 'B2B Lead Discovery & ICP Verification',
      requiresApproval: false,
      execute: (task, project, harness, input) => this.executeLeadResearch(task, project, harness, input)
    });

    this.registerSkill('content_seo', {
      name: 'SEO & GEO Search Intent Analysis',
      requiresApproval: false,
      execute: (task, project, harness, input) => this.executeSeoResearch(task, project, harness, input)
    });
  }

  executeMarketIntel(task, project, harness, input) {
    const client = project?.client_name || 'Target Enterprise';
    const goal = project?.goal || 'Drive market positioning';

    const outputJson = {
      summary: `Market Intelligence Report prepared for ${client}. Grounded in project goals: ${goal}.`,
      market: {
        industry: input.industry || `${client} Target Sector`,
        tam_sam_som: {
          tam: '$4.2B Global Market',
          sam: '$850M Addressable Regional Segment',
          som: '$42M 24-Month Target Opportunity'
        },
        growth_rate: '14.8% CAGR (2024-2028)',
        key_trends: [
          'Shift towards automated, AI-augmented operational workflows',
          'Demand for verifiable ROI and data residency governance',
          'Consolidation of point-solution SaaS tools into unified platforms'
        ],
        buyer_personas: [
          { role: 'VP of Marketing / CMO', pain_points: ['Fragmented attribution', 'Slow agency turnaround'], trigger: 'Team expansion' },
          { role: 'Director of Growth', pain_points: ['High CAC', 'Lead leakage in funnel'], trigger: 'Quarterly pipeline shortfall' }
        ],
        competitor_matrix: [
          { name: 'Incumbent Enterprise SaaS', strengths: 'Brand dominance', weaknesses: 'High price, rigid legacy UX', our_moat: 'Agile execution & local-first speed' },
          { name: 'Specialist Boutique Agency', strengths: 'Hands-on creative', weaknesses: 'No scalable infrastructure', our_moat: 'Autonomous precision + 24/7 reliability' }
        ]
      }
    };

    const reportMd = `
### 📊 Market Intelligence & Competitor Audit: ${client}
**Stage:** Research & Signal Verification
**Agent:** ${this.name} (${this.roleTitle})
**Target Market:** ${outputJson.market.industry}

#### 1. Strategic Opportunity Sizing
- **Total Addressable Market (TAM):** ${outputJson.market.tam_sam_som.tam}
- **Serviceable Addressable Market (SAM):** ${outputJson.market.tam_sam_som.sam}
- **Serviceable Obtainable Market (SOM):** ${outputJson.market.tam_sam_som.som}
- **Market Dynamics:** ${outputJson.market.growth_rate}

#### 2. Competitive Moat & Positioning
- **Primary Moat:** High-velocity autonomous orchestration grounded in verified campaign assets.
- **Identified Whitespace:** Middle-tier organizations underserved by rigid enterprise software and priced out of top-tier traditional agencies.

**Verdict:** Ready to Deliver
`;
    return { outputJson, reportMd };
  }

  executeLeadResearch(task, project, harness, input) {
    const client = project?.client_name || 'Enterprise Client';
    const leads = [
      { name: 'Dr. Marcus Vance', company: `${client} Partner Clinic 01`, title: 'Clinical Director & Co-Owner', email: 'm.vance@clinicpartners.com', phone: '+1 416-555-0142', location: 'Toronto, ON', qualification: 'High ICP Fit', icp_score: 92, estimated_deal: '$18,000' },
      { name: 'Elena Rostova', company: `${client} Health Center Group`, title: 'Operations VP', email: 'elena@healthcentergroup.ca', phone: '+1 604-555-0198', location: 'Vancouver, BC', qualification: 'Immediate Opportunity', icp_score: 89, estimated_deal: '$32,000' },
      { name: 'David Chen', company: 'Apex Dental Care Network', title: 'Managing Partner', email: 'dchen@apexdentalcare.ca', phone: '+1 403-555-0177', location: 'Calgary, AB', qualification: 'Fast Win', icp_score: 86, estimated_deal: '$14,500' },
      { name: 'Sophia Tremblay', company: 'Capital Medical Group', title: 'Chief Executive Officer', email: 'stremblay@capmedgroup.ca', phone: '+1 613-555-0123', location: 'Ottawa, ON', qualification: 'Strategic Account', icp_score: 94, estimated_deal: '$45,000' }
    ];

    const outputJson = {
      summary: `Verified ${leads.length} high-intent B2B prospect accounts for ${client}. Ready for Sales CRM persistence.`,
      target_icp: 'Mid-to-large medical and healthcare organizations with $2M-$15M annual revenue',
      discovered_leads: leads,
      total_count: leads.length
    };

    const reportMd = `
### 🎯 B2B Lead Discovery & ICP Verification
**Agent:** ${this.name} (${this.roleTitle})
**Target Account Segment:** ${outputJson.target_icp}
**Verified Leads Discovered:** ${leads.length} accounts

| Contact Name | Organization | Title | Location | Deal Potential | Status |
| :--- | :--- | :--- | :--- | :---: | :---: |
${leads.map(l => `| ${l.name} | ${l.company} | ${l.title} | ${l.location} | ${l.estimated_deal} | Verified |`).join('\n')}

> **Sales Hand-off:** All ${leads.length} leads have been synced into the Sales CRM pipeline ready for outreach sequencing.

**Verdict:** Ready to Deliver
`;
    return { outputJson, reportMd };
  }

  executeSeoResearch(task, project, harness, input) {
    const client = project?.client_name || 'Client';
    const keywords = [
      { query: `${client.toLowerCase()} services near me`, vol: 3200, cpc: '$6.80', difficulty: 22, intent: 'Transactional', kgr: 0.12, status: 'Fast Win' },
      { query: 'best commercial marketing operating system', vol: 1850, cpc: '$14.20', difficulty: 31, intent: 'Commercial B2B', kgr: 0.18, status: 'High Intent' },
      { query: 'enterprise marketing workflow automation', vol: 2400, cpc: '$11.50', difficulty: 27, intent: 'Informational', kgr: 0.09, status: 'Top of Funnel' },
      { query: 'b2b client acquisition system', vol: 950, cpc: '$18.00', difficulty: 34, intent: 'High Commercial', kgr: 0.15, status: 'High Yield' }
    ];

    const outputJson = {
      summary: `SEO Search Intent & Keyword Matrix generated for ${client}. 4 primary keyword clusters verified.`,
      target_market: 'North America / English Commercial',
      clusters: keywords
    };

    const reportMd = `
### 🔍 SEO & GEO Search Intent Analysis
**Agent:** ${this.name} (${this.roleTitle})
**Client Focus:** ${client}

| Target Keyword Query | Monthly Vol | CPC | Intent | KGR Score | Priority |
| :--- | :---: | :---: | :---: | :---: | :---: |
${keywords.map(k => `| ${k.query} | ${k.vol.toLocaleString()} | ${k.cpc} | ${k.intent} | ${k.kgr} | ${k.status} |`).join('\n')}

**Verdict:** Ready to Deliver
`;
    return { outputJson, reportMd };
  }
}

// =============================================================================
// 2. SALES AGENT (Agent 02 - Sales Department)
// =============================================================================

class SalesAgent extends BaseAgent {
  constructor() {
    super({
      id: 'agent-02',
      name: 'Sales Agent',
      department: 'sales',
      roleTitle: 'Strategic Sales & Outbound Operations Specialist',
      systemDirective: 'Qualify discovered leads, formulate high-converting cold outreach sequences, design follow-up cadence, and structure deal proposals. External communications require Human Approval before dispatch.'
    });

    this.registerSkill('email_campaign', {
      name: 'Cold Outreach Sequence & Copywriting',
      requiresApproval: true,
      execute: (task, project, harness, input) => this.executeOutreachSequence(task, project, harness, input)
    });

    this.registerSkill('lead_qualification', {
      name: 'Lead Qualification & Scoring',
      requiresApproval: false,
      execute: (task, project, harness, input) => this.executeLeadQualification(task, project, harness, input)
    });

    this.registerSkill('deal_proposal', {
      name: 'Commercial Proposal Structuring',
      requiresApproval: true,
      execute: (task, project, harness, input) => this.executeDealProposal(task, project, harness, input)
    });
  }

  executeOutreachSequence(task, project, harness, input) {
    const client = project?.client_name || 'Our Partner';
    const goal = project?.goal || 'Expand market acquisition';

    const sequence = [
      {
        step: 1,
        touchpoint: 'Email Touch 1 (Day 0)',
        subject: `Quick observation regarding ${client}'s growth pipeline`,
        body: `Hi {{firstName}},\n\nNoticed {{company}}'s recent expansion in the region. Most leadership teams we speak with find that managing multi-channel marketing across separate silos creates lead leakage.\n\nWe deployed a unified operating system for similar organizations that reduced client acquisition costs by 34% in 60 days.\n\nOpen to reviewing our 2-page operational brief this week?\n\nBest,\nMarketing Operations Lead`,
        cta: 'Review Operational Brief'
      },
      {
        step: 2,
        touchpoint: 'Email Touch 2 (Day 3)',
        subject: `Case brief: How peers automated campaign production`,
        body: `Hi {{firstName}},\n\nFollowing up on my note from Tuesday. Attached is a quick benchmark breakdown comparing traditional agency turnaround times with unified workflow systems.\n\nWould you be open to a 10-minute executive walk-through on Thursday at 2 PM?\n\nBest,\nMarketing Operations Lead`,
        cta: 'Confirm 10-Min Walkthrough'
      },
      {
        step: 3,
        touchpoint: 'Email Touch 3 (Day 7)',
        subject: `Closing the loop on ${client}'s Q4 initiatives`,
        body: `Hi {{firstName}},\n\nI understand priorities shift quickly. If optimizing your marketing team throughput isn't an active focus right now, no problem at all.\n\nIf you'd like me to send over our brand playbook framework for your internal team to use freely, just reply 'Playbook' and I'll send it right over.\n\nBest,\nMarketing Operations Lead`,
        cta: 'Request Playbook Framework'
      }
    ];

    const outputJson = {
      summary: `High-converting 3-touch outbound email sequence crafted for ${client}. Queued for human approval before sending.`,
      channel: 'Cold Email / Inbound Nurturing',
      sequence: sequence,
      proposed_action: 'Cold Email Outreach Dispatch to Target Healthcare List'
    };

    const reportMd = `
### 📧 Outbound Email Campaign Sequence
**Agent:** ${this.name} (${this.roleTitle})
**Client Brand:** ${client}
**Governance:** Gated — Requires Human Approval before any live dispatch.

#### Proposed Sequence Structure:
${sequence.map(s => `
##### ${s.touchpoint}
- **Subject:** \`${s.subject}\`
- **Call to Action:** *${s.cta}*
\`\`\`text
${s.body}
\`\`\`
`).join('\n')}

> 🛡️ **Human Approval Gate:** This sequence is held in the **Approvals Queue**. No emails will be transmitted without authorized manager approval.

**Verdict:** Ready to Deliver
`;
    return { outputJson, reportMd };
  }

  executeLeadQualification(task, project, harness, input) {
    const outputJson = {
      summary: `BANT Qualification completed for target lead pipeline. 18 accounts qualified with score > 80.`,
      scoring_model: 'BANT (Budget 30%, Authority 30%, Need 25%, Timeline 15%)',
      qualified_count: 18,
      avg_score: 84
    };

    const reportMd = `
### 💼 Lead Qualification & Pipeline Scoring
**Agent:** ${this.name} (${this.roleTitle})
**Scoring Model:** ${outputJson.scoring_model}

- **Total Assessed:** 25 accounts
- **Qualified for Outreach (Score > 80):** 18 accounts
- **Average Lead Quality:** 84/100

**Verdict:** Ready to Deliver
`;
    return { outputJson, reportMd };
  }

  executeDealProposal(task, project, harness, input) {
    const client = project?.client_name || 'Client';
    const outputJson = {
      summary: `Commercial Deal Proposal prepared for ${client}. Scope: 3 Core Departments + Dedicated Creative Support.`,
      deal_size: '$48,000 / Annual Contract',
      tiers: [
        { tier: 'Core Operations', price: '$2,500/mo', scope: 'Research + SEO + Lead Pipeline' },
        { tier: 'Full-Stack Growth', price: '$4,000/mo', scope: 'Research + Sales Outreach + Creative Studio (7 Services)' }
      ]
    };

    const reportMd = `
### 📝 Commercial Proposal Brief: ${client}
**Agent:** ${this.name} (${this.roleTitle})
**Proposed Valuation:** ${outputJson.deal_size}

- **Tier 1 (Core Operations):** $2,500/mo
- **Tier 2 (Full-Stack Growth):** $4,000/mo

> 🛡️ **Governance:** Review proposal terms before sending official client PDF.

**Verdict:** Ready to Deliver
`;
    return { outputJson, reportMd };
  }
}

// =============================================================================
// 3. CREATIVE DIRECTOR AGENT (Agent 03 - Creative Studio & Ops)
// =============================================================================

class CreativeDirectorAgent extends BaseAgent {
  constructor() {
    super({
      id: 'agent-03',
      name: 'Creative Director Agent',
      department: 'creative',
      roleTitle: 'Creative Director & Production Operations Manager',
      systemDirective: 'Orchestrate marketing services production across 7 categories. Decompose complex briefs into clear subtasks, assign to internal team specialists, review deliverables against brand guidelines, and enforce human approval before live release.'
    });

    this.registerSkill('landing_page', {
      name: 'Landing Page Architecture & Copywriting',
      requiresApproval: true,
      execute: (task, project, harness, input) => this.executeLandingPage(task, project, harness, input)
    });

    this.registerSkill('social_content', {
      name: 'Social Media Strategy & 30-Day Calendar',
      requiresApproval: true,
      execute: (task, project, harness, input) => this.executeSocialContent(task, project, harness, input)
    });

    this.registerSkill('ads_creative', {
      name: 'Google & Meta High-Intent Ad Copy',
      requiresApproval: true,
      execute: (task, project, harness, input) => this.executeAdsCreative(task, project, harness, input)
    });

    this.registerSkill('brand_kit', {
      name: 'Brand Identity & Visual System Guidelines',
      requiresApproval: false,
      execute: (task, project, harness, input) => this.executeBrandKit(task, project, harness, input)
    });
  }

  executeLandingPage(task, project, harness, input) {
    const client = project?.client_name || 'Enterprise Brand';
    const goal = project?.goal || 'Drive customer acquisition and conversion';

    const wbs = [
      { task: 'Wireframe Layout & UX Flow', assignee: 'Omar (Web Designer)', status: 'Drafted' },
      { task: 'Value Proposition & Section Copywriting', assignee: 'Creative Director Agent', status: 'Completed' },
      { task: 'Conversion Tracking & Form Integration', assignee: 'Tech Lead', status: 'Ready for Review' }
    ];

    const htmlDeliverable = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${client} — ${goal}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100 font-sans antialiased">
  <header class="py-20 px-6 max-w-5xl mx-auto text-center">
    <span class="inline-block px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-indigo-500/30">Official Campaign Release</span>
    <h1 class="text-4xl md:text-6xl font-black tracking-tight mb-4 text-white">${client}</h1>
    <p class="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-8">${goal}</p>
    <div class="flex justify-center gap-4">
      <a href="#contact" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg transition">Get Started Today</a>
      <a href="#features" class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-6 py-3.5 rounded-xl border border-slate-700 transition">Explore Offerings</a>
    </div>
  </header>
</body>
</html>
`.trim();

    const outputJson = {
      summary: `High-conversion landing page structure & copy designed for ${client}. Grounded in: ${goal}.`,
      wbs_tasks: wbs,
      type: 'html',
      title: `${client} Landing Page Architecture`,
      html: htmlDeliverable
    };

    const reportMd = `
### 🎨 Landing Page Production & Architecture
**Agent:** ${this.name} (${this.roleTitle})
**Client Brand:** ${client}

#### Work Breakdown Structure (Team Task Distribution)
${wbs.map(w => `- **${w.task}** → Assigned to: *${w.assignee}* [${w.status}]`).join('\n')}

> 🛡️ **Human Approval Gate:** Landing page HTML and copy prepared. Staged for manager review before live server deployment.

**Verdict:** Ready to Deliver
`;
    return { outputJson, reportMd };
  }

  executeSocialContent(task, project, harness, input) {
    const client = project?.client_name || 'Client';
    const posts = [
      { day: 1, platform: 'LinkedIn', hook: `Most agencies fail because of siloed execution. Here is how ${client} solved it:`, theme: 'Thought Leadership' },
      { day: 4, platform: 'Twitter/X', hook: 'Speed without governance is chaos. Speed with human approvals is compounding growth.', theme: 'Operational Excellence' },
      { day: 7, platform: 'LinkedIn', hook: 'Case breakdown: 34% CAC reduction in 60 days using a unified operating system.', theme: 'Case Study' }
    ];

    const outputJson = {
      summary: `30-Day Social Content Strategy & Pillar Calendar produced for ${client}.`,
      posts_sample: posts,
      total_planned: 12
    };

    const reportMd = `
### 📱 Social Content Strategy & Pillar Calendar
**Agent:** ${this.name} (${this.roleTitle})
**Client:** ${client}

${posts.map(p => `- **Day ${p.day} (${p.platform} - ${p.theme}):** "${p.hook}"`).join('\n')}

**Verdict:** Ready to Deliver
`;
    return { outputJson, reportMd };
  }

  executeAdsCreative(task, project, harness, input) {
    const client = project?.client_name || 'Client';
    const ads = {
      headlines: [
        `${client} Official Site`,
        'Unified Marketing Operations',
        'Proven B2B Customer Growth',
        'Transparent Campaign Execution'
      ],
      descriptions: [
        `Scale your marketing campaigns with ${client}. Grounded in verified data and transparent governance.`,
        'Eliminate agency silos. Experience rapid production, verified quality, and high conversion.'
      ]
    };

    const outputJson = {
      summary: `High-intent Search & Display ad copy generated for ${client}.`,
      headlines: ads.headlines,
      descriptions: ads.descriptions
    };

    const reportMd = `
### 📢 High-Intent Ad Copy & Creative
**Agent:** ${this.name} (${this.roleTitle})
**Client:** ${client}

- **Headlines:** ${ads.headlines.join(' | ')}
- **Description 1:** ${ads.descriptions[0]}
- **Description 2:** ${ads.descriptions[1]}

> 🛡️ **Governance:** Review ad spend parameters before publishing to ad networks.

**Verdict:** Ready to Deliver
`;
    return { outputJson, reportMd };
  }

  executeBrandKit(task, project, harness, input) {
    const client = project?.client_name || 'Client';
    const outputJson = {
      summary: `Brand Kit & Visual System guidelines codified for ${client}.`,
      palette: { primary: '#4F46E5', secondary: '#10B981', dark: '#0F172A', light: '#F8FAFC' },
      typography: { primary: 'Inter, sans-serif', heading: 'Plus Jakarta Sans, sans-serif' },
      voice: 'Authoritative, precise, outcome-oriented, transparent'
    };

    const reportMd = `
### 🎨 Brand Identity Guidelines & Visual System
**Agent:** ${this.name} (${this.roleTitle})
**Client:** ${client}

- **Primary Brand Color:** Indigo (#4F46E5)
- **Secondary Accent:** Emerald (#10B981)
- **Voice & Tone:** ${outputJson.voice}

**Verdict:** Ready to Deliver
`;
    return { outputJson, reportMd };
  }
}

// Instantiate the 3 sovereign agents
const researchAgent = new ResearchAgent();
const salesAgent = new SalesAgent();
const creativeDirectorAgent = new CreativeDirectorAgent();

// =============================================================================
// MASTER EXECUTION DISPATCHER
// =============================================================================

/**
 * Optional Live Web Search Integration (only runs when Admin configures a real API key in Settings -> External Integrations).
 */
async function fetchLiveWebSearch(targetDb, query) {
  try {
    const row = targetDb.prepare("SELECT * FROM external_integrations WHERE slug = 'web_search'").get();
    if (!row || !row.api_key || !row.endpoint_url) {
      return { configured: false, results: [] };
    }
    const apiKey = decryptSecret(row.api_key);
    if (!apiKey) return { configured: false, results: [] };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const isSerper = row.provider === 'serper' || row.endpoint_url.includes('serper.dev');
      const res = await fetch(row.endpoint_url, {
        method: 'POST',
        headers: isSerper
          ? { 'Content-Type': 'application/json', 'X-API-KEY': apiKey }
          : { 'Content-Type': 'application/json' },
        body: JSON.stringify(isSerper ? { q: query, num: 6 } : { api_key: apiKey, query, max_results: 6 }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) return { configured: true, error: `HTTP ${res.status}`, results: [] };
      const data = await res.json();
      const rawItems = data.results || data.organic || [];
      const results = rawItems.slice(0, 6).map((item) => ({
        title: item.title || '',
        url: item.url || item.link || '',
        snippet: String(item.content || item.snippet || '').slice(0, 320)
      }));
      return { configured: true, provider: row.provider, results };
    } catch (err) {
      clearTimeout(timer);
      return { configured: true, error: err.message, results: [] };
    }
  } catch (_) {
    return { configured: false, results: [] };
  }
}

/**
 * Load persistent Admin-configured Agent Blueprints from DB (`agent_blueprints`).
 */
function loadAgentBlueprints(targetDb, agentSlug) {
  try {
    const rows = targetDb.prepare('SELECT tab_name, content FROM agent_blueprints WHERE agent_slug = ?').all(agentSlug);
    return rows.filter((r) => r.content && r.content.trim()).map((r) => `[${r.tab_name}]\n${r.content.trim()}`).join('\n\n');
  } catch (_) {
    return '';
  }
}

/**
 * Build grounded prompt for live LLM execution using project context, harness files,
 * keyword/BM25 retrieved snippets, live web search (if configured by Admin), real team roster, and saved blueprints.
 */
function buildAgentPrompts(targetAgent, skill, task, project, harnessFiles, ragContext, inputData, { webSearch, teamRoster, blueprints } = {}) {
  const client = project?.client_name || project?.name || 'Client';
  const harnessSummary = (harnessFiles || [])
    .slice(0, 8)
    .map((f) => `- ${f.filename || f.name || 'file'} (${f.category || 'general'})`)
    .join('\n') || 'None uploaded';

  const ragSummary = (ragContext || [])
    .slice(0, 5)
    .map((c, i) => `[Snippet ${i + 1}] ${String(c.content || '').slice(0, 350)}`)
    .join('\n') || 'No knowledge base snippets indexed for this project.';

  const webSummary = webSearch?.configured && webSearch.results.length > 0
    ? webSearch.results.map((r, i) => `[Web ${i + 1}] ${r.title} (${r.url}): ${r.snippet}`).join('\n')
    : 'NOT CONNECTED (Admin has not configured a Live Web Search API in Settings → External Integrations. Do NOT invent unverified contact emails, phone numbers, or live web metrics.)';

  const rosterSummary = (teamRoster || []).length > 0
    ? teamRoster.map((u) => `- ${u.name} (${u.role}${u.department ? ', ' + u.department : ''})`).join('\n')
    : 'No internal team members provisioned beyond owner; mark unassigned tasks as "Unassigned".';

  const systemPrompt = [
    `You are ${targetAgent.name} (${targetAgent.roleTitle}) in the ${targetAgent.department.toUpperCase()} department of Marketing OS.`,
    targetAgent.systemDirective,
    blueprints ? `Custom Admin Blueprints:\n${blueprints}` : '',
    'STRICT HONESTY RULES:',
    '1. Ground outputs strictly in provided client info, harness files, retrieved knowledge base snippets, and live web search results (if connected).',
    '2. NEVER fabricate unverified contact emails, phone numbers, fake competitor prices, or invented market stats.',
    '3. Only assign WBS tasks to real team members listed in the Team Roster, or mark them "Unassigned".',
    '4. Respond with a valid JSON object containing at minimum: {"title": "...", "summary": "...", "deliverable": {...}, "report_md": "... (ending with **Verdict:** Ready to Deliver)"}.'
  ].filter(Boolean).join('\n');

  const userPrompt = [
    `Skill SOP: ${skill.name}`,
    `Task Title: ${task.title}`,
    `Pipeline: ${task.pipeline}`,
    `Description: ${task.description || 'N/A'}`,
    `Client: ${client}`,
    `Campaign Goal: ${project?.goal || 'N/A'}`,
    `Brand Guidelines: ${project?.guidelines || 'Standard agency quality'}`,
    `Input JSON: ${JSON.stringify(inputData || {})}`,
    `Real Workspace Team Roster:\n${rosterSummary}`,
    `Harness Files:\n${harnessSummary}`,
    `Knowledge Base Snippets:\n${ragSummary}`,
    `Live Web Search Results:\n${webSummary}`
  ].join('\n');

  return { systemPrompt, userPrompt };
}

/**
 * Executes a task using the unified 3-Agent framework.
 * - Logs run lifecycle in `agent_runs`
 * - Invokes live configured LLM provider via `llmClient` with retries/failover
 * - NEVER fakes output or inserts fake leads in Production when no live LLM is connected
 * - Enforces strict DB integrity: NEVER reports success if a required DB write fails
 */
async function executeAgentTask(task, project, harnessFiles = [], options = {}) {
  const targetDb = options.db || db;
  const startTime = Date.now();
  const runId = uuidv4();
  const pipeline = (task.pipeline || 'creative').toLowerCase();
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const allowSimulatedFallback = !isProd && (process.env.ALLOW_SIMULATED_FALLBACK === 'true' || options.allowSimulatedFallback === true);

  let inputData = {};
  try {
    inputData = typeof task.input_json === 'string' ? JSON.parse(task.input_json || '{}') : (task.input_json || {});
  } catch (err) {
    console.warn(`[agentFramework] Invalid task.input_json for task ${task.id}: ${err.message}`);
  }

  // 1. Select Responsible Agent & Skill
  let targetAgent = creativeDirectorAgent;
  let sopSlug = 'landing_page';

  if (task.department === 'research' || ['market-intel', 'lead-research', 'content-seo'].includes(pipeline)) {
    targetAgent = researchAgent;
    sopSlug = pipeline.replace('-', '_');
  } else if (task.department === 'sales' || ['email-campaign', 'lead_qualification', 'deal_proposal'].includes(pipeline)) {
    targetAgent = salesAgent;
    sopSlug = pipeline.replace('-', '_');
  } else {
    targetAgent = creativeDirectorAgent;
    sopSlug = pipeline.replace('-', '_');
  }

  const skill = targetAgent.getSkill(sopSlug) || Object.values(targetAgent.skills)[0];
  const activeCfg = getActiveLLMConfig ? getActiveLLMConfig(targetDb, false) : { provider: 'ollama', default_model: 'llama3.2' };

  // 2. Record `running` audit entry in `agent_runs`
  targetDb.prepare(`
    INSERT INTO agent_runs (
      id, task_id, project_id, agent_id, agent_name, department, skill_slug,
      provider, model, status, data_source, attempt_count, duration_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', 'live_llm', 0, 0)
  `).run(
    runId,
    task.id || null,
    project?.id || task.project_id || null,
    targetAgent.id,
    targetAgent.name,
    targetAgent.department,
    sopSlug,
    activeCfg?.provider || 'unconfigured',
    activeCfg?.default_model || 'unconfigured'
  );

  try {
    // 3. Load Keyword/BM25 Knowledge Base context, real Team Roster, saved Blueprints, and optional Live Web Search
    let ragContext = [];
    if (rag && typeof rag.searchChunks === 'function' && project?.id) {
      try {
        ragContext = rag.searchChunks(project.id, `${task.title} ${task.description || ''}`, 5) || [];
      } catch (ragErr) {
        console.warn(`[agentFramework] RAG lookup note: ${ragErr.message}`);
      }
    }

    let teamRoster = [];
    try {
      teamRoster = targetDb.prepare("SELECT name, role, department FROM users WHERE role != 'client'").all();
    } catch (_) {}

    const blueprints = loadAgentBlueprints(targetDb, targetAgent.department);
    const webSearch = targetAgent.department === 'research'
      ? await fetchLiveWebSearch(targetDb, `${project?.client_name || ''} ${task.title} ${project?.goal || ''}`.trim())
      : { configured: false, results: [] };

    // 4. Attempt Real LLM Execution via llmClient (with timeout, backoff retries & failover)
    const { systemPrompt, userPrompt } = buildAgentPrompts(
      targetAgent,
      skill,
      task,
      project,
      harnessFiles,
      ragContext,
      inputData,
      { webSearch, teamRoster, blueprints }
    );

    const llmRes = options.skipLiveLLM
      ? { ok: false, data_source: 'simulated_fallback', attempts: 0, error: 'Live LLM skipped by test options' }
      : await invokeLLM(targetDb, {
          systemPrompt,
          userPrompt,
          maxRetries: options.maxRetries !== undefined ? options.maxRetries : 1,
          baseBackoffMs: options.baseBackoffMs !== undefined ? options.baseBackoffMs : 150,
          timeoutMs: options.timeoutMs || null
        });

    let outputJson;
    let reportMd;
    let dataSource = 'live_llm';
    let isSimulated = false;
    let fallbackReason = null;
    let usedProvider = activeCfg?.provider || 'unconfigured';
    let usedModel = activeCfg?.default_model || 'unconfigured';

    if (llmRes.ok) {
      dataSource = 'live_llm';
      isSimulated = false;
      usedProvider = llmRes.provider || usedProvider;
      usedModel = llmRes.model || usedModel;

      // Pure live LLM output — ZERO hardcoded template contamination!
      const parsed = llmRes.parsedJson && typeof llmRes.parsedJson === 'object' ? llmRes.parsedJson : null;
      outputJson = {
        ...(parsed || {}),
        title: parsed?.title || task.title || 'Marketing Deliverable',
        summary: parsed?.summary || llmRes.content.slice(0, 500),
        deliverable: parsed?.deliverable || { content: llmRes.content },
        llm_raw_output: llmRes.content,
        web_search_used: Boolean(webSearch.configured && webSearch.results.length > 0),
        data_source: 'live_llm',
        is_simulated: false
      };

      reportMd = parsed?.report_md || `### 🤖 ${targetAgent.name} — Live AI Deliverable\n**Provider:** ${usedProvider} (${usedModel})\n**Web Search:** ${webSearch.configured ? `Connected (${webSearch.results.length} sources)` : 'Not configured (LLM + Project Knowledge Base only)'}\n\n${llmRes.content}\n\n**Verdict:** Ready to Deliver\n`;
      if (!reportMd.includes('**Verdict:** Ready to Deliver')) {
        reportMd += '\n\n**Verdict:** Ready to Deliver\n';
      }
    } else if (allowSimulatedFallback) {
      // ONLY allowed in explicitly opted-in offline automated tests — NEVER in Production or normal user runs!
      dataSource = 'simulated_fallback';
      isSimulated = true;
      fallbackReason = llmRes.error || 'No reachable LLM provider configured';

      const fallback = skill.execute(task, project, harnessFiles, inputData);
      outputJson = {
        ...fallback.outputJson,
        data_source: 'simulated_fallback',
        is_simulated: true,
        fallback_reason: fallbackReason
      };
      reportMd = `> ⚠️ **Data Source:** \`simulated_fallback\` *(Test-only offline fixture — Live LLM unavailable: ${fallbackReason})*\n\n${fallback.reportMd}`;
    } else {
      // HONEST PRODUCTION BEHAVIOR: Refuse to fabricate fake data or fake leads when no live LLM is connected!
      const err = new Error(
        `No live LLM provider is connected (${llmRes.error || 'unconfigured'}). Go to Settings → LLM Providers, configure an OpenAI, Anthropic, or Gemini API key (or live endpoint), click Save & Test Ping, and set it as Primary before running agents.`
      );
      err.code = 'LLM_NOT_CONFIGURED';
      err.statusCode = 503;
      throw err;
    }

    // Guarantee deliverable title is set
    if (!outputJson.title) {
      outputJson.title = task.title || 'Marketing Deliverable';
    }

    // 5. Attach Standardized Execution Metadata
    outputJson.metadata = {
      pipeline: task.pipeline || 'landing-page',
      provider: usedProvider,
      model: usedModel,
      agent_id: targetAgent.id,
      agent_name: targetAgent.name,
      department: targetAgent.department,
      data_source: dataSource,
      is_simulated: isSimulated,
      web_search_connected: Boolean(webSearch.configured),
      run_id: runId,
      attempts: llmRes.attempts || 0,
      executed_at: new Date().toISOString()
    };

    // 6. Strict Transactional Side-Effects (Leads & Approval Gate — NEVER silently swallow DB errors!)
    const requiresApproval = targetAgent.requiresHumanApproval(task, sopSlug);
    let approvalId = null;
    let persistedLeadsCount = 0;

    const persistSideEffects = targetDb.transaction(() => {
      // 6a. Persist discovered leads for lead_research into actual `leads` schema
      if (sopSlug === 'lead_research' && Array.isArray(outputJson.discovered_leads) && (project?.id || task.project_id)) {
        const targetProjectId = project?.id || task.project_id;
        const insertLead = targetDb.prepare(`
          INSERT INTO leads (id, project_id, full_name, email, phone, job_title, icp_score, status, source_evidence)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?)
        `);
        for (const l of outputJson.discovered_leads) {
          insertLead.run(
            uuidv4(),
            targetProjectId,
            l.name || l.full_name || 'Prospect Lead',
            l.email || null,
            l.phone || null,
            l.title || l.job_title || 'Decision Maker',
            typeof l.icp_score === 'number' ? l.icp_score : 85,
            JSON.stringify({
              data_source: dataSource,
              is_simulated: isSimulated,
              run_id: runId,
              company: l.company || null,
              location: l.location || null
            })
          );
          persistedLeadsCount++;
        }
      }

      // 6b. Queue Human Approval Gate if required (throws on DB failure!)
      if (requiresApproval) {
        approvalId = uuidv4();
        targetDb.prepare(`
          INSERT INTO approvals (id, task_id, project_id, department, agent_name, action_type, title, summary, preview_data, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `).run(
          approvalId,
          task.id || null,
          project?.id || task.project_id || null,
          targetAgent.department,
          targetAgent.name,
          outputJson.proposed_action || `Execute ${task.title}`,
          `Approval Required: ${task.title}`,
          outputJson.summary || 'Agent output generated requiring human sign-off.',
          JSON.stringify(outputJson.sequence || outputJson.html || outputJson.summary)
        );
      }
    });

    persistSideEffects();

    // 7. Mark agent_run as `succeeded`
    const durationMs = Date.now() - startTime;
    targetDb.prepare(`
      UPDATE agent_runs SET
        provider = ?,
        model = ?,
        status = 'succeeded',
        data_source = ?,
        attempt_count = ?,
        duration_ms = ?,
        metadata_json = ?,
        completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      usedProvider,
      usedModel,
      dataSource,
      llmRes.attempts || 0,
      durationMs,
      JSON.stringify({
        requires_approval: requiresApproval,
        approval_id: approvalId,
        persisted_leads: persistedLeadsCount,
        fallback_reason: fallbackReason
      }),
      runId
    );

    return {
      runId,
      outputJson,
      reportMd,
      requiresApproval,
      approvalId,
      dataSource,
      isSimulated,
      fallbackReason,
      attempts: llmRes.attempts || 0,
      persistedLeadsCount,
      agent: targetAgent
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    console.error(`[agentFramework ERROR] Run ${runId} failed for task ${task.id}: ${err.message}`);

    // Mark agent_runs as `failed` and record incident in `error_log`
    try {
      targetDb.prepare(`
        UPDATE agent_runs SET
          status = 'failed',
          duration_ms = ?,
          error_message = ?,
          completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(durationMs, err.message, runId);

      targetDb.prepare(`
        INSERT INTO error_log (id, correlation_id, category, code, message, stack_trace, context_json, severity)
        VALUES (?, ?, 'AGENT_EXECUTION_ERROR', ?, ?, ?, ?, 'ERROR')
      `).run(
        uuidv4(),
        runId,
        err.code || 'AGENT_RUN_FAILED',
        err.message,
        (err.stack || '').slice(0, 1500),
        JSON.stringify({ source: 'agent_framework', task_id: task.id || null, project_id: project?.id || task.project_id || null })
      );
    } catch (logErr) {
      console.error(`[agentFramework] Secondary error while logging failure: ${logErr.message}`);
    }

    throw err;
  }
}

module.exports = {
  BaseAgent,
  ResearchAgent,
  SalesAgent,
  CreativeDirectorAgent,
  researchAgent,
  salesAgent,
  creativeDirectorAgent,
  executeAgentTask
};
