/**
 * aiService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Orchestrates all communication with the local Ollama API.
 * Model: deepseek-coder:6.7b
 * Supported languages: php, golang
 *
 * Deployment note:
 *   Ollama runs locally and is exposed to the internet via Cloudflare Tunnel.
 *   Set OLLAMA_URL to your tunnel URL in production (e.g. Render env vars).
 *   Set OLLAMA_SECRET to a shared secret to protect the tunnel endpoint.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const OLLAMA_BASE = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'deepseek-coder:6.7b';
// Optional shared secret — set the same value on your tunnel proxy / middleware
const OLLAMA_SECRET = process.env.OLLAMA_SECRET || '';

/**
 * Returns common headers for every Ollama request.
 * Includes X-Ollama-Secret when configured so the tunnel
 * can verify that requests come from this backend only.
 */
function ollamaHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    ...(OLLAMA_SECRET ? { 'X-Ollama-Secret': OLLAMA_SECRET } : {}),
    ...extra,
  };
}

// ─── Prompt Templates ──────────────────────────────────────────────────────

/**
 * Builds the system prompt for code analysis.
 * Returns strict JSON instructions so the model outputs parseable data.
 */
function buildSystemPrompt(language) {
  const langNote =
    language === 'golang'
      ? 'The code is written in Go (Golang). Identify func declarations, struct methods, package imports, and sql/database calls.'
      : 'The code is written in PHP. Identify function/method declarations, class dependencies via $this->load->library/helper/model, and DB calls like $this->db->get/insert/update/delete/query.';

  return `You are a senior software architect specializing in code documentation.
${langNote}

Analyze the source code provided by the user and return ONLY a valid JSON object — no markdown, no explanation, no code fences.

The JSON must follow this exact schema:
{
  "title": "<short descriptive feature name>",
  "description": "<1-2 sentences describing what this code does overall>",
  "language": "${language}",
  "entry_points": ["<functionName or ControllerName::methodName>"],
  "functions": [
    {
      "name": "<function or method name>",
      "class": "<class or controller name, or null>",
      "description": "<what this function does>",
      "params": [{ "name": "<param>", "type": "<type>", "description": "<desc>" }],
      "returns": "<return type or description>",
      "calls_functions": ["<otherFunc>", "<ClassName::method>"],
      "calls_libraries": ["<LibraryName::method or import path>"],
      "calls_helpers": ["<helperFunctionName>"],
      "db_operations": [
        { "type": "SELECT|INSERT|UPDATE|DELETE|QUERY", "table": "<tableName>", "description": "<what data>", "fields": [] }
      ],
      "api_calls": [
        { "method": "GET|POST|PUT|DELETE", "endpoint": "<url or path>", "description": "<purpose>" }
      ]
    }
  ],
  "flow_connections": [
    { "from": "<funcA>", "to": "<funcB>", "label": "<optional branch condition>" }
  ]
}

Rules:
- Include ALL functions/methods you find, even private ones.
- If a function calls another function in the same file, add it to calls_functions.
- If a function calls a library/service/package, add it to calls_libraries.
- If a function calls a helper (PHP helper or Go utility func), add it to calls_helpers.
- db_operations: detect ALL database interactions, including raw SQL strings.
- flow_connections: trace the call graph — which function calls which.
- Return ONLY the raw JSON. No prose, no markdown fences.`;
}

// ─── Ollama API ────────────────────────────────────────────────────────────

/**
 * Checks if Ollama is running and returns available models.
 * @returns {{ running: boolean, models: string[] }}
 */
async function checkOllamaHealth() {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      headers: ollamaHeaders(),
      signal: AbortSignal.timeout(3600000),
    });
    if (!res.ok) return { running: false, models: [], reason: `HTTP ${res.status}` };
    const data = await res.json();
    const models = (data.models || []).map((m) => m.name);
    return { running: true, models, reason: null };
  } catch (err) {
    // Distinguish between tunnel not running vs Ollama not running
    const reason = err.name === 'TimeoutError'
      ? 'Tunnel or Ollama not reachable (timeout)'
      : err.message || 'Unknown error';
    return { running: false, models: [], reason };
  }
}

/**
 * Sends source code to Ollama for analysis.
 * Uses the /api/chat endpoint (non-streaming, returns full response).
 *
 * @param {string} sourceCode - Raw source code pasted by user
 * @param {string} language   - 'php' | 'golang'
 * @param {string} model      - Ollama model name
 * @param {function} [onToken] - Optional streaming callback (string token)
 * @returns {Promise<object>} Parsed analysis result JSON
 */
async function analyzeCode(sourceCode, language = 'php', model = DEFAULT_MODEL, onToken = null) {
  const systemPrompt = buildSystemPrompt(language);

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Analyze this ${language.toUpperCase()} source code:\n\n\`\`\`${language}\n${sourceCode}\n\`\`\``,
      },
    ],
    stream: !!onToken,
    options: {
      temperature: 0.1,     // low temperature for deterministic JSON output
      top_p: 0.9,
      num_ctx: 8192,        // deepseek-coder supports up to 16k, 8k is safe
    },
  };

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: ollamaHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300_000), // 5 min timeout for large code
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama error ${res.status}: ${err}`);
  }

  if (onToken) {
    // Streaming mode — collect tokens and fire callback
    let fullText = '';
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          const token = parsed?.message?.content || '';
          if (token) {
            fullText += token;
            onToken(token);
          }
        } catch { /* ignore malformed partial lines */ }
      }
    }

    return parseAIResponse(fullText);
  } else {
    // Non-streaming mode
    const data = await res.json();
    const rawText = data?.message?.content || data?.response || '';
    return parseAIResponse(rawText);
  }
}

// ─── Response Parser ───────────────────────────────────────────────────────

/**
 * Extracts and validates the JSON object from the AI's raw text response.
 * Handles cases where the model wraps JSON in markdown fences.
 *
 * @param {string} rawText
 * @returns {object} Validated analysis result
 */
function parseAIResponse(rawText) {
  let text = rawText.trim();

  // Strip markdown code fences if model wrapped the JSON
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  // Find the outermost { ... }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI response did not contain valid JSON. Raw: ' + text.substring(0, 200));
  }

  const jsonStr = text.substring(start, end + 1);

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to parse AI JSON response: ${e.message}`);
  }

  // Normalize structure — ensure required keys exist
  return {
    title: parsed.title || 'Untitled',
    description: parsed.description || '',
    language: parsed.language || 'php',
    entry_points: Array.isArray(parsed.entry_points) ? parsed.entry_points : [],
    functions: Array.isArray(parsed.functions) ? parsed.functions.map(normalizeFunction) : [],
    flow_connections: Array.isArray(parsed.flow_connections) ? parsed.flow_connections : [],
  };
}

/**
 * Normalizes a single function object to ensure all expected keys exist.
 */
function normalizeFunction(fn) {
  return {
    name: fn.name || 'unknown',
    class: fn.class || null,
    description: fn.description || '',
    params: Array.isArray(fn.params) ? fn.params : [],
    returns: fn.returns || 'void',
    calls_functions: Array.isArray(fn.calls_functions) ? fn.calls_functions : [],
    calls_libraries: Array.isArray(fn.calls_libraries) ? fn.calls_libraries : [],
    calls_helpers: Array.isArray(fn.calls_helpers) ? fn.calls_helpers : [],
    db_operations: Array.isArray(fn.db_operations) ? fn.db_operations : [],
    api_calls: Array.isArray(fn.api_calls) ? fn.api_calls : [],
  };
}

// ─── Markdown Generator ────────────────────────────────────────────────────

/**
 * Converts the structured analysis result into a human-readable Markdown document.
 *
 * @param {object} analysis - Result from parseAIResponse()
 * @param {string} sourceTitle - User-provided title
 * @returns {string} Markdown string
 */
function generateMarkdown(analysis, sourceTitle) {
  const now = new Date().toISOString().split('T')[0];
  const lines = [];

  lines.push(`# ${sourceTitle || analysis.title}`);
  lines.push('');
  lines.push(`**Language:** ${analysis.language === 'golang' ? 'Go (Golang)' : 'PHP'}`);
  lines.push(`**Analyzed At:** ${now}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Overview');
  lines.push('');
  lines.push(analysis.description || '_No description available._');
  lines.push('');

  if (analysis.entry_points.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Entry Points');
    lines.push('');
    for (const ep of analysis.entry_points) {
      lines.push(`- \`${ep}\``);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Function Detail');
  lines.push('');

  for (let i = 0; i < analysis.functions.length; i++) {
    const fn = analysis.functions[i];
    const fnLabel = fn.class ? `${fn.class}::${fn.name}` : fn.name;

    lines.push(`### ${i + 1}. \`${fnLabel}()\``);
    lines.push('');
    lines.push(`**Description:** ${fn.description || '_No description._'}`);
    lines.push('');

    // Parameters
    if (fn.params.length > 0) {
      lines.push('**Parameters:**');
      lines.push('');
      lines.push('| Name | Type | Description |');
      lines.push('|------|------|-------------|');
      for (const p of fn.params) {
        lines.push(`| \`${p.name || '-'}\` | \`${p.type || '-'}\` | ${p.description || '-'} |`);
      }
      lines.push('');
    }

    lines.push(`**Returns:** \`${fn.returns}\``);
    lines.push('');

    // Calls
    const hasCallsSection =
      fn.calls_functions.length > 0 ||
      fn.calls_libraries.length > 0 ||
      fn.calls_helpers.length > 0;

    if (hasCallsSection) {
      lines.push('**Calls:**');
      lines.push('');
      lines.push('| Target | Type | Category |');
      lines.push('|--------|------|----------|');
      for (const c of fn.calls_functions) {
        lines.push(`| \`${c}\` | Function | 🔵 Internal |`);
      }
      for (const c of fn.calls_libraries) {
        lines.push(`| \`${c}\` | Library/Package | 🟣 External |`);
      }
      for (const c of fn.calls_helpers) {
        lines.push(`| \`${c}\` | Helper | 🟢 Helper |`);
      }
      lines.push('');
    }

    // DB Operations
    if (fn.db_operations.length > 0) {
      lines.push('**Database Operations:**');
      lines.push('');
      lines.push('| Operation | Table | Description |');
      lines.push('|-----------|-------|-------------|');
      for (const db of fn.db_operations) {
        lines.push(`| \`${db.type}\` | \`${db.table || '-'}\` | ${db.description || '-'} |`);
      }
      lines.push('');
    }

    // API Calls
    if (fn.api_calls.length > 0) {
      lines.push('**API Calls:**');
      lines.push('');
      lines.push('| Method | Endpoint | Description |');
      lines.push('|--------|----------|-------------|');
      for (const api of fn.api_calls) {
        lines.push(`| \`${api.method}\` | \`${api.endpoint}\` | ${api.description || '-'} |`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  // Flow connections summary
  if (analysis.flow_connections.length > 0) {
    lines.push('## Call Graph (Text)');
    lines.push('');
    lines.push('```');
    for (const conn of analysis.flow_connections) {
      const label = conn.label ? ` --[${conn.label}]-->` : ' →';
      lines.push(`${conn.from}${label} ${conn.to}`);
    }
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

// ─── DSL Generator (for TechFlow flow auto-create) ─────────────────────────

/**
 * Converts analysis result into TechFlow DSL text format,
 * which can be fed to POST /api/flows/generate-text.
 *
 * @param {object} analysis
 * @param {string} title
 * @returns {string} DSL text
 */
function generateFlowDSL(analysis, title) {
  const lines = [];

  lines.push(`Flow: ${title || analysis.title}`);
  lines.push(`Description: ${analysis.description}`);
  lines.push('');

  // Create one node per function
  for (const fn of analysis.functions) {
    const nodeName = fn.class ? `${fn.class}::${fn.name}` : fn.name;
    lines.push(`[Node: ${nodeName}]`);

    if (fn.description) {
      lines.push(`Proses: ${fn.description}`);
    }

    const dbOps = fn.db_operations.map((d) => `${d.type} ${d.table}`).join(', ');
    if (dbOps) lines.push(`Logic: DB → ${dbOps}`);

    const libCalls = fn.calls_libraries.join(', ');
    if (libCalls) lines.push(`API: Calls library → ${libCalls}`);

    if (fn.returns && fn.returns !== 'void') {
      lines.push(`Output: { "returns": "${fn.returns}" }`);
    }

    lines.push('');
  }

  // Add DB nodes for each unique table touched
  const tables = new Set();
  for (const fn of analysis.functions) {
    for (const db of fn.db_operations) {
      if (db.table && db.table !== '-') tables.add(db.table);
    }
  }
  for (const table of tables) {
    lines.push(`[Node: DB: ${table}]`);
    lines.push(`Proses: Database table — ${table}`);
    lines.push('');
  }

  // Connections section
  lines.push('Connections');

  // Entry → first function
  if (analysis.entry_points.length > 0) {
    const firstEntry = analysis.entry_points[0];
    const firstFn = analysis.functions[0];
    if (firstFn) {
      const firstFnName = firstFn.class ? `${firstFn.class}::${firstFn.name}` : firstFn.name;
      if (firstEntry !== firstFnName) {
        lines.push(`${firstEntry} -> ${firstFnName}`);
      }
    }
  }

  // Function call connections
  for (const conn of analysis.flow_connections) {
    if (conn.label) {
      lines.push(`${conn.from} --${conn.label}--> ${conn.to}`);
    } else {
      lines.push(`${conn.from} -> ${conn.to}`);
    }
  }

  // DB connections: function → DB node
  for (const fn of analysis.functions) {
    const fnName = fn.class ? `${fn.class}::${fn.name}` : fn.name;
    for (const db of fn.db_operations) {
      if (db.table && db.table !== '-') {
        lines.push(`${fnName} -> DB: ${db.table}`);
      }
    }
  }

  return lines.join('\n');
}

module.exports = {
  checkOllamaHealth,
  analyzeCode,
  parseAIResponse,
  generateMarkdown,
  generateFlowDSL,
  DEFAULT_MODEL,
};
