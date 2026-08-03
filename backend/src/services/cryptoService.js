/**
 * cryptoService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Enkripsi hybrid untuk melindungi source code yang dikirim lewat jaringan.
 *
 * Skema:
 *   TRANSPORT (Browser → Backend):
 *     1. Browser generate AES-256-GCM key secara acak per-request
 *     2. Browser enkripsi source_code dengan AES-256-GCM
 *     3. Browser enkripsi AES key dengan RSA-OAEP-2048 (public key server)
 *     4. Hanya server (yang punya RSA private key) yang bisa dekripsi
 *     ✅ Cloudflare tidak bisa baca isi source_code
 *
 *   DATABASE STORAGE:
 *     source_code dienkripsi ulang dengan AES-256-GCM menggunakan
 *     CODE_ENCRYPT_KEY dari .env sebelum disimpan ke PostgreSQL
 *     ✅ DB breach tidak mengekspos source code asli
 *
 * Setup sekali:
 *   node -e "require('./src/services/cryptoService').generateAndPrintKeys()"
 *   Copy output RSA_PRIVATE_KEY dan CODE_ENCRYPT_KEY ke .env
 * ─────────────────────────────────────────────────────────────────────────────
 */

const crypto = require('crypto');

// ─── RSA Keypair ──────────────────────────────────────────────────────────────
// Diload sekali saat startup, tetap di memory selama server hidup.
// RSA_PRIVATE_KEY dari .env (PEM, base64-encoded agar mudah disimpan di env var)

let _privateKey = null;
let _publicKeyPem = null;

function loadOrGenerateRSA() {
  if (_privateKey && _publicKeyPem) return;

  const envPriv = process.env.RSA_PRIVATE_KEY;
  if (envPriv) {
    // Load dari env — key disimpan sebagai base64 PEM
    const pem = Buffer.from(envPriv, 'base64').toString('utf8');
    _privateKey = crypto.createPrivateKey(pem);
    // Derive public key dari private key
    _publicKeyPem = crypto.createPublicKey(_privateKey)
      .export({ type: 'spki', format: 'pem' });
    console.log('[crypto] RSA private key loaded from RSA_PRIVATE_KEY env var');
  } else {
    // Development fallback: generate ephemeral key (valid sampai restart server)
    console.warn('[crypto] RSA_PRIVATE_KEY not set — generating ephemeral RSA key (development only)');
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding:  { type: 'spki',  format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    _privateKey  = crypto.createPrivateKey(privateKey);
    _publicKeyPem = publicKey;
  }
}

/**
 * Kembalikan RSA public key dalam format PEM.
 * Aman untuk di-expose ke browser via GET /api/ai/public-key
 */
function getPublicKeyPem() {
  loadOrGenerateRSA();
  return _publicKeyPem;
}

/**
 * Dekripsi AES session key yang dienkripsi browser menggunakan RSA-OAEP.
 * @param {string} encryptedKeyBase64 - AES key ter-wrap oleh RSA (base64)
 * @returns {Buffer} raw AES key (32 bytes)
 */
function unwrapAesKey(encryptedKeyBase64) {
  loadOrGenerateRSA();
  return crypto.privateDecrypt(
    {
      key:     _privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(encryptedKeyBase64, 'base64')
  );
}

// ─── AES-256-GCM Transport Decrypt ───────────────────────────────────────────

/**
 * Dekripsi source_code yang dienkripsi browser dengan AES-256-GCM.
 *
 * @param {string} encBase64  - ciphertext (termasuk GCM auth tag 16 byte terakhir)
 * @param {string} ivBase64   - IV / nonce (12 bytes)
 * @param {string} keyBase64  - AES key yang sudah di-unwrap (raw base64)
 * @returns {string} source code plaintext
 */
function decryptTransport(encBase64, ivBase64, keyBase64) {
  const keyBuf  = Buffer.from(keyBase64, 'base64');
  const iv      = Buffer.from(ivBase64,  'base64');
  const encBuf  = Buffer.from(encBase64, 'base64');

  // GCM auth tag adalah 16 byte terakhir
  const tag       = encBuf.slice(encBuf.length - 16);
  const cipherBuf = encBuf.slice(0, encBuf.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
  decipher.setAuthTag(tag);
  return decipher.update(cipherBuf, null, 'utf8') + decipher.final('utf8');
}

// ─── AES-256-GCM Database Encryption ─────────────────────────────────────────
// Menggunakan CODE_ENCRYPT_KEY dari .env (32-byte hex = 64 karakter)

function getDbKey() {
  const k = process.env.CODE_ENCRYPT_KEY;
  if (!k || k.length !== 64) {
    throw new Error(
      'CODE_ENCRYPT_KEY harus berisi 64 karakter hex (32 byte). ' +
      'Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(k, 'hex');
}

/**
 * Enkripsi plaintext untuk disimpan di database.
 * Format output: "iv_hex:ciphertext_base64:tag_hex"
 * @param {string} plaintext
 * @returns {string}
 */
function encryptForDb(plaintext) {
  if (!plaintext) return plaintext;
  const key    = getDbKey();
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return `${iv.toString('hex')}:${enc.toString('base64')}:${tag.toString('hex')}`;
}

/**
 * Dekripsi nilai dari database.
 * @param {string} stored - format "iv_hex:ciphertext_base64:tag_hex"
 * @returns {string} plaintext
 */
function decryptFromDb(stored) {
  if (!stored || !stored.includes(':')) return stored; // belum terenkripsi (legacy)
  const [ivHex, encBase64, tagHex] = stored.split(':');
  const key      = getDbKey();
  const iv       = Buffer.from(ivHex, 'hex');
  const encBuf   = Buffer.from(encBase64, 'base64');
  const tag      = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encBuf, null, 'utf8') + decipher.final('utf8');
}

/**
 * Cek apakah string sudah dalam format terenkripsi DB.
 */
function isDbEncrypted(value) {
  if (typeof value !== 'string') return false;
  const parts = value.split(':');
  return parts.length === 3 && parts[0].length === 24; // iv hex = 12 byte = 24 char
}

// ─── Middleware Express ────────────────────────────────────────────────────────

/**
 * Express middleware: jika request body mengandung { encrypted: true },
 * otomatis dekripsi source_code sebelum masuk ke route handler.
 *
 * Payload yang diharapkan dari browser:
 * {
 *   encrypted:        true,
 *   source_code_enc:  "base64...",   // ciphertext + GCM tag
 *   source_code_iv:   "base64...",   // 12-byte IV
 *   source_code_key:  "base64...",   // AES key ter-wrap oleh RSA
 *   language:         "php",
 *   title:            "...",
 *   ...rest
 * }
 */
function decryptMiddleware(req, res, next) {
  const body = req.body;
  if (!body || !body.encrypted) return next(); // tidak terenkripsi, lewatkan

  try {
    if (!body.source_code_enc || !body.source_code_iv || !body.source_code_key) {
      return res.status(400).json({
        error: 'Encrypted request harus mengandung source_code_enc, source_code_iv, source_code_key',
      });
    }

    // 1. Unwrap AES key menggunakan RSA private key
    const aesKeyBuf = unwrapAesKey(body.source_code_key);
    const aesKeyB64 = aesKeyBuf.toString('base64');

    // 2. Dekripsi source_code
    const plaintext = decryptTransport(
      body.source_code_enc,
      body.source_code_iv,
      aesKeyB64
    );

    // 3. Ganti field di body dengan versi plaintext
    req.body = {
      ...body,
      source_code: plaintext,
      encrypted: false, // tandai sudah didekripsi
      // hapus field enkripsi agar tidak diteruskan
      source_code_enc: undefined,
      source_code_iv:  undefined,
      source_code_key: undefined,
    };

    next();
  } catch (err) {
    console.error('[crypto] Decrypt transport failed:', err.message);
    return res.status(400).json({ error: 'Gagal dekripsi payload: ' + err.message });
  }
}

// ─── Key Generation Helper ────────────────────────────────────────────────────

/**
 * Helper untuk generate keys pertama kali.
 * Jalankan: node -e "require('./src/services/cryptoService').generateAndPrintKeys()"
 */
function generateAndPrintKeys() {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const codeKey = crypto.randomBytes(32).toString('hex');
  const privB64 = Buffer.from(privateKey).toString('base64');

  console.log('\n=== Copy ke file .env Anda ===\n');
  console.log(`RSA_PRIVATE_KEY=${privB64}`);
  console.log(`CODE_ENCRYPT_KEY=${codeKey}`);
  console.log('\n================================\n');
}

module.exports = {
  getPublicKeyPem,
  unwrapAesKey,
  decryptTransport,
  encryptForDb,
  decryptFromDb,
  isDbEncrypted,
  decryptMiddleware,
  generateAndPrintKeys,
};
