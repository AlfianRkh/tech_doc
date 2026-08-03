/**
 * aiClient.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Frontend API client for the AI Documentation Agent endpoints.
 *
 * 🔐 Enkripsi otomatis:
 *   Setiap request yang mengandung source_code dienkripsi di browser
 *   menggunakan RSA-OAEP + AES-256-GCM sebelum dikirim ke server.
 *   Cloudflare / proxy hanya melihat ciphertext.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getApiBaseUrl } from '../config';
import { encryptPayload, isEncryptionSupported, getServerPublicKey } from '../utils/codeEncrypt';

function getBase() {
  return getApiBaseUrl() || 'http://localhost:3001/api';
}

function getToken() {
  return localStorage.getItem('tf_token');
}

async function req(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(getBase() + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

/**
 * reqEncrypted — sama dengan req() tapi otomatis enkripsi source_code
 * jika browser mendukung Web Crypto API.
 */
async function reqEncrypted(method, path, body) {
  let finalBody = body;
  if (body && body.source_code && isEncryptionSupported()) {
    try {
      finalBody = await encryptPayload(body);
    } catch (err) {
      console.warn('[aiClient] Enkripsi gagal, fallback plaintext:', err.message);
    }
  }
  return req(method, path, finalBody);
}

export const aiApi = {
  /**
   * Check if Ollama is running and list available models.
   * @returns {{ status, default_model, available_models[] }}
   */
  checkHealth() {
    return req('GET', '/ai/health');
  },

  /**
   * Pre-warm enkripsi: fetch RSA public key dan cache-nya.
   * Panggil sekali saat halaman load agar request pertama tidak lambat.
   * @returns {Promise<boolean>} true jika enkripsi siap
   */
  async encryptionReady() {
    if (!isEncryptionSupported()) return false;
    try {
      await getServerPublicKey();
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Start an AI analysis session.
   * source_code dienkripsi otomatis sebelum dikirim.
   * @param {{ source_code, language, title, project_id, model, save_to_db }} payload
   * @returns {{ id, status: 'analyzing' }}
   */
  analyze(payload) {
    return reqEncrypted('POST', '/ai/analyze', payload);
  },

  /**
   * Parse only with regex (no AI, instant).
   * source_code dienkripsi otomatis sebelum dikirim.
   * @param {{ source_code, language }} payload
   * @returns {{ analysis, markdown, dsl }}
   */
  parseOnly(payload) {
    return reqEncrypted('POST', '/ai/parse', payload);
  },

  /**
   * Open an SSE stream for real-time token output of an analysis session.
   * @param {string|number} docId
   * @param {{ onToken, onComplete, onError }} callbacks
   * @returns {EventSource}
   */
  streamAnalysis(docId, { onToken, onComplete, onError }) {
    const url = `${getBase()}/ai/analyze/${docId}/stream`;
    const es = new EventSource(url);

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === 'token' && onToken) onToken(event.token);
        if (event.type === 'complete') {
          if (onComplete) onComplete(event);
          es.close();
        }
        if (event.type === 'error') {
          if (onError) onError(event.message);
          es.close();
        }
      } catch {
        /* ignore parse errors on heartbeat lines */
      }
    };

    es.onerror = () => {
      if (onError) onError('SSE connection lost');
      es.close();
    };

    return es;
  },

  /**
   * List saved code_documents.
   * @param {{ project_id?, status?, search?, limit? }} params
   */
  listDocuments(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
    ).toString();
    return req('GET', `/ai/documents${qs ? `?${qs}` : ''}`);
  },

  /**
   * Get a single document — source_code otomatis didekripsi oleh backend.
   */
  getDocument(id) {
    return req('GET', `/ai/documents/${id}`);
  },

  /** Delete a saved document. */
  deleteDocument(id) {
    return req('DELETE', `/ai/documents/${id}`);
  },

  /**
   * Convert a completed analysis into a TechFlow canvas flow.
   * @returns {{ flow_id }}
   */
  generateFlow(docId) {
    return req('POST', `/ai/documents/${docId}/generate-flow`);
  },

  /**
   * Generate flow directly from analysis JSON or DSL text (no docId needed).
   * @param {{ analysis?, dsl?, title?, project_id? }} payload
   * @returns {{ flow_id, flow_name }}
   */
  generateFlowDirect(payload) {
    return req('POST', '/ai/generate-flow-direct', payload);
  },
};
