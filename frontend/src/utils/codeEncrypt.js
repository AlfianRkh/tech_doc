/**
 * codeEncrypt.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Enkripsi source code di browser SEBELUM dikirim ke backend.
 * Menggunakan Web Crypto API (native browser, tidak butuh library eksternal).
 *
 * Skema Hybrid:
 *   1. Generate AES-256-GCM key secara acak (per request)
 *   2. Enkripsi source_code dengan AES-256-GCM → { ciphertext + tag }
 *   3. Enkripsi AES key dengan RSA-OAEP (public key server)
 *   4. Kirim { encrypted:true, source_code_enc, source_code_iv, source_code_key }
 *
 * Hasil: Cloudflare/proxy hanya melihat ciphertext, tidak bisa baca kode asli.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Cache public key agar tidak fetch berulang kali
let _cachedPublicKey = null;
let _cachedPublicKeyPem = null;

// ─── Helper: konversi buffer/string ──────────────────────────────────────────

function bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

// ─── Import RSA Public Key ────────────────────────────────────────────────────

/**
 * Import PEM public key menjadi CryptoKey untuk Web Crypto API.
 * @param {string} pem - RSA public key dalam format PEM
 * @returns {Promise<CryptoKey>}
 */
async function importRsaPublicKey(pem) {
  // Hapus header/footer PEM dan decode base64
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\n/g, '');
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    'spki',
    der.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,       // tidak perlu di-export
    ['encrypt']
  );
}

// ─── Fetch & Cache Public Key ─────────────────────────────────────────────────

/**
 * Ambil RSA public key dari backend (di-cache setelah fetch pertama).
 * @returns {Promise<CryptoKey>}
 */
async function getServerPublicKey() {
  if (_cachedPublicKey) return _cachedPublicKey;

  const res = await fetch(`${API_BASE}/ai/public-key`);
  if (!res.ok) throw new Error('Gagal mengambil public key dari server');

  const { public_key: pem } = await res.json();
  _cachedPublicKeyPem = pem;
  _cachedPublicKey = await importRsaPublicKey(pem);
  return _cachedPublicKey;
}

// ─── Main Encrypt Function ────────────────────────────────────────────────────

/**
 * Enkripsi source_code menggunakan hybrid RSA-OAEP + AES-256-GCM.
 *
 * @param {string} sourceCode - kode sumber yang akan dienkripsi
 * @returns {Promise<{
 *   encrypted: true,
 *   source_code_enc: string,  // base64 ciphertext (termasuk GCM auth tag)
 *   source_code_iv:  string,  // base64 IV (12 bytes)
 *   source_code_key: string,  // base64 AES key ter-wrap dengan RSA
 * }>}
 */
async function encryptSourceCode(sourceCode) {
  // 1. Ambil RSA public key server (dari cache jika sudah ada)
  const rsaPublicKey = await getServerPublicKey();

  // 2. Generate AES-256-GCM key acak (unik per request)
  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,            // extractable = true agar bisa di-export untuk wrapping
    ['encrypt']
  );

  // 3. Generate IV (nonce) 12 byte
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 4. Enkripsi source_code dengan AES-256-GCM
  const encoded = new TextEncoder().encode(sourceCode);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoded
  );
  // Web Crypto AES-GCM otomatis append 16-byte GCM auth tag di akhir cipherBuffer

  // 5. Export raw AES key (32 bytes)
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);

  // 6. Enkripsi (wrap) AES key menggunakan RSA-OAEP public key server
  const wrappedKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    rsaPublicKey,
    rawAesKey
  );

  return {
    encrypted:        true,
    source_code_enc:  bufToBase64(cipherBuffer),   // ciphertext + GCM tag
    source_code_iv:   bufToBase64(iv),              // 12-byte nonce
    source_code_key:  bufToBase64(wrappedKey),      // AES key ter-wrap RSA
  };
}

// ─── Patch Request Payload ────────────────────────────────────────────────────

/**
 * Terima payload biasa { source_code, ...rest } dan kembalikan versi terenkripsi.
 * Field source_code dihapus dan diganti dengan field enkripsi.
 *
 * @param {object} payload - request body yang mengandung source_code
 * @param {boolean} [force=false] - paksa enkripsi meski sudah ada flag lain
 * @returns {Promise<object>} payload siap kirim
 */
async function encryptPayload(payload, force = false) {
  if (!payload.source_code || payload.encrypted) return payload; // sudah enkripsi / tidak ada kode

  try {
    const encFields = await encryptSourceCode(payload.source_code);

    // Hapus source_code plaintext, ganti dengan field terenkripsi
    const { source_code, ...rest } = payload;
    return { ...rest, ...encFields };
  } catch (err) {
    // Fallback ke plaintext jika enkripsi gagal (misal: browser lama)
    console.warn('[codeEncrypt] Enkripsi gagal, fallback plaintext:', err.message);
    return payload;
  }
}

/**
 * Cek apakah browser mendukung Web Crypto API (semua browser modern mendukung).
 */
function isEncryptionSupported() {
  return !!(window.crypto && window.crypto.subtle);
}

/**
 * Reset cache public key (berguna saat server restart di dev).
 */
function resetPublicKeyCache() {
  _cachedPublicKey = null;
  _cachedPublicKeyPem = null;
}

export {
  encryptSourceCode,
  encryptPayload,
  isEncryptionSupported,
  resetPublicKeyCache,
  getServerPublicKey,
};
