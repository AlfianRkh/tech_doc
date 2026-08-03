/**
 * test-ai-agent.js
 * Test script untuk verifikasi fitur AI Documentation Agent
 * Jalankan: node test-ai-agent.js
 */

const http = require('http');

// ─── Helper ──────────────────────────────────────────────────────────────────

function httpGet(path) {
  return new Promise((resolve) => {
    http.get('http://localhost:3001' + path, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    }).on('error', (e) => resolve({ status: 0, body: e.message }));
  });
}

function httpPost(path, payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = http.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', (e) => resolve({ status: 0, body: e.message }));
    req.write(body);
    req.end();
  });
}

function section(title) {
  console.log('\n' + '═'.repeat(55));
  console.log('  ' + title);
  console.log('═'.repeat(55));
}

function ok(label, value) {
  console.log(`  ✅  ${label.padEnd(20)} ${value}`);
}
function warn(label, value) {
  console.log(`  ⚠️   ${label.padEnd(20)} ${value}`);
}
function fail(label, value) {
  console.log(`  ❌  ${label.padEnd(20)} ${value}`);
}

// ─── Sample Codes ─────────────────────────────────────────────────────────────

const SAMPLE_PHP = `<?php
/**
 * OrderController - Handles order creation and management
 */
class OrderController extends CI_Controller {

    public function __construct() {
        parent::__construct();
        $this->load->model('Order_model');
        $this->load->library('Auth');
        $this->load->library('Mailer');
        $this->load->helper('format');
        $this->load->helper('currency');
    }

    /**
     * Create new order
     */
    public function create() {
        if (!$this->Auth->check()) {
            redirect('/login');
        }

        $data = $this->input->post();
        $this->validateOrder($data);

        $order_id = $this->Order_model->insert($data);
        $this->calculateShipping($order_id, $data['address_id']);
        $this->logActivity('create_order', $order_id);
        $this->sendConfirmationEmail($order_id);

        $this->response(['status' => 'ok', 'order_id' => $order_id]);
    }

    /**
     * Validate incoming order data
     */
    private function validateOrder($data) {
        if (empty($data['items'])) {
            throw new Exception('Items cannot be empty');
        }
        $total = $this->db->get_where('carts', ['user_id' => $data['user_id']])->row();
        return $total;
    }

    /**
     * Calculate shipping cost
     */
    private function calculateShipping($order_id, $address_id) {
        $address = $this->db->get_where('addresses', ['id' => $address_id])->row();
        $weight  = $this->Order_model->getTotalWeight($order_id);

        // Call external courier API
        $shipping_cost = $this->callCourierAPI($address->city, $weight);

        $this->db->update('orders', ['shipping_cost' => $shipping_cost], ['id' => $order_id]);
    }

    /**
     * Call external courier API
     */
    private function callCourierAPI($city, $weight) {
        $url = 'https://api.courier.com/rates?city=' . $city . '&weight=' . $weight;
        $result = file_get_contents($url);
        return json_decode($result, true)['price'];
    }

    /**
     * Log user activity
     */
    private function logActivity($action, $ref_id) {
        $this->db->insert('activity_logs', [
            'action'   => $action,
            'ref_id'   => $ref_id,
            'user_id'  => $this->session->userdata('user_id'),
            'created_at' => date('Y-m-d H:i:s'),
        ]);
    }

    /**
     * Send order confirmation email
     */
    private function sendConfirmationEmail($order_id) {
        $order = $this->db->get_where('orders', ['id' => $order_id])->row_array();
        $this->Mailer->send([
            'to'      => $order['email'],
            'subject' => 'Order Confirmation #' . $order_id,
            'body'    => format_email_body($order),
        ]);
    }
}
`;

const SAMPLE_GO = `package order

import (
    "database/sql"
    "net/http"
    "encoding/json"
    "github.com/myapp/helpers"
    "github.com/myapp/mailer"
)

type OrderService struct {
    db     *sql.DB
    mailer *mailer.Client
}

// CreateOrder handles new order creation
func (s *OrderService) CreateOrder(w http.ResponseWriter, r *http.Request) {
    var req CreateOrderRequest
    json.NewDecoder(r.Body).Decode(&req)

    if err := s.validateOrder(req); err != nil {
        http.Error(w, err.Error(), 400)
        return
    }

    orderID, err := s.insertOrder(req)
    if err != nil {
        http.Error(w, err.Error(), 500)
        return
    }

    s.calculateShipping(orderID, req.AddressID)
    s.logActivity("create_order", orderID)
    s.sendEmail(orderID)

    json.NewEncoder(w).Encode(map[string]interface{}{"order_id": orderID})
}

// validateOrder validates order fields
func (s *OrderService) validateOrder(req CreateOrderRequest) error {
    if len(req.Items) == 0 {
        return helpers.NewError("items cannot be empty")
    }
    return nil
}

// insertOrder saves order to DB
func (s *OrderService) insertOrder(req CreateOrderRequest) (int64, error) {
    row := s.db.QueryRow(
        "INSERT INTO orders (user_id, total) VALUES ($1, $2) RETURNING id",
        req.UserID, req.Total,
    )
    var id int64
    row.Scan(&id)
    return id, nil
}

// calculateShipping calls external API and updates order
func (s *OrderService) calculateShipping(orderID int64, addressID int) {
    resp, _ := http.Get("https://api.courier.com/rates?order=" + string(orderID))
    defer resp.Body.Close()

    var cost struct{ Price float64 }
    json.NewDecoder(resp.Body).Decode(&cost)

    s.db.Exec("UPDATE orders SET shipping_cost = $1 WHERE id = $2", cost.Price, orderID)
}

// logActivity records user action
func (s *OrderService) logActivity(action string, refID int64) {
    s.db.Exec(
        "INSERT INTO activity_logs (action, ref_id) VALUES ($1, $2)",
        action, refID,
    )
}

// sendEmail sends confirmation email
func (s *OrderService) sendEmail(orderID int64) {
    var order struct{ Email string; Total float64 }
    s.db.QueryRow("SELECT email, total FROM orders WHERE id = $1", orderID).Scan(&order.Email, &order.Total)
    s.mailer.Send(order.Email, "Order Confirmation", helpers.FormatOrderEmail(order))
}
`;

// ─── Tests ────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n🤖 TechFlow AI Documentation Agent — Test Suite');
  console.log('   ' + new Date().toLocaleString('id-ID'));

  // ── Test 1: Backend Health
  section('TEST 1: Backend Health');
  const health = await httpGet('/api/health');
  if (health.status === 200) {
    ok('Backend', 'Running on port 3001');
  } else {
    fail('Backend', 'NOT running — jalankan: npm run dev');
    process.exit(1);
  }

  // ── Test 2: Ollama Health
  section('TEST 2: Ollama Health (/api/ai/health)');
  const aiHealth = await httpGet('/api/ai/health');
  const aij = JSON.parse(aiHealth.body);
  if (aij.status === 'ollama_ok') {
    ok('Ollama', aij.status);
    ok('Default model', aij.default_model);
    ok('Models available', aij.available_models?.join(', ') || '(none)');
  } else {
    warn('Ollama', 'OFFLINE — Parse Only mode masih bisa digunakan');
    warn('Fix', 'Install: winget install Ollama.Ollama');
    warn('Pull model', 'ollama pull deepseek-coder:6.7b');
  }

  // ── Test 3: PHP Parse (no AI)
  section('TEST 3: PHP Parse Only (/api/ai/parse)');
  const phpParse = await httpPost('/api/ai/parse', {
    source_code: SAMPLE_PHP,
    language: 'php',
  });

  if (phpParse.status === 200) {
    const r = JSON.parse(phpParse.body);
    const fns = r.analysis?.functions || [];
    ok('Status', '200 OK');
    ok('Title (class)', r.analysis?.title || '—');
    ok('Functions found', fns.length + ' functions');

    fns.forEach((fn) => {
      console.log(`\n  📌 fn: ${fn.name}()`);
      if (fn.calls_libraries?.length)
        console.log(`     📦 Libraries : ${fn.calls_libraries.join(', ')}`);
      if (fn.calls_helpers?.length)
        console.log(`     🔧 Helpers   : ${fn.calls_helpers.join(', ')}`);
      if (fn.db_operations?.length)
        console.log(`     🗄  DB ops    : ${fn.db_operations.map((d) => `${d.type}:${d.table}`).join(', ')}`);
      if (fn.calls_functions?.length)
        console.log(`     🔵 Calls     : ${fn.calls_functions.join(', ')}`);
    });

    console.log('\n  📊 Call Graph connections:');
    (r.analysis?.flow_connections || []).slice(0, 8).forEach((c) => {
      const label = c.label ? ` --[${c.label}]-->` : ' →';
      console.log(`     ${c.from}${label} ${c.to}`);
    });

    console.log('\n  📄 Markdown preview:');
    console.log('  ' + (r.markdown?.slice(0, 400).split('\n').join('\n  ') || '(empty)'));
  } else {
    fail('PHP Parse', phpParse.status + ' — ' + phpParse.body.slice(0, 100));
  }

  // ── Test 4: Go Parse (no AI)
  section('TEST 4: Golang Parse Only (/api/ai/parse)');
  const goParse = await httpPost('/api/ai/parse', {
    source_code: SAMPLE_GO,
    language: 'golang',
  });

  if (goParse.status === 200) {
    const r = JSON.parse(goParse.body);
    const fns = r.analysis?.functions || [];
    ok('Status', '200 OK');
    ok('Package', r.analysis?.title || '—');
    ok('Functions found', fns.length + ' functions');

    fns.forEach((fn) => {
      console.log(`\n  📌 fn: ${fn.class ? fn.class + '.' : ''}${fn.name}()`);
      if (fn.calls_libraries?.length)
        console.log(`     📦 Libraries : ${fn.calls_libraries.join(', ')}`);
      if (fn.db_operations?.length)
        console.log(`     🗄  DB ops    : ${fn.db_operations.map((d) => `${d.type}:${d.table}`).join(', ')}`);
    });
  } else {
    fail('Go Parse', goParse.status + ' — ' + goParse.body.slice(0, 100));
  }

  // ── Test 5: Documents list
  section('TEST 5: Document List (/api/ai/documents)');
  const docList = await httpGet('/api/ai/documents');
  if (docList.status === 200) {
    const docs = JSON.parse(docList.body);
    ok('Status', '200 OK');
    ok('Saved documents', docs.length + ' items');
  } else {
    fail('Doc List', docList.status);
  }

  // ── Test 6: AI Analyze (jika Ollama tersedia)
  const ollamaOk = JSON.parse(aiHealth.body).status === 'ollama_ok';
  section('TEST 6: AI Analyze (/api/ai/analyze)' + (!ollamaOk ? ' — SKIP (Ollama offline)' : ''));

  if (ollamaOk) {
    console.log('  Mengirim PHP code ke Ollama deepseek-coder...');
    console.log('  (Ini bisa memakan waktu 30-120 detik tergantung hardware)\n');

    const analyzeRes = await httpPost('/api/ai/analyze', {
      source_code: SAMPLE_PHP,
      language: 'php',
      title: 'OrderController Test',
      save_to_db: true,
    });

    if (analyzeRes.status === 202) {
      const j = JSON.parse(analyzeRes.body);
      ok('Analyze started', 'doc ID = ' + j.id + ', status = ' + j.status);
      ok('SSE Stream', `http://localhost:3001/api/ai/analyze/${j.id}/stream`);
      console.log('\n  ℹ️  Untuk melihat hasil AI lengkap, buka UI di browser:');
      console.log('     http://localhost:5173/documents');
      console.log('     → Pilih dokumen "OrderController Test" di panel kiri');
    } else {
      fail('AI Analyze', analyzeRes.status + ' — ' + analyzeRes.body.slice(0, 200));
    }
  } else {
    warn('SKIP', 'Ollama tidak running — jalankan: ollama serve');
    console.log('\n  ℹ️  Fitur Parse Only masih berfungsi penuh tanpa Ollama.');
    console.log('     Buka UI: http://localhost:5173/documents → klik "⚡ Parse Only"');
  }

  // ── Summary
  section('SUMMARY');
  console.log('  Buka browser ke: http://localhost:5173/documents');
  console.log('  Paste salah satu contoh kode di bawah ke textarea:\n');
  console.log('  PHP  → test-sample-php.php  (OrderController)');
  console.log('  Go   → test-sample-go.go    (OrderService)\n');
  console.log('  Klik "⚡ Parse Only" untuk hasil instan (tanpa AI)');
  console.log('  Klik "🤖 Analyze with AI" untuk dokumentasi AI lengkap\n');
}

run().catch(console.error);
