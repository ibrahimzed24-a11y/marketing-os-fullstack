// SEO & GEO Intelligence Architecture
// Definitive 14-branch structure for enterprise SEO, GEO Search, Copywriting & Content Creation

const SEO_STRUCTURE = [
  {
    id: 'keyword-research',
    name: 'Keyword Research',
    icon: '🔍',
    description: 'Discovery and classification of high-yield commercial queries, search intent clustering, and SERP landscape audits.',
    subcategories: [
      {
        id: 'long-tail-keywords',
        name: 'Long Tail Keywords',
        description: 'Specific 3-5 word high-intent phrases with high conversion probability and clear transactional or informational intent.',
        tools: ['google-keyword-planner', 'semrush-suite', 'ahrefs-suite', 'lowfruits-kgr', 'answerthepublic'],
        deliverable: 'Long Tail Keyword Matrix (.csv) with search volumes, CPC, and intent categorization.',
        workflow_prompt: '/assign Extract 50 long-tail treatment and service queries from project harness files with search intent and difficulty scores.'
      },
      {
        id: 'low-competition-keywords',
        name: 'Low-competition Keywords',
        description: 'Keyword Golden Ratio (KGR < 0.25) queries where competitors lack dedicated content, allowing immediate page 1 ranking.',
        tools: ['lowfruits-kgr', 'ahrefs-suite', 'semrush-suite'],
        deliverable: 'KGR Opportunity Scorecard (.csv) highlighting easy win target keywords.',
        workflow_prompt: '/assign Identify zero and low-competition keyword clusters where authority sites have weak content coverage.'
      },
      {
        id: 'keyword-gap-analysis',
        name: 'Keyword Gap Analysis',
        description: 'Side-by-side keyword overlap audit identifying lucrative queries competitors rank for but your client does not.',
        tools: ['semrush-suite', 'ahrefs-suite', 'google-search-console'],
        deliverable: 'Competitive Keyword Gap Matrix comparing 3 market leaders.',
        workflow_prompt: '/assign Perform keyword gap teardown against competitor.html harness file and list 20 priority gap queries.'
      },
      {
        id: 'serp-analysis',
        name: 'SERP Analysis',
        description: 'Detailed inspection of top 10 search engine results: featured snippets, People Also Ask (PAA), local packs, and video carousels.',
        tools: ['google-search-console', 'ahrefs-suite', 'semrush-suite'],
        deliverable: 'SERP Feature Architecture & Content Length Benchmark Report.',
        workflow_prompt: '/assign Analyze SERP intent for primary target keyword and map required schema and headings to win snippet.'
      }
    ]
  },
  {
    id: 'on-page-seo',
    name: 'On-page SEO',
    icon: '📄',
    description: 'Granular page-level optimization ensuring keyword placement, structural hierarchy, media tags, and schema compliance.',
    subcategories: [
      {
        id: 'title',
        name: 'Title',
        description: '55-60 character click-optimized Title tags balancing primary keyword, city/geo hook, and CTR emotional modifier.',
        tools: ['surfer-seo', 'google-search-console', 'screaming-frog'],
        deliverable: 'Title Tag Variant Matrix (Primary, Branded, and CTR High-Yield options).',
        workflow_prompt: '/assign Generate 5 optimized title tags adhering to strict 58 character limit and local search intent.'
      },
      {
        id: 'heading',
        name: 'Heading',
        description: 'Semantic H1, H2, H3 hierarchy mapping sub-intents, PAA answers, and secondary semantic keyword variants.',
        tools: ['surfer-seo', 'clearscope-content', 'frase-seo'],
        deliverable: 'H1-H4 Structural Outline with embedded semantic entities.',
        workflow_prompt: '/assign Draft semantic heading hierarchy mapping all user questions from harness into H2 and H3 tags.'
      },
      {
        id: 'image-seo',
        name: 'Image SEO',
        description: 'Descriptive alt attributes, WebP next-gen compression, geo-tagged metadata, and responsive srcset configurations.',
        tools: ['tinypng-squoosh', 'screaming-frog', 'google-search-console'],
        deliverable: 'Image SEO Audit Manifest with file naming, alt tags, and WebP compression specs.',
        workflow_prompt: '/assign Optimize image alt tags and media file names for local dental and service search visibility.'
      },
      {
        id: 'internal-linking',
        name: 'Internal Linking',
        description: 'Hub-and-spoke topic cluster linking passing PageRank and context between pillar guides and transactional landing pages.',
        tools: ['screaming-frog', 'ahrefs-suite', 'google-search-console'],
        deliverable: 'Internal Link Routing Architecture with exact anchor text rules.',
        workflow_prompt: '/assign Build topic cluster link architecture connecting landing pages to core service pillars.'
      },
      {
        id: 'schema-markup',
        name: 'Schema Markup',
        description: 'JSON-LD structured data: LocalBusiness, MedicalBusiness, Dentist, Service, FAQPage, and BreadcrumbList.',
        tools: ['schema-org-validator', 'google-search-console'],
        deliverable: 'Complete validated JSON-LD Schema Script ready for injection.',
        workflow_prompt: '/assign Generate validated LocalBusiness and MedicalClinic JSON-LD schema with coordinates, phone, and opening hours.'
      },
      {
        id: 'ctr',
        name: 'CTR',
        description: 'Meta description copywriting, rich snippet star ratings, and emotional curiosity hooks designed to maximize click share.',
        tools: ['google-search-console', 'surfer-seo'],
        deliverable: 'High-CTR Meta Description and Snippet Playbook.',
        workflow_prompt: '/assign Craft high-converting meta descriptions with active CTA and character counter verification.'
      }
    ]
  },
  {
    id: 'content-seo',
    name: 'Content SEO',
    icon: '✍️',
    description: 'End-to-end editorial pipeline: deep topic research, data briefs, expert copywriting, optimization, and content refresh cycles.',
    subcategories: [
      {
        id: 'research',
        name: 'Research',
        description: 'Evidence gathering from verified project harness datasets, scientific studies, patient review databases, and industry benchmarks.',
        tools: ['answerthepublic', 'perplexity-ai', 'ahrefs-suite'],
        deliverable: 'Topic Intelligence & Citation Ledger.',
        workflow_prompt: '/assign Synthesize grounded research points strictly from project /uploads harness files.'
      },
      {
        id: 'briefs',
        name: 'Briefs',
        description: 'Comprehensive content blueprints specifying target word counts, entity frequencies, competitor outlines, and primary CTA.',
        tools: ['surfer-seo', 'clearscope-content', 'frase-seo'],
        deliverable: 'Production Content Brief Markdown.',
        workflow_prompt: '/assign Generate full Content Brief with target headings, entities, word count target, and internal links.'
      },
      {
        id: 'content-writing',
        name: 'Content Writing',
        description: 'High-authority, engaging copy written for humans first and search algorithms second, infused with verified client metrics.',
        tools: ['jasper-ai', 'copy-ai', 'grammarly-enterprise', 'claude-ai'],
        deliverable: 'Complete 1,500+ word Production Article Markdown.',
        workflow_prompt: '/assign Write an authoritative 1,500-word article grounded in clinic specialties with zero fluff or hallucinated data.'
      },
      {
        id: 'content-optimization',
        name: 'Content Optimization',
        description: 'Real-time NLP entity scoring, readability grading, sentence variation, and TF-IDF semantic density tuning.',
        tools: ['surfer-seo', 'clearscope-content', 'grammarly-enterprise'],
        deliverable: 'NLP Optimization Scorecard with 80+ Surfer/Clearscope benchmark.',
        workflow_prompt: '/assign Optimize draft text with required NLP terms and entities to achieve top 10% topical depth.'
      },
      {
        id: 'content-refresh',
        name: 'Content Refresh',
        description: 'Updating decaying articles with new dates, refreshed data points, new media, and expanded FAQs.',
        tools: ['google-search-console', 'ahrefs-suite'],
        deliverable: 'Content Update Changelog and Delta Document.',
        workflow_prompt: '/assign Review existing page content, identify outdated metrics, and inject 2026 current benchmark data.'
      },
      {
        id: 'expansion',
        name: 'Expansion',
        description: 'Repurposing top-ranking articles into downloadable lead magnets, checklists, video scripts, and newsletter digests.',
        tools: ['copy-ai', 'jasper-ai', 'canva-visuals'],
        deliverable: 'Multi-Format Asset Pack (Checklist PDF, Slide Deck, Social Snippets).',
        workflow_prompt: '/assign Repurpose primary SEO guide into a 1-page PDF cheat sheet and 5-email nurture sequence.'
      }
    ]
  },
  {
    id: 'technical-seo',
    name: 'Technical SEO',
    icon: '⚙️',
    description: 'Foundational site health: crawl budget optimization, server status codes, canonicals, security, and Core Web Vitals.',
    subcategories: [
      {
        id: 'crawling',
        name: 'Crawling',
        description: 'Detection of crawl traps, orphan pages, deep click depths (>3 clicks from root), and parameter URL bloat.',
        tools: ['screaming-frog', 'google-search-console', 'bing-webmaster'],
        deliverable: 'Crawl Health Audit Log with full URL status code breakdown.',
        workflow_prompt: '/assign Audit crawl paths and flag any pages requiring more than 3 clicks from homepage.'
      },
      {
        id: 'indexing',
        name: 'Indexing',
        description: 'Google Indexing API submission, noindex verification, and Index Coverage error remediation in Search Console.',
        tools: ['google-search-console', 'bing-webmaster'],
        deliverable: 'Indexation Status Report & Google Indexing API submission log.',
        workflow_prompt: '/assign Check indexing status for all new landing page URLs and draft Indexing API payload.'
      },
      {
        id: 'https-security',
        name: 'HTTPS Security',
        description: 'Mixed content eradication, TLS 1.3 enforcement, HSTS headers, and secure certificate validation.',
        tools: ['cloudflare-dns', 'screaming-frog'],
        deliverable: 'Security Header & Mixed Content Audit.',
        workflow_prompt: '/assign Verify SSL certificate status, HTTPS redirection rules, and HSTS security headers.'
      },
      {
        id: 'sitemaps',
        name: 'Sitemaps',
        description: 'Clean XML sitemap generation excluding redirected or canonicalized URLs, segmented by post type and location.',
        tools: ['screaming-frog', 'google-search-console'],
        deliverable: 'Validated sitemap.xml and sitemap-index.xml files.',
        workflow_prompt: '/assign Generate XML sitemap structure containing only 200 OK canonical landing pages.'
      },
      {
        id: 'robotstxt',
        name: 'RobotsTXT',
        description: 'Directives controlling search spider access, disallowing admin endpoints, and referencing sitemap locations.',
        tools: ['google-search-console', 'cloudflare-dns'],
        deliverable: 'Production robots.txt file with bot-specific directives.',
        workflow_prompt: '/assign Generate optimized robots.txt allowing search spiders while blocking staging and private files.'
      },
      {
        id: 'canonical-tags',
        name: 'Canonical Tags',
        description: 'Self-referential and cross-domain rel="canonical" tags preventing duplicate content penalties across variants.',
        tools: ['screaming-frog', 'surfer-seo'],
        deliverable: 'Canonical Mapping Ledger for all service variants.',
        workflow_prompt: '/assign Verify rel=canonical links across all city landing pages to prevent duplicate content flags.'
      },
      {
        id: 'redirects',
        name: 'Redirects',
        description: '301 permanent redirects, redirect loop detection, and elimination of legacy 302 or chaining hops.',
        tools: ['screaming-frog', 'cloudflare-dns'],
        deliverable: 'Redirect Rule Sheet (.htaccess, Cloudflare, or nginx rules).',
        workflow_prompt: '/assign Map 301 redirects for modified URLs with zero multi-hop redirect chains.'
      },
      {
        id: 'page-speed',
        name: 'Page Speed',
        description: 'Core Web Vitals optimization: LCP < 2.5s, INP < 200ms, CLS < 0.1 via JS deferral, caching, and CSS minification.',
        tools: ['google-pagespeed', 'cloudflare-dns'],
        deliverable: 'Core Web Vitals Performance Diagnostic & Optimization Script.',
        workflow_prompt: '/assign Analyze PageSpeed metrics and recommend script deferral and image lazy loading rules.'
      },
      {
        id: 'log-file-analysis',
        name: 'Log File Analysis',
        description: 'Inspecting raw Apache/Nginx web server access logs to uncover Googlebot crawl frequencies and wasted budget.',
        tools: ['screaming-frog', 'cloudflare-dns'],
        deliverable: 'Googlebot Crawl Frequency & Response Code Breakdown.',
        workflow_prompt: '/assign Analyze server logs to track bot visit frequency across high-priority service URLs.'
      }
    ]
  },
  {
    id: 'link-building',
    name: 'Link Building',
    icon: '🔗',
    description: 'Earning high-authority, editorial backlinks through digital PR, resource hubs, broken link recovery, and journalist outreach.',
    subcategories: [
      {
        id: 'guest-posting',
        name: 'Guest Posting',
        description: 'Pitching contextual, highly relevant guest publications on DR 50+ industry blogs and regional trade journals.',
        tools: ['hunter-io', 'buzzstream-crm', 'ahrefs-suite'],
        deliverable: 'Vetted Publisher Prospect List & Personalized Pitch Angles.',
        workflow_prompt: '/assign Identify 20 relevant healthcare/industry publications accepting guest contributions.'
      },
      {
        id: 'digital-pr',
        name: 'Digital PR',
        description: 'Proprietary data studies, infographic hooks, and press releases distributed to regional journalists and news editors.',
        tools: ['pitchbox-pr', 'buzzstream-crm', 'hunter-io'],
        deliverable: 'Digital PR Campaign Press Release and Media Outreach List.',
        workflow_prompt: '/assign Draft data-driven press release based on market search gap analysis for regional media distribution.'
      },
      {
        id: 'broken-link-building',
        name: 'Broken Link Building',
        description: 'Finding dead 404 links on authoritative resource lists and pitching your client\'s working asset as a superior replacement.',
        tools: ['ahrefs-suite', 'screaming-frog', 'hunter-io'],
        deliverable: 'Broken Link Target URLs & Replacement Pitch Templates.',
        workflow_prompt: '/assign Identify broken links on regional resource hubs and draft replacement outreach messages.'
      },
      {
        id: 'resource-page-links',
        name: 'Resource Page Links',
        description: 'Securing placements on curated community, municipal, healthcare, and educational reference directories.',
        tools: ['buzzstream-crm', 'google-search-console'],
        deliverable: 'Resource Page Target Directory with contact emails.',
        workflow_prompt: '/assign Extract community and chamber of commerce resource lists for local directory link acquisition.'
      },
      {
        id: 'unlinked-brand-mentions',
        name: 'Unlinked Brand Mentions',
        description: 'Scanning the web for articles citing your client or brand name without hyperlinking, then converting them to live links.',
        tools: ['ahrefs-suite', 'semrush-suite', 'hunter-io'],
        deliverable: 'Unlinked Brand Mention Outreach Queue.',
        workflow_prompt: '/assign Find unlinked mentions of client name across digital press and draft attribution link request.'
      },
      {
        id: 'linkable-assets',
        name: 'Linkable Assets',
        description: 'Creating high-value interactive tools, calculators, industry statistics reports, and free templates that naturally earn links.',
        tools: ['surfer-seo', 'canva-visuals'],
        deliverable: 'Linkable Asset Specification & Interactive Embed Widget.',
        workflow_prompt: '/assign Design a free ROI calculator widget engineered to attract organic editorial citations.'
      },
      {
        id: 'haro',
        name: 'HARO & Journalist Queries',
        description: 'Daily monitoring of journalist requests on Connectively (formerly HARO), Qwoted, and Featured for executive quotes.',
        tools: ['connectively-haro', 'gmail-workspace'],
        deliverable: 'Daily Journalist Pitch Submissions with expert commentary.',
        workflow_prompt: '/assign Draft authoritative expert quote answering journalist inquiry regarding patient discovery trends.'
      }
    ]
  },
  {
    id: 'saas-seo',
    name: 'SaaS SEO',
    icon: '💻',
    description: 'Specialized organic growth architecture for software and B2B platforms: comparison hubs, alternatives, integrations, and free tools.',
    subcategories: [
      {
        id: 'programmatic-seo',
        name: 'Programmatic SEO',
        description: 'Deploying hundreds of high-quality, templated landing pages targeting "[Service] in [City]" or "[Tool] for [Industry]".',
        tools: ['whalesync-programmatic', 'google-sheets', 'screaming-frog'],
        deliverable: 'Programmatic Database Schema (.csv) & Modular Page Template.',
        workflow_prompt: '/assign Create programmatic page template mapping 22 cities and dental specialties from harness data.'
      },
      {
        id: 'comparison-pages',
        name: 'Comparison Pages',
        description: '"Brand A vs Brand B" comparison hubs capturing late-stage buyers evaluating alternative solutions before buying.',
        tools: ['surfer-seo', 'semrush-suite'],
        deliverable: 'Feature-by-Feature Comparison Matrix & Page Copy.',
        workflow_prompt: '/assign Draft objective comparison page pitting client offer against traditional agency retainers.'
      },
      {
        id: 'alternative-pages',
        name: 'Alternative Pages',
        description: '"Top 10 Alternatives to [Competitor]" capturing churned or dissatisfied customers actively seeking a replacement.',
        tools: ['ahrefs-suite', 'copy-ai'],
        deliverable: 'Alternatives Pillar Guide with comparison table.',
        workflow_prompt: '/assign Write "Top Alternatives to Generic Agency Contracts" highlighting asset ownership advantages.'
      },
      {
        id: 'integration-pages',
        name: 'Integration Pages',
        description: 'Dedicated pages detailing compatibility with third-party software (e.g. Dentrix, Curve Dental, Hostinger, Google Calendar).',
        tools: ['surfer-seo', 'screaming-frog'],
        deliverable: 'Software Integration Showcase Page Copy & Schema.',
        workflow_prompt: '/assign Draft integration pages explaining workflow compatibility with clinic practice software.'
      },
      {
        id: 'feature-pages',
        name: 'Feature Pages',
        description: 'Deep-dive product feature pages targeting specific functional queries and problem-aware searchers.',
        tools: ['surfer-seo', 'clearscope-content'],
        deliverable: 'Feature Showcase Landing Page Copy & Visual Mockups.',
        workflow_prompt: '/assign Build feature landing page detailing the AI Growth Agent daily reporting and review monitoring engine.'
      },
      {
        id: 'free-tools',
        name: 'Free Tools',
        description: 'Lightweight free browser calculators, audit widgets, or previewers driving bottom-funnel organic backlinks and leads.',
        tools: ['whalesync-programmatic', 'google-analytics-4'],
        deliverable: 'Interactive Web Tool HTML/JS Component.',
        workflow_prompt: '/assign Create interactive "Clinic Search Potential Calculator" providing instant personalized estimates.'
      }
    ]
  },
  {
    id: 'ai-seo',
    name: 'AI SEO & GEO Optimization',
    icon: '🤖',
    description: 'Generative Engine Optimization (GEO): securing authoritative mentions, quotations, and brand citations inside AI search models.',
    subcategories: [
      {
        id: 'ai-search-visibility',
        name: 'AI Search Visibility',
        description: 'Measuring brand appearance rates across Perplexity, ChatGPT Search, Gemini, and Google AI Overviews for core keywords.',
        tools: ['perplexity-ai', 'openai-chatgpt', 'google-gemini'],
        deliverable: 'AI Model Presence & Visibility Index Scorecard.',
        workflow_prompt: '/assign Audit brand presence in Perplexity and ChatGPT for regional search queries and benchmark citations.'
      },
      {
        id: 'chatgpt-optimization',
        name: 'ChatGPT Optimization',
        description: 'Structuring content with definitive entity definitions, tables, and statistics that OpenAI models cite when answering queries.',
        tools: ['openai-chatgpt', 'surfer-seo'],
        deliverable: 'ChatGPT-Optimized Knowledge Snippets & Entity Definitions.',
        workflow_prompt: '/assign Format clinic value proposition into concise, citable factual definitions for LLM ingestion.'
      },
      {
        id: 'ai-mode-overviews',
        name: 'AI Mode / Overviews',
        description: 'Targeting Google Search Generative Experience (SGE) / AI Overviews with structured summary cards and FAQ schema.',
        tools: ['google-search-console', 'schema-org-validator'],
        deliverable: 'AI Overview Ingestion Blueprint with concise definitions.',
        workflow_prompt: '/assign Craft 40-word direct answers formatted to win inclusion in Google AI Overviews.'
      },
      {
        id: 'gemini-visibility',
        name: 'Gemini Visibility',
        description: 'Optimizing for Google Gemini Live and Workspace search integrations via Google Business Profile, Maps, and YouTube citations.',
        tools: ['google-gemini', 'google-business-profile'],
        deliverable: 'Gemini Ecosystem Optimization Strategy Document.',
        workflow_prompt: '/assign Optimize Google Business Profile description and category tags for Gemini assistant recommendations.'
      },
      {
        id: 'claude-visibility',
        name: 'Claude Visibility',
        description: 'Ensuring technical documents, PDFs, and deep research whitepapers are cleanly structured for Anthropic Claude comprehension.',
        tools: ['claude-ai', 'surfer-seo'],
        deliverable: 'Technical Whitepaper & Markdown Summary for Claude citation.',
        workflow_prompt: '/assign Structure service protocols into clean Markdown tables optimized for Claude extraction.'
      },
      {
        id: 'brand-mentions',
        name: 'Brand Mentions',
        description: 'Generating organic co-occurrences of brand name alongside industry category keywords across Reddit, Quora, and forums.',
        tools: ['semrush-suite', 'ahrefs-suite'],
        deliverable: 'Community Discussion & Brand Co-Occurrence Plan.',
        workflow_prompt: '/assign Map top Reddit and community threads discussing local dental care and outline helpful expert responses.'
      },
      {
        id: 'ai-citations',
        name: 'AI Citations',
        description: 'Tracking exact source URLs cited in AI answers and optimizing client domain to become the primary cited authority.',
        tools: ['perplexity-ai', 'openai-chatgpt'],
        deliverable: 'AI Citation Source Log & Optimization Recommendations.',
        workflow_prompt: '/assign Query Perplexity for local dental treatment costs and identify which domain sources it currently cites.'
      }
    ]
  },
  {
    id: 'international-seo',
    name: 'International SEO',
    icon: '🌍',
    description: 'Cross-border search targeting: hreflang tag implementation, ccTLDs, subfolder architectures, and cultural keyword localization.',
    subcategories: [
      {
        id: 'multilingual-seo',
        name: 'Multilingual SEO',
        description: 'Implementing rel="alternate" hreflang="x" tags across English, French, and regional languages with zero self-canonical errors.',
        tools: ['screaming-frog', 'deepl-translation'],
        deliverable: 'Validated Hreflang Tag Mapping Matrix.',
        workflow_prompt: '/assign Generate hreflang tag mapping for English (en-CA) and French (fr-CA) bilingual clinic pages.'
      },
      {
        id: 'country-targeting',
        name: 'Country Targeting',
        description: 'Setting geographic targets in Google Search Console, local server hosting, and regional phone/currency formatting.',
        tools: ['google-search-console', 'cloudflare-dns'],
        deliverable: 'Geo-Targeting Technical Audit & CDN Configuration.',
        workflow_prompt: '/assign Configure regional NAP (Name, Address, Phone) format and local currency tags for Canadian clinics.'
      },
      {
        id: 'translation-seo',
        name: 'Translation SEO',
        description: 'Transcreating content with local idioms and real search query volume rather than word-for-word machine translation.',
        tools: ['deepl-translation', 'semrush-suite'],
        deliverable: 'Localized Translation Copy with keyword verification.',
        workflow_prompt: '/assign Transcreate landing page copy into French Canadian with verified local keyword search volumes.'
      }
    ]
  },
  {
    id: 'seo-analytics',
    name: 'SEO Analytics & Attribution',
    icon: '📈',
    description: 'Measuring organic ROI: Search Console rank tracking, GA4 event pipelines, Bing Webmaster tools, and revenue attribution.',
    subcategories: [
      {
        id: 'search-console',
        name: 'Search Console',
        description: 'Extracting queries with high impressions but low CTR (positions 4-15) for immediate content updates.',
        tools: ['google-search-console', 'looker-studio'],
        deliverable: 'Search Console Query Opportunity Report (Underperforming Striking-Distance Keywords).',
        workflow_prompt: '/assign Extract queries ranking positions 5-15 with >500 monthly impressions for title and content refresh.'
      },
      {
        id: 'google-analytics',
        name: 'Google Analytics',
        description: 'Tracking organic landing page sessions, scroll depth, form submission conversions, and bounce behavior in GA4.',
        tools: ['google-analytics-4', 'looker-studio'],
        deliverable: 'GA4 Custom Exploration Dashboard & Conversion Report.',
        workflow_prompt: '/assign Configure GA4 custom events for appointment booking submissions and call clicks.'
      },
      {
        id: 'bing-webmaster-tools',
        name: 'Bing Webmaster Tools',
        description: 'Indexing validation and Bing search queries (capturing Copilot integration and Windows desktop users).',
        tools: ['bing-webmaster'],
        deliverable: 'Bing Indexation & Search Performance Summary.',
        workflow_prompt: '/assign Submit sitemaps to Bing Webmaster Tools and inspect IndexNow automated submission status.'
      },
      {
        id: 'conversion-tracking',
        name: 'Conversion Tracking',
        description: 'Call tracking, lead form completion, and consultation booking goal mapping back to organic entry URLs.',
        tools: ['google-analytics-4', 'google-search-console'],
        deliverable: 'Organic Conversion Funnel Audit & Goal Value Matrix.',
        workflow_prompt: '/assign Map conversion tracking tags across all CTA buttons on the active landing page.'
      },
      {
        id: 'revenue-attribution',
        name: 'Revenue Attribution',
        description: 'Multi-touch attribution models connecting first organic search click to signed client contracts and revenue.',
        tools: ['looker-studio', 'google-sheets'],
        deliverable: 'Closed-Loop Revenue Attribution Report.',
        workflow_prompt: '/assign Generate pipeline attribution model showing revenue generated per organic ranking asset.'
      },
      {
        id: 'seo-reporting',
        name: 'SEO Reporting',
        description: 'Automated executive monthly summaries: ranking improvements, traffic gains, leads acquired, and next sprint priorities.',
        tools: ['looker-studio', 'google-search-console'],
        deliverable: 'Executive SEO Performance Dashboard (PDF & Live Link).',
        workflow_prompt: '/assign Compile executive monthly SEO performance brief with month-over-month growth charts.'
      }
    ]
  },
  {
    id: 'seo-tools',
    name: 'SEO Tools & Suite Management',
    icon: '🛠️',
    description: 'Centralized administration of all industry-standard software: Ahrefs, SEMrush, Screaming Frog, and Surfer SEO.',
    subcategories: [
      {
        id: 'ahrefs',
        name: 'Ahrefs',
        description: 'Backlink profile auditing, Domain Rating (DR) monitoring, broken outbound link scanning, and keyword explorer.',
        tools: ['ahrefs-suite'],
        deliverable: 'Ahrefs Backlink Profile Diagnostic & Anchor Text Diversity Report.',
        workflow_prompt: '/assign Check backlink velocity and anchor text distribution in Ahrefs for target domain.'
      },
      {
        id: 'semrush',
        name: 'SEMrush',
        description: 'Keyword Magic tool queries, Organic Research competitor benchmarks, and automated Site Audit tracking.',
        tools: ['semrush-suite'],
        deliverable: 'SEMrush Site Health & Competitor Keyword Overview.',
        workflow_prompt: '/assign Run SEMrush competitive analysis to identify high-value competitor PPC & SEO keywords.'
      },
      {
        id: 'screaming-frog',
        name: 'Screaming Frog',
        description: 'Desktop and cloud website spider crawling up to 500,000 URLs for technical errors, redirects, and missing tags.',
        tools: ['screaming-frog'],
        deliverable: 'Screaming Frog Technical Crawl Export & Error Remediation List.',
        workflow_prompt: '/assign Execute Screaming Frog crawl configuration targeting status codes, meta tags, and H1s.'
      },
      {
        id: 'surfer-seo',
        name: 'Surfer SEO',
        description: 'Real-time NLP Content Editor with word count benchmarks, heading recommendations, and structural scoring.',
        tools: ['surfer-seo'],
        deliverable: 'Surfer Content Guidelines & Real-Time Optimization Score.',
        workflow_prompt: '/assign Generate Surfer SEO content guidelines for target topic with entity term density targets.'
      },
      {
        id: 'seo-wins-tools',
        name: 'SEO Wins Tracker',
        description: 'Logging quick-win ranking jumps, newly acquired featured snippets, and top-converting keyword milestones.',
        tools: ['google-search-console', 'looker-studio'],
        deliverable: 'Weekly Quick-Wins Scorecard with ranking delta badges.',
        workflow_prompt: '/assign Compile weekly wins report highlighting keywords that jumped into top 3 positions.'
      }
    ]
  },
  {
    id: 'seo-automation',
    name: 'SEO Automation & Workflows',
    icon: '⚡',
    description: 'Automated n8n and Python pipelines: daily rank alerts, automated technical audits, programmatic link detection, and schema builders.',
    subcategories: [
      {
        id: 'scripts',
        name: 'Scripts',
        description: 'Custom Python and Node.js automation scripts for bulk SERP scraping, sitemap validation, and broken link checkers.',
        tools: ['n8n-automation-engine', 'github-automation'],
        deliverable: 'Production Python/Node.js SEO Automation Script.',
        workflow_prompt: '/assign Write a Node.js script to validate response codes for all URLs in sitemap.xml daily.'
      },
      {
        id: 'workflows',
        name: 'Workflows',
        description: 'n8n autonomous pipelines triggered by new blog publication to automatically ping Indexing APIs, post to socials, and submit sitemaps.',
        tools: ['n8n-automation-engine', 'google-search-console'],
        deliverable: 'n8n Production Workflow JSON & Execution Webhook.',
        workflow_prompt: '/assign Build n8n workflow that notifies team in Slack when any core keyword drops out of top 5.'
      },
      {
        id: 'audits',
        name: 'Audits',
        description: 'Weekly scheduled automated technical SEO crawls posting issue summaries directly to the project dashboard.',
        tools: ['screaming-frog', 'n8n-automation-engine'],
        deliverable: 'Automated Weekly Technical Health Audit.',
        workflow_prompt: '/assign Schedule weekly automated crawl checking for broken internal links and 500 server errors.'
      },
      {
        id: 'link-automation',
        name: 'Link Automation',
        description: 'Automated monitoring of acquired backlinks: pinging lost links and alerting operator when a link is removed.',
        tools: ['ahrefs-suite', 'n8n-automation-engine'],
        deliverable: 'Backlink Monitor Alert Pipeline.',
        workflow_prompt: '/assign Set up webhook alert tracking lost backlinks to initiate prompt recovery outreach.'
      },
      {
        id: 'schema-automation',
        name: 'Schema Automation',
        description: 'Dynamic schema generation from CMS database fields (injecting author bios, medical reviewer credentials, and publication dates).',
        tools: ['n8n-automation-engine', 'schema-org-validator'],
        deliverable: 'Dynamic Schema Injection Script.',
        workflow_prompt: '/assign Create automated JSON-LD generator dynamically pulling dentist bio and clinic credentials.'
      }
    ]
  },
  {
    id: 'seo-penalties',
    name: 'SEO Penalties & Algorithm Recovery',
    icon: '🛡️',
    description: 'Protecting websites against Google core updates, unhelpful content flags, manual actions, and toxic backlink spam.',
    subcategories: [
      {
        id: 'manual-actions',
        name: 'Manual Actions',
        description: 'Reviewing Search Console Security & Manual Actions tab, identifying violation causes, and preparing reconsideration requests.',
        tools: ['google-search-console'],
        deliverable: 'Manual Action Diagnostic & Formal Reconsideration Letter.',
        workflow_prompt: '/assign Inspect Search Console manual actions tab and draft formal reconsideration request with proof of remediation.'
      },
      {
        id: 'algorithm-updates',
        name: 'Algorithm Updates',
        description: 'Correlating organic traffic drops with confirmed Google Core Updates, Helpful Content Updates, and Spam Updates.',
        tools: ['google-search-console', 'google-analytics-4', 'semrush-suite'],
        deliverable: 'Google Core Update Impact Correlation Analysis.',
        workflow_prompt: '/assign Compare traffic timelines against recent Google algorithm update dates to isolate affected page clusters.'
      },
      {
        id: 'spam-policies',
        name: 'Spam Policies',
        description: 'Auditing against Google Search Essentials: eliminating keyword stuffing, cloaking, scraped content, and scaled AI spam.',
        tools: ['surfer-seo', 'screaming-frog'],
        deliverable: 'Search Essentials & Spam Policy Compliance Checklist.',
        workflow_prompt: '/assign Audit website for thin content and scaled text generation compliance with Google Search Essentials.'
      },
      {
        id: 'penalty-recovery',
        name: 'Penalty Recovery',
        description: 'Systematic remediation: pruning thin content, rewriting automated copy, disavowing toxic link networks, and reclaiming lost traffic.',
        tools: ['google-search-console', 'ahrefs-suite', 'surfer-seo'],
        deliverable: '90-Day Algorithm Recovery Roadmap & Content Pruning List.',
        workflow_prompt: '/assign Create 90-day recovery plan to refresh unhelpful content pages and prune zero-traffic URLs.'
      }
    ]
  },
  {
    id: 'seo-wins',
    name: 'SEO Wins & Fast Growth Hacks',
    icon: '🏆',
    description: 'High-leverage, fast-acting techniques: CTR title testing, internal link power routing, parasite SEO, and instant indexing.',
    subcategories: [
      {
        id: 'seo-hacks',
        name: 'SEO Hacks',
        description: 'Quick-win optimizations: bracket modifiers in titles ([2026 Guide]), PAA question hijacking, and table comparison snippets.',
        tools: ['google-search-console', 'surfer-seo'],
        deliverable: 'Quick-Win Optimization Matrix (Expected 20%+ CTR boost).',
        workflow_prompt: '/assign Apply high-CTR modifiers (e.g. [2026], [Pricing], [Verified]) to top 10 impression URLs.'
      },
      {
        id: 'ai-seo-hacks',
        name: 'AI SEO Hacks',
        description: 'Engineering clear factual definition paragraphs and statistics tables designed to be scraped by ChatGPT and Gemini search bots.',
        tools: ['perplexity-ai', 'openai-chatgpt'],
        deliverable: 'AI Answer Extraction Optimization Blocks.',
        workflow_prompt: '/assign Craft definition blocks answering core clinic questions formatted for direct LLM citation.'
      },
      {
        id: 'free-link-building',
        name: 'Free Link Building',
        description: 'Claiming high-DA profile citations, podcast interviews, local sponsorships, and open directory mentions at zero cost.',
        tools: ['hunter-io', 'google-search-console'],
        deliverable: 'Free High-DA Link Opportunity Directory (50+ sources).',
        workflow_prompt: '/assign Compile 30 authoritative free directories, local chamber citations, and podcast pitch targets.'
      },
      {
        id: 'content-optimization-wins',
        name: 'Content Optimization',
        description: 'Adding bulleted key takeaways, TL;DR summaries, and comparison tables to instantly boost dwell time and rank.',
        tools: ['surfer-seo', 'clearscope-content'],
        deliverable: 'Engagement Enhancement Snippets (TL;DR boxes, key stats).',
        workflow_prompt: '/assign Add executive summary box and comparison table to top organic landing page.'
      },
      {
        id: 'indexing-strategies',
        name: 'Indexing Strategies',
        description: 'Using Google Indexing API, social signal pings, and internal homepage link injection for new page indexing under 2 hours.',
        tools: ['google-search-console', 'n8n-automation-engine'],
        deliverable: 'Fast-Track Indexing Pipeline Execution Log.',
        workflow_prompt: '/assign Submit newly created URLs via Google Indexing API and verify server response code.'
      }
    ]
  },
  {
    id: 'growth',
    name: 'Growth & Business Scaling',
    icon: '🚀',
    description: 'Scaling organic search into predictable enterprise revenue: website acquisition, conversion rate optimization, and international expansion.',
    subcategories: [
      {
        id: 'organic-traffic',
        name: 'Organic Traffic',
        description: 'Building sustainable, compounding search traffic month-over-month through continuous topic cluster expansion.',
        tools: ['google-search-console', 'google-analytics-4'],
        deliverable: '12-Month Traffic Compounding Projections & Cluster Roadmap.',
        workflow_prompt: '/assign Model 12-month traffic growth trajectory across primary dental service clusters.'
      },
      {
        id: 'website-acquisition',
        name: 'Website Acquisition',
        description: 'Acquiring expiring or abandoned industry websites with existing authority and 301-redirecting them to accelerate ranking.',
        tools: ['ahrefs-suite', 'whois-lookup'],
        deliverable: 'Due Diligence Acquisition Scorecard for expired domains.',
        workflow_prompt: '/assign Analyze domain authority and backlink quality of potential acquisition targets.'
      },
      {
        id: 'conversion-optimization',
        name: 'Conversion Optimization',
        description: 'A/B testing lead forms, headline value propositions, sticky consultation bars, and trust signal badges to double page value.',
        tools: ['google-analytics-4', 'surfer-seo'],
        deliverable: 'CRO A/B Test Variant Layout & Uplift Report.',
        workflow_prompt: '/assign Optimize landing page conversion architecture with social proof, guarantee badge, and instant CTA.'
      },
      {
        id: 'revenue-growth',
        name: 'Revenue Growth',
        description: 'Connecting organic traffic directly to pipeline ARR, client customer acquisition cost (CAC), and lifetime value (LTV).',
        tools: ['looker-studio', 'google-sheets'],
        deliverable: 'Executive Organic Revenue Dashboard (CAC & LTV Analysis).',
        workflow_prompt: '/assign Calculate customer acquisition cost and lifetime value generated from organic search pipeline.'
      },
      {
        id: 'seo-scaling',
        name: 'SEO Scaling',
        description: 'Standardizing autonomous agent workflows to launch 10+ niche ventures and local client campaigns simultaneously.',
        tools: ['n8n-automation-engine', 'whalesync-programmatic'],
        deliverable: 'Autonomous Multi-Client SEO Playbook & Operational SOP.',
        workflow_prompt: '/assign Codify standardized agent loop SOP to launch new client SEO campaigns in under 48 hours.'
      }
    ]
  }
];

function getFlatSeoSubcategories() {
  const list = [];
  SEO_STRUCTURE.forEach(cat => {
    cat.subcategories.forEach(sub => {
      list.push({
        ...sub,
        category_id: cat.id,
        category_name: cat.name,
        category_icon: cat.icon
      });
    });
  });
  return list;
}

module.exports = { SEO_STRUCTURE, getFlatSeoSubcategories };
