# 🚀 Deployment Guide: TechFlow + Cloudflare + Render + Netlify
## Ollama Lokal → Cloud (Render BE + Netlify FE)

> **Update:** 2026-08-03  
> **Stack:** Node.js Backend (Render) · React/Vite Frontend (Netlify) · Ollama Local · Cloudflare Tunnel

---

## Arsitektur Final

```
┌──────────────────────────────────────────────────────────────────┐
│                         Internet                                 │
│                                                                  │
│   User Browser                                                   │
│       │ https://techflow.yourdomain.com                          │
│       ▼                                                          │
│   ┌─────────────┐     ┌──────────────────────────────────────┐  │
│   │   Netlify   │     │          Cloudflare DNS              │  │
│   │  (Frontend) │     │  techflow.yourdomain.com → Netlify   │  │
│   │  React/Vite │     │  api.yourdomain.com → Render         │  │
│   └──────┬──────┘     │  ollama.yourdomain.com → CF Tunnel   │  │
│          │            └──────────────────────────────────────┘  │
│          │ /api/* → https://api.yourdomain.com                  │
│          ▼                                                       │
│   ┌─────────────┐                                               │
│   │   Render    │                                               │
│   │  (Backend)  │                                               │
│   │  Node.js    │                                               │
│   └──────┬──────┘                                               │
│          │ OLLAMA_URL=https://ollama.yourdomain.com             │
│          ▼                                                       │
│   ┌───────────────────────────────────────┐                     │
│   │  Cloudflare Tunnel (cloudflared)      │                     │
│   │  ollama.yourdomain.com → localhost:11434                    │
│   └──────────────────────────────────────┘                      │
│          │ tunnel ke mesin lokal                                 │
│          ▼                                                       │
│   ┌─────────────┐                                               │
│   │  PC/Server  │                                               │
│   │  Lokal Anda │                                               │
│   │  Ollama     │                                               │
│   │  :11434     │                                               │
│   └─────────────┘                                               │
└──────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> Cloudflare **DNS Only** (grey cloud) dipakai untuk record Render & Netlify.  
> Cloudflare **Tunnel** dipakai untuk mengekspos Ollama lokal ke internet.  
> Ini dua fitur berbeda — DNS Only ≠ mematikan Cloudflare sepenuhnya.

---

## BAGIAN 1 — Persiapan Domain di Cloudflare

### 1.1 Daftarkan Domain ke Cloudflare

1. Buka [dash.cloudflare.com](https://dash.cloudflare.com)
2. Klik **Add a Site** → masukkan domain Anda
3. Pilih plan **Free**
4. Cloudflare akan scan DNS record lama → klik **Continue**
5. Ganti nameserver di registrar domain Anda ke Cloudflare NS
6. Tunggu propagasi ±30 menit

### 1.2 Buat DNS Records

Buka **DNS → Records**, tambahkan:

| Type | Name | Content | Proxy | Keterangan |
|------|------|---------|-------|-----------|
| `CNAME` | `techflow` | `[nama-netlify].netlify.app` | ☁️ **DNS only** | Frontend |
| `CNAME` | `api` | `[nama-render].onrender.com` | ☁️ **DNS only** | Backend |
| Otomatis | `ollama` | (dibuat oleh cloudflared) | 🟠 **Proxied** | AI Tunnel |

> [!NOTE]
> Record `ollama` akan dibuat **otomatis** oleh `cloudflared tunnel route dns`.
> Jangan buat manual — biarkan Cloudflare Tunnel yang mengaturnya.

---

## BAGIAN 2 — Setup Cloudflare Tunnel untuk Ollama Lokal

Ini bagian terpenting: mengekspos Ollama lokal ke internet secara aman.

### 2.1 Install cloudflared di PC Lokal

```powershell
# Windows — via winget
winget install Cloudflare.cloudflared

# Verifikasi
cloudflared --version
```

### 2.2 Login ke Cloudflare

```powershell
cloudflared tunnel login
# Browser akan terbuka → pilih domain Anda → klik Authorize
# File credentials tersimpan di: C:\Users\User\.cloudflared\cert.pem
```

### 2.3 Buat Tunnel

```powershell
cloudflared tunnel create ollama-tunnel
# Output: Created tunnel ollama-tunnel with id: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# Catat TUNNEL_ID ini!
```

### 2.4 Buat Config File

Buat file `C:\Users\User\.cloudflared\config.yml`:

```yaml
tunnel: <TUNNEL_ID>    # Ganti dengan ID dari langkah 2.3
credentials-file: C:\Users\User\.cloudflared\<TUNNEL_ID>.json

ingress:
  # Route: ollama.yourdomain.com → localhost:11434
  - hostname: ollama.yourdomain.com
    service: http://localhost:11434
    originRequest:
      # Header untuk autentikasi (opsional tapi direkomendasikan)
      httpHostHeader: "ollama.yourdomain.com"

  # Catch-all wajib ada
  - service: http_status:404
```

### 2.5 Daftarkan Subdomain ke DNS Cloudflare

```powershell
cloudflared tunnel route dns ollama-tunnel ollama.yourdomain.com
# Otomatis membuat CNAME record di Cloudflare DNS (Proxied)
```

### 2.6 Jalankan Tunnel

```powershell
# Pastikan Ollama sudah berjalan dulu
ollama serve

# Terminal baru — jalankan tunnel
cloudflared tunnel run ollama-tunnel
```

**Verifikasi tunnel aktif:**
```powershell
curl https://ollama.yourdomain.com/api/tags
# Harus return JSON list model Ollama
```

### 2.7 Proteksi Tunnel dengan Secret (Opsional tapi Direkomendasikan)

Tambahkan header autentikasi di `config.yml`:

```yaml
ingress:
  - hostname: ollama.yourdomain.com
    service: http://localhost:11434
    originRequest:
      httpHostHeader: "ollama.yourdomain.com"
      caPool: ""
      noTLSVerify: false
```

Di backend (`.env` Render), tambahkan:
```env
OLLAMA_SECRET=your-strong-random-secret-here
```

Di `aiService.js` backend, tambahkan header ke setiap request Ollama:
```js
headers: {
  'Content-Type': 'application/json',
  ...(process.env.OLLAMA_SECRET ? { 'X-Ollama-Secret': process.env.OLLAMA_SECRET } : {}),
}
```

### 2.8 Jalankan Tunnel sebagai Windows Service (Auto-start)

```powershell
# Pasang sebagai Windows Service agar auto-run saat PC nyala
cloudflared service install

# Start service
Start-Service cloudflared

# Cek status
Get-Service cloudflared
```

---

## BAGIAN 3 — Deploy Backend ke Render

### 3.1 Persiapan Repository

Pastikan `backend/` sudah di-push ke GitHub:

```bash
# Di root project
git add backend/
git commit -m "feat: add AI documentation agent with encryption"
git push origin main
```

Pastikan `backend/package.json` punya script start:
```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js"
  }
}
```

### 3.2 Buat Web Service di Render

1. Buka [render.com](https://render.com) → **New → Web Service**
2. Hubungkan GitHub repo Anda
3. Konfigurasi:

| Setting | Value |
|---------|-------|
| **Name** | `techflow-api` |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (atau Starter $7/mo untuk selalu aktif) |

### 3.3 Set Environment Variables di Render

Buka **Environment → Add Environment Variable**:

```env
# Database (PostgreSQL)
DB_HOST=<render-postgres-host>
DB_PORT=5432
DB_NAME=techflow
DB_USER=techflow
DB_PASSWORD=<db-password>
DATABASE_URL=postgresql://techflow:<pass>@<host>:5432/techflow

# App
PORT=3001
NODE_ENV=production
JWT_SECRET=<strong-random-secret>

# Ollama — arahkan ke Cloudflare Tunnel lokal
OLLAMA_URL=https://ollama.yourdomain.com
OLLAMA_MODEL=deepseek-coder:6.7b
OLLAMA_SECRET=<same-as-tunnel-secret>

# Enkripsi Source Code
RSA_PRIVATE_KEY=<output dari generateAndPrintKeys()>
CODE_ENCRYPT_KEY=<64-char-hex>

# CORS — izinkan Netlify domain
CORS_ORIGIN=https://techflow.yourdomain.com,https://[nama].netlify.app
```

### 3.4 Buat PostgreSQL di Render

1. **New → PostgreSQL**
2. Name: `techflow-db`
3. Plan: Free
4. Copy **Internal Database URL** → paste ke `DATABASE_URL` di Web Service

### 3.5 Update CORS di Backend

Edit `backend/src/index.js`:

```js
const cors = require('cors');

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Izinkan request tanpa origin (Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS: ' + origin));
  },
  credentials: true,
}));
```

### 3.6 Deploy & Verifikasi

Setelah save, Render otomatis deploy. Tunggu hingga status **Live**.

```bash
# Test backend dari terminal lokal
curl https://api.yourdomain.com/api/health
# Expected: { "status": "ok", "version": "1.0.0" }

curl https://api.yourdomain.com/api/ai/health
# Expected: { "status": "ollama_ok", ... }
```

---

## BAGIAN 4 — Deploy Frontend ke Netlify

### 4.1 Konfigurasi Vite untuk Production

Buat/edit `frontend/.env.production`:

```env
VITE_API_URL=https://api.yourdomain.com/api
```

Pastikan `frontend/src/config.js` membaca env var:

```js
export function getApiBaseUrl() {
  return import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
}
```

### 4.2 Buat `netlify.toml`

Buat file `frontend/netlify.toml`:

```toml
[build]
  base    = "frontend"
  publish = "dist"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "20"

# SPA routing — semua path arahkan ke index.html
[[redirects]]
  from   = "/*"
  to     = "/index.html"
  status = 200

# Security headers
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options        = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy        = "strict-origin-when-cross-origin"
    Permissions-Policy     = "camera=(), microphone=(), geolocation=()"
```

### 4.3 Deploy ke Netlify

**Opsi A — Via GitHub (Direkomendasikan)**

1. Buka [app.netlify.com](https://app.netlify.com) → **Add new site → Import from Git**
2. Pilih repo GitHub Anda
3. Konfigurasi:

| Setting | Value |
|---------|-------|
| **Base directory** | `frontend` |
| **Build command** | `npm run build` |
| **Publish directory** | `frontend/dist` |

4. Klik **Deploy site**

**Opsi B — Via Netlify CLI**

```powershell
npm install -g netlify-cli
cd frontend
npm run build
netlify deploy --dir=dist --prod
```

### 4.4 Set Environment Variables di Netlify

**Site settings → Environment variables → Add variable**:

```env
VITE_API_URL=https://api.yourdomain.com/api
```

### 4.5 Custom Domain di Netlify

1. **Domain settings → Add custom domain**
2. Masukkan: `techflow.yourdomain.com`
3. Netlify akan minta verifikasi DNS
4. Di Cloudflare, pastikan CNAME sudah ada:
   ```
   CNAME  techflow  →  [nama-site].netlify.app  (DNS only)
   ```
5. Netlify otomatis issue SSL via Let's Encrypt

---

## BAGIAN 5 — Konfigurasi Final & Verifikasi

### 5.1 Checklist Koneksi

```
✅ PC Lokal:
   □ Ollama berjalan (ollama serve)
   □ cloudflared tunnel berjalan (cloudflared tunnel run ollama-tunnel)
   □ Test: curl https://ollama.yourdomain.com/api/tags

✅ Render (Backend):
   □ OLLAMA_URL diset ke https://ollama.yourdomain.com
   □ DATABASE_URL tersambung ke PostgreSQL Render
   □ RSA_PRIVATE_KEY dan CODE_ENCRYPT_KEY sudah diisi
   □ Test: curl https://api.yourdomain.com/api/ai/health

✅ Netlify (Frontend):
   □ VITE_API_URL diset ke https://api.yourdomain.com/api
   □ netlify.toml redirect sudah ada
   □ Custom domain pointing ke Netlify
   □ Test: buka https://techflow.yourdomain.com
```

### 5.2 Test End-to-End

```bash
# 1. Cek Backend Health
curl https://api.yourdomain.com/api/health

# 2. Cek Ollama via Tunnel
curl https://api.yourdomain.com/api/ai/health

# 3. Cek Public Key (enkripsi)
curl https://api.yourdomain.com/api/ai/public-key

# 4. Test Parse
curl -X POST https://api.yourdomain.com/api/ai/parse \
  -H "Content-Type: application/json" \
  -d '{"source_code":"<?php class A { public function b() { $this->db->insert(\"t\",[]); } }","language":"php"}'
```

### 5.3 Diagnosa Cepat

| Masalah | Kemungkinan Penyebab | Solusi |
|---------|---------------------|--------|
| `ollama_unavailable` di Render | Tunnel offline | Cek `cloudflared tunnel run` di PC lokal |
| CORS error di browser | `CORS_ORIGIN` salah | Tambahkan URL Netlify ke `CORS_ORIGIN` di Render |
| 502 Bad Gateway dari Render | Backend crash | Cek logs di Render dashboard |
| SSL error Netlify | DNS belum propagasi | Tunggu 5-15 menit, cek `dig techflow.yourdomain.com` |
| Enkripsi gagal | `RSA_PRIVATE_KEY` salah format | Re-generate dengan `generateAndPrintKeys()` |
| Free Render spin-down | Render free tier hibernate | Upgrade ke $7/mo Starter atau pakai UptimeRobot ping |

---

## BAGIAN 6 — Tips Produksi

### 6.1 Cegah Render Spin-Down (Free Tier)

Render Free tier "tidur" setelah 15 menit idle → response pertama lambat 30 detik.

**Solusi — UptimeRobot (Gratis):**
1. Daftar di [uptimerobot.com](https://uptimerobot.com)
2. **Add New Monitor → HTTP(s)**
3. URL: `https://api.yourdomain.com/api/health`
4. Interval: **5 minutes**

### 6.2 Tunnel Otomatis Saat PC Mati/Restart

```powershell
# Pastikan cloudflared service sudah install (Bagian 2.8)
# Set startup type ke Automatic
Set-Service cloudflared -StartupType Automatic
```

Atau buat Task Scheduler:
- Trigger: **At startup**
- Action: `cloudflared.exe tunnel run ollama-tunnel`
- Run as: SYSTEM atau user Anda

### 6.3 Monitor Tunnel Status

```powershell
# Cek tunnel aktif
cloudflared tunnel list

# Cek logs tunnel
cloudflared tunnel info ollama-tunnel
```

Dashboard: [one.dash.cloudflare.com](https://one.dash.cloudflare.com) → Zero Trust → Networks → Tunnels

### 6.4 Backup Key Enkripsi

> [!CAUTION]
> Simpan `RSA_PRIVATE_KEY` dan `CODE_ENCRYPT_KEY` di **password manager** (Bitwarden, 1Password, dll).  
> Jika key hilang, semua source_code tersimpan di DB **tidak bisa didekripsi**.

---

## BAGIAN 7 — Ringkasan Biaya

| Service | Plan | Biaya/Bulan |
|---------|------|------------|
| Cloudflare DNS + Tunnel | Free | **$0** |
| Render Web Service | Free (spin-down) | **$0** |
| Render PostgreSQL | Free (90 hari) | **$0 → $7** |
| Netlify | Free | **$0** |
| Domain `.com` | — | ~$10-15/tahun |
| **Total** | | **~$0–$7/bulan** |

> Setelah 90 hari, Render PostgreSQL Free expired → upgrade ke $7/mo  
> atau migrate ke **Supabase Free** (PostgreSQL gratis selamanya)

### Alternatif Database Gratis Seumur Hidup

**Supabase (Direkomendasikan):**
1. Daftar di [supabase.com](https://supabase.com)
2. New Project → buat database
3. Settings → Database → copy **Connection String**
4. Paste ke `DATABASE_URL` di Render
5. Jalankan SQL schema TechFlow di Supabase SQL Editor

---

*Dokumen ini adalah panduan deployment TechFlow ke production environment.*  
*Untuk pertanyaan teknis, lihat source code di `c:\xampp\htdocs\tech\`*
