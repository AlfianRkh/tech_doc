-- ============================================================
-- TechFlow Seed Data (Multi-Project & Dynamic RBAC)
-- ============================================================

-- 1. Insert Default Projects / Documentation Repos
INSERT INTO projects (id, name, code, description, color, icon) VALUES
(1, 'E-Commerce Platform', 'ECOMMERCE', 'Alur pemrosesan order, inventory, dan notifikasi customer', '#3b82f6', '🛒'),
(2, 'Payment & Finance Gateway', 'FINANCE', 'Alur verifikasi pembayaran, promo engine, dan jurnal keuangan', '#10b981', '💳')
ON CONFLICT (code) DO NOTHING;

-- Reset sequence for projects
SELECT setval('projects_id_seq', (SELECT MAX(id) FROM projects));

-- 2. Insert Default Roles
INSERT INTO roles (id, name, description, is_system) VALUES
(1, 'Admin', 'Akses penuh ke seluruh sistem, project, pengguna, dan aturan izin', TRUE),
(2, 'Editor', 'Dapat membuat dan mengedit alur dokumentasi serta node template', TRUE),
(3, 'Viewer', 'Akses lihat saja ke dokumentasi flow dan simulasi', TRUE)
ON CONFLICT (name) DO NOTHING;

SELECT setval('roles_id_seq', (SELECT MAX(id) FROM roles));

-- 3. Insert System Feature Permissions Registry
INSERT INTO permissions (key, name, module, description) VALUES
('flows:read', 'View Documentation Flows', 'Flows', 'Dapat melihat daftar dan detail alur dokumentasi'),
('flows:write', 'Create & Edit Flows', 'Flows', 'Dapat membuat, memperbarui alur dokumentasi'),
('flows:delete', 'Delete Flows', 'Flows', 'Dapat menghapus alur dokumentasi'),
('nodes:read', 'View Node Templates', 'Nodes', 'Dapat melihat katalog node template'),
('nodes:write', 'Manage Node Templates', 'Nodes', 'Dapat membuat dan mengedit node template'),
('nodes:delete', 'Delete Node Templates', 'Nodes', 'Dapat menghapus node template'),
('simulations:read', 'View Simulations', 'Simulations', 'Dapat melihat riwayat eksekusi simulasi'),
('simulations:run', 'Run Simulations', 'Simulations', 'Dapat menjalankan simulasi alur dokumentasi'),
('projects:read', 'View Projects', 'Projects', 'Dapat melihat daftar project documentation'),
('projects:write', 'Create & Edit Projects', 'Projects', 'Dapat membuat dan mengedit repository project'),
('projects:delete', 'Delete Projects', 'Projects', 'Dapat menghapus repository project'),
('users:read', 'View Users', 'User Management', 'Dapat melihat daftar pengguna sistem'),
('users:write', 'Manage Users & Roles', 'User Management', 'Dapat mengubah role pengguna dan akun'),
('roles:read', 'View Roles & Matrix', 'RBAC', 'Dapat melihat daftar role dan matriks izin'),
('roles:write', 'Manage Roles & Permissions', 'RBAC', 'Dapat membuat role baru dan mengatur centang izin'),
('permissions:manage', 'Manage Feature Registry', 'RBAC', 'Dapat menambah/mengedit registri izin fitur baru')
ON CONFLICT (key) DO NOTHING;

-- 4. Map Role Permissions
-- Admin Gets ALL Permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions
ON CONFLICT DO NOTHING;

-- Editor Permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions WHERE key IN (
  'flows:read', 'flows:write', 'nodes:read', 'nodes:write',
  'simulations:read', 'simulations:run', 'projects:read', 'projects:write'
)
ON CONFLICT DO NOTHING;

-- Viewer Permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions WHERE key IN (
  'flows:read', 'nodes:read', 'simulations:read', 'projects:read'
)
ON CONFLICT DO NOTHING;

-- 5. Insert Default Users (Passwords hashed with bcrypt for 'admin123', 'editor123', 'viewer123')
-- Hash for admin123 / editor123 / viewer123: $2b$10$COvZfsH3/6fkyL9xrhVw5O9zasO7YTvwRDF21mqiADkAu1sGKUCRm
INSERT INTO users (id, name, email, password_hash, role_id) VALUES
(1, 'Administrator', 'admin@techflow.com', '$2b$10$COvZfsH3/6fkyL9xrhVw5O9zasO7YTvwRDF21mqiADkAu1sGKUCRm', 1),
(2, 'Technical Editor', 'editor@techflow.com', '$2b$10$COvZfsH3/6fkyL9xrhVw5O9zasO7YTvwRDF21mqiADkAu1sGKUCRm', 2),
(3, 'API Viewer', 'viewer@techflow.com', '$2b$10$COvZfsH3/6fkyL9xrhVw5O9zasO7YTvwRDF21mqiADkAu1sGKUCRm', 3)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- 6. Insert Project Members
INSERT INTO project_members (project_id, user_id, role_id) VALUES
(1, 1, 1),
(1, 2, 2),
(1, 3, 3),
(2, 1, 1),
(2, 2, 2)
ON CONFLICT DO NOTHING;

-- 7. Insert Node Templates
INSERT INTO node_templates (project_id, name, node_type, description, icon, color, default_input_params, default_validation, default_process_logic, default_output_template) VALUES
(
  1, 'Create Order', 'Process', 'Membuat order baru dari data customer dan item', '📋', '#3b82f6',
  '{"customer_id":{"type":"integer","required":true,"value":501,"desc":"ID customer"},"items":{"type":"array","required":true,"value":"[{\"sku\":\"P001\",\"qty\":2}]","desc":"List item order"}}',
  'customer_id must be positive integer\nitems array must not be empty\neach item must have sku and qty',
  '1. Validate customer exists in DB\n2. Generate unique order_id\n3. Set status = "created"\n4. Save order to database\n5. Return order object',
  '{"order_id":1001,"customer_id":501,"status":"created","total_items":2,"created_at":"2024-01-01T10:00:00Z"}'
),
(
  1, 'Validate Product', 'Validation', 'Validasi produk dan ketersediaan stok', '✅', '#10b981',
  '{"order_id":{"type":"integer","required":true,"value":1001,"desc":"ID order"},"items":{"type":"array","required":true,"value":"[...]","desc":"Item list dari order"}}',
  'All items must exist in product catalog\nStock must be >= requested quantity\nProduct status must be "active"',
  '1. For each item, query product catalog\n2. Check product.status == "active"\n3. Verify stock >= requested qty\n4. Reserve stock temporarily',
  '{"order_id":1001,"validated":true,"items_ok":true,"stock_reserved":true,"reserved_until":"2024-01-01T10:05:00Z"}'
),
(
  1, 'Check Stock', 'Database', 'Cek dan reservasi stok di warehouse', '📦', '#8b5cf6',
  '{"items":{"type":"array","required":true,"value":"[...]","desc":"Items to check"},"warehouse_id":{"type":"string","required":false,"value":"WH01","desc":"Warehouse ID"}}',
  'warehouse_id must be a registered warehouse\nEach SKU must exist in inventory',
  'SELECT sku, qty_available, warehouse_id\nFROM inventory\nWHERE sku IN (...) AND warehouse_id = $1\nFOR UPDATE;\n\nUPDATE inventory SET qty_reserved = qty_reserved + $qty\nWHERE sku = $sku;',
  '{"stock_available":20,"warehouse":"WH01","reserved":2,"remaining":18,"check_time":"2024-01-01T10:00:03Z"}'
),
(
  1, 'Calculate Shipping', 'API', 'Hitung biaya pengiriman via courier API', '🚚', '#f59e0b',
  '{"destination":{"type":"string","required":true,"value":"JAKARTA","desc":"Destination city/region"},"weight":{"type":"decimal","required":true,"value":1.5,"desc":"Total weight in kg"},"courier":{"type":"string","required":false,"value":"JNE","desc":"Preferred courier"}}',
  'destination must be a valid shipping region\nweight must be > 0\ncourier must be in registered courier list',
  'POST https://api.courier.com/calculate\n{\n  "origin": "JAKARTA",\n  "destination": $destination,\n  "weight": $weight,\n  "service": "REG"\n}\nReturn: { cost, eta, courier, tracking_prefix }',
  '{"shipping_cost":15000,"courier":"JNE","eta":"2 days","service":"REG","tracking_prefix":"JNE"}'
),
(
  2, 'Apply Promo', 'Logic', 'Terapkan rule promo berdasarkan member level', '🎫', '#06b6d4',
  '{"order_id":{"type":"integer","required":true,"value":1001,"desc":"Order ID"},"subtotal":{"type":"decimal","required":true,"value":75000,"desc":"Order subtotal"},"member_level":{"type":"string","required":false,"value":"GOLD","desc":"BRONZE|SILVER|GOLD"}}',
  'member_level must be one of: BRONZE, SILVER, GOLD\nsubtotal must be positive',
  'IF member_level == "GOLD":\n  discount_pct = 0.10\nELSE IF member_level == "SILVER":\n  discount_pct = 0.05\nELSE IF member_level == "BRONZE":\n  discount_pct = 0.02\nELSE:\n  discount_pct = 0\n\ndiscount = subtotal * discount_pct\nfinal_price = subtotal - discount + shipping_cost',
  '{"discount":7500,"promo_code":"GOLD10","discount_pct":10,"final_price":82500}'
),
(
  2, 'Generate Journal', 'Finance', 'Buat jurnal akuntansi untuk transaksi', '📊', '#ec4899',
  '{"order_id":{"type":"integer","required":true,"value":1001,"desc":"Order ID"},"final_price":{"type":"decimal","required":true,"value":82500,"desc":"Final transaction amount"}}',
  'final_price must be positive\norder_id must be in pending status',
  '1. Create debit entry: Account Receivable\n2. Create credit entry: Revenue\n3. Create credit entry: Tax Payable (11%)\n4. Save all entries to General Ledger\n5. Generate journal reference number',
  '{"journal_id":"JRN-2024-001001","debit":"Piutang Usaha","credit":"Pendapatan","amount":82500,"tax":9075,"journal_ref":"JRN-2024-001001"}'
),
(
  1, 'Send to Courier', 'API', 'Kirim data order ke ekspedisi', '📨', '#f59e0b',
  '{"order_id":{"type":"integer","required":true,"value":1001,"desc":"Order ID"},"courier":{"type":"string","required":true,"value":"JNE","desc":"Courier code"}}',
  'courier must be registered in courier_list table\norder must have shipping_cost calculated',
  'POST https://api.jne.co.id/orders\n{\n  "reference": "TF-$order_id",\n  "sender": { ... },\n  "recipient": { ... },\n  "weight": $weight,\n  "service": $service\n}\nPoll for tracking number',
  '{"tracking_number":"JNE2024001001","status":"manifested","pickup_scheduled":"2024-01-02","courier":"JNE"}'
),
(
  2, 'Verify Payment', 'Validation', 'Verifikasi status pembayaran dari payment gateway', '💳', '#10b981',
  '{"order_id":{"type":"integer","required":true,"value":1001,"desc":"Order ID"},"payment_method":{"type":"string","required":true,"value":"TRANSFER","desc":"TRANSFER|VA|CREDIT_CARD|EWALLET"},"amount":{"type":"decimal","required":true,"value":82500,"desc":"Payment amount"}}',
  'payment_method must be valid\namount must match order.final_price\npayment must not be expired',
  '1. Query payment gateway for transaction status\n2. Verify amount matches order total\n3. Check payment not expired (< 24h)\n4. Update order.payment_status = "paid"',
  '{"payment_verified":true,"payment_method":"TRANSFER","paid_amount":82500,"payment_time":"2024-01-01T10:05:00Z","transaction_ref":"TRX-2024-001001"}'
),
(
  1, 'Send Notification', 'API', 'Kirim notifikasi email/WhatsApp ke customer', '📱', '#f59e0b',
  '{"order_id":{"type":"integer","required":true,"value":1001,"desc":"Order ID"},"channel":{"type":"string","required":true,"value":"EMAIL","desc":"EMAIL|WHATSAPP|SMS"},"template":{"type":"string","required":true,"value":"ORDER_CONFIRMED","desc":"Notification template"}}',
  'channel must be EMAIL, WHATSAPP, or SMS\ncustomer must have registered contact',
  'POST /api/notifications/send\n{\n  "recipient": customer.email,\n  "template": $template,\n  "data": { order_id, total, tracking }\n}',
  '{"sent":true,"channel":"EMAIL","recipient":"customer@email.com","message_id":"MSG-001","delivered_at":"2024-01-01T10:05:02Z"}'
),
(
  1, 'Update Inventory', 'Database', 'Update data inventory setelah order dikonfirmasi', '🏭', '#8b5cf6',
  '{"order_id":{"type":"integer","required":true,"value":1001,"desc":"Order ID"},"items":{"type":"array","required":true,"value":"[...]","desc":"Confirmed items"}}',
  'Items must have valid SKUs\nReserved stock must match confirmed order',
  'UPDATE inventory\nSET qty_available = qty_available - $qty,\n    qty_reserved = qty_reserved - $qty,\n    qty_sold = qty_sold + $qty\nWHERE sku = $sku;\n\nINSERT INTO inventory_log (...)',
  '{"updated_items":2,"total_deducted":2,"inventory_log_id":"INV-LOG-1001"}'
),
(
  1, 'Loop', 'Loop', 'Melakukan perulangan untuk setiap item dalam array', '🔁', '#f97316',
  '{"loop_over":{"type":"string","required":true,"value":"items","desc":"Nama variabel array di context"},"item_var":{"type":"string","required":true,"value":"item","desc":"Nama variabel per item di dalam loop"}}',
  'loop_over must be a string and exist in context as array\nitem_var must be a non-empty string',
  '1. Ambil array dari context menggunakan key loop_over\n2. Untuk setiap item di array, set context[item_var] = item\n3. Eksekusi branch "body"\n4. Setelah semua item selesai diproses, eksekusi branch "next"',
  '{"loop_completed":true}'
);

-- 8. Insert Sample Flows (Belonging to Project 1 & Project 2)
INSERT INTO flows (id, project_id, name, description, version, status) VALUES
(1, 1, 'Order Processing Flow', 'Alur lengkap pemrosesan order dari create hingga pengiriman', 'v1.2', 'active'),
(2, 2, 'Payment Verification Flow', 'Proses verifikasi dan konfirmasi pembayaran multi metode', 'v1.1', 'active'),
(3, 1, 'Inventory Management Flow', 'Manajemen stok dan update inventory real-time', 'v1.0', 'active'),
(4, 2, 'Promo Engine Flow', 'Engine eksekusi dan validasi promo serta diskon', 'v1.3', 'active'),
(5, 1, 'User Registration Flow', 'Pendaftaran dan verifikasi user baru', 'v1.0', 'draft')
ON CONFLICT (id) DO NOTHING;

SELECT setval('flows_id_seq', (SELECT MAX(id) FROM flows));

-- Flow 1 Nodes: Order Processing
INSERT INTO flow_nodes (flow_id, label, node_type, icon, color, pos_x, pos_y, input_params, validation_rules, process_logic, output_template, order_index) VALUES
(1, 'Start', 'Start', '▶', '#10b981', 40, 120, '{}', '', 'Flow triggered manually or via API', '{"trigger":"manual","timestamp":"10:00:00","session_id":"SIM-001"}', 0),
(1, 'Create Order', 'Process', '📋', '#3b82f6', 200, 100, '{"customer_id":{"type":"integer","required":true,"value":501},"items":{"type":"array","required":true,"value":"[{\"sku\":\"P001\",\"qty\":2}]"}}', 'customer_id must exist\nitems must not be empty', '1. Validate customer\n2. Generate order_id\n3. Set status=created\n4. Save to DB', '{"order_id":1001,"customer_id":501,"status":"created","created_at":"10:00:01"}', 1),
(1, 'Validate Item', 'Validation', '✅', '#10b981', 360, 100, '{"order_id":{"type":"integer","required":true,"value":1001},"items":{"type":"array","required":true,"value":"[...]"}}', 'All items must be available\nStock must be sufficient', '1. Check each item in DB\n2. Verify stock qty\n3. Reserve stock\n4. Return validation result', '{"order_id":1001,"validated":true,"items_ok":true,"stock_reserved":true}', 2),
(1, 'Check Stock', 'Database', '📦', '#8b5cf6', 520, 100, '{"items":{"type":"array","required":true,"value":"[...]"},"warehouse_id":{"type":"string","required":false,"value":"WH01"}}', 'warehouse_id must be valid', 'SELECT qty FROM inventory\nWHERE sku IN (...)\nRESERVE qty for order', '{"stock_available":20,"warehouse":"WH01","reserved":2,"remaining":18}', 3),
(1, 'Auth Check', 'Decision', '◆', '#ef4444', 680, 100, '{"auth":{"type":"boolean","required":true,"value":true}}', 'auth must be boolean', 'Evaluate if user is authenticated', '{"auth_result":"success","branch":"true"}', 4),
(1, 'Calculate Shipping', 'API', '🚚', '#f59e0b', 840, 80, '{"destination":{"type":"string","required":true,"value":"JABODETABEK"},"weight":{"type":"decimal","required":true,"value":1.5}}', 'destination must be valid region', 'POST /api/shipping/calculate\n{ origin, destination, weight }\nReturn shipping cost & ETA', '{"shipping_cost":15000,"courier":"JNE","eta":"2 days","service":"REG"}', 5),
(1, 'Auth Failed', 'End', '❌', '#ef4444', 840, 220, '{}', '', 'Return authentication error', '{"error":"Unauthorized","code":401}', 5),
(1, 'Apply Promo', 'Logic', '🎫', '#06b6d4', 1000, 80, '{"order_id":{"type":"integer","required":true,"value":1001},"subtotal":{"type":"decimal","required":true,"value":75000},"member_level":{"type":"string","required":false,"value":"GOLD"}}', 'member_level: BRONZE|SILVER|GOLD', 'IF member_level == GOLD:\n  discount = subtotal * 0.1\nELSE IF member_level == SILVER:\n  discount = subtotal * 0.05\nELSE:\n  discount = 0', '{"discount":7500,"promo_code":"GOLD10","final_price":67500}', 6),
(1, 'Generate Journal', 'Finance', '📊', '#ec4899', 1160, 80, '{"order_id":{"type":"integer","required":true,"value":1001},"final_price":{"type":"decimal","required":true,"value":67500}}', 'final_price must be positive', '1. Create debit entry\n2. Create credit entry\n3. Save to GL\n4. Return journal_id', '{"journal_id":"JRN-001","debit":"Piutang","credit":"Pendapatan","amount":67500}', 7),
(1, 'Send to Courier', 'API', '📨', '#f59e0b', 1320, 80, '{"order_id":{"type":"integer","required":true,"value":1001},"courier":{"type":"string","required":true,"value":"JNE"}}', 'courier must be registered', 'POST /api/courier/send\nWait for tracking number\nUpdate order status', '{"tracking_number":"JNE2024001001","status":"manifested"}', 8),
(1, 'End', 'End', '■', '#ef4444', 1480, 120, '{}', '', 'Flow completed', '{"status":"completed","message":"Order processed successfully"}', 9);

-- Flow 1 Connections
INSERT INTO flow_connections (flow_id, source_node_id, target_node_id, branch_label) VALUES
(1, 1, 2, NULL),
(1, 2, 3, NULL),
(1, 3, 4, NULL),
(1, 4, 5, NULL),
(1, 5, 6, 'true'),
(1, 5, 7, 'false'),
(1, 6, 8, NULL),
(1, 8, 9, NULL),
(1, 9, 10, NULL),
(1, 10, 11, NULL);
