/**
 * routes/ai.js
 * ─────────────────────────────────────────────────────────────────────────────
 * AI Code Documentation endpoints.
 *
 * POST   /api/ai/analyze              → Start AI analysis (async + SSE)
 * GET    /api/ai/analyze/:id/stream   → SSE real-time token stream
 * GET    /api/ai/health               → Check Ollama availability
 * GET    /api/ai/documents            → List all saved analyses
 * GET    /api/ai/documents/:id        → Single document + analysis result
 * DELETE /api/ai/documents/:id        → Delete a saved document
 * POST   /api/ai/documents/:id/generate-flow → Convert analysis to TechFlow flow
 * POST   /api/ai/parse                → Parse only (no AI, regex fallback)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const express = require('express');
const router = express.Router();
const { EventEmitter } = require('events');
const db = require('../db');
const { analyzeCode, checkOllamaHealth, generateMarkdown, generateFlowDSL, DEFAULT_MODEL } = require('../services/aiService');
const { parseCode } = require('../services/codeParser');
const {
  getPublicKeyPem,
  encryptForDb,
  decryptFromDb,
  isDbEncrypted,
  decryptMiddleware,
} = require('../services/cryptoService');

// In-process SSE bus: emit token events per analysis session
const aiBus = new EventEmitter();
aiBus.setMaxListeners(200);

// ─── Health Check ──────────────────────────────────────────────────────────

/**
 * GET /api/ai/health
 * Returns Ollama status and available models.
 */
router.get('/health', async (_req, res) => {
  try {
    const health = await checkOllamaHealth();
    res.json({
      status: health.running ? 'ollama_ok' : 'ollama_unavailable',
      ollama_url: process.env.OLLAMA_URL || 'http://localhost:11434',
      default_model: DEFAULT_MODEL,
      available_models: health.models,
      reason: health.reason || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Public Key (untuk enkripsi payload di browser) ────────────────────────

/**
 * GET /api/ai/public-key
 * Mengembalikan RSA-2048 public key dalam format PEM.
 * Browser menggunakan key ini untuk mengenkripsi AES session key.
 * Aman di-expose ke publik (hanya public key, bukan private key).
 */
router.get('/public-key', (_req, res) => {
  try {
    const pem = getPublicKeyPem();
    res.json({ public_key: pem, algorithm: 'RSA-OAEP-2048-SHA256' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Parse Only (no AI) ────────────────────────────────────────────────────

/**
 * POST /api/ai/parse
 * Body: { source_code, language } ATAU payload terenkripsi
 * Runs regex parser only — instant, no Ollama required.
 *
 * Mendukung dua mode request:
 *   Mode A (plaintext)  : { source_code, language }
 *   Mode B (encrypted)  : { encrypted:true, source_code_enc, source_code_iv, source_code_key, language }
 */
router.post('/parse', decryptMiddleware, async (req, res) => {
  const { source_code, language = 'php' } = req.body;
  if (!source_code) return res.status(400).json({ error: 'source_code is required' });
  if (!['php', 'golang'].includes(language)) {
    return res.status(400).json({ error: 'language must be "php" or "golang"' });
  }

  try {
    const parsed = parseCode(source_code, language);
    const markdown = generateMarkdown(parsed, parsed.title);
    const dsl = generateFlowDSL(parsed, parsed.title);
    // Parse Only tidak simpan source_code ke DB — hanya return hasil
    res.json({ analysis: parsed, markdown, dsl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start AI Analysis ─────────────────────────────────────────────────────

/**
 * POST /api/ai/analyze
 * Body:
 *   source_code   string  (required)
 *   language      string  'php' | 'golang'
 *   title         string  user-provided doc title
 *   project_id    int     optional
 *   model         string  Ollama model, default deepseek-coder:6.7b
 *   save_to_db    bool    default true
 *
 * Returns: { id, status: 'analyzing' }
 * Client should then open SSE stream at /api/ai/analyze/:id/stream
 */
router.post('/analyze', decryptMiddleware, async (req, res) => {
  const {
    source_code,
    language = 'php',
    title = 'Untitled Analysis',
    project_id = null,
    model = DEFAULT_MODEL,
    save_to_db = true,
  } = req.body;

  if (!source_code) return res.status(400).json({ error: 'source_code is required' });
  if (!['php', 'golang'].includes(language)) {
    return res.status(400).json({ error: 'language must be "php" or "golang"' });
  }

  try {
    // 1. Pre-parse with regex to have something immediately
    const preParsed = parseCode(source_code, language);

    // 2. Enkripsi source_code sebelum simpan ke database
    let storedSourceCode = source_code;
    try {
      storedSourceCode = encryptForDb(source_code);
    } catch (encErr) {
      // Jika CODE_ENCRYPT_KEY belum di-set, simpan plaintext + warning
      console.warn('[crypto] DB encryption skipped (CODE_ENCRYPT_KEY not set):', encErr.message);
    }

    // 3. Save document record with 'analyzing' status
    let docId = null;
    if (save_to_db) {
      const dbRes = await db.query(
        `INSERT INTO code_documents
           (project_id, title, language, source_code, ai_model, status,
            analysis_result, doc_markdown)
         VALUES ($1,$2,$3,$4,$5,'analyzing',$6,$7)
         RETURNING id`,
        [
          project_id,
          title,
          language,
          storedSourceCode,                    // ✅ tersimpan terenkripsi
          model,
          JSON.stringify(preParsed),
          generateMarkdown(preParsed, title),
        ]
      );
      docId = dbRes.rows[0].id;
    } else {
      // Temp ID for SSE bus without DB persistence
      docId = `tmp_${Date.now()}`;
    }

    // 3. Return immediately so client can open SSE stream
    res.status(202).json({ id: docId, status: 'analyzing' });

    // 4. Run AI analysis asynchronously
    setImmediate(async () => {
      try {
        // Stream tokens to SSE bus
        const onToken = (token) => {
          aiBus.emit(`ai:${docId}`, { type: 'token', token });
        };

        const aiResult = await analyzeCode(source_code, language, model, onToken);
        const markdown = generateMarkdown(aiResult, title);
        const dsl = generateFlowDSL(aiResult, title);

        // 5. Update DB with final AI result
        if (save_to_db && typeof docId === 'number') {
          await db.query(
            `UPDATE code_documents SET
               status = 'done',
               analysis_result = $1,
               doc_markdown = $2,
               updated_at = NOW()
             WHERE id = $3`,
            [JSON.stringify(aiResult), markdown, docId]
          );
        }

        // 6. Emit completion event
        aiBus.emit(`ai:${docId}`, {
          type: 'complete',
          analysis: aiResult,
          markdown,
          dsl,
          docId,
        });
      } catch (err) {
        // Mark as failed in DB
        if (save_to_db && typeof docId === 'number') {
          await db.query(
            `UPDATE code_documents SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
            [err.message, docId]
          );
        }
        aiBus.emit(`ai:${docId}`, { type: 'error', message: err.message, docId });
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SSE Stream ────────────────────────────────────────────────────────────

/**
 * GET /api/ai/analyze/:id/stream
 * Server-Sent Events: streams AI token output in real time.
 * Events:
 *   { type: 'token', token: '...' }
 *   { type: 'complete', analysis: {...}, markdown: '...', dsl: '...' }
 *   { type: 'error', message: '...' }
 */
router.get('/analyze/:id/stream', async (req, res) => {
  const docId = isNaN(req.params.id) ? req.params.id : parseInt(req.params.id);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Heartbeat keeps connection alive during long analyses
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(': heartbeat\n\n');
  }, 15000);

  function send(event) {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    if (event.type === 'complete' || event.type === 'error') {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    }
  }

  aiBus.on(`ai:${docId}`, send);

  req.on('close', () => {
    clearInterval(heartbeat);
    aiBus.off(`ai:${docId}`, send);
  });
});

// ─── Documents CRUD ────────────────────────────────────────────────────────

/**
 * GET /api/ai/documents
 * Query params: project_id, status, search, limit
 */
router.get('/documents', async (req, res) => {
  try {
    const { project_id, status, search, limit = 50 } = req.query;
    const params = [];
    const conditions = [];

    if (project_id) {
      params.push(project_id);
      conditions.push(`cd.project_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`cd.status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(cd.title ILIKE $${params.length} OR cd.language ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(parseInt(limit));

    const result = await db.query(
      `SELECT
         cd.id, cd.project_id, cd.flow_id, cd.title, cd.language,
         cd.ai_model, cd.status, cd.error_message,
         cd.created_at, cd.updated_at,
         p.name AS project_name, p.color AS project_color, p.icon AS project_icon,
         LEFT(cd.source_code, 200) AS source_preview,
         LEFT(cd.doc_markdown, 300) AS markdown_preview
       FROM code_documents cd
       LEFT JOIN projects p ON p.id = cd.project_id
       ${where}
       ORDER BY cd.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/ai/documents/:id
 * Returns full document including analysis_result and doc_markdown.
 * source_code di-dekripsi dari DB sebelum dikirim ke client.
 */
router.get('/documents/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT cd.*, p.name AS project_name, p.color AS project_color, p.icon AS project_icon
       FROM code_documents cd
       LEFT JOIN projects p ON p.id = cd.project_id
       WHERE cd.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Document not found' });

    const doc = { ...result.rows[0] };

    // Dekripsi source_code jika tersimpan terenkripsi
    if (doc.source_code && isDbEncrypted(doc.source_code)) {
      try {
        doc.source_code = decryptFromDb(doc.source_code);
      } catch (decErr) {
        console.warn('[crypto] Failed to decrypt source_code for doc', doc.id, ':', decErr.message);
        doc.source_code = '[terenkripsi — tidak dapat didekripsi]';
      }
    }

    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/**
 * DELETE /api/ai/documents/:id
 */
router.delete('/documents/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM code_documents WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Generate Flow from Analysis ───────────────────────────────────────────

/**
 * POST /api/ai/documents/:id/generate-flow
 * Reads a completed code_documents record, converts its analysis to
 * TechFlow DSL, and calls the existing /api/flows/generate-text logic
 * to create a real flow in the DB.
 *
 * Returns: { flow_id, flow_name }
 */
router.post('/documents/:id/generate-flow', async (req, res) => {
  try {
    // 1. Load document
    const docRes = await db.query(
      'SELECT * FROM code_documents WHERE id = $1',
      [req.params.id]
    );
    if (!docRes.rows.length) return res.status(404).json({ error: 'Document not found' });

    const doc = docRes.rows[0];
    if (doc.status !== 'done') {
      return res.status(400).json({ error: 'Analysis must be complete (status=done) before generating flow' });
    }

    const analysis = doc.analysis_result;
    if (!analysis || !analysis.functions) {
      return res.status(400).json({ error: 'No analysis result available' });
    }

    // 2. Build DSL from analysis
    const dsl = generateFlowDSL(analysis, doc.title);

    // 3. Use internal flow generation (same logic as /api/flows/generate-text)
    //    We replicate the DB transaction here to avoid HTTP-to-HTTP self-call.
    const { createFlowFromDSL } = require('./flowGeneratorHelper');
    const flowId = await createFlowFromDSL(dsl, doc.project_id);

    // 4. Link generated flow back to code_document
    await db.query(
      'UPDATE code_documents SET flow_id = $1, updated_at = NOW() WHERE id = $2',
      [flowId, doc.id]
    );

    res.json({ flow_id: flowId, message: 'Flow generated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Generate Flow Directly (tanpa docId) ──────────────────────────────────

/**
 * POST /api/ai/generate-flow-direct
 * Generate a TechFlow canvas flow directly from:
 *   - `dsl` (string)  → raw DSL text format, ATAU
 *   - `analysis` (object) + `title` → convert analysis JSON → DSL → flow
 *   - `project_id` (optional)
 *
 * Digunakan oleh frontend untuk Parse Only results yang belum tersimpan di DB.
 * Returns: { flow_id, flow_name }
 */
router.post('/generate-flow-direct', async (req, res) => {
  try {
    const { dsl, analysis, title = 'Generated Flow', project_id = null } = req.body;

    let dslText = dsl;

    // Jika tidak ada DSL tapi ada analysis object, generate DSL dari analysis
    if (!dslText && analysis) {
      dslText = generateFlowDSL(analysis, title);
    }

    if (!dslText) {
      return res.status(400).json({ error: 'Either "dsl" or "analysis" is required' });
    }

    const { createFlowFromDSL } = require('./flowGeneratorHelper');
    const flowId = await createFlowFromDSL(dslText, project_id);

    res.json({ flow_id: flowId, flow_name: title, message: 'Flow generated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

