const path = require('path');
const { v4: uuidv4 } = require('uuid');
let _db = null;
function getDb() {
  if (!_db) _db = require('./db');
  return _db;
}

const SEEDED_LOGINS = [
  // 1. Email & Outbound
  {
    name: 'Hostinger Webmail & Cold SMTP',
    slug: 'hostinger-mail',
    category: 'Email & Outreach',
    website_url: 'https://mail.hostinger.com',
    username: 'outreach@valioz.com',
    password: 'Hostinger#Secure2026!',
    api_key: 'smtp_auth_token_465_ssl',
    notes: 'Used in Module 08 email sequence dispatch & cold outbound outreach. Host: smtp.hostinger.com (Port 465 SSL), IMAP: imap.hostinger.com (Port 993).',
    status: 'connected',
    metadata: JSON.stringify({
      provider: 'Hostinger',
      smtp_host: 'smtp.hostinger.com',
      smtp_port: 465,
      imap_host: 'imap.hostinger.com',
      imap_port: 993,
      daily_quota: 500,
      spf_dkim_dmarc: 'VERIFIED'
    })
  },
  {
    name: 'Gmail & Google Workspace API',
    slug: 'gmail-workspace',
    category: 'Google Workspace',
    website_url: 'https://mail.google.com',
    username: 'ibrahim.zed24@gmail.com',
    password: 'GSuite#IbrahimPass2026',
    api_key: 'google_oauth2_app_token_placeholder',
    notes: 'Primary operator communication, client inbound alert forwarding, and OAuth2 token delivery for Google Workspace integrations.',
    status: 'connected',
    metadata: JSON.stringify({
      account_type: 'Google Workspace / Business Standard',
      oauth2_enabled: true,
      forwarding_filter: 'Active'
    })
  },
  {
    name: 'Hunter.io Email Finder & Verifier',
    slug: 'hunter-io',
    category: 'Email & Outreach',
    website_url: 'https://hunter.io',
    username: 'outreach@valioz.com',
    password: 'Hunter#OutreachKey2026',
    api_key: 'hunt_live_8390bcaefd91',
    notes: 'Domain search and deliverability verification for Canadian clinic directors and healthcare founders.',
    status: 'connected',
    metadata: JSON.stringify({
      monthly_searches: 2500,
      confidence_threshold: '90%',
      smtp_check: 'Enabled'
    })
  },
  {
    name: 'Connectively / HARO PR Outbound',
    slug: 'connectively-haro',
    category: 'PR & Link Building',
    website_url: 'https://app.connectively.us',
    username: 'media@valioz.com',
    password: 'Connectively#PR2026',
    api_key: 'haro_media_tok_9918',
    notes: 'High-authority media pitch dispatch to journalists from Forbes, Healthline, and Canadian business press for DR 70+ backlinks.',
    status: 'connected',
    metadata: JSON.stringify({
      pitch_quota: 'Unlimited',
      alert_topics: ['Healthcare', 'Dental Tech', 'SaaS', 'Business Growth']
    })
  },
  {
    name: 'BuzzStream Link Outreach CRM',
    slug: 'buzzstream-crm',
    category: 'PR & Link Building',
    website_url: 'https://app.buzzstream.com',
    username: 'outreach@valioz.com',
    password: 'Buzz#StreamLink2026',
    api_key: 'bz_api_token_valioz_core',
    notes: 'Manages publisher relationship pipelines, unlinked brand mention claims, and guest post editorial tracking.',
    status: 'connected',
    metadata: JSON.stringify({
      active_campaigns: ['Dental Authority Q2', 'SaaS Linkable Assets'],
      team_seats: 5
    })
  },
  {
    name: 'Pitchbox Outreach Automation',
    slug: 'pitchbox-pr',
    category: 'PR & Link Building',
    website_url: 'https://pitchbox.com',
    username: 'outreach@valioz.com',
    password: 'Pitchbox#MasterKey2026',
    api_key: 'pb_enterprise_token_4819',
    notes: 'Enterprise outreach personalization, automatic follow-ups, and link prospect prospecting for high-DR sites.',
    status: 'connected',
    metadata: JSON.stringify({
      inbox_rotation: ['outreach@valioz.com', 'partners@valioz.com'],
      daily_send_limit: 400
    })
  },

  // 2. Google Workspace & Search Infrastructure
  {
    name: 'Google Search Console',
    slug: 'google-search-console',
    category: 'SEO & Search',
    website_url: 'https://search.google.com/search-console',
    username: 'ibrahim.zed24@gmail.com',
    password: 'SearchConsole#Auth2026',
    api_key: 'gsc_api_read_write_v3',
    notes: 'Organic search performance monitoring, index coverage audits, click-through analysis, and sitemap crawling for client domains.',
    status: 'connected',
    metadata: JSON.stringify({
      verified_properties: ['https://health.valioz.com', 'https://nilesupplies.com'],
      indexing_api: 'Enabled'
    })
  },
  {
    name: 'Google Ads Keyword Planner',
    slug: 'google-keyword-planner',
    category: 'SEO & Search',
    website_url: 'https://ads.google.com/aw/keywordplanner',
    username: 'ibrahim.zed24@gmail.com',
    password: 'GoogleAds#Planner2026!',
    api_key: 'gads_dev_token_8892',
    notes: 'Authoritative monthly search volume estimates (e.g. 1K-10K Canadian dentist searches), CPC bids, and high-yield treatment keyword extraction.',
    status: 'connected',
    metadata: JSON.stringify({
      customer_id: '492-819-2041',
      default_geo: 'Canada / Ontario / British Columbia',
      currency: 'CAD'
    })
  },
  {
    name: 'Google Calendar API',
    slug: 'google-calendar',
    category: 'Google Workspace',
    website_url: 'https://calendar.google.com',
    username: 'ibrahim.zed24@gmail.com',
    password: 'Calendar#SyncSecure2026',
    api_key: 'gcal_oauth_refresh_token_v4',
    notes: 'Automated consultation scheduling for qualified clinic leads who reply YES to email campaigns. Embeds meeting links via n8n webhook.',
    status: 'connected',
    metadata: JSON.stringify({
      calendar_id: 'primary',
      booking_duration_mins: 20,
      buffer_mins: 10,
      timezone: 'America/Toronto'
    })
  },
  {
    name: 'Google Sheets CRM & Lead Sync',
    slug: 'google-sheets',
    category: 'Google Workspace',
    website_url: 'https://docs.google.com/spreadsheets',
    username: 'ibrahim.zed24@gmail.com',
    password: 'Sheets#SyncKey2026',
    api_key: 'gsheet_service_acc_key_json',
    notes: 'Bidirectional sync for raw lead datasets (Priority_A_Outreach_Email_Merge_Fields.csv, Clinic Intelligence) and executive reporting sheets.',
    status: 'connected',
    metadata: JSON.stringify({
      connected_sheets: ['Priority_A_Outreach_Leads', 'Clinic_Intelligence_Master'],
      service_account: 'marketing-os-sync@appspot.gserviceaccount.com'
    })
  },
  {
    name: 'Google Analytics 4 (GA4)',
    slug: 'google-analytics-4',
    category: 'Analytics & Measurement',
    website_url: 'https://analytics.google.com',
    username: 'ibrahim.zed24@gmail.com',
    password: 'GA4#AnalyticsToken2026',
    api_key: 'G-MEASUREMENT_ID_9901',
    notes: 'Conversion tracking, visitor event telemetry, landing page bounce rate analysis, and UTM attribution across campaigns.',
    status: 'connected',
    metadata: JSON.stringify({
      property_id: 'properties/384910291',
      data_stream: 'Web Stream'
    })
  },
  {
    name: 'Google Business Profile Manager',
    slug: 'google-business-profile',
    category: 'SEO & Search',
    website_url: 'https://business.google.com',
    username: 'ibrahim.zed24@gmail.com',
    password: 'GBP#VerifiedAdmin2026',
    api_key: 'gbp_mybusiness_api_v4',
    notes: 'Local 3-Pack Maps rankings, review management, geo-tagged photo uploads, and clinic address verification.',
    status: 'connected',
    metadata: JSON.stringify({
      location_groups: ['Valioz Partner Clinics'],
      auto_reply_reviews: true
    })
  },
  {
    name: 'Google PageSpeed Insights & Web Vitals',
    slug: 'google-pagespeed',
    category: 'Technical & Web Vitals',
    website_url: 'https://pagespeed.web.dev',
    username: 'ibrahim.zed24@gmail.com',
    password: 'PageSpeed#ApiAccess2026',
    api_key: 'google_pagespeed_api_key_placeholder',
    notes: 'Core Web Vitals measurement: LCP (< 2.5s), INP (< 200ms), and CLS (< 0.1) for desktop and mobile performance.',
    status: 'connected',
    metadata: JSON.stringify({
      audit_modes: ['mobile', 'desktop'],
      target_lighthouse_score: 95
    })
  },
  {
    name: 'Google Looker Studio Dashboards',
    slug: 'looker-studio',
    category: 'Analytics & Measurement',
    website_url: 'https://lookerstudio.google.com',
    username: 'ibrahim.zed24@gmail.com',
    password: 'Looker#ExecutiveReports2026',
    api_key: 'looker_dashboard_embed_key',
    notes: 'Automated executive monthly SEO & revenue attribution dashboards combining GSC, GA4, and CRM deal value.',
    status: 'connected',
    metadata: JSON.stringify({
      report_templates: ['Client Executive ROI', 'SEO 14-Branch Progress'],
      auto_refresh: 'daily'
    })
  },

  // 3. Professional SEO & Competitive Intelligence Suites
  {
    name: 'Ahrefs All-in-One SEO Suite',
    slug: 'ahrefs-suite',
    category: 'SEO & Search',
    website_url: 'https://app.ahrefs.com',
    username: 'seo-lead@valioz.com',
    password: 'Ahrefs#EnterprisePass2026',
    api_key: 'ahrefs_api_v3_token_8820',
    notes: 'Backlink profile auditing, Domain Rating (DR) inspection, Keyword Gap tearing, and Site Explorer live crawls.',
    status: 'connected',
    metadata: JSON.stringify({
      plan: 'Enterprise',
      tracked_keywords: 5000,
      export_formats: ['CSV', 'PDF', 'API']
    })
  },
  {
    name: 'SEMrush Online Visibility Suite',
    slug: 'semrush-suite',
    category: 'SEO & Search',
    website_url: 'https://www.semrush.com',
    username: 'semrush@valioz.com',
    password: 'SEMrush#Visibility2026',
    api_key: 'semrush_live_api_key_4490',
    notes: 'Competitor organic research, position tracking, PLA advertising spy, and historical SERP feature volatility tracking.',
    status: 'connected',
    metadata: JSON.stringify({
      plan: 'Guru + Trends',
      daily_reports: 3000,
      keyword_database: 'Canada & USA'
    })
  },
  {
    name: 'Screaming Frog SEO Spider (Headless CLI)',
    slug: 'screaming-frog',
    category: 'Technical & Web Vitals',
    website_url: 'https://www.screamingfrog.co.uk',
    username: 'devops@valioz.com',
    password: 'Frog#HeadlessSpider2026',
    api_key: 'sf_license_key_corporate_992',
    notes: 'Full technical website crawls: broken links, redirect chains, canonical anomalies, orphan pages, and hreflang tag validation.',
    status: 'connected',
    metadata: JSON.stringify({
      max_crawl_urls: 500000,
      js_rendering: 'Chrome Headless',
      export_target: '/uploads/crawls/'
    })
  },
  {
    name: 'Surfer SEO Content Intelligence',
    slug: 'surfer-seo',
    category: 'Content & Copywriting',
    website_url: 'https://app.surferseo.com',
    username: 'copy@valioz.com',
    password: 'Surfer#ContentEditor2026',
    api_key: 'surfer_guidelines_api_token',
    notes: 'Real-time NLP term frequency, structural heading length recommendations, and Content Score 85+ optimization.',
    status: 'connected',
    metadata: JSON.stringify({
      target_score: 85,
      audit_preset: 'Top 10 SERP Competitors',
      plagiarism_check: 'Enabled'
    })
  },
  {
    name: 'Clearscope Content Optimization',
    slug: 'clearscope-content',
    category: 'Content & Copywriting',
    website_url: 'https://www.clearscope.io',
    username: 'copy@valioz.com',
    password: 'Clearscope#Editorial2026',
    api_key: 'cs_api_token_enterprise_91',
    notes: 'Semantic entity grading (A++ to F), readability benchmarks, and search intent alignment for pillar articles.',
    status: 'connected',
    metadata: JSON.stringify({
      target_grade: 'A+',
      keyword_intent_clustering: true
    })
  },
  {
    name: 'Frase.io AI Briefs & Content Architecture',
    slug: 'frase-seo',
    category: 'Content & Copywriting',
    website_url: 'https://www.frase.io',
    username: 'copy@valioz.com',
    password: 'Frase#BriefMaster2026',
    api_key: 'frase_ai_token_7721',
    notes: 'Automated 1-click SEO content briefs, People-Also-Ask question harvesting, and heading architecture outlines.',
    status: 'connected',
    metadata: JSON.stringify({
      brief_preset: 'Enterprise B2B / Medical Clinic',
      export_format: 'Markdown / HTML'
    })
  },
  {
    name: 'LowFruits KGR Keyword Analyzer',
    slug: 'lowfruits-kgr',
    category: 'SEO & Search',
    website_url: 'https://lowfruits.io',
    username: 'seo-lead@valioz.com',
    password: 'LowFruits#KGRPass2026',
    api_key: 'lf_kgr_token_49182',
    notes: 'Keyword Golden Ratio (< 0.25) query discovery where low-DA or UGC forums rank, allowing instant page 1 ranking.',
    status: 'connected',
    metadata: JSON.stringify({
      serp_extract_depth: 10,
      weak_spot_filter: ['Reddit', 'Quora', 'Medium', 'Forum']
    })
  },
  {
    name: 'AnswerThePublic Search Intent Harvester',
    slug: 'answerthepublic',
    category: 'SEO & Search',
    website_url: 'https://answerthepublic.com',
    username: 'seo-lead@valioz.com',
    password: 'ATP#SearchIntent2026',
    api_key: 'atp_intent_api_591',
    notes: 'Raw customer search intent visualizer: What, Why, How, Cost, Where questions for FAQs and PAA rich snippets.',
    status: 'connected',
    metadata: JSON.stringify({
      country: 'CA',
      language: 'en'
    })
  },

  // 4. AI & Next-Gen Search (GEO - Generative Engine Optimization)
  {
    name: 'OpenAI ChatGPT Plus & Enterprise API',
    slug: 'openai-chatgpt',
    category: 'AI & LLM Engines',
    website_url: 'https://chatgpt.com',
    username: 'ai-ops@valioz.com',
    password: 'OpenAI#EnterprisePass2026',
    api_key: 'sk-proj-9948190248102830192',
    notes: 'Powers AI Search Visibility audits, SearchGPT citation targeting, and semantic synthesis across marketing funnels.',
    status: 'connected',
    metadata: JSON.stringify({
      model: 'gpt-4o',
      searchgpt_optimization: 'Enabled',
      token_limit: 128000
    })
  },
  {
    name: 'Anthropic Claude Pro & Opus 5.5 API',
    slug: 'claude-ai',
    category: 'AI & LLM Engines',
    website_url: 'https://claude.ai',
    username: 'ai-ops@valioz.com',
    password: 'Claude#ThinkingPro2026',
    api_key: 'sk-ant-api03-opus-5-5-preview',
    notes: 'Deep reasoning, complex copywriting, tone matching, and multi-turn architectural planning.',
    status: 'connected',
    metadata: JSON.stringify({
      model: 'claude-3-opus-20240229',
      extended_thinking: 'Enabled'
    })
  },
  {
    name: 'Google Gemini Advanced & AI Studio',
    slug: 'google-gemini',
    category: 'AI & LLM Engines',
    website_url: 'https://gemini.google.com',
    username: 'ibrahim.zed24@gmail.com',
    password: 'Gemini#AdvancedStudio2026',
    api_key: 'gemini_pro_vision_key_placeholder',
    notes: 'Google AI Overviews (SGE) optimization, multimodal harness parsing, and local entity vectorization.',
    status: 'connected',
    metadata: JSON.stringify({
      model: 'gemini-1.5-pro',
      context_window: 1000000
    })
  },
  {
    name: 'Perplexity AI Pro Research Engine',
    slug: 'perplexity-ai',
    category: 'AI & LLM Engines',
    website_url: 'https://www.perplexity.ai',
    username: 'research@valioz.com',
    password: 'Perplexity#ResearchPro2026',
    api_key: 'pplx-889102481029102',
    notes: 'Real-time citation tracking, brand mention queries in Perplexity answers, and competitive source analysis.',
    status: 'connected',
    metadata: JSON.stringify({
      pro_search_quota: 600,
      domain_filters: ['valioz.com', 'canada.ca', 'cda-adc.ca']
    })
  },
  {
    name: 'Jasper AI Copywriting Platform',
    slug: 'jasper-ai',
    category: 'Content & Copywriting',
    website_url: 'https://app.jasper.ai',
    username: 'copy@valioz.com',
    password: 'Jasper#BrandVoice2026',
    api_key: 'jas_api_token_brand_voice_88',
    notes: 'Brand Voice enforcement, multi-channel promotional copywriting, and email hook generation.',
    status: 'connected',
    metadata: JSON.stringify({
      brand_voice_guidelines: 'Authoritative, Clinical, High-ROI',
      plagiarism_safe: true
    })
  },
  {
    name: 'Copy.ai GTM Automation',
    slug: 'copy-ai',
    category: 'Content & Copywriting',
    website_url: 'https://app.copy.ai',
    username: 'copy@valioz.com',
    password: 'CopyAI#GTMWorkflows2026',
    api_key: 'copy_jwt_token_99182',
    notes: 'Generates programmatic ad copy, cold email angles, and sales sequence messaging.',
    status: 'connected',
    metadata: JSON.stringify({
      workflows: ['Cold Outbound Hooks', 'Landing Page Headlines']
    })
  },
  {
    name: 'Grammarly Enterprise Tone & Style',
    slug: 'grammarly-enterprise',
    category: 'Content & Copywriting',
    website_url: 'https://app.grammarly.com',
    username: 'editorial@valioz.com',
    password: 'Grammarly#Enterprise2026',
    api_key: 'gram_sdk_enterprise_token',
    notes: 'Ensures clinical accuracy, zero grammatical errors, clarity, and tone consistency across all client deliverables.',
    status: 'connected',
    metadata: JSON.stringify({
      brand_tone: 'Direct, Confident, Professional',
      formality: 'High'
    })
  },

  // 5. Technical SEO, Schema, Performance & Translation
  {
    name: 'Schema.org & Rich Results Validator',
    slug: 'schema-org-validator',
    category: 'Technical & Web Vitals',
    website_url: 'https://validator.schema.org',
    username: 'dev@valioz.com',
    password: 'Schema#ValidatorKey2026',
    api_key: 'schema_linter_token_v1',
    notes: 'Validates JSON-LD schema syntax for MedicalBusiness, Dentist, LocalBusiness, FAQPage, and Review snippets.',
    status: 'connected',
    metadata: JSON.stringify({
      supported_schemas: ['LocalBusiness', 'MedicalClinic', 'Dentist', 'FAQPage', 'BreadcrumbList'],
      validation_standard: 'Schema.org v26.0'
    })
  },
  {
    name: 'TinyPNG & Squoosh Image Compression',
    slug: 'tinypng-squoosh',
    category: 'Technical & Web Vitals',
    website_url: 'https://tinypng.com',
    username: 'design@valioz.com',
    password: 'TinyPNG#ImageEngine2026',
    api_key: 'tp_api_key_compression_8819',
    notes: 'Automated lossy and lossless image compression to WebP and AVIF formats with EXIF preservation for local GEO tagging.',
    status: 'connected',
    metadata: JSON.stringify({
      output_formats: ['WebP', 'AVIF'],
      max_width_px: 1920,
      quality: 82
    })
  },
  {
    name: 'Bing Webmaster Tools & IndexNow',
    slug: 'bing-webmaster',
    category: 'Technical & Web Vitals',
    website_url: 'https://www.bing.com/webmasters',
    username: 'seo-lead@valioz.com',
    password: 'Bing#WebmasterKey2026',
    api_key: 'bing_indexnow_api_tok_772',
    notes: 'Instant URL indexing via IndexNow protocol for Bing and Yahoo search results, plus Bing Copilot visibility tracking.',
    status: 'connected',
    metadata: JSON.stringify({
      indexnow_key: 'b94f8910284910294102941029481920',
      auto_submit_on_publish: true
    })
  },
  {
    name: 'DeepL Pro Multilingual Translation',
    slug: 'deepl-translation',
    category: 'Content & Copywriting',
    website_url: 'https://www.deepl.com',
    username: 'intl-seo@valioz.com',
    password: 'DeepL#EnterprisePro2026',
    api_key: 'deepl_auth_key_v2_unlimited',
    notes: 'High-accuracy French (Canadian) and multilingual content translation preserving technical SEO tags and hreflang anchors.',
    status: 'connected',
    metadata: JSON.stringify({
      primary_target: 'fr-CA (French Canadian)',
      glossary_id: 'dental_healthcare_terms_ca'
    })
  },
  {
    name: 'Whalesync Programmatic SEO Engine',
    slug: 'whalesync-programmatic',
    category: 'Automation & AI',
    website_url: 'https://app.whalesync.com',
    username: 'dev@valioz.com',
    password: 'Whalesync#Programmatic2026',
    api_key: 'ws_api_token_sync_99182',
    notes: 'Two-way sync between Postgres/SQLite lead databases and Webflow/WordPress CMS to generate 500+ localized landing pages.',
    status: 'connected',
    metadata: JSON.stringify({
      sync_direction: 'Database -> Webflow CMS',
      batch_size: 100
    })
  },
  {
    name: 'ICANN WHOIS & Expired Domain Intel',
    slug: 'whois-lookup',
    category: 'SEO & Search',
    website_url: 'https://lookup.icann.org',
    username: 'domains@valioz.com',
    password: 'Whois#IntelTool2026',
    api_key: 'whois_xml_api_token_4810',
    notes: 'Audits competitor domain age, ownership history, historical DNS records, and evaluates expired high-DR domains for 301 redirects.',
    status: 'connected',
    metadata: JSON.stringify({
      rate_limit: '100 queries/day',
      audit_fields: ['Registrar', 'CreatedDate', 'ExpiryDate', 'Nameservers']
    })
  },

  // 6. Design, Visuals & Engineering Automation
  {
    name: 'Canva Enterprise Brand Visuals',
    slug: 'canva-visuals',
    category: 'Design & Visuals',
    website_url: 'https://www.canva.com',
    username: 'design@valioz.com',
    password: 'Canva#EnterpriseBrand2026',
    api_key: 'canva_connect_api_tok_991',
    notes: 'Automated brand kit generation, social media share preview images (OG:Image 1200x630), and infographic design assets.',
    status: 'connected',
    metadata: JSON.stringify({
      brand_kit_id: 'valioz_master_brand',
      og_image_template: 'og_dental_authority_v2'
    })
  },
  {
    name: 'GitHub Actions & SEO Automation Repo',
    slug: 'github-automation',
    category: 'Automation & AI',
    website_url: 'https://github.com',
    username: 'ibrahimzid',
    password: 'GitHub#DevOpsPass2026',
    api_key: 'github_automation_runner_key_placeholder',
    notes: 'Automated CI/CD workflows for scheduled Screaming Frog crawls, sitemap re-generation, and Lighthouse performance checks.',
    status: 'connected',
    metadata: JSON.stringify({
      repo: 'ibrahimzid/marketing-os-core',
      default_branch: 'main',
      cron_schedules: ['0 4 * * *']
    })
  },

  // 7. Advertising & Core Platform Infrastructure
  {
    name: 'Meta Ads Manager (Facebook & Instagram)',
    slug: 'meta-ads-manager',
    category: 'Advertising',
    website_url: 'https://adsmanager.facebook.com',
    username: 'ibrahim.zed24@gmail.com',
    password: 'Meta#AdsManagerSecure2026',
    api_key: 'EAABwz..._meta_graph_system_user_token',
    notes: 'B2B lead generation ads, local radius retargeting, and carousel creatives (Module 04 Ads Creative).',
    status: 'connected',
    metadata: JSON.stringify({
      business_id: '204918204910291',
      pixel_id: '9948192049102'
    })
  },
  {
    name: 'LinkedIn Campaign Manager',
    slug: 'linkedin-campaign-manager',
    category: 'Advertising',
    website_url: 'https://www.linkedin.com/campaignmanager',
    username: 'ibrahim.zed24@gmail.com',
    password: 'LinkedIn#AdsAccount2026!',
    api_key: 'li_oauth_marketing_dev_v2',
    notes: 'Account-Based Marketing (ABM) targeting clinic directors, practice principals, and healthcare procurement leaders.',
    status: 'connected',
    metadata: JSON.stringify({
      ad_account_id: '509281920',
      insight_tag: 'ACTIVE'
    })
  },
  {
    name: 'n8n Autonomous Workflow Engine',
    slug: 'n8n-automation-engine',
    category: 'Automation & AI',
    website_url: 'http://localhost:5678',
    username: 'admin',
    password: 'n8n#LocalMasterPassword2026',
    api_key: 'mos_live_98a7bc65d4e3f210',
    notes: 'Local autonomous pipeline execution engine (:5678), webhook dispatch, and multi-agent coordination.',
    status: 'connected',
    metadata: JSON.stringify({
      port: 5678,
      mode: 'webhook + stdio MCP',
      instance: 'Docker / Self-Hosted'
    })
  },
  {
    name: 'Supabase Cloud (PostgreSQL & Storage)',
    slug: 'supabase-cloud',
    category: 'Hosting & Infrastructure',
    website_url: 'https://app.supabase.com',
    username: 'ibrahim.zed24@gmail.com',
    password: 'Supabase#CloudDBPass2026',
    api_key: 'supabase_personal_token_placeholder',
    notes: 'Primary cloud database for Workforce OS documents, project vectors, and agent handovers.',
    status: 'connected',
    metadata: JSON.stringify({
      project_ref: 'jzyqmzjfmaceoltlqukh',
      postgrest_api: 'https://jzyqmzjfmaceoltlqukh.supabase.co'
    })
  },
  {
    name: 'Vercel Cloud Platform',
    slug: 'vercel-cloud',
    category: 'Hosting & Infrastructure',
    website_url: 'https://vercel.com',
    username: 'ibrahim.zed24@gmail.com',
    password: 'Vercel#DeployToken2026',
    api_key: 'vercel_cli_deploy_tok_8991',
    notes: 'Production deployment host for Sovereign Workforce OS (personal-ai-workforce-os-pi.vercel.app).',
    status: 'connected',
    metadata: JSON.stringify({
      project_id: 'prj_RStZNth77dQxR9EQaZfbEAyo0Ud8',
      org_id: 'team_1KJnPSPta9s6ql5i8stsN4At'
    })
  },
  {
    name: 'Cloudflare / DNS & Edge Security',
    slug: 'cloudflare-dns',
    category: 'Hosting & Infrastructure',
    website_url: 'https://dash.cloudflare.com',
    username: 'ibrahim.zed24@gmail.com',
    password: 'Cloudflare#EdgePass2026',
    api_key: 'cf_global_api_token_valioz',
    notes: 'DNS records, SSL/TLS certificates, SPF/DKIM TXT records for Hostinger webmail, and DDoS edge protection.',
    status: 'connected',
    metadata: JSON.stringify({
      zones: ['valioz.com', 'nilesupplies.com'],
      ssl_mode: 'Full (Strict)'
    })
  }
];

function seedLogins(customDb) {
  const activeDb = customDb || getDb();
  const insertStmt = activeDb.prepare(`
    INSERT INTO saved_logins (
      id, name, slug, category, website_url, username, password, api_key, notes, status, is_active, metadata, last_tested, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      website_url = excluded.website_url,
      username = excluded.username,
      password = excluded.password,
      api_key = excluded.api_key,
      notes = excluded.notes,
      status = excluded.status,
      metadata = excluded.metadata,
      updated_at = CURRENT_TIMESTAMP
  `);

  let count = 0;
  for (const l of SEEDED_LOGINS) {
    const id = uuidv4();
    insertStmt.run(
      id,
      l.name,
      l.slug,
      l.category,
      l.website_url,
      l.username,
      l.password,
      l.api_key || null,
      l.notes || '',
      l.status || 'connected',
      l.metadata || '{}'
    );
    count++;
  }

  console.log(`✅ Seeded ${count} saved logins & tool credentials into SQLite marketing-os.db`);
}

if (require.main === module) {
  seedLogins();
}

module.exports = { seedLogins, SEEDED_LOGINS };
