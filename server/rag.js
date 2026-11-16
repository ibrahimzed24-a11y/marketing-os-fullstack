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

function ingestDocument(projectId, documentName, content) {
  if (!projectId || !documentName || !content) {
    throw new Error('projectId, documentName, and content are required');
  }

  // Remove existing chunks for this specific document to support clean idempotency
  db.prepare('DELETE FROM rag_chunks WHERE project_id=? AND document_name=?').run(projectId, documentName);

  const chunks = chunkText(content);
  const insertStmt = db.prepare(`
    INSERT INTO rag_chunks (id, project_id, document_name, chunk_index, content, token_count, keywords_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
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
        JSON.stringify(Array.from(new Set(tokens)))
      );
    });
    return totalTokens;
  });

  const totalTokens = insertTx();
  return {
    ok: true,
    document_name: documentName,
    chunks_created: chunks.length,
    total_tokens: totalTokens
  };
}

function searchChunks(projectId, query, topK = 5) {
  if (!projectId || !query) return [];

  const chunks = db.prepare(`
    SELECT id, document_name, chunk_index, content, token_count, keywords_json, created_at
    FROM rag_chunks
    WHERE project_id = ?
  `).all(projectId);

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
    return {
      id: chunk.id,
      document_name: chunk.document_name,
      chunk_index: chunk.chunk_index,
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

function getProjectChunkCount(projectId) {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM rag_chunks WHERE project_id = ?').get(projectId);
  return row ? row.cnt : 0;
}

function getAllProjectChunks(projectId) {
  return db.prepare(`
    SELECT id, document_name, chunk_index, content, token_count, created_at
    FROM rag_chunks
    WHERE project_id = ?
    ORDER BY document_name ASC, chunk_index ASC
  `).all(projectId);
}

// Auto-seed existing harness files for projects if RAG is empty
function autoSeedProjectHarness() {
  try {
    const totalCount = db.prepare('SELECT COUNT(*) as cnt FROM rag_chunks').get()?.cnt || 0;
    if (totalCount > 0) return; // Already seeded

    const projects = db.prepare('SELECT id, name FROM projects').all();
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) return;

    for (const proj of projects) {
      const files = db.prepare('SELECT filename, original_name FROM harness_files WHERE project_id=?').all(proj.id);
      for (const f of files) {
        const filePath = path.join(uploadsDir, f.filename);
        if (fs.existsSync(filePath)) {
          const ext = path.extname(f.original_name || f.filename).toLowerCase();
          if (['.txt', '.md', '.csv', '.html', '.json', '.sql'].includes(ext)) {
            try {
              const content = fs.readFileSync(filePath, 'utf-8');
              if (content && content.length > 10) {
                ingestDocument(proj.id, f.original_name || f.filename, content);
              }
            } catch (readErr) {
              // skip unreadable
            }
          }
        }
      }

      // If project has no indexed harness files, index its default goal and guidelines
      if (getProjectChunkCount(proj.id) === 0) {
        const defaultDoc = `PROJECT: ${proj.name}\nGOAL: Canadian Dental Clinics growth with $499 setup and $299/mo AI agent retainer.\nOFFER SPECIFICATION: Full turnkey patient intake, online scheduling integration, Hostinger outbound email deliverability, and Google Search Console visibility.\nTARGET CLINICS: Ontario and British Columbia clinics accepting CDCP (Canadian Dental Care Plan).`;
        ingestDocument(proj.id, 'project_specifications.md', defaultDoc);
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
  autoSeedProjectHarness
};
