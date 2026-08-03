# 🤖 TechFlow — AI Documentation Agent
## Panduan Teknis Lengkap

> **Versi:** 1.0 · **Tanggal:** 2026-08-02  
> **Dikembangkan untuk:** TechFlow Documentation Platform  
> **Model AI:** `deepseek-coder:6.7b` via Ollama (lokal, offline-first)

---

## Daftar Isi

1. [Ringkasan Fitur](#1-ringkasan-fitur)
2. [Arsitektur Sistem](#2-arsitektur-sistem)
3. [Daftar File yang Dibuat / Diubah](#3-daftar-file-yang-dibuat--diubah)
4. [Instalasi & Konfigurasi](#4-instalasi--konfigurasi)
5. [Cara Menjalankan](#5-cara-menjalankan)
6. [Cara Pakai — Step by Step](#6-cara-pakai--step-by-step)
7. [Output yang Dihasilkan](#7-output-yang-dihasilkan)
8. [Referensi API Endpoint](#8-referensi-api-endpoint)
9. [Troubleshooting](#9-troubleshooting)
10. [Contoh Kode untuk Testing](#10-contoh-kode-untuk-testing)

---

## 1. Ringkasan Fitur

Fitur AI Documentation Agent memungkinkan developer mendokumentasikan source code **secara otomatis** hanya dengan *paste* kode ke browser. Sistem akan menganalisis kode dan menghasilkan:

| Output | Keterangan |
|--------|-----------|
| 📄 **Markdown Doc** | Dokumentasi naratif setiap function: parameter, return value, DB ops, API call |
| 📊 **Call Graph** | Grafik SVG interaktif: alur panggilan function → library → helper → DB |
| 🔀 **Flow Canvas** | Diagram alur visual di kanvas TechFlow, siap di-*simulate* |

**Bahasa yang didukung:** PHP · Golang

**Mode analisis:**
- ⚡ **Parse Only** — Instan, tanpa AI, berbasis regex. Cocok untuk scan cepat.
- 🤖 **Analyze with AI** — Analisis mendalam oleh `deepseek-coder:6.7b` via Ollama. Menghasilkan deskripsi kontekstual.

---

## 2. Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React)                          │
│                                                                 │
│  DocumentsPage.jsx                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │  Code Input  │  │  Markdown    │  │   Call Graph SVG   │   │
│  │  (textarea)  │  │  Viewer      │  │   (CallGraphViewer)│   │
│  └──────┬───────┘  └──────────────┘  └────────────────────┘   │
│         │  aiClient.js (fetch + EventSource SSE)               │
└─────────┼───────────────────────────────────────────────────────┘
          │ HTTP / SSE
┌─────────▼───────────────────────────────────────────────────────┐
│                    Node.js Backend (port 3001)                  │
│                                                                 │
│  routes/ai.js                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  POST /api/ai/analyze     → async AI + SSE stream        │  │
│  │  POST /api/ai/parse       → sync regex parse (instant)   │  │
│  │  GET  /api/ai/analyze/:id/stream  → SSE token stream     │  │
│  │  GET  /api/ai/health      → cek Ollama status            │  │
│  │  GET  /api/ai/documents   → list saved analyses          │  │
│  │  POST /api/ai/generate-flow-direct → DSL → canvas flow   │  │
│  └──────────┬────────────────────────┬───────────────────────┘  │
│             │                        │                          │
│  services/aiService.js    services/codeParser.js               │
│  ┌──────────┴──────────┐  ┌──────────┴──────────┐             │
│  │  Prompt Builder     │  │  Regex Parser        │             │
│  │  Ollama API call    │  │  PHP + Golang        │             │
│  │  Markdown Generator │  │  Function extractor  │             │
│  │  DSL Generator      │  │  DB/Library detect   │             │
│  └─────────────────────┘  └─────────────────────┘             │
│             │                        │                          │
│  ┌──────────▼────────────────────────▼──────────────────────┐  │
│  │         PostgreSQL — tabel code_documents                 │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │ POST /api/chat (streaming)
┌─────────▼────────────┐
│   Ollama (port 11434) │
│   deepseek-coder:6.7b │
└──────────────────────┘
```

### Alur Data Parse Only (⚡)

```
User paste kode
      ↓
POST /api/ai/parse
      ↓
codeParser.js → regex extract functions / DB / library / helper
      ↓
aiService.generateMarkdown() → string markdown
aiService.generateFlowDSL() → string DSL
      ↓
Response JSON { analysis, markdown, dsl }
      ↓
Frontend render Markdown + Call Graph
      ↓
[Opsional] POST /api/ai/generate-flow-direct
      ↓
flowGeneratorHelper.createFlowFromDSL()
      ↓
INSERT flow_nodes + flow_connections → PostgreSQL
      ↓
navigate /canvas/:flow_id
```

### Alur Data AI Analyze (🤖)

```
User klik Analyze with AI
      ↓
POST /api/ai/analyze → return { id: docId, status: 'analyzing' }
      ↓ (async background)
aiService.analyzeCode() → build prompt → POST /api/chat ke Ollama
      ↓                                                    ↓
EventEmitter aiBus.emit('ai:docId', token)         streaming tokens
      ↓
GET /api/ai/analyze/:id/stream (EventSource SSE)
      ↓
Frontend tampilkan token realtime di textarea preview
      ↓
aiBus.emit('complete') → UPDATE code_documents SET status='done'
      ↓
Frontend render Markdown + Call Graph + tombol Generate to Canvas
```

---

## 3. Daftar File yang Dibuat / Diubah

### File Baru (Dibuat)

| File | Lokasi | Deskripsi |
|------|--------|-----------|
| `aiService.js` | `backend/src/services/` | Integrasi Ollama API, prompt builder PHP/Go, markdown generator, DSL generator |
| `codeParser.js` | `backend/src/services/` | Regex parser PHP & Golang — ekstrak function, DB ops, library, helper |
| `ai.js` | `backend/src/routes/` | 7 endpoint REST + SSE untuk fitur AI documentation |
| `flowGeneratorHelper.js` | `backend/src/routes/` | Shared helper DSL → flow DB transaction |
| `aiClient.js` | `frontend/src/api/` | Frontend API client + EventSource SSE wrapper |
| `CallGraphViewer.jsx` | `frontend/src/components/docs/` | SVG call graph interaktif (BFS layout, klik node) |
| `DocumentsPage.jsx` | `frontend/src/pages/` | Halaman utama AI Docs Agent (3-panel layout) |
| `test-ai-agent.js` | `tech/` (root) | Script test end-to-end semua endpoint |
| `examples/test-sample-php.php` | `tech/examples/` | Sample OrderController PHP untuk testing |
| `examples/test-sample-go.go` | `tech/examples/` | Sample OrderService Golang untuk testing |

### File yang Diubah

| File | Perubahan |
|------|-----------|
| `backend/src/db/schema.sql` | +Tabel `code_documents` |
| `backend/src/index.js` | +Register route `/api/ai` |
| `backend/.env.example` | +`OLLAMA_URL`, `OLLAMA_MODEL` |
| `frontend/src/App.jsx` | Aktifkan route `/documents` → `DocumentsPage` |
| `frontend/src/components/Sidebar.jsx` | +Menu `🤖 AI Docs Agent` |

---

## 4. Instalasi & Konfigurasi

### 4.1 Install Ollama

```powershell
# Windows — via winget
winget install Ollama.Ollama

# Atau download manual dari:
# https://ollama.com/download/windows
```

### 4.2 Pull Model AI

```powershell
# Buka terminal baru, jalankan:
ollama pull deepseek-coder:6.7b

# Verifikasi model terinstall:
ollama list
```

> **Catatan:** Model `deepseek-coder:6.7b` berukuran ~3.8 GB.  
> Alternatif lebih ringan: `deepseek-coder:1.3b` (~800 MB, akurasi lebih rendah)

### 4.3 Konfigurasi Environment Backend

Buka file `backend/.env` (buat jika belum ada berdasarkan `.env.example`):

```env
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=techflow
DB_USER=techflow
DB_PASSWORD=techflow123

# AI Agent — Ollama lokal
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=deepseek-coder:6.7b
```

### 4.4 Migrasi Database

Tabel `code_documents` sudah ditambahkan ke `schema.sql`. Jalankan setup ulang:

```powershell
cd c:\xampp\htdocs\tech\backend
node setup-db.js
```

Atau jalankan SQL ini langsung di PostgreSQL:

```sql
CREATE TABLE IF NOT EXISTS code_documents (
    id              SERIAL PRIMARY KEY,
    project_id      INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    flow_id         INTEGER REFERENCES flows(id) ON DELETE SET NULL,
    title           VARCHAR(255) NOT NULL DEFAULT 'Untitled',
    language        VARCHAR(20) NOT NULL DEFAULT 'php',
    source_code     TEXT NOT NULL,
    ai_model        VARCHAR(100) DEFAULT 'deepseek-coder:6.7b',
    status          VARCHAR(20) DEFAULT 'pending',
    analysis_result JSONB,
    doc_markdown    TEXT,
    error_message   TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
```

---

## 5. Cara Menjalankan

```powershell
# Terminal 1 — Pastikan Ollama berjalan
ollama serve

# Terminal 2 — Jalankan Backend
cd c:\xampp\htdocs\tech\backend
npm run dev
# → TechFlow API running on port 3001

# Terminal 3 — Jalankan Frontend
cd c:\xampp\htdocs\tech\frontend
npm run dev
# → Local: http://localhost:5173/

# Verifikasi semua service:
node c:\xampp\htdocs\tech\test-ai-agent.js
```

---

## 6. Cara Pakai — Step by Step

### Langkah 1 — Buka Halaman AI Docs Agent

1. Buka browser → `http://localhost:5173`
2. Login sebagai admin
3. Klik menu **🤖 AI Docs Agent** di sidebar (bagian MANAGEMENT)

### Langkah 2 — Input Kode

1. Isi **Title** → nama fitur/controller yang akan didokumentasikan  
   Contoh: `OrderController`, `Login Process`, `JNT Cargo Driver`

2. Pilih **Language** → `🐘 PHP` atau `🐹 Go`

3. Pilih **Model** → default `deepseek-coder:6.7b`

4. **Copy** isi file PHP/Go dari editor → **Paste** ke textarea

### Langkah 3 — Pilih Mode Analisis

#### Mode A: ⚡ Parse Only (Instan)
- Klik tombol **⚡ Parse Only**
- Hasil muncul dalam **< 1 detik**
- Tanpa AI, berbasis regex
- Cocok untuk: scan cepat, cek apakah parser mendeteksi struktur kode dengan benar

#### Mode B: 🤖 Analyze with AI (Lengkap)
- Klik tombol **🤖 Analyze with AI**
- Token AI muncul realtime di bawah textarea (streaming)
- Durasi: **30–120 detik** tergantung panjang kode dan spesifikasi hardware
- Menghasilkan deskripsi kontekstual setiap function
- Disimpan otomatis ke database

### Langkah 4 — Baca Hasil di Tiga Tab

#### Tab 📄 Markdown Doc
Dokumentasi naratif yang berisi:
- Nama class / package
- Language & tanggal analisis
- Entry points (public function)
- Tabel detail setiap function:
  - Deskripsi
  - Parameter input
  - Return value
  - Tabel calls: target → type → category (Internal/Library/Helper/DB/API)
  - Tabel DB Operations: tabel → operasi (SELECT/INSERT/UPDATE/DELETE)
  - API call eksternal

#### Tab 📊 Call Graph
Grafik SVG interaktif dengan node berwarna:

| Warna | Jenis Node | Contoh |
|-------|-----------|--------|
| 🔵 Biru | Function internal | `index()`, `doLogin()` |
| 🟣 Ungu | Library / dependency | `Auth`, `Mailer` |
| 🟢 Hijau | Helper function | `url`, `format` |
| 🔴 Merah-Ungu | Database table | `users`, `activity_logs` |
| 🟡 Kuning | API eksternal | `https://api.courier.com` |

**Interaksi:**
- Klik node → panel kanan menampilkan detail (dipanggil oleh siapa / memanggil siapa)
- Scroll untuk melihat graph yang besar
- Node yang dipilih akan di-highlight dengan border putih

#### Tab 💾 Raw JSON
Output mentah dari parser / AI dalam format JSON. Berguna untuk:
- Debug hasil parsing
- Integrasi dengan sistem lain
- Verifikasi akurasi deteksi

### Langkah 5 — Generate to Canvas (Opsional)

1. Setelah hasil analisis muncul (tab manapun), tombol **🔀 Generate to Canvas** otomatis muncul di kanan atas
2. Klik tombol tersebut
3. Sistem otomatis membuat flow diagram di database
4. Browser diarahkan ke `/canvas/:id` — kanvas TechFlow dengan semua node dan koneksi sudah terpasang
5. Di canvas bisa: edit node, tambah node, jalankan simulasi (**Run Simulation**)

---

## 7. Output yang Dihasilkan

### Contoh Markdown Doc (PHP — Login Controller)

```markdown
# Login

**Language:** PHP
**Analyzed At:** 2026-08-02

## Entry Points
- `Login::index`

## Function Detail

### 1. `Login::doLogin()`
**Description:** Memproses login user — validasi email, verifikasi password, set session.
**Returns:** `void`

**Calls:**
| Target | Type | Category |
|--------|------|----------|
| `Auth` | Library | 📦 Library |
| `url` | Helper | 🔧 Helper |
| `logFailedAttempt` | Function | 🔵 Internal |
| `logActivity` | Function | 🔵 Internal |

**DB Operations:**
| Table | Operation |
|-------|-----------|
| `users` | SELECT |
| `activity_logs` | INSERT |
```

### Contoh Call Graph — Nodes & Edges

```
Login::index ──calls──► logFailedAttempt
Login::index ──calls──► logActivity
Login::doLogin ──library──► Auth (Library)
Login::doLogin ──helper──► url (Helper)
Login::logFailedAttempt ──INSERT──► DB: login_attempts
Login::logActivity ──INSERT──► DB: activity_logs
```

### Contoh Flow Canvas yang Dihasilkan

Dari controller Login dengan 4 functions akan menghasilkan:
- **8 nodes** (4 function + 2 library/helper + 2 DB table)
- **11 connections** (panah berdireksi antar node)
- Auto-layout: function di kiri → dependency di kanan

---

## 8. Referensi API Endpoint

Base URL: `http://localhost:3001/api/ai`

| Method | Endpoint | Deskripsi | Body / Params |
|--------|----------|-----------|---------------|
| `GET` | `/health` | Cek status Ollama | — |
| `POST` | `/parse` | Parse kode (tanpa AI) | `{ source_code, language }` |
| `POST` | `/analyze` | Mulai analisis AI (async) | `{ source_code, language, title, project_id, model, save_to_db }` |
| `GET` | `/analyze/:id/stream` | SSE token stream | — |
| `GET` | `/documents` | List semua analisis tersimpan | `?project_id&status&search&limit` |
| `GET` | `/documents/:id` | Detail satu dokumen | — |
| `DELETE` | `/documents/:id` | Hapus dokumen | — |
| `POST` | `/documents/:id/generate-flow` | Generate flow dari doc tersimpan | — |
| `POST` | `/generate-flow-direct` | Generate flow dari analisis langsung | `{ analysis?, dsl?, title, project_id }` |

### Contoh Request — Parse Only

```bash
curl -X POST http://localhost:3001/api/ai/parse \
  -H "Content-Type: application/json" \
  -d '{
    "language": "php",
    "source_code": "<?php class OrderController { public function create() { $this->db->insert(\"orders\", $data); } }"
  }'
```

### Contoh Response — Parse

```json
{
  "analysis": {
    "title": "OrderController",
    "language": "php",
    "functions": [
      {
        "name": "create",
        "class": "OrderController",
        "calls_functions": [],
        "calls_libraries": [],
        "calls_helpers": [],
        "db_operations": [
          { "type": "INSERT", "table": "orders" }
        ],
        "api_calls": []
      }
    ],
    "flow_connections": [
      { "from": "OrderController::create", "to": "db::orders", "label": "INSERT" }
    ]
  },
  "markdown": "# OrderController\n\n**Language:** PHP\n...",
  "dsl": "Flow: OrderController\n[Node:OrderController::create]\n..."
}
```

---

## 9. Troubleshooting

### ❌ Ollama Offline (`ollama_unavailable`)

**Gejala:** Badge di topbar merah, model tidak terdeteksi

**Solusi:**
```powershell
# Pastikan Ollama service berjalan
ollama serve

# Cek apakah port 11434 terbuka
netstat -ano | findstr 11434
```

### ❌ Model tidak ditemukan

**Gejala:** Error saat klik Analyze with AI

**Solusi:**
```powershell
ollama pull deepseek-coder:6.7b
# Alternatif model yang lebih kecil:
ollama pull deepseek-coder:1.3b
ollama pull qwen2.5-coder:7b
```

### ❌ Parse Only tidak mendeteksi function

**Gejala:** "0 functions found"

**Kemungkinan penyebab:**
- Kode bukan class-based (procedural)
- Indentasi atau encoding tidak standard
- Nama function menggunakan karakter non-Latin

**Solusi:** Gunakan mode **🤖 Analyze with AI** yang lebih fleksibel

### ❌ Generate to Canvas gagal

**Gejala:** Alert "Gagal generate flow"

**Solusi:**
1. Pastikan backend running (`npm run dev` di folder `backend`)
2. Cek console browser untuk pesan error spesifik
3. Pastikan analisis berhasil (ada konten di tab Markdown)

### ❌ SSE Stream tidak muncul (AI Analyze stuck)

**Gejala:** Token tidak muncul, loading terus

**Kemungkinan:** Hardware terlalu lambat untuk model 6.7B

**Solusi:**
```powershell
# Gunakan model lebih kecil
ollama pull deepseek-coder:1.3b
```
Kemudian pilih model `deepseek-coder:1.3b` di dropdown model sebelum klik Analyze.

---

## 10. Contoh Kode untuk Testing

### PHP — CodeIgniter Controller

File referensi: `c:\xampp\htdocs\tech\examples\test-sample-php.php`

Komponen yang akan terdeteksi:
- `load->model`, `load->library`, `load->helper` → Library nodes
- `$this->db->insert/update/get_where` → DB nodes
- `file_get_contents('https://...')` → API call
- Pemanggilan antar method private → Call edges

### Golang — HTTP Service

File referensi: `c:\xampp\htdocs\tech\examples\test-sample-go.go`

Komponen yang akan terdeteksi:
- `import "github.com/..."` → Library nodes
- `s.db.QueryRow / db.Exec` → DB nodes
- `http.Get("https://...")` → API call
- Method receiver `(s *OrderService)` → class-like grouping

### Rekomendasi Kode untuk Dokumentasi Optimal

Agar hasil dokumentasi maksimal, pilih file yang memiliki:
- ✅ Minimal 3–5 function dalam satu class/struct
- ✅ Campuran: public entry point + private helper
- ✅ Ada operasi database (`INSERT`, `SELECT`, dll)
- ✅ Ada pemanggilan library atau helper
- ✅ Komentar PHPDoc / GoDoc di atas function (akan digunakan AI sebagai context)

---

*Dokumen ini dibuat otomatis oleh sesi pengembangan TechFlow AI Documentation Agent.*  
*Untuk pertanyaan teknis, lihat source code di `c:\xampp\htdocs\tech\`*
