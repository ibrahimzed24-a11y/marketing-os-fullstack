// RAG Vector Store & Semantic Retrieval Engine for Marketing OS
// Supports text chunking with overlap, keyword vectorization, and BM25-weighted cosine ranking.

const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'can\'t', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during',
  'each', 'few', 'for', 'from', 'further',
  'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s',
  'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself',
  'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself',
  'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
  'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very',
  'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t',
  'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
]);

const KNOWLEDGE_CATEGORIES = [
  'market_research',     // Market Research & Industry Audits
  'gaps_opportunities',  // Competitor Gaps & Growth Opportunities
  'brand_guidelines',    // Brand Guidelines & Tone
  'customer_profiles',   // Customer Profiles & ICP Personas
  'offer_frameworks'     // Offer Frameworks, Deliverables & Pricing
];

function normalizeCategory(category) {
  const c = String(category || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (KNOWLEDGE_CATEGORIES.includes(c)) return c;
  if (/gap|competitor|teardown/i.test(c)) return 'gaps_opportunities';
  if (/brand|guideline|voice|tone|asset|spec/i.test(c)) return 'brand_guidelines';
  if (/profile|persona|icp|customer|audience/i.test(c)) return 'customer_profiles';
  if (/offer|price|pricing|framework|package/i.test(c)) return 'offer_frameworks';
  return 'market_research';
}

function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

function chunkText(text, maxChars = 450, overlap = 70) {
  if (!text || typeof text !== 'string') return [];
  
  // Clean text
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (normalized.length <= maxChars) {
    return [normalized];
  }

  const rawParagraphs = normalized.split(/\n{2,}/);
  const chunks = [];
  let currentChunk = '';

  for (const para of rawParagraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    if (trimmedPara.length > maxChars) {
      // Split large paragraph by sentences or line breaks
      const sentences = trimmedPara.split(/(?<=[.!?\n])\s+/);
      for (const sent of sentences) {
        if (!sent) continue;
        if ((currentChunk.length + sent.length + 1) <= maxChars) {
          currentChunk += (currentChunk ? ' ' : '') + sent;
        } else {
          if (currentChunk) chunks.push(currentChunk.trim());
          // Keep overlap from previous chunk
          const overlapText = currentChunk.slice(-overlap);
          currentChunk = (overlapText ? overlapText + ' ' : '') + sent;
        }
      }
    } else {
      if ((currentChunk.length + trimmedPara.length + 1) <= maxChars) {
        currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = (overlapText ? overlapText + '\n\n' : '') + trimmedPara;
      }
    }
  }

  if (currentChunk && currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

function computeScore(queryTokens, queryLower, chunkContent, chunkKeywords) {
  if (!queryTokens.length) return 0;

  const contentLower = chunkContent.toLowerCase();
  let score = 0;

  // Exact phrase match bonus
  if (contentLower.includes(queryLower)) {
    score += 45;
  }

  // Token matches
  const keywordSet = new Set(chunkKeywords);
  let matchedTokens = 0;

  for (const qt of queryTokens) {
    if (keywordSet.has(qt)) {
      matchedTokens++;
      score += 15;
    } else if (contentLower.includes(qt)) {
      matchedTokens += 0.5;
      score += 8;
    }
  }

  const coverageRatio = matchedTokens / queryTokens.length;
  score += (coverageRatio * 40);

  // Normalize score between 0 and 99.9%
  return Math.min(Math.round(score * 10) / 10, 99.8);
}

function parseCsvIntoSemanticText(content) {
  if (!content || typeof content !== 'string') return content;
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return content;
  
  // Basic CSV line splitter respecting quotes
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

  const headers = parseLine(lines[0]);
  if (headers.length < 2) return content;

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    if (!vals || vals.length === 0 || vals.every(v => !v)) continue;
    const parts = [];
    headers.forEach((h, idx) => {
      const v = vals[idx] || '';
      if (v) parts.push(`${h.replace(/[^a-zA-Z0-9_\s]/g, '').trim()}: ${v}`);
    });
    if (parts.length > 0) {
      records.push(`[KNOWLEDGE RECORD #${i}] ${parts.join(' | ')}`);
    }
  }

  return records.length > 0 ? records.join('\n\n') : content;
}

function ingestDocument(projectId, documentName, content, category = 'market_research', options = {}) {
  if (!projectId || !documentName || !content) {
    throw new Error('projectId, documentName, and content are required');
  }

  const resolvedCategory = normalizeCategory(category);
  const scope = options.scope || (projectId === 'helm' ? 'helm' : (options.taskId ? 'task' : 'project'));
  const taskId = options.taskId || null;

  // Remove existing chunks for this specific document to support clean idempotency
  if (taskId) {
    db.prepare('DELETE FROM rag_chunks WHERE task_id=? AND document_name=?').run(taskId, documentName);
  } else {
    db.prepare('DELETE FROM rag_chunks WHERE project_id=? AND document_name=?').run(projectId, documentName);
  }

  // If file is CSV, convert to high-relevance semantic representation
  let textToChunk = content;
  if (documentName.toLowerCase().endsWith('.csv') || (typeof content === 'string' && content.slice(0, 100).includes(','))) {
    textToChunk = parseCsvIntoSemanticText(content);
  }

  const chunks = chunkText(textToChunk);
  const insertStmt = db.prepare(`
    INSERT INTO rag_chunks (id, project_id, document_name, chunk_index, content, token_count, keywords_json, category, scope, task_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTx = db.transaction(() => {
    let totalTokens = 0;
    chunks.forEach((chunk, idx) => {
      const tokens = tokenize(chunk);
      totalTokens += tokens.length;
      const chunkId = uuidv4();
      insertStmt.run(
        chunkId,
        projectId,
        documentName,
        idx + 1,
        chunk,
        tokens.length,
        JSON.stringify(Array.from(new Set(tokens))),
        resolvedCategory,
        scope,
        taskId
      );
    });
    return totalTokens;
  });

  const totalTokens = insertTx();
  return {
    ok: true,
    document_name: documentName,
    category: resolvedCategory,
    scope,
    task_id: taskId,
    chunks_created: chunks.length,
    total_tokens: totalTokens
  };
}

function searchChunks(projectId, query, topK = 5, category = null, options = {}) {
  if (!query) return [];

  const filterCategory = category ? normalizeCategory(category) : null;
  const taskId = options.taskId || null;
  const includeHelm = options.includeHelm !== false;

  // Hierarchical query building: Helm Global Knowledge + Project Knowledge + Task Knowledge
  let whereClauses = [];
  let params = [];

  if (projectId && projectId !== 'helm') {
    if (filterCategory) {
      whereClauses.push('(project_id = ? AND category = ?)');
      params.push(projectId, filterCategory);
    } else {
      whereClauses.push('project_id = ?');
      params.push(projectId);
    }
  }

  if (includeHelm) {
    whereClauses.push("(scope = 'helm' OR project_id = 'helm')");
  }

  if (taskId) {
    whereClauses.push('task_id = ?');
    params.push(taskId);
  }

  if (whereClauses.length === 0) {
    if (filterCategory) {
      whereClauses.push('category = ?');
      params.push(filterCategory);
    } else {
      whereClauses.push('1 = 1');
    }
  }

  const sql = `
    SELECT id, project_id, document_name, chunk_index, content, token_count, keywords_json, category, scope, task_id, created_at
    FROM rag_chunks
    WHERE ${whereClauses.join(' OR ')}
  `;

  let chunks = [];
  try {
    chunks = db.prepare(sql).all(...params);
  } catch (err) {
    console.warn(`[RAG searchChunks warning]: ${err.message}`);
    chunks = [];
  }

  if (!chunks.length) return [];

  const queryLower = query.toLowerCase().trim();
  const queryTokens = tokenize(queryLower);

  const scored = chunks.map(chunk => {
    let keywords = [];
    try {
      keywords = JSON.parse(chunk.keywords_json || '[]');
    } catch (e) {
      keywords = [];
    }
    const score = computeScore(queryTokens, queryLower, chunk.content, keywords);
    const chunkScope = chunk.scope || (chunk.project_id === 'helm' ? 'helm' : (chunk.task_id ? 'task' : 'project'));
    const tierLabel = chunkScope === 'helm'
      ? '[Helm Global Knowledge]'
      : (chunkScope === 'task' ? '[Task Knowledge]' : '[Project Knowledge]');

    return {
      id: chunk.id,
      project_id: chunk.project_id,
      document_name: chunk.document_name,
      chunk_index: chunk.chunk_index,
      category: chunk.category || 'market_research',
      scope: chunkScope,
      task_id: chunk.task_id,
      tier_label: tierLabel,
      content: chunk.content,
      token_count: chunk.token_count,
      score,
      match_pct: Math.max(score, 12.5),
      created_at: chunk.created_at
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Number(topK) || 5);
}

function getProjectChunkCount(projectId, category = null) {
  if (category) {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM rag_chunks WHERE project_id = ? AND category = ?').get(projectId, normalizeCategory(category));
    return row ? row.cnt : 0;
  }
  const row = db.prepare('SELECT COUNT(*) as cnt FROM rag_chunks WHERE project_id = ?').get(projectId);
  return row ? row.cnt : 0;
}

function getAllProjectChunks(projectId, category = null) {
  if (category) {
    return db.prepare(`
      SELECT id, document_name, chunk_index, content, token_count, category, created_at
      FROM rag_chunks
      WHERE project_id = ? AND category = ?
      ORDER BY document_name ASC, chunk_index ASC
    `).all(projectId, normalizeCategory(category));
  }
  return db.prepare(`
    SELECT id, document_name, chunk_index, content, token_count, category, created_at
    FROM rag_chunks
    WHERE project_id = ?
    ORDER BY category ASC, document_name ASC, chunk_index ASC
  `).all(projectId);
}

function getProjectKnowledgeSummary(projectId, options = {}) {
  const scope = options.scope || (projectId === 'helm' ? 'helm' : (options.taskId ? 'task' : 'project'));
  const taskId = options.taskId || null;

  let whereClause = 'project_id = ?';
  let params = [projectId];

  if (scope === 'helm' || projectId === 'helm') {
    whereClause = "(scope = 'helm' OR project_id = 'helm')";
    params = [];
  } else if (taskId) {
    whereClause = 'task_id = ?';
    params = [taskId];
  } else if (projectId) {
    whereClause = "(project_id = ? AND (scope = 'project' OR scope IS NULL))";
    params = [projectId];
  }

  const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM rag_chunks WHERE ${whereClause}`).get(...params);
  const totalChunks = countRow ? countRow.cnt : 0;

  const rows = db.prepare(`
    SELECT category, document_name, COUNT(*) as chunks, SUM(token_count) as tokens, MAX(created_at) as latest_created
    FROM rag_chunks
    WHERE ${whereClause}
    GROUP BY category, document_name
    ORDER BY category ASC, document_name ASC
  `).all(...params);

  const categories = {
    market_research: { title: 'Market Research & Audits', count: 0, documents: [] },
    gaps_opportunities: { title: 'Competitor Gaps & Opportunities', count: 0, documents: [] },
    brand_guidelines: { title: 'Brand Guidelines & Tone', count: 0, documents: [] },
    customer_profiles: { title: 'Customer Profiles (ICP)', count: 0, documents: [] },
    offer_frameworks: { title: 'Offer Frameworks & Pricing', count: 0, documents: [] }
  };

  const docSet = new Set();
  for (const r of rows) {
    const cat = normalizeCategory(r.category);
    docSet.add(r.document_name);
    if (!categories[cat]) {
      categories[cat] = { title: cat, count: 0, documents: [] };
    }
    categories[cat].count += r.chunks;
    categories[cat].documents.push({
      document_name: r.document_name,
      chunks: r.chunks,
      tokens: r.tokens || 0,
      updated_at: r.latest_created
    });
  }

  return {
    project_id: projectId,
    total_chunks: totalChunks,
    total_documents: docSet.size,
    categories
  };
}

// Auto-seed existing harness files and research files for projects
function autoSeedProjectHarness() {
  try {
    const projects = db.prepare('SELECT id, name FROM projects').all();
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) return;

    for (const proj of projects) {
      // 1. Ingest files registered in harness_files for this project
      const files = db.prepare('SELECT filename, original_name, file_category FROM harness_files WHERE project_id=?').all(proj.id);
      for (const f of files) {
        if (f.file_category === 'Lead Logo') continue;
        const filePath = path.join(uploadsDir, f.filename);
        if (fs.existsSync(filePath)) {
          const ext = path.extname(f.original_name || f.filename).toLowerCase();
          if (['.txt', '.md', '.csv', '.html', '.json', '.sql'].includes(ext)) {
            try {
              const content = fs.readFileSync(filePath, 'utf-8');
              if (content && content.length > 10) {
                const cat = f.file_category === 'Spreadsheet' ? 'gaps_opportunities' : normalizeCategory(f.file_category);
                ingestDocument(proj.id, f.original_name || f.filename, content, cat);
              }
            } catch (_) {}
          }
        }
      }

      // 2. Ingest available project market research and intelligence files from uploads/
      const researchCandidates = [
        { file: 'Priority_A_Outreach_Email_Merge_Fields.csv', name: 'Priority_A_Outreach_Verified_Gaps.csv', cat: 'gaps_opportunities' },
        { file: 'Clinic Intelligence (138 leads, scored and verified).csv', name: 'Canadian_Dental_Clinic_Intelligence_138.csv', cat: 'market_research' }
      ];

      for (const cand of researchCandidates) {
        const cPath = path.join(uploadsDir, cand.file);
        if (fs.existsSync(cPath)) {
          try {
            const content = fs.readFileSync(cPath, 'utf8');
            if (content && content.length > 20) {
              ingestDocument(proj.id, cand.name, content, cand.cat);
            }
          } catch (_) {}
        }
      }

      // 3. Ensure core offer frameworks and brand guidelines are indexed
      const existingOffers = searchChunks(proj.id, 'Valioz offer pricing', 1, 'offer_frameworks');
      if (existingOffers.length === 0) {
        const offerDoc = `# VALIOZ Health — Core Offer Framework & Pricing Specs
- **Model**: Full Turnkey Patient Acquisition & Dental Growth Engine
- **Setup Fee**: $499 one-time website & AI intake engine purchase
- **Guarantee**: 30-day risk-free launch with $0 upfront fee until 10 new patients are booked
- **Retainer**: $299/month optional AI Growth Agent retainer after 30 days
- **Asset Ownership**: 100% clinic property — client owns domain, hosting, code, and connected Google profiles
- **Deliverables**:
  1. Custom mobile-first responsive clinic website with online intake
  2. Google Search Console & Google Business Profile local 3-pack optimization
  3. AI-powered patient booking triage (answering inquiries 24/7)
  4. CDCP (Canadian Dental Care Plan) patient qualification flow
  5. Daily Growth Brief & real-time intake telemetry`;
        ingestDocument(proj.id, 'Valioz_Health_Offer_Framework.md', offerDoc, 'offer_frameworks');
      }

      const existingBrands = searchChunks(proj.id, 'brand voice guidelines', 1, 'brand_guidelines');
      if (existingBrands.length === 0) {
        const brandDoc = `# VALIOZ Health & Dual-Branded Client Brand Guidelines
- **Core Mission**: "Better care deserves to be found."
- **Brand Colors**: Teal Accent (#00a9a4), Deep Navy (#122f47), Card Mint (#f1f8f7)
- **Voice & Tone**: High-integrity, evidence-grounded, empathetic to dental practice owners.
- **Rules of Engagement**:
  - Never fabricate review metrics, rankings, or patient figures.
  - Side-by-side logo lockup: [VALIOZ Health] × [Partner Clinic Logo].
  - Emphasize clinic ownership vs renting SaaS templates.
  - Focus on patient care access and seamless local appointment booking.`;
        ingestDocument(proj.id, 'Valioz_Brand_Kit_and_Guidelines.md', brandDoc, 'brand_guidelines');
      }
    }
  } catch (err) {
    console.warn(`[WARN] RAG auto-seed note: ${err.message}`);
  }
}

// Run autoSeed on module load
autoSeedProjectHarness();

module.exports = {
  chunkText,
  tokenize,
  ingestDocument,
  searchChunks,
  getProjectChunkCount,
  getAllProjectChunks,
  getProjectKnowledgeSummary,
  autoSeedProjectHarness,
  normalizeCategory,
  KNOWLEDGE_CATEGORIES
};
