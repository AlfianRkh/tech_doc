/**
 * codeParser.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Regex-based fallback parser for PHP and Golang source code.
 * Used when AI analysis is not available / as a pre-analysis step.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── PHP Patterns ─────────────────────────────────────────────────────────

const PHP_PATTERNS = {
  // function myFunc(...)  OR  public/private/protected function myFunc(...)
  functions: /(?:(?:public|private|protected|static|abstract)\s+)*function\s+(\w+)\s*\(([^)]*)\)/g,
  // class MyClass extends ...
  classes: /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+[\w,\s]+)?/g,
  // $this->load->library('xxx')
  loadLibrary: /\$this->load->library\(['"]([^'"]+)['"]/g,
  // $this->load->helper('xxx')
  loadHelper: /\$this->load->helper\(['"]([^'"]+)['"]/g,
  // $this->load->model('xxx')
  loadModel: /\$this->load->model\(['"]([^'"]+)['"]/g,
  // $this->db->get('table') / ->insert() / ->update() / ->delete() / ->query()
  dbGet:    /\$this->db->get\(['"]([^'"]+)['"]/g,
  dbInsert: /\$this->db->insert\(['"]([^'"]+)['"]/g,
  dbUpdate: /\$this->db->update\(['"]([^'"]+)['"]/g,
  dbDelete: /\$this->db->delete\(['"]([^'"]+)['"]/g,
  dbQuery:  /\$this->db->query\(['"]([^'"]+)['"]/g,
  // Raw SQL: SELECT/INSERT/UPDATE/DELETE FROM tableName
  rawSql: /(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+`?(\w+)`?/gi,
  // function calls: $this->someMethod() or SomeClass::method()
  internalCalls: /(?:\$this->(\w+)\(|(\w+)::(\w+)\()/g,
  // curl_exec, file_get_contents with http
  apiCalls: /(?:curl_exec|file_get_contents|curl_setopt.*CURLOPT_URL)\s*\(([^)]*)\)/g,
  // require/include
  requires: /(?:require|include)(?:_once)?\s*['"(]([^'")]+)['"]/g,
};

// ─── Golang Patterns ───────────────────────────────────────────────────────

const GO_PATTERNS = {
  // func (r *Receiver) FuncName(...) or func FuncName(...)
  functions: /func\s+(?:\(\w+\s+[\*]?(\w+)\)\s+)?(\w+)\s*\(([^)]*)\)\s*(?:\(([^)]*)\)|(\w+))?\s*\{/g,
  // import "pkg" or import ( "pkg" )
  imports: /import\s+(?:"([^"]+)"|`([^`]+)`|\(\s*([\s\S]*?)\s*\))/g,
  // sql.Query / db.Query / DB.QueryRow / db.Exec
  dbQuery:  /(?:db|DB|r\.db|s\.db|repo\.db)\.Query(?:Row|Context)?\s*\(/g,
  dbExec:   /(?:db|DB|r\.db|s\.db|repo\.db)\.Exec(?:Context)?\s*\(/g,
  dbPrepare:/(?:db|DB|r\.db|s\.db|repo\.db)\.Prepare(?:Context)?\s*\(/g,
  // raw SQL strings
  rawSql: /(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+["'`]?(\w+)["'`]?/gi,
  // http.Get / http.Post / client.Get
  httpCalls: /(?:http\.(?:Get|Post|NewRequest)|client\.(?:Get|Post|Do))\s*\(/g,
  // Struct type declarations
  structs: /type\s+(\w+)\s+struct\s*\{/g,
};

// ─── PHP Parser ────────────────────────────────────────────────────────────

/**
 * Parse PHP source code.
 * @param {string} code
 * @returns {ParsedCode}
 */
function parsePHP(code) {
  const result = {
    language: 'php',
    title: '',
    description: '',
    entry_points: [],
    functions: [],
    flow_connections: [],
  };

  // Detect class name
  let className = null;
  const classMatch = code.match(/class\s+(\w+)/);
  if (classMatch) {
    className = classMatch[1];
    result.title = className;
  }

  // Extract all functions
  const fnRegex = new RegExp(PHP_PATTERNS.functions.source, 'g');
  let fnMatch;
  while ((fnMatch = fnRegex.exec(code)) !== null) {
    const fnName = fnMatch[1];
    if (['__construct', '__destruct'].includes(fnName)) continue;

    // Get function body (from match position, grab ~2000 chars)
    const bodyStart = code.indexOf('{', fnMatch.index + fnMatch[0].length - 1);
    const bodySlice = bodyStart !== -1 ? code.substring(bodyStart, bodyStart + 2500) : '';

    const fn = {
      name: fnName,
      class: className,
      description: '',
      params: parsePhpParams(fnMatch[2]),
      returns: detectPhpReturn(bodySlice),
      calls_functions: [],
      calls_libraries: [],
      calls_helpers: [],
      db_operations: [],
      api_calls: [],
    };

    // Libraries
    const libRe = new RegExp(PHP_PATTERNS.loadLibrary.source, 'g');
    let m;
    while ((m = libRe.exec(bodySlice)) !== null) fn.calls_libraries.push(m[1]);

    // Helpers
    const helpRe = new RegExp(PHP_PATTERNS.loadHelper.source, 'g');
    while ((m = helpRe.exec(bodySlice)) !== null) fn.calls_helpers.push(m[1]);

    // Models (treat as internal function calls)
    const modelRe = new RegExp(PHP_PATTERNS.loadModel.source, 'g');
    while ((m = modelRe.exec(bodySlice)) !== null) fn.calls_functions.push(`${m[1]} (model)`);

    // DB operations
    const dbPatterns = [
      { re: PHP_PATTERNS.dbGet,    type: 'SELECT' },
      { re: PHP_PATTERNS.dbInsert, type: 'INSERT' },
      { re: PHP_PATTERNS.dbUpdate, type: 'UPDATE' },
      { re: PHP_PATTERNS.dbDelete, type: 'DELETE' },
    ];
    for (const { re, type } of dbPatterns) {
      const dbRe = new RegExp(re.source, 'g');
      while ((m = dbRe.exec(bodySlice)) !== null) {
        fn.db_operations.push({ type, table: m[1], description: `${type} from table ${m[1]}` });
      }
    }

    // Raw SQL
    const sqlRe = new RegExp(PHP_PATTERNS.rawSql.source, 'gi');
    while ((m = sqlRe.exec(bodySlice)) !== null) {
      const sqlType = m[0].trim().split(/\s+/)[0].toUpperCase().replace('INTO', '').trim();
      fn.db_operations.push({ type: sqlType || 'QUERY', table: m[1] || '?', description: `Raw SQL on ${m[1] || 'unknown table'}` });
    }

    // Internal calls
    const callRe = new RegExp(PHP_PATTERNS.internalCalls.source, 'g');
    while ((m = callRe.exec(bodySlice)) !== null) {
      const called = m[1] || `${m[2]}::${m[3]}`;
      if (called && called !== fnName) {
        fn.calls_functions.push(called);
      }
    }

    // API / HTTP calls
    if (/curl_exec|file_get_contents/.test(bodySlice)) {
      const urlMatch = bodySlice.match(/CURLOPT_URL[^"']*['"]([^'"]+)['"]/);
      fn.api_calls.push({
        method: 'POST',
        endpoint: urlMatch ? urlMatch[1] : '<curl endpoint>',
        description: 'HTTP/cURL call',
      });
    }

    // De-duplicate
    fn.calls_functions = [...new Set(fn.calls_functions)];
    fn.calls_libraries = [...new Set(fn.calls_libraries)];
    fn.calls_helpers = [...new Set(fn.calls_helpers)];

    result.functions.push(fn);
  }

  // Build flow connections from function call data
  for (const fn of result.functions) {
    const fromName = fn.class ? `${fn.class}::${fn.name}` : fn.name;
    for (const called of fn.calls_functions) {
      result.flow_connections.push({ from: fromName, to: called, label: '' });
    }
  }

  // Entry point = first public function or constructor
  const publicFn = result.functions.find((f) => code.includes(`public function ${f.name}`));
  if (publicFn) {
    result.entry_points = [publicFn.class ? `${publicFn.class}::${publicFn.name}` : publicFn.name];
  } else if (result.functions.length > 0) {
    const f = result.functions[0];
    result.entry_points = [f.class ? `${f.class}::${f.name}` : f.name];
  }

  return result;
}

function parsePhpParams(paramStr) {
  if (!paramStr || !paramStr.trim()) return [];
  return paramStr
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      // e.g. "string $name = ''" or "$id"
      const parts = p.split(/\s+/);
      const name = parts.find((x) => x.startsWith('$')) || p;
      const type = parts.find((x) => !x.startsWith('$') && !x.includes('=')) || 'mixed';
      return { name: name.replace('$', ''), type, description: '' };
    });
}

function detectPhpReturn(bodySlice) {
  if (/return\s+\$this/.test(bodySlice)) return '$this (fluent)';
  if (/return\s+true|return\s+false/.test(bodySlice)) return 'bool';
  if (/return\s+\[/.test(bodySlice)) return 'array';
  if (/return\s+\$/.test(bodySlice)) return 'mixed';
  if (/return\s+null/.test(bodySlice)) return 'null';
  return 'void';
}

// ─── Golang Parser ─────────────────────────────────────────────────────────

/**
 * Parse Golang source code.
 * @param {string} code
 * @returns {ParsedCode}
 */
function parseGolang(code) {
  const result = {
    language: 'golang',
    title: '',
    description: '',
    entry_points: [],
    functions: [],
    flow_connections: [],
  };

  // Package name
  const pkgMatch = code.match(/^package\s+(\w+)/m);
  result.title = pkgMatch ? pkgMatch[1] : 'main';

  // Extract imports
  const importedPkgs = extractGoImports(code);

  // Extract structs (used as class names for methods)
  const structs = new Set();
  const structRe = new RegExp(GO_PATTERNS.structs.source, 'g');
  let m;
  while ((m = structRe.exec(code)) !== null) structs.add(m[1]);

  // Extract functions / methods
  const fnRe = /func\s+(?:\((\w+)\s+[\*]?(\w+)\)\s+)?(\w+)\s*\(([^)]*)\)/g;
  let fnMatch;
  while ((fnMatch = fnRe.exec(code)) !== null) {
    const receiverType = fnMatch[2] || null;
    const fnName = fnMatch[3];
    if (!fnName) continue;

    // Get function body
    const bodyStart = code.indexOf('{', fnMatch.index + fnMatch[0].length - 1);
    const bodySlice = bodyStart !== -1 ? code.substring(bodyStart, bodyStart + 2500) : '';

    const fn = {
      name: fnName,
      class: receiverType || null,
      description: '',
      params: parseGoParams(fnMatch[4]),
      returns: 'error',
      calls_functions: [],
      calls_libraries: [],
      calls_helpers: [],
      db_operations: [],
      api_calls: [],
    };

    // Library / package calls (detect used imports in body)
    for (const pkg of importedPkgs) {
      const shortName = pkg.split('/').pop();
      if (new RegExp(`\\b${shortName}\\.`).test(bodySlice)) {
        fn.calls_libraries.push(pkg);
      }
    }

    // DB operations
    const dbTypes = [
      { re: /(?:db|DB|r\.db|s\.db|repo\.db)\.Query(?:Row|Context)?\s*\(/g, type: 'SELECT' },
      { re: /(?:db|DB|r\.db|s\.db|repo\.db)\.Exec(?:Context)?\s*\(/g,      type: 'EXEC' },
      { re: /(?:db|DB|r\.db|s\.db|repo\.db)\.Prepare(?:Context)?\s*\(/g,   type: 'PREPARE' },
    ];
    for (const { re, type } of dbTypes) {
      const reClone = new RegExp(re.source, 'g');
      while ((m = reClone.exec(bodySlice)) !== null) {
        // Try to find the SQL string nearby
        const sqlSearch = bodySlice.substring(m.index, m.index + 400);
        const sqlMatch = sqlSearch.match(/`([^`]{0,500})`|"([^"]{0,200})"/);
        const rawSql = sqlMatch ? (sqlMatch[1] || sqlMatch[2]).trim() : '';
        const tableMatch = rawSql.match(/(?:FROM|INTO|UPDATE|TABLE)\s+["'`]?(\w+)["'`]?/i);
        fn.db_operations.push({
          type,
          table: tableMatch ? tableMatch[1] : '?',
          description: rawSql ? rawSql.substring(0, 80) : `DB ${type} operation`,
        });
      }
    }

    // HTTP calls
    if (/http\.(?:Get|Post|NewRequest)|client\.(?:Get|Post|Do)/.test(bodySlice)) {
      const urlMatch = bodySlice.match(/http\.(?:Get|Post)\s*\(\s*["'`]([^"'`]+)["'`]/);
      fn.api_calls.push({
        method: urlMatch ? (bodySlice.includes('http.Post') ? 'POST' : 'GET') : 'HTTP',
        endpoint: urlMatch ? urlMatch[1] : '<http endpoint>',
        description: 'HTTP client call',
      });
    }

    // Internal function calls (other functions in same file)
    const internalCallRe = /(\w+)\s*\(/g;
    let ic;
    const knownBuiltins = new Set([
      'fmt', 'len', 'make', 'append', 'close', 'copy', 'delete', 'new', 'panic',
      'recover', 'print', 'println', 'cap', 'complex', 'imag', 'real',
    ]);
    while ((ic = internalCallRe.exec(bodySlice)) !== null) {
      const called = ic[1];
      if (
        called !== fnName &&
        !knownBuiltins.has(called) &&
        !/^[A-Z]/.test(called) &&        // skip exported pkg calls
        called.length > 2
      ) {
        fn.calls_functions.push(called);
      }
    }

    fn.calls_functions = [...new Set(fn.calls_functions)].slice(0, 15);
    fn.calls_libraries = [...new Set(fn.calls_libraries)];

    result.functions.push(fn);
  }

  // Build connections
  for (const fn of result.functions) {
    const fromName = fn.class ? `${fn.class}.${fn.name}` : fn.name;
    for (const called of fn.calls_functions) {
      result.flow_connections.push({ from: fromName, to: called, label: '' });
    }
  }

  // Entry point = main() or first exported function
  const mainFn = result.functions.find((f) => f.name === 'main');
  if (mainFn) {
    result.entry_points = ['main'];
  } else {
    const exported = result.functions.find((f) => /^[A-Z]/.test(f.name));
    if (exported) result.entry_points = [exported.name];
  }

  return result;
}

function extractGoImports(code) {
  const imports = [];
  // Single: import "path"
  const singleRe = /import\s+"([^"]+)"/g;
  let m;
  while ((m = singleRe.exec(code)) !== null) imports.push(m[1]);

  // Block: import ( ... )
  const blockMatch = code.match(/import\s*\(\s*([\s\S]*?)\s*\)/);
  if (blockMatch) {
    const lines = blockMatch[1].split('\n');
    for (const line of lines) {
      const im = line.match(/"([^"]+)"/);
      if (im) imports.push(im[1]);
    }
  }

  return [...new Set(imports)];
}

function parseGoParams(paramStr) {
  if (!paramStr || !paramStr.trim()) return [];
  return paramStr
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const parts = p.trim().split(/\s+/);
      const name = parts[0] || 'arg';
      const type = parts.slice(1).join(' ') || 'interface{}';
      return { name, type, description: '' };
    });
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Auto-detect language and parse code.
 * @param {string} code
 * @param {'php'|'golang'} language
 * @returns {ParsedCode}
 */
function parseCode(code, language) {
  if (language === 'golang') return parseGolang(code);
  return parsePHP(code);
}

module.exports = { parseCode, parsePHP, parseGolang };
