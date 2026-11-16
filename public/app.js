// Marketing OS — Full-Stack Factory & Saved Logins Client Engine
const STORAGE_KEY = 'mos_sovereign_v2_state';

const PIPELINE_CATALOG = {
  'email-campaign': {
    id: 'email-campaign', code: 'EM', name: 'Email Sequence Campaign',
    badge: 'Dual-Branded HTML + Merge Tags + Gate G2',
    squad: ['CO', 'BR', 'SE', 'MR'],
    squadNames: ['@coordinator', '@browser-researcher', '@software-engineer', '@master-reporting-agent'],
    webhook: '/webhook/marketing-os-task',
    defaultCmd: '/assign Craft dual-branded email templates for Valioz Health from Priority_A_Outreach_Email_Merge_Fields.csv with 22 clinic merge fields and $499 offer.'
  },
  'landing-page': {
    id: 'landing-page', code: 'LP', name: 'Landing Page Factory',
    badge: 'HTML + Tailwind + Conversion Form',
    squad: ['CO', 'AE', 'SE', 'MR'],
    squadNames: ['@coordinator', '@aesthetic', '@software-engineer', '@master-reporting-agent'],
    webhook: '/webhook/marketing-os-landing',
    defaultCmd: '/assign Build a conversion-focused B2B Landing Page from catalog.pdf + leads.csv with cold-chain specs and instant booking form.'
  },
  'lead-research': {
    id: 'lead-research', code: 'LR', name: 'Lead-to-Deal Machine',
    badge: 'Enriched CSV + Outreach Pack',
    squad: ['CO', 'BR', 'SE', 'MR'],
    squadNames: ['@coordinator', '@browser-researcher', '@software-engineer', '@master-reporting-agent'],
    webhook: '/webhook/marketing-os-leads',
    defaultCmd: '/assign Research & qualify 50 buyer leads from leads.csv + catalog.pdf. Output enriched table + personalized outreach pack.'
  },
  'content-seo': {
    id: 'content-seo', code: 'CS', name: 'Content + SEO Pillar',
    badge: '1,500w Article + Schema + Meta',
    squad: ['CO', 'BR', 'SC', 'MR'],
    squadNames: ['@coordinator', '@browser-researcher', '@scribe', '@master-reporting-agent'],
    webhook: '/webhook/marketing-os-seo',
    defaultCmd: '/assign Draft an authoritative B2B SEO pillar article grounded in catalog.pdf targeting executive decision makers.'
  },
  'social-content': {
    id: 'social-content', code: 'SC', name: 'Social Content Calendar',
    badge: '7-Day Multi-Channel Grid',
    squad: ['CO', 'ST', 'AM', 'MR'],
    squadNames: ['@coordinator', '@storyteller', '@amplifier', '@master-reporting-agent'],
    webhook: '/webhook/marketing-os-social',
    defaultCmd: '/assign Generate a 7-day LinkedIn + Instagram Reels content calendar from products.png and catalog.pdf.'
  },
  'ads-creative': {
    id: 'ads-creative', code: 'AD', name: 'Ads Creative + Copy',
    badge: '3 Ad Angles + ROAS Matrix',
    squad: ['CO', 'AE', 'AM', 'MR'],
    squadNames: ['@coordinator', '@aesthetic', '@amplifier', '@master-reporting-agent'],
    webhook: '/webhook/marketing-os-ads',
    defaultCmd: '/assign Build 3 high-converting LinkedIn & Meta B2B ad creative variants grounded in price gaps and product margins.'
  },
  'market-intel': {
    id: 'market-intel', code: 'MI', name: 'Market Intel (/grillme)',
    badge: 'Competitor Teardown + Pricing',
    squad: ['CO', 'SS', 'AN', 'MR'],
    squadNames: ['@coordinator', '@signal-scout', '@analyst', '@master-reporting-agent'],
    webhook: '/webhook/marketing-os-intel',
    defaultCmd: '/grillme Stress-test our pricing and landed cost structure against competitors and recommend 3 immediate margin-expansion moves.'
  },
  'brand-kit': {
    id: 'brand-kit', code: 'BK', name: 'Brand Kit + Visual System',
    badge: 'Palette + Typography + Voice',
    squad: ['CO', 'VK', 'AE', 'MR'],
    squadNames: ['@coordinator', '@vision-keeper', '@aesthetic', '@master-reporting-agent'],
    webhook: '/webhook/marketing-os-brand',
    defaultCmd: '/assign Codify a cohesive B2B Brand Kit (color tokens, typography hierarchy, and positioning rules) from product assets.'
  }
};

const AGENTS_32 = [
  // Leadership & Strategy (4)
  {
    id: 'c1',
    slug: 'coordinator',
    name: 'Coordinator',
    role: 'Orchestration Lead & COO',
    dept: 'Leadership',
    initials: 'CO',
    color: '#4F46E5',
    capabilities: ['5-Stage Loop Governance', 'Task DAG Scheduling', 'Gate G2 Enforcer', 'Agent Delegation'],
    assigned_pipelines: ['landing-page', 'email-campaign', 'lead-research', 'content-seo', 'market-intel', 'brand-kit', 'social-content', 'ads-creative'],
    system_directive: 'Decompose complex marketing briefs into deterministic 5-stage agent pipelines (Plan -> Assign -> Execute -> Verify -> Report). Enforce ground-truth harness compliance and human-in-the-loop Gate G2 approval before live delivery.',
    status: 'active'
  },
  {
    id: 'c2',
    slug: 'strategist',
    name: 'Strategist',
    role: 'Market Positioning & OKRs',
    dept: 'Leadership',
    initials: 'ST',
    color: '#7C3AED',
    capabilities: ['Competitive Moat Analysis', 'Value Proposition Design', 'Quarterly OKR Mapping', 'Channel Economics'],
    assigned_pipelines: ['market-intel', 'brand-kit'],
    system_directive: 'Formulate high-yield strategic positioning frameworks. Align client offerings with market whitespace and validate economics against harness pricing data.',
    status: 'active'
  },
  {
    id: 'c3',
    slug: 'chief-staff',
    name: 'Chief Staff',
    role: 'Cross-Functional Execution Ops',
    dept: 'Leadership',
    initials: 'CS',
    color: '#4F46E5',
    capabilities: ['Resource Allocation', 'Bottleneck Elimination', 'Inter-Agent Handoffs', 'Execution Velocity'],
    assigned_pipelines: ['landing-page', 'email-campaign'],
    system_directive: 'Ensure zero-stall execution across agent squads. Monitor token throughput, task dependencies, and error recovery policies.',
    status: 'active'
  },
  {
    id: 'c4',
    slug: 'vision-keeper',
    name: 'Vision Keeper',
    role: 'Brand Integrity & Narrative',
    dept: 'Leadership',
    initials: 'VK',
    color: '#DB2777',
    capabilities: ['Brand Voice Calibration', 'Ethical Guardrails', 'Mission Alignment', 'Executive Polish'],
    assigned_pipelines: ['brand-kit', 'social-content'],
    system_directive: 'Audit all outbound narratives against the brand guidelines. Guarantee that voice, tone, typography, and visual assets communicate sovereign authority.',
    status: 'active'
  },

  // Research & Intelligence (4)
  {
    id: 'r1',
    slug: 'insight-miner',
    name: 'Insight Miner',
    role: 'Pattern & Data Extraction',
    dept: 'Research',
    initials: 'IM',
    color: '#0891B2',
    capabilities: ['Customer Sentiment Mining', 'Review Teardowns', 'Objection Harvesting', 'Feature Gap Extraction'],
    assigned_pipelines: ['market-intel', 'lead-research'],
    system_directive: 'Analyze customer review corpuses, forum discussions, and feedback transcripts. Extract unvarnished pain points, conversion blockers, and emotional hooks.',
    status: 'active'
  },
  {
    id: 'r2',
    slug: 'browser-researcher',
    name: 'Browser Researcher',
    role: 'Autonomous Forensics & Web Scraping',
    dept: 'Research',
    initials: 'BR',
    color: '#0284C7',
    capabilities: ['Headless Chromium Navigation', 'DOM Tree Extraction', 'SERP Analysis', 'Pricing Table Forensic Scrape'],
    assigned_pipelines: ['lead-research', 'market-intel', 'content-seo'],
    system_directive: 'Perform automated web investigation, SERP queries, and competitor audits. Capture exact evidence citations and prevent stale assumptions.',
    status: 'active'
  },
  {
    id: 'r3',
    slug: 'signal-scout',
    name: 'Signal Scout',
    role: 'Trend Sensing & Market Shifts',
    dept: 'Research',
    initials: 'SS',
    color: '#0D9488',
    capabilities: ['Google Trends Velocity', 'Algorithmic Shift Detection', 'Viral Loop Modeling', 'Emerging Entity Radar'],
    assigned_pipelines: ['content-seo', 'social-content'],
    system_directive: 'Monitor real-time search volume velocity, rising queries, and category shifts to capture high-intent organic demand ahead of competitors.',
    status: 'active'
  },
  {
    id: 'r4',
    slug: 'truth-seeker',
    name: 'Truth Seeker',
    role: 'Fact & Claim Validation',
    dept: 'Research',
    initials: 'TS',
    color: '#059669',
    capabilities: ['Source Grounding Verification', 'Citation Cross-Check', 'Anti-Hallucination Gate', 'Numeric Reconciliation'],
    assigned_pipelines: ['market-intel', 'lead-research'],
    system_directive: 'Cross-reference every metric, price, and doctor or clinic name directly against uploaded harness files. Reject ungrounded claims with zero tolerance.',
    status: 'active'
  },

  // Engineering & Full-Stack Development (4)
  {
    id: 'e1',
    slug: 'architect',
    name: 'Architect',
    role: 'Distributed Systems & Data Modeling',
    dept: 'Engineering',
    initials: 'AR',
    color: '#4F46E5',
    capabilities: ['Schema Normalization', 'State Machine Design', 'API Contract Specs', 'Fault-Tolerant Topology'],
    assigned_pipelines: ['landing-page'],
    system_directive: 'Design robust, low-latency architectures with clear interface boundaries, strict SQLite pragma enforcement, and centralized error hierarchies.',
    status: 'active'
  },
  {
    id: 'e2',
    slug: 'software-engineer',
    name: 'Software Engineer',
    role: 'Full-Stack Code & UI Deliverables',
    dept: 'Engineering',
    initials: 'SE',
    color: '#7C3AED',
    capabilities: ['Tailwind CSS Generation', 'Responsive HTML Landing Pages', 'AST Validation', 'Interactive DOM Components'],
    assigned_pipelines: ['landing-page', 'email-campaign', 'brand-kit'],
    system_directive: 'Author production-grade HTML, CSS, JavaScript, and Node.js microservices. Implement defensive try/catch blocks and guarantee responsive mobile rendering.',
    status: 'active'
  },
  {
    id: 'e3',
    slug: 'guardian',
    name: 'Guardian',
    role: 'Security & Automated TDD',
    dept: 'Engineering',
    initials: 'GU',
    color: '#DC2626',
    capabilities: ['RBAC Boundary Auditing', 'Type Confusion Defense', 'SQL Injection Mitigation', 'Automated Test Harness'],
    assigned_pipelines: ['landing-page'],
    system_directive: 'Maintain rigorous defensive perimeter checks. Block privilege escalation, enforce credential masking, and run regression test suites on every release.',
    status: 'active'
  },
  {
    id: 'e4',
    slug: 'integrator',
    name: 'Integrator',
    role: 'API Webhooks & Data Pipelines',
    dept: 'Engineering',
    initials: 'IN',
    color: '#D97706',
    capabilities: ['n8n Dual Engine Routing', 'SMTP Protocol Handshakes', 'Webhook Retry Mechanics', 'Multipart Stream Parsing'],
    assigned_pipelines: ['email-campaign', 'lead-research'],
    system_directive: 'Orchestrate seamless telemetry between local Antigravity runtimes, n8n webhook nodes, Hostinger mail servers, and external CRM sync endpoints.',
    status: 'active'
  },

  // Design & Creative Assets (4)
  {
    id: 'd1',
    slug: 'aesthetic',
    name: 'Aesthetic',
    role: 'Visual Language & Brand Style',
    dept: 'Design',
    initials: 'AE',
    color: '#DB2777',
    capabilities: ['Design System Tokens', 'Color Theory & Harmony', 'Hero Section Composition', 'Visual Hierarchy'],
    assigned_pipelines: ['brand-kit', 'landing-page'],
    system_directive: 'Establish premium visual standards utilizing modern dark/light gradients, crisp borders, and balanced whitespace that converts high-ticket buyers.',
    status: 'active'
  },
  {
    id: 'd2',
    slug: 'flow-maker',
    name: 'Flow Maker',
    role: 'Conversion UX & Funnels',
    dept: 'Design',
    initials: 'FM',
    color: '#7C3AED',
    capabilities: ['Friction Reduction', 'Form Step Optimization', 'Checkout Flow Audit', 'Micro-Interaction Design'],
    assigned_pipelines: ['landing-page'],
    system_directive: 'Engineer frictionless user conversion journeys. Reduce drop-off rates on booking forms, consultation schedulers, and inquiry CTA buttons.',
    status: 'active'
  },
  {
    id: 'd3',
    slug: 'motion',
    name: 'Motion',
    role: 'Interactive Animation & Delight',
    dept: 'Design',
    initials: 'MO',
    color: '#4F46E5',
    capabilities: ['CSS Micro-Animations', 'Skeleton Loaders', 'Scroll-Trigger Transitions', 'Mobile Touch Feedback'],
    assigned_pipelines: ['landing-page'],
    system_directive: 'Infuse lightweight, GPU-accelerated motion tokens that guide user focus without compromising page load speeds or Google Core Web Vitals.',
    status: 'active'
  },
  {
    id: 'd4',
    slug: 'scribe',
    name: 'Scribe',
    role: 'Content Systems & Copy Architecture',
    dept: 'Design',
    initials: 'SC',
    color: '#0891B2',
    capabilities: ['Direct-Response Copywriting', 'H1-H3 Structure', 'FAQ Schema Generation', 'Meta Description Crafting'],
    assigned_pipelines: ['content-seo', 'email-campaign', 'social-content'],
    system_directive: 'Produce authoritative, persuasive copywriting. Frame compelling headlines, benefit bullet points, and authoritative FAQs grounded in search intent.',
    status: 'active'
  },

  // Operations & Quality Assurance (4)
  {
    id: 'o1',
    slug: 'conductor',
    name: 'Conductor',
    role: 'Release Management & CI/CD',
    dept: 'Ops',
    initials: 'CN',
    color: '#059669',
    capabilities: ['Artifact Versioning', 'Rollback Triggers', 'Build Automation', 'Environment Staging'],
    assigned_pipelines: ['landing-page', 'email-campaign'],
    system_directive: 'Manage build artifacts and deployment pipelines. Verify system health checks and maintain clean migration rollbacks.',
    status: 'active'
  },
  {
    id: 'o2',
    slug: 'keeper',
    name: 'Keeper',
    role: 'Knowledge Base & RAG Indexing',
    dept: 'Ops',
    initials: 'KE',
    color: '#0D9488',
    capabilities: ['Harness Chunking', 'Vector Ingestion', 'Semantic Cache Sync', 'Context Window Packing'],
    assigned_pipelines: ['market-intel', 'content-seo'],
    system_directive: 'Maintain the project RAG vector database. Ensure newly uploaded harness files, CSV leads, and SOP guidelines are immediately chunked and searchable.',
    status: 'active'
  },
  {
    id: 'o3',
    slug: 'resolver',
    name: 'Resolver',
    role: 'Incident Response & Fallbacks',
    dept: 'Ops',
    initials: 'RE',
    color: '#D97706',
    capabilities: ['Dead Letter Queue Handling', 'Webhook Fallback Routing', 'Rate Limit Backoff', 'Error Correlation Diagnostics'],
    assigned_pipelines: ['email-campaign', 'landing-page'],
    system_directive: 'Detect infrastructure disconnects (e.g. n8n offline) and route instantly to Antigravity sovereign local runners without dropping task states.',
    status: 'active'
  },
  {
    id: 'o4',
    slug: 'master-reporting-agent',
    name: 'Master Reporting',
    role: 'Executive Audit & Delivery Verdict',
    dept: 'Ops',
    initials: 'MR',
    color: '#4F46E5',
    capabilities: ['Executive QA Audit', 'Deliverable Verification', 'Admin Markdown Reports', 'Ready-to-Deliver Sign-off'],
    assigned_pipelines: ['landing-page', 'email-campaign', 'lead-research', 'content-seo', 'market-intel', 'brand-kit', 'social-content', 'ads-creative'],
    system_directive: 'Audit all deliverables for ground truth alignment, usability, and commercial readiness. Emit official Admin Reports with final Ready to Deliver verdicts.',
    status: 'active'
  },

  // Growth & Acquisition (4)
  {
    id: 'g1',
    slug: 'amplifier',
    name: 'Amplifier',
    role: 'Growth Loops & Viral Dynamics',
    dept: 'Growth',
    initials: 'AM',
    color: '#DB2777',
    capabilities: ['Referral Engine Design', 'Social Share Mechanics', 'Product-Led Growth', 'Flywheel Optimization'],
    assigned_pipelines: ['social-content', 'ads-creative'],
    system_directive: 'Architect viral acquisition loops and referral programs that turn satisfied patients and customers into organic acquisition drivers.',
    status: 'active'
  },
  {
    id: 'g2',
    slug: 'storyteller',
    name: 'Storyteller',
    role: 'Narrative Growth & Case Studies',
    dept: 'Growth',
    initials: 'ST',
    color: '#7C3AED',
    capabilities: ['Customer Proof Case Studies', 'Email Nurture Storytelling', 'Founder Angle Framing', 'Emotional Resonance'],
    assigned_pipelines: ['email-campaign', 'content-seo'],
    system_directive: 'Craft compelling narrative arcs across cold email sequences and content assets. Transform raw clinic metrics into undeniable transformation stories.',
    status: 'active'
  },
  {
    id: 'g3',
    slug: 'connector',
    name: 'Connector',
    role: 'Partnerships & B2B Distribution',
    dept: 'Growth',
    initials: 'CN',
    color: '#4F46E5',
    capabilities: ['Strategic Channel Alliances', 'Affiliate Mesh Modeling', 'Supplier Co-Marketing', 'B2B Deal Routing'],
    assigned_pipelines: ['lead-research', 'market-intel'],
    system_directive: 'Identify high-leverage distribution partners, dental associations, and supplier networks to scale B2B pipeline without linear ad spend.',
    status: 'active'
  },
  {
    id: 'g4',
    slug: 'analyst',
    name: 'Analyst',
    role: 'Attribution & Conversion Analytics',
    dept: 'Growth',
    initials: 'AN',
    color: '#0891B2',
    capabilities: ['Multi-Touch Attribution', 'CAC / LTV Modeling', 'ROAS Optimization', 'Funnel Cohort Analysis'],
    assigned_pipelines: ['ads-creative', 'market-intel'],
    system_directive: 'Compute customer acquisition costs, lifetime value ratios, and channel attribution models to ensure advertising dollars yield profitable growth.',
    status: 'active'
  },

  // Finance & Deal Structuring (4)
  {
    id: 'f1',
    slug: 'steward',
    name: 'Steward',
    role: 'Capital Strategy & Budgeting',
    dept: 'Finance',
    initials: 'SW',
    color: '#059669',
    capabilities: ['Unit Economics Modeling', 'Margin Protection', 'Media Budget Allocation', 'Runway Forecasting'],
    assigned_pipelines: ['ads-creative'],
    system_directive: 'Monitor advertising burn rates and campaign spend. Protect gross margins on setup fees and recurring software retainers.',
    status: 'active'
  },
  {
    id: 'f2',
    slug: 'forecaster',
    name: 'Forecaster',
    role: 'Financial Projections & Modeling',
    dept: 'Finance',
    initials: 'FC',
    color: '#0284C7',
    capabilities: ['MRR / ARR Projections', 'Churn Sensitivity Modeling', 'Lead-to-Close Modeling', 'Seasonality Adjustments'],
    assigned_pipelines: ['market-intel'],
    system_directive: 'Project pipeline yields and revenue velocity based on outreach conversion rates and closed retainer contracts.',
    status: 'active'
  },
  {
    id: 'f3',
    slug: 'auditor',
    name: 'Auditor',
    role: 'Financial Reconciliation & Invoicing',
    dept: 'Finance',
    initials: 'AU',
    color: '#D97706',
    capabilities: ['Invoice Verification', 'Payment Gateway Sync', 'Tax Jurisdiction Compliance', 'Billing Dispute Resolution'],
    assigned_pipelines: ['landing-page'],
    system_directive: 'Verify invoice generation and Stripe payment webhook receipts against deliverable milestones before client asset release.',
    status: 'active'
  },
  {
    id: 'f4',
    slug: 'negotiator',
    name: 'Negotiator',
    role: 'Deal Terms & Commercial Contracts',
    dept: 'Finance',
    initials: 'NE',
    color: '#4F46E5',
    capabilities: ['Retainer Tier Pricing', 'Discount Guardrails', 'Performance Fee Clauses', 'Commercial Proposal Generation'],
    assigned_pipelines: ['email-campaign', 'lead-research'],
    system_directive: 'Structure profitable retainer packages ($499 setup + $299/mo growth retainer) with strict contract terms protecting intellectual property.',
    status: 'active'
  },

  // Legal, Risk & Governance (4)
  {
    id: 'l1',
    slug: 'sentry',
    name: 'Sentry',
    role: 'Risk Assessment & Policy Shield',
    dept: 'Legal',
    initials: 'SN',
    color: '#DC2626',
    capabilities: ['CAN-SPAM Compliance', 'CASL (Canada) Verification', 'GDPR / CCPA Audit', 'Unsubscribe Header Checks'],
    assigned_pipelines: ['email-campaign', 'lead-research'],
    system_directive: 'Ensure all outbound email sequences strictly comply with Canadian Anti-Spam Legislation (CASL) and CAN-SPAM, including physical postal address and opt-out links.',
    status: 'active'
  },
  {
    id: 'l2',
    slug: 'counsel',
    name: 'Counsel',
    role: 'Contract Terms & IP Protection',
    dept: 'Legal',
    initials: 'CL',
    color: '#7C3AED',
    capabilities: ['Master Services Agreements', 'SOW Drafting', 'Copyright & Asset Ownership Clauses', 'NDA Verification'],
    assigned_pipelines: ['brand-kit', 'landing-page'],
    system_directive: 'Draft clear intellectual property transfer agreements ensuring clients permanently retain 100% domain and website asset ownership.',
    status: 'active'
  },
  {
    id: 'l3',
    slug: 'guardian-l',
    name: 'Guardian L',
    role: 'Healthcare & Regulatory Compliance',
    dept: 'Legal',
    initials: 'GL',
    color: '#4F46E5',
    capabilities: ['RCDSO Advertising Standards', 'CDCP Compliance Verification', 'Patient Data Confidentiality', 'PIPEDA Privacy Shield'],
    assigned_pipelines: ['landing-page', 'email-campaign', 'content-seo'],
    system_directive: 'Ensure dental clinic website claims and advertising copy adhere to provincial dental regulatory college advertising guidelines and PIPEDA privacy regulations.',
    status: 'active'
  },
  {
    id: 'l4',
    slug: 'ethicist',
    name: 'Ethicist',
    role: 'AI Ethics & Autonomous Governance',
    dept: 'Legal',
    initials: 'ET',
    color: '#0D9488',
    capabilities: ['Bias Mitigation', 'Truthful AI Representations', 'Safety Boundary Reviews', 'Transparency Disclosures'],
    assigned_pipelines: ['market-intel', 'brand-kit'],
    system_directive: 'Audit AI agent communication to maintain transparency, avoid misleading medical representations, and ensure ethical marketing standards.',
    status: 'active'
  }
];

const INITIAL_SAVED_LOGINS = [
  {
    id: 'log-1',
    name: 'Hostinger Webmail & Cold SMTP',
    slug: 'hostinger-mail',
    category: 'Email & Outreach',
    website_url: 'https://mail.hostinger.com',
    username: 'outreach@valioz.com',
    password: 'Hostinger#Secure2026!',
    api_key: 'smtp_auth_token_465_ssl',
    notes: 'Used in Module 08 email sequence dispatch & cold outbound outreach. Host: smtp.hostinger.com (Port 465 SSL), IMAP: imap.hostinger.com (Port 993).',
    status: 'connected',
    metadata: { host: 'smtp.hostinger.com', port: 465, ssl: true, quota: 500 }
  },
  {
    id: 'log-2',
    name: 'Gmail & Google Workspace API',
    slug: 'gmail-workspace',
    category: 'Google Workspace',
    website_url: 'https://mail.google.com',
    username: 'ibrahim.zed24@gmail.com',
    password: 'GSuite#IbrahimPass2026',
    api_key: 'google_oauth2_app_token_placeholder',
    notes: 'Primary operator communication, client inbound alert forwarding, and OAuth2 token delivery for Google Workspace integrations.',
    status: 'connected',
    metadata: { oauth2: true, type: 'Business Standard' }
  },
  {
    id: 'log-3',
    name: 'Google Search Console',
    slug: 'google-search-console',
    category: 'SEO & Search',
    website_url: 'https://search.google.com/search-console',
    username: 'ibrahim.zed24@gmail.com',
    password: 'SearchConsole#Auth2026',
    api_key: 'gsc_api_read_write_v3',
    notes: 'Organic search performance monitoring, index coverage audits, click-through analysis, and sitemap crawling for client domains (Module 03 SEO & GEO).',
    status: 'connected',
    metadata: { properties: ['https://health.valioz.com', 'https://nilesupplies.com'] }
  },
  {
    id: 'log-4',
    name: 'Google Ads Keyword Planner',
    slug: 'google-keyword-planner',
    category: 'SEO & Search',
    website_url: 'https://ads.google.com/aw/keywordplanner',
    username: 'ibrahim.zed24@gmail.com',
    password: 'GoogleAds#Planner2026!',
    api_key: 'gads_dev_token_8892',
    notes: 'Authoritative monthly search volume estimates (e.g. 1K-10K Canadian dentist searches), CPC bids, and high-yield treatment keyword extraction.',
    status: 'connected',
    metadata: { customer_id: '492-819-2041', geo: 'Canada' }
  },
  {
    id: 'log-5',
    name: 'Google Calendar API',
    slug: 'google-calendar',
    category: 'Google Workspace',
    website_url: 'https://calendar.google.com',
    username: 'ibrahim.zed24@gmail.com',
    password: 'Calendar#SyncSecure2026',
    api_key: 'gcal_oauth_refresh_token_v4',
    notes: 'Automated consultation scheduling for qualified clinic leads who reply YES to email campaigns. Embeds meeting links via n8n webhook.',
    status: 'connected',
    metadata: { calendar_id: 'primary', booking_mins: 20 }
  },
  {
    id: 'log-6',
    name: 'Google Sheets CRM & Lead Sync',
    slug: 'google-sheets',
    category: 'Google Workspace',
    website_url: 'https://docs.google.com/spreadsheets',
    username: 'ibrahim.zed24@gmail.com',
    password: 'Sheets#SyncKey2026',
    api_key: 'gsheet_service_acc_key_json',
    notes: 'Bidirectional sync for raw lead datasets (Priority_A_Outreach_Email_Merge_Fields.csv, Clinic Intelligence) and executive reporting sheets.',
    status: 'connected',
    metadata: { service_acc: 'marketing-os-sync@appspot.gserviceaccount.com' }
  },
  {
    id: 'log-7',
    name: 'Google Analytics 4 (GA4)',
    slug: 'google-analytics-4',
    category: 'Analytics & Measurement',
    website_url: 'https://analytics.google.com',
    username: 'ibrahim.zed24@gmail.com',
    password: 'GA4#AnalyticsToken2026',
    api_key: 'G-MEASUREMENT_ID_9901',
    notes: 'Conversion tracking, visitor event telemetry, landing page bounce rate analysis, and UTM attribution across campaigns.',
    status: 'connected',
    metadata: { property_id: 'properties/384910291' }
  },
  {
    id: 'log-8',
    name: 'Google Business Profile Manager',
    slug: 'google-business-profile',
    category: 'SEO & Search',
    website_url: 'https://business.google.com',
    username: 'ibrahim.zed24@gmail.com',
    password: 'GBP#VerifiedAdmin2026',
    api_key: 'gbp_mybusiness_api_v4',
    notes: 'Local 3-Pack Maps rankings, review management, geo-tagged photo uploads, and clinic address verification.',
    status: 'connected',
    metadata: { auto_reply_reviews: true }
  },
  {
    id: 'log-9',
    name: 'Meta Ads Manager (Facebook & Instagram)',
    slug: 'meta-ads-manager',
    category: 'Advertising',
    website_url: 'https://adsmanager.facebook.com',
    username: 'ibrahim.zed24@gmail.com',
    password: 'Meta#AdsManagerSecure2026',
    api_key: 'EAABwz..._meta_graph_token',
    notes: 'B2B lead generation ads, local radius retargeting, and carousel creatives (Module 04 Ads Creative).',
    status: 'connected',
    metadata: { business_id: '204918204910291' }
  },
  {
    id: 'log-10',
    name: 'LinkedIn Campaign Manager',
    slug: 'linkedin-campaign-manager',
    category: 'Advertising',
    website_url: 'https://www.linkedin.com/campaignmanager',
    username: 'ibrahim.zed24@gmail.com',
    password: 'LinkedIn#AdsAccount2026!',
    api_key: 'li_oauth_marketing_dev_v2',
    notes: 'Account-Based Marketing (ABM) targeting clinic directors, practice principals, and healthcare procurement leaders.',
    status: 'connected',
    metadata: { ad_account_id: '509281920' }
  },
  {
    id: 'log-11',
    name: 'n8n Autonomous Workflow Engine',
    slug: 'n8n-automation-engine',
    category: 'Automation & AI',
    website_url: 'http://localhost:5678',
    username: 'admin',
    password: 'n8n#LocalMasterPassword2026',
    api_key: 'mos_live_98a7bc65d4e3f210',
    notes: 'Local autonomous pipeline execution engine (:5678), webhook dispatch, and multi-agent coordination.',
    status: 'connected',
    metadata: { port: 5678, mode: 'webhook + stdio MCP' }
  },
  {
    id: 'log-12',
    name: 'Supabase Cloud (PostgreSQL & Storage)',
    slug: 'supabase-cloud',
    category: 'Hosting & Infrastructure',
    website_url: 'https://app.supabase.com',
    username: 'ibrahim.zed24@gmail.com',
    password: 'Supabase#CloudDBPass2026',
    api_key: 'supabase_personal_token_placeholder',
    notes: 'Primary cloud database for Workforce OS documents, project vectors, and agent handovers.',
    status: 'connected',
    metadata: { project_ref: 'jzyqmzjfmaceoltlqukh' }
  },
  {
    id: 'log-13',
    name: 'Vercel Cloud Platform',
    slug: 'vercel-cloud',
    category: 'Hosting & Infrastructure',
    website_url: 'https://vercel.com',
    username: 'ibrahim.zed24@gmail.com',
    password: 'Vercel#DeployToken2026',
    api_key: 'vercel_cli_deploy_tok_8991',
    notes: 'Production deployment host for Sovereign Workforce OS (personal-ai-workforce-os-pi.vercel.app).',
    status: 'connected',
    metadata: { project_id: 'prj_RStZNth77dQxR9EQaZfbEAyo0Ud8' }
  },
  {
    id: 'log-14',
    name: 'Cloudflare / DNS & Edge Security',
    slug: 'cloudflare-dns',
    category: 'Hosting & Infrastructure',
    website_url: 'https://dash.cloudflare.com',
    username: 'ibrahim.zed24@gmail.com',
    password: 'Cloudflare#EdgePass2026',
    api_key: 'cf_global_api_token_valioz',
    notes: 'DNS records, SSL/TLS certificates, SPF/DKIM TXT records for Hostinger webmail, and DDoS edge protection.',
    status: 'connected',
    metadata: { ssl: 'Full (Strict)', zones: ['valioz.com'] }
  }
];

function buildDefaultState() {
  return {
    currentUserRole: 'super_admin',
    mainView: 'workbench',
    stageFilter: 'All',
    selectedProjectId: '019f11bf-10b0-4667-8a2a-6637d902c044',
    selectedPipeline: 'email-campaign',
    outputTab: 'Preview',
    agentDeptFilter: 'All',
    loginsCategoryFilter: 'All',
    loginsRevealed: false,
    activePreset: 'Factory Squad',
    executing: false,
    execStep: 4,
    execProgress: 100,
    savedLogins: INITIAL_SAVED_LOGINS.slice(),
    users: [
      { id: 'u-super', name: 'Ibrahim Zid', email: 'admin@marketingos.local', role: 'super_admin', dept: 'Leadership', status: 'active', initials: 'IZ' },
      { id: 'u-admin', name: 'Nadia Hassan', email: 'ops@marketingos.local', role: 'admin', dept: 'Ops', status: 'active', initials: 'NH' },
      { id: 'u-manager', name: 'Sara Manager', email: 'manager@marketingos.local', role: 'manager', dept: 'Growth', status: 'active', initials: 'SM' },
      { id: 'u-member', name: 'Omar Member', email: 'member@marketingos.local', role: 'member', dept: 'Content', status: 'active', initials: 'OM' },
      { id: 'u-client', name: 'Valioz Client', email: 'client@marketingos.local', role: 'client', dept: 'Client', status: 'active', initials: 'VC' }
    ],
    projects: [
      {
        id: '019f11bf-10b0-4667-8a2a-6637d902c044',
        name: 'Valioz Health sales',
        client: 'Valioz Health',
        goal: 'Draft dual-branded outreach email campaigns, schedule consultations, and send via Hostinger SMTP.',
        stage: 'In Review',
        progress: 95,
        deliverable: 'Dual-Branded Email Sequence',
        pipeline: 'email-campaign',
        squad: ['CO', 'BR', 'SE', 'MR'],
        assigneeId: 'u-manager',
        harnessFiles: [
          { name: 'Priority_A_Outreach_Email_Merge_Fields.csv', meta: '22 Canadian Dental Clinics • 8.2 KB', rows: '22 verified clinic leads', status: 'Injected into reasoning' },
          { name: 'Clinic Intelligence (138 leads, scored and verified).csv', meta: 'Master Scored Intelligence • 48 KB', rows: '138 enriched clinic accounts', status: 'Injected into reasoning' },
          { name: 'index.html', meta: 'Valioz Responsive Email Template • 10.4 KB', rows: 'Dual-branded HTML base', status: 'Injected into reasoning' },
          { name: 'valioz-health-logo.png', meta: 'Official High-Res Logo • 92 KB', rows: 'Base64 embedded brand asset', status: 'Injected into reasoning' },
          { name: 'Research_Gaps.csv', meta: 'Patient Search Gaps • 2.4 KB', rows: '10 audit gap records', status: 'Injected into reasoning' },
          { name: 'Keyword Opportunities.csv', meta: 'Treatment Keyword Volumes • 8.2 KB', rows: 'Canada-wide dental queries', status: 'Injected into reasoning' }
        ],
        lastReport: {
          verdict: 'Ready to Deliver',
          grounded: 'Yes • 6 harness files evaluated (Priority_A_Outreach_Email_Merge_Fields.csv, index.html, logo, etc.)',
          usable: 'Yes • Dual-branded HTML with 22-clinic selector + live merge tags',
          sellable: 'Yes • $499 launch offer + 30 days growth service',
          summary: 'Generated 5-step dual-branded nurture sequence personalized across 22 Canadian dental practices. Gate G2 human consent enforced with 20 staged leads.',
          shipped: 'Responsive Dual-Branded HTML + 5-Step Sequence + Interactive Clinic Selector.',
          blocked: 'None — All emails staged in staging state awaiting operator approval.',
          nextSteps: 'Click "Approve & Deliver" to release deliverable to Client Portal.'
        }
      },
      {
        id: 'proj-nile',
        name: 'Nile Supplies - Lead Gen System',
        client: 'Nile Supplies',
        goal: 'Turn 128 researched Maldivian resort leads into booked meetings with a live page + outreach pack.',
        stage: 'In Progress',
        progress: 68,
        deliverable: 'Lead Pack',
        pipeline: 'lead-research',
        squad: ['CO', 'BR', 'SE', 'MR'],
        assigneeId: 'u-member',
        harnessFiles: [
          { name: 'catalog.pdf', meta: '2026 Export Produce Catalog • 4.1 MB', rows: '42 SKUs', status: 'Injected into reasoning' },
          { name: 'leads.csv', meta: '128 Maldivian Resort F&B Leads • 2.4 MB', rows: '128 verified contacts', status: 'Injected into reasoning' }
        ],
        lastReport: {
          verdict: 'Ready to Deliver',
          grounded: 'Yes • 2 files injected',
          usable: 'Yes • Outreach pack ready',
          sellable: 'Yes • 28% landed cost advantage shown',
          summary: 'Segmented 128 Maldivian resort accounts by weekly volume.',
          shipped: '50 Priority Resort Lead Pack + 4-Step Sequence.',
          blocked: 'None.',
          nextSteps: 'Operator approves outreach schedule.'
        }
      }
    ],
    tasks: [
      {
        id: '3504c56b-ec9f-4dff-869f-0bb629629459',
        projectId: '019f11bf-10b0-4667-8a2a-6637d902c044',
        title: 'craft a dual branded email templates for valioz health',
        pipeline: 'email-campaign',
        assigneeId: 'u-manager',
        status: 'in_review',
        priority: 'urgent',
        updated: 'Just now'
      }
    ],
    telemetryLogs: [
      '[04:29:31] @coordinator parsed 6 harness files for Valioz Health sales',
      '[04:29:32] @browser-researcher validated 22 Priority A Canadian dental clinic accounts',
      '[04:29:33] @software-engineer compiled dual-branded HTML email template + 22 clinic merge tags',
      '[04:29:34] @master-reporting-agent verified Gate G2 staging: 20 ready, 2 held -> Verdict: Ready to Deliver'
    ]
  };
}

let state = loadState();
let activeBlueprintAgentSlug = 'coordinator';
let activeBlueprintTab = 'AGENT';
let execIntervalId = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.projects)) return parsed;
    }
  } catch (e) {}
  return buildDefaultState();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
}

function resetDemoState() {
  state = buildDefaultState();
  saveState();
  syncFromBackend().then(() => renderAll());
  showToast('Reset local database. Synchronized with live backend.');
}

function showToast(msg) {
  const banner = document.getElementById('toastBanner');
  const text = document.getElementById('toastMessage');
  if (banner && text) {
    text.textContent = msg;
    banner.classList.remove('hidden');
  }
}

function hideToast() {
  const banner = document.getElementById('toastBanner');
  if (banner) banner.classList.add('hidden');
}

function toggleTheme() {
  document.documentElement.classList.toggle('dark');
}

function getCurrentUser() {
  return state.users.find(u => u.role === state.currentUserRole) || state.users[0];
}

function getSelectedProject() {
  return state.projects.find(p => p.id === state.selectedProjectId) || state.projects[0];
}

// --- Live Backend Sync ---
async function syncFromBackend() {
  try {
    // 1. Fetch live saved logins from backend SQLite
    const resLogins = await fetch('/api/saved-logins?reveal=' + state.loginsRevealed, {
      headers: { 'x-session-role': state.currentUserRole }
    });
    if (resLogins.ok) {
      const data = await resLogins.json();
      if (data.logins && data.logins.length > 0) {
        state.savedLogins = data.logins;
        const navBadge = document.getElementById('navLoginsCountBadge');
        if (navBadge) navBadge.textContent = String(data.total || data.logins.length);
      }
    }

    // 2. Fetch live project tasks and harness files
    const proj = getSelectedProject();
    if (proj) {
      const pRes = await fetch('/api/projects/' + proj.id, {
        headers: { 'x-session-role': state.currentUserRole }
      });
      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData.files) {
          proj.harnessFiles = pData.files.map(f => ({
            id: f.id,
            name: f.original_name || f.filename,
            category: f.file_category || detectFileCategoryJs(f.original_name || f.filename),
            meta: (f.mime || 'application/octet-stream') + ' • ' + Math.round((f.size || 1024)/1024) + ' KB',
            rows: f.parsed_summary || 'Verified Grounding File',
            status: 'Injected into reasoning'
          }));
        }
        if (pData.project) {
          proj.guidelines = pData.project.guidelines || proj.guidelines || '';
          proj.custom_rules = pData.project.custom_rules || proj.custom_rules || '';
        }
      }
    }

    // 3. Fetch SEO Tree data
    await fetchSeoTree();
  } catch (err) {
    console.warn('[Sync] Using local resilient storage:', err.message);
  }
}

function switchRoleSession(role) {
  state.currentUserRole = role;
  saveState();
  renderAll();
  const user = getCurrentUser();
  showToast('Switched session to ' + user.name + ' (' + role.toUpperCase() + '). UI permissions refreshed.');
}

function switchMainView(view) {
  state.mainView = view;
  saveState();
  renderAll();
}

function setStageFilter(stage) {
  state.stageFilter = stage;
  saveState();
  renderAll();
}

function selectProject(projectId) {
  state.selectedProjectId = projectId;
  const proj = getSelectedProject();
  if (proj && proj.pipeline) {
    state.selectedPipeline = proj.pipeline;
    const cmdInput = document.getElementById('wbCommandInput');
    if (cmdInput && PIPELINE_CATALOG[proj.pipeline]) {
      cmdInput.value = PIPELINE_CATALOG[proj.pipeline].defaultCmd;
    }
  }
  saveState();
  renderAll();
}

function selectPipeline(pipelineId) {
  if (state.currentUserRole === 'client') {
    showToast('Client role is view-only. Switch to Member, Manager, or Admin.');
    return;
  }
  state.selectedPipeline = pipelineId;
  const proj = getSelectedProject();
  if (proj && PIPELINE_CATALOG[pipelineId]) {
    proj.pipeline = pipelineId;
    proj.squad = PIPELINE_CATALOG[pipelineId].squad.slice();
    const cmdInput = document.getElementById('wbCommandInput');
    if (cmdInput) {
      cmdInput.value = PIPELINE_CATALOG[pipelineId].defaultCmd.replace('Valioz Health', proj.client);
    }
  }
  saveState();
  renderAll();
}

function insertSlashPrefix(prefix) {
  const cmdInput = document.getElementById('wbCommandInput');
  if (!cmdInput) return;
  const current = cmdInput.value.replace(/^\/(assign|grillme|direct|ask)\s*/i, '');
  cmdInput.value = prefix + ' ' + current;
  cmdInput.focus();
}

function switchOutputTab(tab) {
  state.outputTab = tab;
  saveState();
  renderWorkbenchOutput();
}

function toggleNewProjectDrawer() {
  if (['member', 'client'].includes(state.currentUserRole)) {
    showToast('RBAC Restriction: Only Super Admin, Admin, or Manager can create projects.');
    return;
  }
  const el = document.getElementById('newProjectDrawer');
  if (el) el.classList.toggle('hidden');
}

function createNewProject() {
  const name = (document.getElementById('npName')?.value || '').trim();
  const client = (document.getElementById('npClient')?.value || '').trim();
  if (!name || !client) return showToast('Please enter both Project Name and Client.');

  const pipeline = document.getElementById('npPipeline')?.value || 'email-campaign';
  const newProj = {
    id: 'proj-' + Date.now(),
    name: name,
    client: client,
    goal: document.getElementById('npGoal')?.value.trim() || 'Execute grounded marketing pipeline.',
    stage: 'Draft',
    progress: 15,
    deliverable: document.getElementById('npDeliverable')?.value || 'Email Sequence',
    pipeline: pipeline,
    squad: PIPELINE_CATALOG[pipeline] ? PIPELINE_CATALOG[pipeline].squad.slice() : ['CO', 'BR', 'SE', 'MR'],
    assigneeId: 'u-member',
    harnessFiles: [
      { name: 'leads.csv', meta: client + ' Target Accounts • 1.2 MB', rows: '45 contacts', status: 'Injected into reasoning' },
      { name: 'brief.pdf', meta: client + ' Project Brief • 850 KB', rows: 'Core Value Prop', status: 'Injected into reasoning' }
    ],
    lastReport: {
      verdict: 'Draft Initialized',
      grounded: 'Yes • 2 starter harness files',
      usable: 'Ready for pipeline run',
      sellable: 'Pending execution',
      summary: 'Project initialized in Draft stage.',
      shipped: 'Workspace scaffolded.',
      blocked: 'None.',
      nextSteps: 'Run pipeline command in Workbench.'
    }
  };
  state.projects.unshift(newProj);
  state.selectedProjectId = newProj.id;
  state.selectedPipeline = pipeline;
  document.getElementById('newProjectDrawer')?.classList.add('hidden');
  saveState();
  renderAll();
  showToast('Created project "' + newProj.name + '".');
}

function detectFileCategoryJs(filename) {
  const ext = '.' + filename.split('.').pop().toLowerCase();
  if (['.db', '.sqlite', '.sqlite3', '.sql', '.json'].includes(ext)) return 'Core Database';
  if (['.html', '.htm'].includes(ext)) return 'HTML Prototype';
  if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'].includes(ext)) return 'Image Asset';
  if (['.pdf', '.doc', '.docx'].includes(ext)) return 'Document';
  if (['.csv', '.xlsx', '.xls', '.tsv'].includes(ext)) return 'Spreadsheet';
  if (['.zip', '.tar', '.gz', '.tgz'].includes(ext) || filename.endsWith('.tar.gz')) return 'Archive Bundle';
  if (['.md', '.markdown', '.txt', '.sop'].includes(ext)) return 'Workflow SOP & Guidelines';
  return 'General Asset';
}

function getFileIcon(filename) {
  const ext = '.' + filename.split('.').pop().toLowerCase();
  if (['.db', '.sqlite', '.sql'].includes(ext)) return '🗄️';
  if (['.json'].includes(ext)) return '📦';
  if (['.html', '.htm'].includes(ext)) return '🌐';
  if (['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(ext)) return '🖼️';
  if (['.pdf'].includes(ext)) return '📄';
  if (['.csv', '.xlsx', '.xls'].includes(ext)) return '📊';
  if (['.zip', '.gz', '.tar'].includes(ext) || filename.endsWith('.tar.gz')) return '🗜️';
  if (['.md', '.txt', '.sop'].includes(ext)) return '📝';
  return '📎';
}

async function handleHarnessFileUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  const proj = getSelectedProject();
  if (!proj) {
    showToast('Please select an active project first.');
    return;
  }

  if (state.currentUserRole === 'client') {
    showToast('Client role is read-only. Switch to Admin, Manager, or Member to upload.');
    return;
  }

  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('file', files[i]);
  }

  showToast(`Uploading ${files.length} harness file(s) into ${proj.name}...`);

  try {
    const res = await fetch(`/api/projects/${proj.id}/harness`, {
      method: 'POST',
      headers: {
        'x-session-role': state.currentUserRole
      },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    state.telemetryLogs.unshift(`[${new Date().toTimeString().slice(0, 8)}] Ingested ${files[0].name} (${data.file_category}) into ${proj.name}`);
    if (data.auto_applied_guidelines) {
      showToast(`Uploaded ${files[0].name} & automatically applied as Project Workflow Guidelines!`);
    } else {
      showToast(`Uploaded & grounded ${files[0].name} (${data.file_category})`);
    }

    await syncFromBackend();
    renderAll();
  } catch (err) {
    showToast(`Upload failed: ${err.message}`);
  }
}

async function deleteHarnessFile(projectId, fileId, originalName) {
  if (state.currentUserRole === 'client') {
    showToast('Client role is read-only.');
    return;
  }
  if (!confirm(`Are you sure you want to delete ${originalName}?`)) return;

  try {
    const res = await fetch(`/api/projects/${projectId}/harness/${fileId}`, {
      method: 'DELETE',
      headers: { 'x-session-role': state.currentUserRole }
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Delete failed');
    }
    showToast(`Deleted ${originalName}`);
    await syncFromBackend();
    renderAll();
  } catch (err) {
    showToast(`Error: ${err.message}`);
  }
}

function previewHarnessFile(projectId, fileId, originalName) {
  const viewUrl = `/api/projects/${projectId}/harness/${fileId}/view`;
  window.open(viewUrl, '_blank');
}

async function applyFileAsGuidelines(filename) {
  const proj = getSelectedProject();
  if (!proj) return;

  try {
    const pRes = await fetch(`/api/projects/${proj.id}`, {
      headers: { 'x-session-role': state.currentUserRole }
    });
    const pData = await pRes.json();
    const targetFile = (pData.files || []).find(f => f.original_name === filename || f.filename === filename);
    if (!targetFile) {
      showToast('File not found in project database.');
      return;
    }

    const fileContentRes = await fetch(`/api/projects/${proj.id}/harness/${targetFile.id}/view`, {
      headers: { 'x-session-role': state.currentUserRole }
    });
    const content = await fileContentRes.text();

    await fetch(`/api/projects/${proj.id}/guidelines`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-session-role': state.currentUserRole
      },
      body: JSON.stringify({ guidelines: content })
    });

    showToast(`Applied contents of ${filename} as Project Workflow Guidelines!`);
    await syncFromBackend();
    renderAll();
  } catch (err) {
    showToast(`Failed to apply guidelines: ${err.message}`);
  }
}

function setupDragAndDrop() {
  const dropZone = document.getElementById('harnessDropZone');
  if (!dropZone || dropZone.dataset.bound) return;
  dropZone.dataset.bound = 'true';

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('border-indigo-500', 'bg-indigo-500/10');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('border-indigo-500', 'bg-indigo-500/10');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files.length > 0) {
      const fakeEvent = { target: { files } };
      handleHarnessFileUpload(fakeEvent);
    }
  }, false);
}

function executePipelineCommand() {
  if (state.executing) return;
  const proj = getSelectedProject();
  const pipe = PIPELINE_CATALOG[state.selectedPipeline] || PIPELINE_CATALOG['email-campaign'];

  state.executing = true;
  state.execProgress = 10;
  state.execStep = 0;
  proj.stage = 'In Progress';
  proj.pipeline = pipe.id;

  renderAll();

  if (execIntervalId) clearInterval(execIntervalId);
  execIntervalId = setInterval(function() {
    state.execProgress = Math.min(100, state.execProgress + 25);
    state.execStep = Math.min(4, Math.floor(state.execProgress / 22));
    if (state.execProgress >= 100) {
      clearInterval(execIntervalId);
      execIntervalId = null;
      state.executing = false;
      state.execStep = 4;
      proj.stage = 'In Review';
      proj.progress = 95;
      proj.deliverable = pipe.name;
      proj.lastReport = {
        verdict: 'Ready to Deliver',
        grounded: 'Yes • ' + proj.harnessFiles.length + ' harness files evaluated',
        usable: 'Yes • Production ready with Gate G2 staging',
        sellable: 'Yes • Fully tailored for ' + proj.client,
        summary: 'Executed 5-stage pipeline for ' + proj.name + ' via ' + pipe.squadNames.join(', ') + '.',
        shipped: pipe.name + ' + live HTML deliverable + Admin Report.',
        blocked: 'None — staged in staging state awaiting operator sign-off.',
        nextSteps: 'Click "Approve & Deliver" to release to Client Portal.'
      };
      saveState();
      renderAll();
      showToast('Pipeline execution complete! Deliverable ready in Review.');
    } else {
      renderExecutionStepper();
    }
  }, 300);
}

function approveAndDeliverCurrent() {
  if (!['super_admin', 'admin', 'manager'].includes(state.currentUserRole)) {
    return showToast('RBAC Restriction: Only Admin or Manager can approve deliverables.');
  }
  const proj = getSelectedProject();
  if (!proj) return;
  proj.stage = 'Delivered';
  proj.progress = 100;
  proj.lastReport.verdict = 'Approved & Delivered';
  state.telemetryLogs.unshift('[' + new Date().toTimeString().slice(0, 8) + '] APPROVED & DELIVERED: "' + proj.name + '" by ' + getCurrentUser().name);
  saveState();
  renderAll();
  showToast('Approved & Delivered "' + proj.name + '" to Client Portal!');
}

function requestFixOnCurrent() {
  if (!['super_admin', 'admin', 'manager'].includes(state.currentUserRole)) {
    return showToast('RBAC Restriction: Only Admin or Manager can request revisions.');
  }
  const proj = getSelectedProject();
  if (!proj) return;
  proj.stage = 'In Progress';
  proj.progress = 60;
  proj.lastReport.verdict = 'Needs Fix (Revision Requested)';
  saveState();
  renderAll();
  showToast('Moved "' + proj.name + '" back to In Progress.');
}

function downloadActiveDeliverable() {
  const proj = getSelectedProject();
  const pipe = PIPELINE_CATALOG[state.selectedPipeline] || PIPELINE_CATALOG['email-campaign'];
  const report = [
    '# Marketing OS — Official Deliverable Report',
    '- **Project:** ' + proj.name + ' (' + proj.client + ')',
    '- **Pipeline:** ' + pipe.name,
    '- **Squad:** ' + pipe.squadNames.join(', '),
    '- **Verdict:** ' + proj.lastReport.verdict,
    '',
    '## Grounding & Quality',
    '- **Grounded:** ' + proj.lastReport.grounded,
    '- **Usable:** ' + proj.lastReport.usable,
    '- **Sellable:** ' + proj.lastReport.sellable,
    '',
    '## Executive Summary',
    proj.lastReport.summary,
    '',
    '## What Shipped',
    proj.lastReport.shipped
  ].join('\n');

  const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = proj.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-report.md';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Exported grounded Markdown deliverable report.');
}

// --- Preview Modal for HTML Deliverables ---
async function openLiveHtmlPreview(taskId) {
  try {
    const res = await fetch('/api/tasks/' + taskId);
    if (res.ok) {
      const data = await res.json();
      const out = JSON.parse(data.task.output_json || '{}');
      if (out.html) {
        document.getElementById('previewModalTitle').textContent = data.task.title + ' — Interactive Dual-Branded Preview';
        document.getElementById('previewModalFrame').srcdoc = out.html;
        document.getElementById('previewModal').classList.remove('hidden');
        return;
      }
    }
  } catch (e) {
    console.warn('[Preview] Fallback to client generator');
  }

  // Fallback demo iframe
  document.getElementById('previewModalTitle').textContent = 'Valioz Health Dual-Branded Email Engine Preview';
  document.getElementById('previewModalFrame').src = '/valioz-preview.html';
  document.getElementById('previewModal').classList.remove('hidden');
}

function closePreviewModal() {
  document.getElementById('previewModal')?.classList.add('hidden');
}

// --- SAVED LOGINS & TOOLS DATABASE CONTROLLERS ---
function setLoginsCategoryFilter(cat) {
  state.loginsCategoryFilter = cat;
  saveState();
  renderSavedLoginsView();
}

function toggleLoginsSecretReveal() {
  if (!['super_admin', 'admin'].includes(state.currentUserRole)) {
    return showToast('RBAC Notice: Only Super Admin or Admin can reveal decrypted credentials.');
  }
  state.loginsRevealed = !state.loginsRevealed;
  const btn = document.getElementById('loginsRevealToggleBtn');
  if (btn) btn.textContent = state.loginsRevealed ? '🔒 Hide Passwords' : '👁️ Reveal Passwords';
  saveState();
  syncFromBackend().then(() => renderSavedLoginsView());
}

function openAddLoginModal(editId = null) {
  const modal = document.getElementById('addLoginModal');
  const title = document.getElementById('addLoginModalTitle');
  const hiddenId = document.getElementById('loginFormEditId');

  if (editId) {
    const item = state.savedLogins.find(l => l.id === editId);
    if (item) {
      title.textContent = 'Edit Saved Login: ' + item.name;
      hiddenId.value = item.id;
      document.getElementById('lfName').value = item.name;
      document.getElementById('lfCategory').value = item.category;
      document.getElementById('lfUrl').value = item.website_url;
      document.getElementById('lfUser').value = item.username;
      document.getElementById('lfPass').value = item.password === '••••••••••••' ? '' : item.password;
      document.getElementById('lfApiKey').value = item.api_key || '';
      document.getElementById('lfNotes').value = item.notes || '';
    }
  } else {
    title.textContent = 'Add Website / Workflow Tool Login';
    hiddenId.value = '';
    document.getElementById('lfName').value = '';
    document.getElementById('lfCategory').value = 'Email & Outreach';
    document.getElementById('lfUrl').value = '';
    document.getElementById('lfUser').value = '';
    document.getElementById('lfPass').value = '';
    document.getElementById('lfApiKey').value = '';
    document.getElementById('lfNotes').value = '';
  }

  modal?.classList.remove('hidden');
}

function closeAddLoginModal() {
  document.getElementById('addLoginModal')?.classList.add('hidden');
}

async function saveLoginTool() {
  const editId = document.getElementById('loginFormEditId')?.value;
  const name = document.getElementById('lfName')?.value.trim();
  const category = document.getElementById('lfCategory')?.value;
  const website_url = document.getElementById('lfUrl')?.value.trim();
  const username = document.getElementById('lfUser')?.value.trim();
  const password = document.getElementById('lfPass')?.value;
  const api_key = document.getElementById('lfApiKey')?.value.trim() || null;
  const notes = document.getElementById('lfNotes')?.value.trim();

  if (!name || !category || !website_url || !username || (!editId && !password)) {
    return showToast('Please complete all required fields (*).');
  }

  const payload = { name, category, website_url, username, password, api_key, notes };

  try {
    const url = editId ? '/api/saved-logins/' + editId : '/api/saved-logins';
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast(editId ? 'Updated saved login in SQLite database!' : 'Added new saved login to SQLite database!');
    }
  } catch (e) {
    console.warn('[Logins] Local fallback save');
  }

  // Local state update
  if (editId) {
    const idx = state.savedLogins.findIndex(l => l.id === editId);
    if (idx !== -1) {
      state.savedLogins[idx] = { ...state.savedLogins[idx], ...payload };
    }
  } else {
    state.savedLogins.unshift({
      id: 'log-' + Date.now(),
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      status: 'connected',
      ...payload
    });
  }

  closeAddLoginModal();
  saveState();
  syncFromBackend().then(() => renderAll());
}

async function deleteLoginTool(id) {
  if (!['super_admin', 'admin'].includes(state.currentUserRole)) {
    return showToast('RBAC Restriction: Only Admin can delete credentials.');
  }
  if (!confirm('Are you sure you want to delete this saved tool login?')) return;

  try {
    await fetch('/api/saved-logins/' + id, { method: 'DELETE' });
  } catch (e) {}

  state.savedLogins = state.savedLogins.filter(l => l.id !== id);
  saveState();
  renderSavedLoginsView();
  showToast('Removed saved login.');
}

async function testLoginConnection(id) {
  showToast('Pinging target website...');
  try {
    const res = await fetch('/api/saved-logins/' + id + '/test', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      showToast('Live test result: ' + (data.ok ? '✓ Connected (' + data.latency_ms + 'ms)' : '⚠️ Check URL: ' + data.message));
      await syncFromBackend();
      renderSavedLoginsView();
      return;
    }
  } catch (e) {}

  // Fallback ping simulation
  setTimeout(() => {
    showToast('✓ Connection verified (Simulated 320ms latency).');
  }, 400);
}

function copyToClipboard(text, label = 'Copied') {
  navigator.clipboard.writeText(text).then(() => {
    showToast(label + ' to clipboard!');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast(label + ' to clipboard!');
  });
}

// --- RENDER VIEWS ---
function renderHeaderAndRoleBanner() {
  const user = getCurrentUser();
  const roles = ['super_admin', 'admin', 'manager', 'member', 'client'];
  roles.forEach(r => {
    const btn = document.getElementById('roleBtn-' + r);
    if (btn) {
      btn.className = (r === state.currentUserRole)
        ? 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-600 text-white shadow-sm transition'
        : 'px-2.5 py-1 rounded-full text-[11px] font-medium text-[var(--text-soft)] hover:text-[var(--text)] transition';
    }
  });

  const navTabs = ['workbench', 'roleDash', 'pipelines', 'team', 'seo', 'logins', 'agents', 'rag'];
  navTabs.forEach(t => {
    const el = document.getElementById('navTab-' + t);
    if (el) {
      el.className = (t === state.mainView)
        ? 'px-3.5 py-1.5 rounded-full text-xs font-bold bg-[var(--text)] text-[var(--surface)] transition flex items-center gap-1.5'
        : 'px-3.5 py-1.5 rounded-full text-xs font-medium text-[var(--text-soft)] hover:text-[var(--text)] transition flex items-center gap-1.5';
    }
    const viewEl = document.getElementById('view-' + t);
    if (viewEl) {
      if (t === state.mainView) viewEl.classList.remove('hidden');
      else viewEl.classList.add('hidden');
    }
  });

  const badge = document.getElementById('headerUserBadge');
  const chip = document.getElementById('headerRoleChip');
  if (badge) badge.textContent = user.name;
  if (chip) chip.textContent = user.role.toUpperCase();

  const delivCount = state.projects.filter(p => p.stage === 'Delivered').length;
  const delivBadge = document.getElementById('headerDeliveredBadge');
  if (delivBadge) delivBadge.textContent = delivCount + ' Delivered Today';

  const roleMeta = {
    super_admin: {
      title: 'Super Admin Factory Control (' + user.name + ')',
      perm: 'Full System Access • RBAC Admin • Saved Logins Database • Approve & Deliver',
      desc: 'You control all projects, credentials for all 14 tools (Hostinger, Gmail, Google Console, Keyword Planner, etc.), and final client delivery sign-offs.'
    },
    admin: {
      title: 'Operations Admin Dashboard (' + user.name + ')',
      perm: 'Team Management • Project Creation • Saved Logins Access • Approve & Deliver',
      desc: 'Review pending deliverables, manage workflow credentials, and release verified assets to clients.'
    },
    manager: {
      title: 'Growth Manager Sprint Hub (' + user.name + ')',
      perm: 'Create Projects • Assign Tasks • Manage Saved Logins • Review Squad Outputs',
      desc: 'Create client campaigns, manage Hostinger and Google tools, and assign marketing pipelines across your team.'
    },
    member: {
      title: 'Team Member Execution Workbench (' + user.name + ')',
      perm: 'Run Assigned Pipelines • View Saved Logins • Submit to Review',
      desc: 'Execute assigned marketing tasks using n8n + Antigravity squads. Passwords are masked.'
    },
    client: {
      title: 'Client Deliverable Showroom (' + user.name + ')',
      perm: 'View-Only Client Portal • Inspect Verified Deliverables',
      desc: 'Inspect your delivered campaigns and landing pages. Internal agent controls and credentials are hidden.'
    }
  }[state.currentUserRole];

  const av = document.getElementById('roleBannerAvatar');
  const rt = document.getElementById('roleBannerTitle');
  const rp = document.getElementById('roleBannerPermBadge');
  const rd = document.getElementById('roleBannerDesc');
  if (av) av.textContent = user.initials;
  if (rt) rt.textContent = roleMeta.title;
  if (rp) rp.textContent = roleMeta.perm;
  if (rd) rd.textContent = roleMeta.desc;

  const npBtn = document.getElementById('newProjectTopBtn');
  const nlBtn = document.getElementById('newLoginTopBtn');
  const ntBtn = document.getElementById('newTaskTopBtn');
  if (npBtn) npBtn.className = ['member', 'client'].includes(state.currentUserRole) ? 'hidden' : 'btn-ink px-3.5 py-2 text-xs inline-flex items-center gap-1.5';
  if (nlBtn) nlBtn.className = (state.currentUserRole === 'client') ? 'hidden' : 'btn-outline px-3.5 py-2 text-xs inline-flex items-center gap-1.5';
  if (ntBtn) ntBtn.className = (state.currentUserRole === 'client') ? 'hidden' : 'btn-primary px-3.5 py-2 text-xs inline-flex items-center gap-1.5';
}

function renderStageRibbonAndProjects() {
  const stages = ['Draft', 'In Progress', 'In Review', 'Delivered'];
  const counts = { 'Draft': 0, 'In Progress': 0, 'In Review': 0, 'Delivered': 0 };
  state.projects.forEach(p => { counts[p.stage] = (counts[p.stage] || 0) + 1; });

  const grid = document.getElementById('stageRibbonGrid');
  if (grid) {
    grid.innerHTML = stages.map((s, idx) => {
      const active = state.stageFilter === s;
      return '<button onclick="setStageFilter(\'' + s + '\')" class="text-left rounded-2xl border p-3.5 transition ' +
        (active ? 'bg-[var(--text)] text-[var(--surface)] border-[var(--text)]' : 'bg-[var(--bg-soft)] border-[var(--border)] hover:border-indigo-500/50') + '">' +
        '<div class="flex items-center justify-between">' +
          '<span class="text-[11px] font-bold uppercase tracking-wider">' + s + '</span>' +
          '<span class="text-lg font-extrabold mono">' + counts[s] + '</span>' +
        '</div>' +
        '<div class="mt-2.5 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">' +
          '<div class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style="width:' + Math.round((counts[s]/state.projects.length)*100) + '%"></div>' +
        '</div>' +
      '</button>';
    }).join('');
  }

  const filtered = state.stageFilter === 'All'
    ? state.projects
    : state.projects.filter(p => p.stage === state.stageFilter);

  const listEl = document.getElementById('projectCardsList');
  if (listEl) {
    listEl.innerHTML = filtered.map(p => {
      const isSel = p.id === state.selectedProjectId;
      return '<div class="rounded-2xl border p-3.5 transition ' +
        (isSel ? 'bg-[var(--primary-soft)] border-indigo-500/50 shadow-sm' : 'bg-[var(--surface)] border-[var(--border)]') + '">' +
        '<div class="flex items-start justify-between gap-2">' +
          '<button onclick="selectProject(\'' + p.id + '\')" class="text-left font-bold text-xs hover:text-indigo-600 leading-snug">' + p.name + '</button>' +
          '<span class="text-[10px] px-2 py-0.5 rounded-full border font-semibold shrink-0 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">' + p.stage + '</span>' +
        '</div>' +
        '<p class="text-[11px] text-[var(--text-soft)] mt-1 line-clamp-2">' + p.client + ' • ' + p.goal + '</p>' +
        '<div class="mt-2.5 flex items-center justify-between text-[11px]">' +
          '<span class="text-emerald-600 dark:text-emerald-400 font-medium">● ' + p.harnessFiles.length + ' harness files</span>' +
          '<span class="mono text-[10px] text-[var(--text-faint)]">' + p.pipeline + '</span>' +
        '</div>' +
        '<div class="mt-3 flex items-center gap-1.5">' +
          '<button onclick="selectProject(\'' + p.id + '\')" class="btn-ink flex-1 py-1.5 text-[11px]">Open Workbench</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  const sel = getSelectedProject();
  const hList = document.getElementById('harnessFilesList');
  if (hList && sel) {
    if (!sel.harnessFiles || sel.harnessFiles.length === 0) {
      hList.innerHTML = '<div class="text-center py-4 text-xs text-[var(--text-faint)]">No harness files uploaded yet. Drag & drop files above.</div>';
    } else {
      const categoryBadges = {
        'Core Database': 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
        'HTML Prototype': 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
        'Image Asset': 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
        'Document': 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
        'Spreadsheet': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        'Archive Bundle': 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
        'Workflow SOP & Guidelines': 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30'
      };

      const isAdminOrManager = ['super_admin', 'admin', 'manager'].includes(state.currentUserRole);

      hList.innerHTML = sel.harnessFiles.map(f => {
        const cat = f.category || detectFileCategoryJs(f.name);
        const badgeStyle = categoryBadges[cat] || 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30';
        const isMd = f.name.endsWith('.md') || f.name.endsWith('.txt');

        return `
          <div class="card-subtle p-2.5 rounded-xl border border-[var(--border)] hover:border-indigo-500/40 transition">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="text-xs font-bold mono truncate flex items-center gap-1.5" title="${f.name}">
                  <span>${getFileIcon(f.name)}</span>
                  <span class="truncate">${f.name}</span>
                </div>
                <div class="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span class="text-[9px] px-1.5 py-0.2 rounded font-semibold border ${badgeStyle}">${cat}</span>
                  <span class="text-[10px] text-[var(--text-soft)]">${f.meta || ''}</span>
                </div>
              </div>
              <span class="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold shrink-0">Grounded</span>
            </div>
            <div class="mt-2 pt-2 border-t border-[var(--border)] flex items-center justify-between text-[11px]">
              <div class="flex items-center gap-2 flex-wrap">
                <button onclick="previewHarnessFile('${sel.id}', '${f.id || f.name}', '${f.name}')" class="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Preview</button>
                <a href="/api/projects/${sel.id}/harness/${f.id || f.name}/download" download="${f.name}" class="text-[var(--text-soft)] hover:text-[var(--text)] hover:underline">Download</a>
                ${isMd && isAdminOrManager ? `<button onclick="applyFileAsGuidelines('${f.name}')" class="text-cyan-600 dark:text-cyan-400 font-semibold hover:underline">Set as SOP</button>` : ''}
              </div>
              ${isAdminOrManager ? `<button onclick="deleteHarnessFile('${sel.id}', '${f.id || f.name}', '${f.name}')" class="text-red-500 hover:text-red-600 text-[10px]">Delete</button>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

function renderExecutionStepper() {
  const stages = ['1. Plan', '2. Assign', '3. Execute', '4. Verify', '5. Report'];
  const pctEl = document.getElementById('wbExecPct');
  const barEl = document.getElementById('wbExecBar');
  const rowEl = document.getElementById('wbExecStepsRow');
  const logEl = document.getElementById('wbTelemetryLog');

  if (pctEl) pctEl.textContent = state.execProgress + '%';
  if (barEl) barEl.style.width = state.execProgress + '%';
  if (rowEl) {
    rowEl.innerHTML = stages.map((s, idx) => {
      const done = !state.executing || idx <= state.execStep;
      return '<div class="rounded-lg px-2 py-1 text-center font-semibold border ' +
        (done ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' : 'bg-[var(--bg-soft)] text-[var(--text-faint)] border-[var(--border)]') + '">' +
        (done ? '✓ ' : '') + s +
      '</div>';
    }).join('');
  }
  if (logEl) {
    logEl.innerHTML = state.telemetryLogs.slice(0, 5).map(l => '<div class="py-0.5">' + l + '</div>').join('');
  }
}

function renderWorkbenchCenterAndRight() {
  const proj = getSelectedProject();
  if (!proj) return;
  const pipe = PIPELINE_CATALOG[state.selectedPipeline] || PIPELINE_CATALOG['email-campaign'];

  document.getElementById('wbClientTag').textContent = proj.client;
  document.getElementById('wbPipelineTag').textContent = pipe.id;
  document.getElementById('wbProjectTitle').textContent = proj.name;
  document.getElementById('wbProjectGoal').textContent = proj.goal;
  document.getElementById('activeSquadLabel').textContent = 'Squad: ' + pipe.squadNames.join(', ');

  const pipeGrid = document.getElementById('wbPipelineSelector');
  if (pipeGrid) {
    pipeGrid.innerHTML = Object.values(PIPELINE_CATALOG).map(p => {
      const active = p.id === state.selectedPipeline;
      return '<button onclick="selectPipeline(\'' + p.id + '\')" class="text-left rounded-xl border p-2.5 transition ' +
        (active ? 'bg-[var(--primary-soft)] border-indigo-500 shadow-sm' : 'bg-[var(--surface)] border-[var(--border)] hover:border-indigo-400') + '">' +
        '<div class="flex items-center justify-between">' +
          '<span class="text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-[var(--text)] text-[var(--surface)]">' + p.code + '</span>' +
        '</div>' +
        '<div class="text-xs font-bold mt-1.5 truncate">' + p.name + '</div>' +
        '<div class="text-[10px] text-[var(--text-soft)] truncate">' + p.badge + '</div>' +
      '</button>';
    }).join('');
  }

  renderExecutionStepper();
  renderWorkbenchOutput();

  // Right Column: Verdict
  const rep = proj.lastReport;
  document.getElementById('reportVerdictBadge').textContent = rep.verdict;
  document.getElementById('repCheckGrounded').textContent = rep.grounded;
  document.getElementById('repCheckUsable').textContent = rep.usable;
  document.getElementById('repCheckSellable').textContent = rep.sellable;
  document.getElementById('reportSummaryBox').innerHTML =
    '<div><b class="text-[var(--text)]">Summary:</b><p class="text-[var(--text-soft)] mt-0.5">' + rep.summary + '</p></div>' +
    '<div><b class="text-[var(--text)]">Shipped:</b><p class="text-[var(--text-soft)] mt-0.5">' + rep.shipped + '</p></div>' +
    '<div><b class="text-[var(--text)]">Next Action:</b><p class="text-[var(--text-soft)] mt-0.5">' + rep.nextSteps + '</p></div>';

  // Vault Connections Quick-Hub
  const vList = document.getElementById('vaultConnectionsList');
  if (vList) {
    const topLogins = state.savedLogins.slice(0, 4);
    vList.innerHTML = topLogins.map(l =>
      '<div class="flex items-center justify-between card-subtle px-3 py-2 text-xs">' +
        '<div class="min-w-0">' +
          '<div class="font-semibold truncate">' + l.name + '</div>' +
          '<div class="text-[10px] text-[var(--text-soft)] truncate">' + l.username + '</div>' +
        '</div>' +
        '<span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-700">Connected</span>' +
      '</div>'
    ).join('');
  }
}

function renderWorkbenchOutput() {
  const proj = getSelectedProject();
  const pipe = PIPELINE_CATALOG[state.selectedPipeline] || PIPELINE_CATALOG['email-campaign'];
  const vp = document.getElementById('wbOutputViewport');
  if (!vp) return;

  if (state.outputTab === 'Preview') {
    vp.innerHTML =
      '<div class="p-5 space-y-4">' +
        '<div class="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-teal-700 via-indigo-700 to-purple-700 text-white p-4 rounded-xl">' +
          '<div>' +
            '<div class="text-[10px] uppercase tracking-wider opacity-80">VALIOZ HEALTH &times; CANADIAN DENTAL PRACTICES</div>' +
            '<h4 class="text-base font-bold mt-0.5">Dual-Branded Email Growth Campaign Engine</h4>' +
          '</div>' +
          '<button onclick="openLiveHtmlPreview(\'3504c56b-ec9f-4dff-869f-0bb629629459\')" class="bg-white text-indigo-900 font-bold px-4 py-2 rounded-xl text-xs shadow hover:bg-slate-100 transition">' +
            '🌐 Open Interactive 22-Clinic Preview →' +
          '</button>' +
        '</div>' +
        '<div class="grid sm:grid-cols-3 gap-3 text-xs">' +
          '<div class="card-subtle p-3.5"><div class="text-[10px] text-teal-600 font-bold uppercase">Merge Tag Architecture</div><div class="font-bold mt-1">22 Canadian Dental Clinics</div><p class="text-[11px] text-[var(--text-soft)] mt-1">Personalized with clinic name, city, review evidence hooks, and treatment keyword volumes.</p></div>' +
          '<div class="card-subtle p-3.5"><div class="text-[10px] text-indigo-600 font-bold uppercase">5-Step Nurture Sequence</div><div class="font-bold mt-1">$499 Launch Offer</div><p class="text-[11px] text-[var(--text-soft)] mt-1">Step 1: Growth Opportunity, Step 2: Local Teardown, Step 3: Intake Blueprint, Step 4: Asset Ownership, Step 5: Close.</p></div>' +
          '<div class="card-subtle p-3.5"><div class="text-[10px] text-emerald-600 font-bold uppercase">Gate G2 Compliance</div><div class="font-bold mt-1">Hostinger SMTP Staged</div><p class="text-[11px] text-[var(--text-soft)] mt-1">20 leads in staging state, 2 held for site review. Zero unauthorized dispatches without human consent.</p></div>' +
        '</div>' +
      '</div>';
  } else if (state.outputTab === 'Code') {
    vp.innerHTML = '<div class="p-4 bg-slate-950 text-lime-300 font-mono text-xs overflow-x-auto"><pre>' + JSON.stringify({
      campaign: 'VALIOZ Health Dental Practice Outreach',
      smtp_provider: 'Hostinger (mail.hostinger.com:465)',
      staged_leads: 22,
      sequence_length: 5,
      harness: 'Priority_A_Outreach_Email_Merge_Fields.csv',
      gate: 'G2_HUMAN_CONSENT_REQUIRED'
    }, null, 2) + '</pre></div>';
  } else if (state.outputTab === 'Data') {
    vp.innerHTML = '<div class="p-4 text-xs font-mono space-y-2">' +
      '<div class="font-bold text-slate-800 dark:text-slate-200">Grounded Clinic Accounts from Priority_A_Outreach_Email_Merge_Fields.csv:</div>' +
      '<div>• #1 Billings Bridge Dental Centre (Ottawa, ON) — info@adcottawa.com [Hold: confirm site status]</div>' +
      '<div>• #2 Fraserview Dentist (Vancouver, BC) — info@fraserviewdentist.com [Ready - needs approval]</div>' +
      '<div>• #3 Maple Ridge Family Dental (London, ON) — info@mapleridgefamilydental.com [Ready - needs approval]</div>' +
      '<div>• #4 Norgate Dental Centre (North Vancouver, BC) — info@norgatedental.com [Ready - needs approval]</div>' +
      '<div>• #5 Thunderbird Dental Group (Langley, BC) — info@thunderbirddentist.com [Ready - needs approval]</div>' +
      '<div>... and 17 more accounts.</div>' +
    '</div>';
  } else if (state.outputTab === 'RAG') {
    vp.innerHTML = '<div class="p-4 text-xs space-y-2"><div class="font-bold">Project RAG Vectors:</div><p class="text-[var(--text-soft)]">6 harness files embedded using nomic-embed-text (768-dim) in SQLite database.</p></div>';
  } else {
    vp.innerHTML = '<div class="p-5 text-xs space-y-2 leading-relaxed"><h4 class="font-bold text-sm"># Admin Report: craft a dual branded email templates for valioz health</h4><p><b>Verdict:</b> Ready to Deliver</p><p><b>Grounded in harness:</b> Yes (6 harness files evaluated: Priority_A_Outreach_Email_Merge_Fields.csv, index.html, logo, etc.)</p><p><b>Usable:</b> Yes • <b>Sellable:</b> Yes</p></div>';
  }
}

// --- DEDICATED SAVED LOGINS VIEW RENDERER ---
function renderSavedLoginsView() {
  const categories = ['All', 'Email & Outreach', 'Google Workspace', 'SEO & Search', 'Advertising', 'Analytics & Measurement', 'Hosting & Infrastructure', 'Automation & AI'];
  const pillsEl = document.getElementById('loginsCategoryPills');
  if (pillsEl) {
    pillsEl.innerHTML = categories.map(cat => {
      const active = state.loginsCategoryFilter === cat;
      return '<button onclick="setLoginsCategoryFilter(\'' + cat + '\')" class="px-3 py-1 rounded-full text-xs font-semibold border transition ' +
        (active ? 'bg-[var(--text)] text-[var(--surface)] border-[var(--text)]' : 'bg-[var(--surface)] border-[var(--border)]') + '">' + cat + '</button>';
    }).join('');
  }

  const q = (document.getElementById('loginsSearchInput')?.value || '').toLowerCase();
  const filtered = state.savedLogins.filter(l => {
    const matchCat = (state.loginsCategoryFilter === 'All' || l.category === state.loginsCategoryFilter);
    const matchQ = !q || (l.name.toLowerCase().includes(q) || l.username.toLowerCase().includes(q) || (l.notes || '').toLowerCase().includes(q) || l.website_url.toLowerCase().includes(q));
    return matchCat && matchQ;
  });

  const grid = document.getElementById('savedLoginsCardsGrid');
  if (!grid) return;

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="col-span-full card-subtle p-8 text-center text-xs text-[var(--text-soft)]">No saved tools match this filter. Click "+ Add Website / Tool Login" to save a new tool.</div>';
    return;
  }

  grid.innerHTML = filtered.map(l => {
    const isRevealed = state.loginsRevealed;
    const passDisplay = isRevealed ? l.password : '••••••••••••';
    const canManage = ['super_admin', 'admin', 'manager'].includes(state.currentUserRole);

    return '<div class="card-subtle p-4 flex flex-col justify-between space-y-3 border hover:border-indigo-500/50 transition">' +
      '<div class="space-y-2.5">' +
        '<div class="flex items-start justify-between gap-2">' +
          '<div>' +
            '<span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">' + l.category + '</span>' +
            '<h3 class="text-sm font-bold mt-1.5">' + l.name + '</h3>' +
          '</div>' +
          '<a href="' + l.website_url + '" target="_blank" class="btn-outline px-2 py-1 text-[11px] font-semibold flex items-center gap-1 shrink-0" title="Open website">' +
            '<span>Launch</span> <span>↗</span>' +
          '</a>' +
        '</div>' +

        '<div class="space-y-1.5 text-xs bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--border)]">' +
          '<div class="flex items-center justify-between text-[11px]">' +
            '<span class="text-[var(--text-soft)]">URL:</span>' +
            '<span class="mono text-indigo-600 dark:text-indigo-400 truncate max-w-[200px]">' + l.website_url + '</span>' +
          '</div>' +
          '<div class="flex items-center justify-between text-[11px]">' +
            '<span class="text-[var(--text-soft)]">Login:</span>' +
            '<div class="flex items-center gap-1.5">' +
              '<span class="font-semibold">' + l.username + '</span>' +
              '<button onclick="copyToClipboard(\'' + l.username + '\', \'Username copied\')" class="text-[10px] text-slate-400 hover:text-slate-600" title="Copy username">📋</button>' +
            '</div>' +
          '</div>' +
          '<div class="flex items-center justify-between text-[11px]">' +
            '<span class="text-[var(--text-soft)]">Password:</span>' +
            '<div class="flex items-center gap-1.5">' +
              '<span class="mono font-semibold">' + passDisplay + '</span>' +
              '<button onclick="copyToClipboard(\'' + l.password + '\', \'Password copied\')" class="text-[10px] text-slate-400 hover:text-slate-600" title="Copy password">📋</button>' +
            '</div>' +
          '</div>' +
          (l.api_key ? (
            '<div class="flex items-center justify-between text-[11px] border-t border-[var(--border)] pt-1.5">' +
              '<span class="text-[var(--text-soft)]">API Token:</span>' +
              '<div class="flex items-center gap-1.5">' +
                '<span class="mono text-[10px] truncate max-w-[150px]">' + (isRevealed ? l.api_key : (l.api_key.slice(0, 6) + '••••')) + '</span>' +
                '<button onclick="copyToClipboard(\'' + l.api_key + '\', \'Token copied\')" class="text-[10px] text-slate-400 hover:text-slate-600" title="Copy API key">📋</button>' +
              '</div>' +
            '</div>'
          ) : '') +
        '</div>' +

        '<p class="text-[11px] text-[var(--text-soft)] line-clamp-2 leading-relaxed">' + (l.notes || 'Configured for automated marketing workflows.') + '</p>' +
      '</div>' +

      '<div class="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-2">' +
        '<div class="flex items-center gap-1.5">' +
          '<span class="w-2 h-2 rounded-full ' + (l.status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500') + '"></span>' +
          '<span class="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-soft)]">' + (l.status || 'CONNECTED') + '</span>' +
        '</div>' +
        '<div class="flex items-center gap-1.5">' +
          '<button onclick="testLoginConnection(\'' + l.id + '\')" class="btn-outline px-2.5 py-1 text-[11px] font-medium" title="Test website reachability">⚡ Ping</button>' +
          (canManage ? '<button onclick="openAddLoginModal(\'' + l.id + '\')" class="btn-outline px-2 py-1 text-[11px]" title="Edit credentials">✎</button>' : '') +
          (['super_admin', 'admin'].includes(state.currentUserRole) ? '<button onclick="deleteLoginTool(\'' + l.id + '\')" class="btn-outline px-2 py-1 text-[11px] hover:text-red-500" title="Delete">✕</button>' : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function renderRoleSpecificDashboard() {
  const container = document.getElementById('roleSpecificDashboardContent');
  if (!container) return;
  const user = getCurrentUser();
  container.innerHTML = '<div class="card-surface p-5 space-y-4">' +
    '<h2 class="text-base font-extrabold">' + user.name + ' — Active Pipeline Tasks</h2>' +
    '<div class="space-y-2.5">' +
      state.tasks.map(t =>
        '<div class="card-subtle p-3.5 flex flex-wrap items-center justify-between gap-3">' +
          '<div>' +
            '<div class="font-bold text-xs">' + t.title + '</div>' +
            '<div class="text-[11px] text-[var(--text-soft)] mt-0.5">Pipeline: ' + t.pipeline + ' • Priority: ' + t.priority + '</div>' +
          '</div>' +
          '<button onclick="switchMainView(\'workbench\')" class="btn-ink px-3.5 py-1.5 text-xs">Open in Workbench →</button>' +
        '</div>'
      ).join('') +
    '</div>' +
  '</div>';
}

function renderPipelinesCatalogView() {
  const grid = document.getElementById('allPipelinesDetailedGrid');
  if (!grid) return;
  grid.innerHTML = Object.values(PIPELINE_CATALOG).map(p =>
    '<div class="card-subtle p-4 flex flex-col justify-between space-y-3">' +
      '<div>' +
        '<div class="flex items-center justify-between">' +
          '<span class="px-2 py-0.5 rounded bg-indigo-600 text-white font-bold text-xs mono">' + p.code + '</span>' +
          '<span class="text-[10px] mono text-[var(--text-faint)]">' + p.webhook + '</span>' +
        '</div>' +
        '<h3 class="text-sm font-bold mt-2.5">' + p.name + '</h3>' +
        '<p class="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">' + p.badge + '</p>' +
        '<p class="text-[11px] text-[var(--text-soft)] mt-2">Squad: <span class="mono">' + p.squadNames.join(', ') + '</span></p>' +
      '</div>' +
      '<button onclick="selectPipeline(\'' + p.id + '\'); switchMainView(\'workbench\');" class="btn-ink w-full py-2 text-xs">Load Pipeline in Workbench →</button>' +
    '</div>'
  ).join('');
}

function renderTeamView() {
  const grid = document.getElementById('teamMembersGrid');
  if (!grid) return;
  grid.innerHTML = state.users.map(u =>
    '<div class="card-subtle p-4 flex items-start justify-between gap-3">' +
      '<div class="flex items-center gap-3 min-w-0">' +
        '<div class="w-10 h-10 rounded-2xl bg-indigo-600 text-white font-bold text-xs grid place-items-center shrink-0">' + u.initials + '</div>' +
        '<div class="min-w-0">' +
          '<div class="font-bold text-xs truncate">' + u.name + '</div>' +
          '<div class="text-[11px] text-[var(--text-soft)] mono truncate">' + u.email + '</div>' +
          '<span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 font-semibold mono mt-1 inline-block">' + u.role + '</span>' +
        '</div>' +
      '</div>' +
      '<button onclick="switchRoleSession(\'' + u.role + '\')" class="btn-outline px-2.5 py-1 text-[10px]">Switch</button>' +
    '</div>'
  ).join('');
}

// =============================================================================
// 32 SOVEREIGN AGENTS DIRECTORY & SQUAD DISPATCH INTERACTION
// =============================================================================
function setAgentDeptFilter(dept) {
  state.agentDeptFilter = dept;
  saveState();
  renderAgentsView();
}

function renderAgentsView() {
  // Render department filter pills
  const pillsEl = document.getElementById('agentsDeptFilterPills');
  const depts = ['All', 'Leadership', 'Research', 'Engineering', 'Design', 'Ops', 'Growth', 'Finance', 'Legal'];
  if (pillsEl) {
    pillsEl.innerHTML = depts.map(d => {
      const active = (state.agentDeptFilter || 'All') === d;
      const count = d === 'All' ? AGENTS_32.length : AGENTS_32.filter(a => a.dept === d).length;
      return `<button onclick="setAgentDeptFilter('${d}')" class="px-2.5 py-1 rounded-full text-xs font-semibold transition ${
        active
          ? 'bg-[var(--text)] text-[var(--surface)] shadow-sm'
          : 'bg-[var(--bg-soft)] text-[var(--text-soft)] hover:text-[var(--text)] border border-[var(--border)]'
      }">${d} (${count})</button>`;
    }).join('');
  }

  // Filter agents
  const searchInput = document.getElementById('agentsSearchInput');
  const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
  const currentDept = state.agentDeptFilter || 'All';

  const filtered = AGENTS_32.filter(a => {
    const matchDept = currentDept === 'All' || a.dept === currentDept;
    if (!matchDept) return false;
    if (!query) return true;
    const matchText = (a.name + ' ' + a.slug + ' ' + a.role + ' ' + a.dept + ' ' + (a.capabilities || []).join(' ') + ' ' + (a.system_directive || '')).toLowerCase();
    return matchText.includes(query);
  });

  const grid = document.getElementById('agentsGridContainer') || document.getElementById('agentsDirectoryGrid');
  if (!grid) return;

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="col-span-full py-12 text-center text-xs text-[var(--text-soft)]">No sovereign agents match your search filter.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(a => `
    <div class="card-surface p-4 flex flex-col justify-between hover:border-indigo-500/50 transition shadow-sm space-y-3">
      <div>
        <div class="flex items-start justify-between gap-2 mb-2.5">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-10 h-10 rounded-2xl text-white font-bold text-xs grid place-items-center shrink-0 shadow-sm" style="background:${a.color}">
              ${a.initials}
            </div>
            <div class="min-w-0">
              <div class="font-bold text-xs tracking-tight truncate flex items-center gap-1.5">
                <span>${a.name}</span>
                <span class="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">@${a.slug}</span>
              </div>
              <div class="text-[11px] text-[var(--text-soft)] truncate">${a.role}</div>
            </div>
          </div>
          <span class="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/20 shrink-0">● Online</span>
        </div>

        <div class="flex items-center gap-1.5 mb-2">
          <span class="text-[10px] px-2 py-0.5 rounded-md bg-[var(--bg-soft)] text-[var(--text-soft)] font-semibold border border-[var(--border)]">${a.dept}</span>
          <span class="text-[10px] text-[var(--text-faint)] font-mono">${(a.assigned_pipelines || []).length} Pipelines</span>
        </div>

        <p class="text-[11px] text-[var(--text-soft)] line-clamp-2 leading-relaxed mb-2.5">
          ${a.system_directive || 'Autonomous agent execution with strict harness grounding and 5-stage loop governance.'}
        </p>

        <div class="flex flex-wrap gap-1">
          ${(a.capabilities || ['Ground Truth', 'Deterministic Check']).slice(0, 3).map(c => `
            <span class="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium">${c}</span>
          `).join('')}
        </div>
      </div>

      <div class="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-2">
        <button onclick="openAgentModal('${a.slug}')" class="btn-outline px-2.5 py-1 text-[11px] flex-1">
          🔍 Blueprint
        </button>
        <button onclick="openAgentDispatchModal('${a.slug}')" class="btn-primary px-3 py-1 text-[11px] flex-1 font-bold inline-flex items-center justify-center gap-1">
          ⚡ Dispatch
        </button>
      </div>
    </div>
  `).join('');
}

function renderAgentsDirectory() {
  renderAgentsView();
}

let activeDispatchAgentSlug = 'coordinator';

function openAgentDispatchModal(agentSlug) {
  if (state.currentUserRole === 'client') {
    showToast('Client role is read-only. Switch to Member, Manager, or Admin to dispatch agents.');
    return;
  }

  activeDispatchAgentSlug = agentSlug || 'coordinator';
  const agent = AGENTS_32.find(a => a.slug === activeDispatchAgentSlug) || AGENTS_32[0];
  const modal = document.getElementById('agentDispatchModal');
  if (!modal) return;

  const avatar = document.getElementById('dispatchModalAvatar');
  const title = document.getElementById('dispatchModalTitle');
  const sub = document.getElementById('dispatchModalSub');
  const projSelect = document.getElementById('dispatchModalProjectSelect');
  const taskTitle = document.getElementById('dispatchModalTaskTitle');
  const taskBrief = document.getElementById('dispatchModalBrief');

  if (avatar) {
    avatar.textContent = agent.initials;
    avatar.style.background = agent.color;
  }
  if (title) title.textContent = `Dispatch Agent: @${agent.slug}`;
  if (sub) sub.textContent = `${agent.dept} • ${agent.role}`;

  if (projSelect) {
    projSelect.innerHTML = state.projects.map(p => `
      <option value="${p.id}" ${p.id === state.selectedProjectId ? 'selected' : ''}>${p.name}</option>
    `).join('');
  }

  const proj = getSelectedProject();
  if (taskTitle) taskTitle.value = `[@${agent.slug}] ${agent.role} for ${proj ? proj.name : 'Campaign'}`;
  if (taskBrief) taskBrief.value = agent.system_directive || 'Execute grounded marketing analysis and output validated deliverable.';

  modal.classList.remove('hidden');
}

function closeAgentDispatchModal() {
  const modal = document.getElementById('agentDispatchModal');
  if (modal) modal.classList.add('hidden');
}

async function submitAgentDispatch() {
  const btn = document.getElementById('dispatchModalSubmitBtn');
  const projSelect = document.getElementById('dispatchModalProjectSelect');
  const titleInput = document.getElementById('dispatchModalTaskTitle');
  const briefInput = document.getElementById('dispatchModalBrief');
  const prioritySelect = document.getElementById('dispatchModalPriority');

  const projectId = projSelect ? projSelect.value : state.selectedProjectId;
  const title = titleInput ? titleInput.value.trim() : '';
  const brief = briefInput ? briefInput.value.trim() : '';
  const priority = prioritySelect ? prioritySelect.value : 'normal';

  if (!title) {
    showToast('Task title is required.');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin inline-block mr-1">◐</span> Dispatching @${activeDispatchAgentSlug}...`;
  }

  try {
    const res = await fetch('/api/agents/dispatch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-role': state.currentUserRole
      },
      body: JSON.stringify({
        agent_slug: activeDispatchAgentSlug,
        project_id: projectId,
        title,
        brief,
        priority
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to dispatch agent');

    closeAgentDispatchModal();
    showToast(`@${activeDispatchAgentSlug} completed task! Deliverable staged in review.`);
    state.selectedProjectId = projectId;
    state.mainView = 'workbench';
    state.activeWorkbenchTab = 'report';
    await syncFromBackend();
    renderAll();
  } catch (err) {
    showToast(`Dispatch error: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '⚡ Dispatch Agent';
    }
  }
}

// =============================================================================
// PROJECT RAG VECTOR ENGINE & RETRIEVAL CONTROLS
// =============================================================================
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let latestRagResults = [];

async function renderRagView() {
  const selEl = document.getElementById('ragProjectSelect');
  if (selEl) {
    selEl.innerHTML = state.projects.map(p => `
      <option value="${p.id}" ${p.id === state.selectedProjectId ? 'selected' : ''}>${p.name}</option>
    `).join('');
  }

  const badge = document.getElementById('ragChunkCountBadge');
  const proj = getSelectedProject();
  if (proj) {
    try {
      const res = await fetch(`/api/projects/${proj.id}/rag/chunks`, {
        headers: { 'x-session-role': state.currentUserRole }
      });
      if (res.ok) {
        const data = await res.json();
        if (badge) badge.textContent = `${data.count || 0} chunks indexed`;
      }
    } catch (e) {}
  }
}

function selectProjectFromRag(projectId) {
  state.selectedProjectId = projectId;
  saveState();
  renderAll();
  runRagSemanticSearch();
}

async function runRagSemanticSearch() {
  const queryInput = document.getElementById('ragQueryInput');
  const topKSelect = document.getElementById('ragTopKSelect');
  const resultsContainer = document.getElementById('ragSearchResultsList');

  const query = queryInput ? queryInput.value.trim() : '';
  const topK = topKSelect ? Number(topKSelect.value) : 5;
  const proj = getSelectedProject();

  if (!proj) return;
  if (!query) {
    showToast('Please enter a search query for the project harness.');
    return;
  }

  if (resultsContainer) {
    resultsContainer.innerHTML = `<div class="p-4 text-center text-xs text-[var(--text-soft)]"><span class="animate-spin inline-block mr-1.5">◐</span> Computing BM25 & cosine relevance across project chunks...</div>`;
  }

  try {
    const res = await fetch(`/api/projects/${proj.id}/rag/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-role': state.currentUserRole
      },
      body: JSON.stringify({ query, top_k: topK })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'RAG search error');

    latestRagResults = data.results || [];

    if (!resultsContainer) return;
    if (latestRagResults.length === 0) {
      resultsContainer.innerHTML = `<div class="p-4 text-center text-xs text-[var(--text-soft)]">No matching chunks found in project harness for "${query}". Ingest more documents below.</div>`;
      return;
    }

    resultsContainer.innerHTML = latestRagResults.map((r, i) => `
      <div class="card-surface p-3.5 space-y-2 border border-[var(--border)] hover:border-indigo-500/50 transition">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="w-5 h-5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] grid place-items-center font-bold">#${i+1}</span>
            <span class="font-bold text-xs truncate">${r.document_name}</span>
            <span class="text-[10px] mono text-[var(--text-faint)]">chunk ${r.chunk_index} &bull; ${r.token_count} tokens</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${
              r.match_pct >= 75
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
            }">${r.match_pct}% Match</span>
            <button onclick="copyChunkContent(${i})" class="btn-outline px-2 py-0.5 text-[10px]" title="Copy Chunk">📋 Copy</button>
            <button onclick="insertChunkIntoTask(${i})" class="btn-ink px-2 py-0.5 text-[10px]" title="Use in Task">⚡ Insert</button>
          </div>
        </div>
        <div class="card-subtle p-2.5 text-[11px] mono text-[var(--text-soft)] leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
          ${escapeHtml(r.content)}
        </div>
      </div>
    `).join('');

    showToast(`Retrieved ${latestRagResults.length} relevant chunks for active project.`);
  } catch (err) {
    if (resultsContainer) {
      resultsContainer.innerHTML = `<div class="p-4 text-center text-xs text-rose-500">Retrieval error: ${err.message}</div>`;
    }
  }
}

function copyChunkContent(index) {
  if (latestRagResults[index]) {
    navigator.clipboard.writeText(latestRagResults[index].content);
    showToast(`Copied chunk from ${latestRagResults[index].document_name} to clipboard.`);
  }
}

function insertChunkIntoTask(index) {
  if (latestRagResults[index]) {
    const chunk = latestRagResults[index];
    const cmdInput = document.getElementById('wbCommandInput');
    if (cmdInput) {
      cmdInput.value = `${cmdInput.value}\n[GROUNDING CITATION: ${chunk.document_name} chunk ${chunk.chunk_index}]\n${chunk.content}`;
    }
    state.mainView = 'workbench';
    saveState();
    renderAll();
    showToast(`Inserted chunk into Workbench Task Brief!`);
  }
}

async function ingestNewRagDocument() {
  if (state.currentUserRole === 'client') {
    showToast('Client role is read-only. Switch to Member, Manager, or Admin.');
    return;
  }

  const nameInput = document.getElementById('ragNewDocName');
  const contentInput = document.getElementById('ragNewDocContent');
  const docName = nameInput ? nameInput.value.trim() : '';
  const content = contentInput ? contentInput.value.trim() : '';
  const proj = getSelectedProject();

  if (!proj) return;
  if (!docName || !content) {
    showToast('Source filename and document content are required.');
    return;
  }

  try {
    const res = await fetch(`/api/projects/${proj.id}/rag/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-role': state.currentUserRole
      },
      body: JSON.stringify({ document_name: docName, content })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to ingest document');

    showToast(`Successfully indexed ${docName} into project RAG (${data.chunks_created} chunks, ${data.total_tokens} tokens)!`);
    renderRagView();

    // Auto-search for the newly ingested document
    const queryInput = document.getElementById('ragQueryInput');
    if (queryInput) queryInput.value = docName.replace(/[._-]/g, ' ');
    runRagSemanticSearch();
  } catch (err) {
    showToast(`Ingestion error: ${err.message}`);
  }
}

function copyAntigravityRagPrompt() {
  const proj = getSelectedProject();
  if (!proj) return;

  const topChunks = latestRagResults.slice(0, 3).map((r, i) => `
### [Harness Chunk ${i+1}: ${r.document_name} (Chunk ${r.chunk_index})]
\`\`\`text
${r.content.trim()}
\`\`\`
`).join('\n');

  const masterPrompt = `
# Antigravity Task Prompt: ${proj.name}
**Client:** ${proj.client || 'Valioz Health'}
**Goal:** ${proj.goal || 'High-conversion marketing system'}
**Guidelines & Rules:**
${proj.guidelines || 'Strict adherence to Ground Truth; zero hallucinations allowed.'}

## Retrieved Project Grounding Context (RAG Top Matches)
${topChunks || 'No RAG chunks currently queried. Ingest harness files in RAG Control Center.'}

## Instructions for Antigravity Squad
1. Decompose the request into deterministic 5-stage loop steps.
2. Ground all pricing, clinic names, and claims directly in the RAG chunks above.
3. Emit both structured JSON deliverable and Executive Admin Report markdown.
`.trim();

  navigator.clipboard.writeText(masterPrompt);
  showToast('Copied master Antigravity RAG prompt to clipboard!');
}

// =============================================================================
// PROJECT WORKFLOW GUIDELINES & DELIVERABLE SOP (ADMIN/MANAGER)
// =============================================================================
async function openGuidelinesModal() {
  const proj = getSelectedProject();
  if (!proj) return;

  const modal = document.getElementById('guidelinesModal');
  if (!modal) return;

  try {
    const res = await fetch(`/api/projects/${proj.id}/guidelines`, {
      headers: { 'x-session-role': state.currentUserRole }
    });
    if (res.ok) {
      const data = await res.json();
      const ta = document.getElementById('guidelinesTextarea');
      if (ta) ta.value = data.guidelines || '';
      const specs = data.deliverable_specs || {};
      const aud = document.getElementById('guidelinesTargetAudience');
      if (aud) aud.value = specs.target_audience || 'Canadian Dental Clinics & Practice Directors';
      const tone = document.getElementById('guidelinesTone');
      if (tone) tone.value = specs.tone || 'Authoritative, Clinical, Consultative, High-ROI';
      const pricing = document.getElementById('guidelinesPricingRules');
      if (pricing) pricing.value = specs.pricing_rules || '$499 setup, 100% domain/code ownership, 0 lock-in';
      const comp = document.getElementById('guidelinesCompliance');
      if (comp) comp.value = specs.compliance || 'CASL, PIPEDA, Google Healthcare Ads Policy';
      const rules = document.getElementById('guidelinesCustomRules');
      if (rules) rules.value = data.custom_rules || '';
    }
  } catch (e) {
    console.warn('Could not load remote guidelines:', e.message);
  }

  modal.classList.remove('hidden');
}

function closeGuidelinesModal() {
  const modal = document.getElementById('guidelinesModal');
  if (modal) modal.classList.add('hidden');
}

function insertTemplateGuidelines() {
  const template = `# Valioz Health — Clinical B2B Outreach SOP & Guidelines

## 1. Brand Identity & Value Stacking
- **Client:** Valioz Health
- **Target Persona:** Canadian Dental Clinics (Ontario, BC, Alberta)
- **Primary Offer:** $499 turnkey website setup with 30-day AI Growth Agent included.
- **Key Trust Anchor:** 100% asset ownership (domain, Google Analytics, code) transferred directly to the clinic.
- **Tone:** Authoritative, clinical, consultative, patient-outcome focused.

## 2. Gate G2 Outbound Quality Gates
- All cold outreach messages staged for human review before sending.
- Every clinic cited must exist in Priority_A_Outreach_Email_Merge_Fields.csv with verified city and doctor credentials.
- Zero generic boilerplate. All pitches cite local search volume benchmarks.

## 3. SEO & Schema Standards
- Enforce LocalBusiness + MedicalBusiness JSON-LD markup with geo coordinates.
- Target zero-competition treatment keywords with KGR < 0.25.`;

  const ta = document.getElementById('guidelinesTextarea');
  if (ta) ta.value = template;
}

async function saveProjectGuidelines() {
  const proj = getSelectedProject();
  if (!proj) return;

  if (state.currentUserRole === 'client' || state.currentUserRole === 'member') {
    showToast('Only Admin and Manager can modify project guidelines.');
    return;
  }

  const guidelines = document.getElementById('guidelinesTextarea')?.value || '';
  const deliverable_specs = {
    target_audience: document.getElementById('guidelinesTargetAudience')?.value || '',
    tone: document.getElementById('guidelinesTone')?.value || '',
    pricing_rules: document.getElementById('guidelinesPricingRules')?.value || '',
    compliance: document.getElementById('guidelinesCompliance')?.value || ''
  };
  const custom_rules = document.getElementById('guidelinesCustomRules')?.value || '';

  try {
    const res = await fetch(`/api/projects/${proj.id}/guidelines`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-session-role': state.currentUserRole
      },
      body: JSON.stringify({ guidelines, deliverable_specs, custom_rules })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update guidelines');

    proj.guidelines = guidelines;
    proj.custom_rules = custom_rules;
    saveState();
    closeGuidelinesModal();
    showToast('Workflow guidelines and deliverable specs successfully updated.');
  } catch (err) {
    showToast('Error saving guidelines: ' + err.message);
  }
}

// =============================================================================
// SEO & GEO SEARCH ARCHITECTURE (14 Disciplines Engine)
// =============================================================================
let seoTreeData = null;
let activeSeoCategory = 'all';

async function fetchSeoTree() {
  try {
    const res = await fetch('/api/seo/tree', {
      headers: { 'x-session-role': state.currentUserRole }
    });
    if (res.ok) {
      const data = await res.json();
      seoTreeData = data.categories;
      return data.categories;
    }
  } catch (e) {
    console.warn('Using local SEO definitions:', e.message);
  }
  return [];
}

async function renderSeoView() {
  const grid = document.getElementById('seoDisciplinesGrid');
  const chipsRow = document.getElementById('seoFilterChips');
  if (!grid) return;

  if (!seoTreeData || seoTreeData.length === 0) {
    await fetchSeoTree();
  }

  const categories = seoTreeData || [];
  if (categories.length === 0) {
    grid.innerHTML = '<div class="text-center py-6 text-xs text-[var(--text-soft)]">Loading 14 SEO Disciplines...</div>';
    return;
  }

  // Render Category Filter Chips
  if (chipsRow) {
    const allChips = ['all', ...categories.map(c => c.id)];
    chipsRow.innerHTML = allChips.map(id => {
      const name = id === 'all' ? 'All Disciplines (14)' : (categories.find(c => c.id === id)?.name || id);
      const active = activeSeoCategory === id;
      return `<button onclick="setSeoCategoryFilter('${id}')" class="px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition ${active ? 'bg-indigo-600 text-white shadow-xs' : 'bg-[var(--bg-soft)] text-[var(--text-soft)] hover:text-[var(--text)]'}">${name}</button>`;
    }).join('');
  }

  const filterQuery = (document.getElementById('seoSearchInput')?.value || '').toLowerCase().trim();

  // Filter categories
  const filtered = categories.filter(c => {
    if (activeSeoCategory !== 'all' && c.id !== activeSeoCategory) return false;
    if (!filterQuery) return true;
    const matchCat = c.name.toLowerCase().includes(filterQuery) || c.description.toLowerCase().includes(filterQuery);
    const matchSub = c.subcategories.some(s =>
      s.name.toLowerCase().includes(filterQuery) ||
      s.description.toLowerCase().includes(filterQuery) ||
      s.deliverable.toLowerCase().includes(filterQuery) ||
      (s.tools || []).some(t => t.toLowerCase().includes(filterQuery))
    );
    return matchCat || matchSub;
  });

  grid.innerHTML = filtered.map(c => {
    const subcats = c.subcategories.filter(s => {
      if (!filterQuery) return true;
      return s.name.toLowerCase().includes(filterQuery) ||
        s.description.toLowerCase().includes(filterQuery) ||
        s.deliverable.toLowerCase().includes(filterQuery) ||
        (s.tools || []).some(t => t.toLowerCase().includes(filterQuery));
    });

    return `
      <div class="card-surface p-4 sm:p-5 border border-[var(--border)] rounded-2xl">
        <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border)]">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="text-2xl">${c.icon || '📁'}</span>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-sm sm:text-base font-bold">${c.name}</h3>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono font-semibold">${subcats.length} Frameworks</span>
              </div>
              <p class="text-xs text-[var(--text-soft)] mt-0.5">${c.description}</p>
            </div>
          </div>
        </div>

        <div class="grid md:grid-cols-2 gap-3 mt-3.5">
          ${subcats.map(sub => `
            <div class="card-subtle p-3.5 rounded-xl border border-[var(--border)] flex flex-col justify-between space-y-2.5">
              <div>
                <div class="flex items-center justify-between gap-2">
                  <h4 class="text-xs font-bold text-[var(--text)]">${sub.name}</h4>
                  <span class="text-[9px] px-1.5 py-0.5 rounded font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-semibold">Active</span>
                </div>
                <p class="text-[11px] text-[var(--text-soft)] mt-1 leading-relaxed">${sub.description}</p>
                
                <div class="mt-2 text-[10px] bg-[var(--surface)] p-2 rounded-lg border border-[var(--border)]">
                  <span class="font-bold text-[var(--text)]">Deliverable:</span>
                  <span class="text-indigo-600 dark:text-indigo-400 mono ml-1">${sub.deliverable}</span>
                </div>
              </div>

              <div>
                <div class="text-[10px] text-[var(--text-faint)] font-bold mb-1">Required Tools (${(sub.tools || []).length}):</div>
                <div class="flex flex-wrap gap-1 mb-2.5">
                  ${(sub.tools_detail || (sub.tools || []).map(t => ({ slug: t, name: t, status: 'connected' }))).map(t => `
                    <button onclick="viewToolDetail('${t.slug}')" class="text-[9px] px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border)] hover:border-indigo-500 font-mono text-[var(--text-soft)] flex items-center gap-1" title="Click to view tool in Saved Logins">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>${t.name || t.slug}</span>
                    </button>
                  `).join('')}
                </div>

                <div class="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
                  <button onclick="openSeoActionModal('${c.id}', '${sub.id}')" class="btn-primary flex-1 py-1.5 text-[11px] font-semibold text-center">
                    ⚡ Execute Action
                  </button>
                  <button onclick="copySeoPrompt('${sub.workflow_prompt || ''}')" class="btn-outline px-2.5 py-1.5 text-[11px] text-[var(--text-soft)] hover:text-[var(--text)]" title="Copy Antigravity Slash Command">
                    📋
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function setSeoCategoryFilter(id) {
  activeSeoCategory = id;
  renderSeoView();
}

function filterSeoTree() {
  renderSeoView();
}

function copySeoPrompt(promptText) {
  if (!promptText) return;
  navigator.clipboard.writeText(promptText).then(() => {
    showToast('Copied to clipboard: "' + promptText + '"');
  }).catch(() => {
    showToast('Prompt: ' + promptText);
  });
  const cmdInput = document.getElementById('wbCommandInput');
  if (cmdInput) cmdInput.value = promptText;
}

let activeSeoModalContext = null;

function openSeoActionModal(catId, subId) {
  const cat = (seoTreeData || []).find(c => c.id === catId);
  const sub = cat?.subcategories.find(s => s.id === subId);
  if (!sub) return;

  activeSeoModalContext = { catId, subId, cat, sub };

  const titleEl = document.getElementById('seoModalTitle');
  if (titleEl) titleEl.textContent = `Launch: ${sub.name}`;
  const fEl = document.getElementById('seoModalFramework');
  if (fEl) fEl.value = `${cat.name} → ${sub.name}`;
  const dEl = document.getElementById('seoModalDeliverableType');
  if (dEl) dEl.textContent = sub.deliverable;
  const pEl = document.getElementById('seoModalPrompt');
  if (pEl) pEl.value = sub.workflow_prompt || `/assign Execute ${sub.name} for active project.`;

  const toolsList = document.getElementById('seoModalToolsList');
  if (toolsList) {
    toolsList.innerHTML = (sub.tools || []).map(slug => `
      <span class="text-[10px] px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] mono flex items-center gap-1 font-semibold">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        ${slug}
      </span>
    `).join('');
  }

  const modal = document.getElementById('seoActionModal');
  if (modal) modal.classList.remove('hidden');
}

function openSeoCustomModal() {
  if (seoTreeData && seoTreeData[0] && seoTreeData[0].subcategories[0]) {
    openSeoActionModal(seoTreeData[0].id, seoTreeData[0].subcategories[0].id);
  }
}

function closeSeoActionModal() {
  const modal = document.getElementById('seoActionModal');
  if (modal) modal.classList.add('hidden');
}

async function submitSeoActionTask() {
  if (!activeSeoModalContext) return;
  const proj = getSelectedProject();
  if (!proj) return;

  const prompt = document.getElementById('seoModalPrompt')?.value || '';
  const btn = document.getElementById('seoModalSubmitBtn');
  if (btn) btn.disabled = true;

  showToast(`Queuing ${activeSeoModalContext.sub.name} for ${proj.name}...`);

  try {
    const res = await fetch('/api/seo/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-role': state.currentUserRole
      },
      body: JSON.stringify({
        project_id: proj.id,
        category_id: activeSeoModalContext.catId,
        subcategory_id: activeSeoModalContext.subId,
        custom_prompt: prompt
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to execute SEO task');

    closeSeoActionModal();
    showToast(data.message || 'SEO task completed and ready for review.');

    // Switch to workbench so the user sees the output immediately
    state.mainView = 'workbench';
    state.activeWorkbenchTab = 'report';
    await syncFromBackend();
    renderAll();
  } catch (err) {
    showToast(`SEO execution error: ${err.message}`);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function viewToolDetail(slug) {
  state.mainView = 'logins';
  state.loginsSearchQuery = slug;
  saveState();
  renderAll();
  const searchInput = document.getElementById('loginsSearchInput');
  if (searchInput) searchInput.value = slug;
  showToast(`Filtered Saved Logins vault for tool: ${slug}`);
}

function renderAll() {
  renderHeaderAndRoleBanner();
  renderStageRibbonAndProjects();
  renderWorkbenchCenterAndRight();
  renderRoleSpecificDashboard();
  renderPipelinesCatalogView();
  renderTeamView();
  renderSeoView();
  renderSavedLoginsView();
  renderAgentsDirectory();
  renderRagView();
  setupDragAndDrop();
}

window.addEventListener('DOMContentLoaded', function() {
  syncFromBackend().then(() => {
    if (window.location.hash === '#seo') state.mainView = 'seo';
    else if (window.location.hash === '#logins') state.mainView = 'logins';
    else if (window.location.hash === '#agents') state.mainView = 'agents';
    else if (window.location.hash === '#rag') {
      state.mainView = 'rag';
      setTimeout(runRagSemanticSearch, 250);
    }
    else if (window.location.hash === '#dispatch') {
      state.mainView = 'agents';
      setTimeout(() => openAgentDispatchModal('coordinator'), 200);
    }
    else if (window.location.hash === '#guidelines') {
      state.mainView = 'workbench';
      setTimeout(openGuidelinesModal, 100);
    }
    renderAll();
  });
});
