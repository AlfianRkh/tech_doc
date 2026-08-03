<?php
/**
 * OrderController
 * Contoh controller CodeIgniter untuk test AI Documentation Agent.
 * Copy-paste isi file ini ke textarea di halaman /documents → klik Analyze.
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
     * Entry point utama untuk membuat pesanan baru
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
     * Get order list milik user yang sedang login
     */
    public function index() {
        if (!$this->Auth->check()) {
            redirect('/login');
        }
        $user_id = $this->session->userdata('user_id');
        $orders  = $this->db->get_where('orders', ['user_id' => $user_id])->result_array();
        $this->response(['data' => $orders]);
    }

    /**
     * Update status pesanan (admin only)
     */
    public function updateStatus($order_id) {
        if (!$this->Auth->isAdmin()) {
            show_error('Forbidden', 403);
        }
        $status = $this->input->post('status');
        $this->db->update('orders', ['status' => $status, 'updated_at' => date('Y-m-d H:i:s')], ['id' => $order_id]);
        $this->notifyCustomer($order_id, $status);
        $this->logActivity('update_status', $order_id);
        $this->response(['success' => true]);
    }

    /**
     * Validasi data order sebelum disimpan
     */
    private function validateOrder($data) {
        if (empty($data['items'])) {
            throw new Exception('Items cannot be empty');
        }
        $cart = $this->db->get_where('carts', ['user_id' => $data['user_id']])->row();
        if (!$cart) {
            throw new Exception('Cart not found');
        }
        return true;
    }

    /**
     * Hitung ongkos kirim dari API eksternal kurir
     */
    private function calculateShipping($order_id, $address_id) {
        $address = $this->db->get_where('addresses', ['id' => $address_id])->row();
        $weight  = $this->Order_model->getTotalWeight($order_id);

        $shipping_cost = $this->callCourierAPI($address->city, $weight);

        $this->db->update('orders', ['shipping_cost' => $shipping_cost], ['id' => $order_id]);
    }

    /**
     * Panggil API eksternal kurir untuk mendapatkan tarif
     */
    private function callCourierAPI($city, $weight) {
        $url    = 'https://api.courier.com/rates?city=' . urlencode($city) . '&weight=' . $weight;
        $result = file_get_contents($url);
        $data   = json_decode($result, true);
        return $data['price'] ?? 0;
    }

    /**
     * Simpan log aktivitas user ke database
     */
    private function logActivity($action, $ref_id) {
        $this->db->insert('activity_logs', [
            'action'     => $action,
            'ref_id'     => $ref_id,
            'user_id'    => $this->session->userdata('user_id'),
            'created_at' => date('Y-m-d H:i:s'),
        ]);
    }

    /**
     * Kirim email konfirmasi order ke customer
     */
    private function sendConfirmationEmail($order_id) {
        $order = $this->db->get_where('orders', ['id' => $order_id])->row_array();
        $this->Mailer->send([
            'to'      => $order['email'],
            'subject' => 'Order Confirmation #' . $order_id,
            'body'    => format_email_body($order),
        ]);
    }

    /**
     * Kirim notifikasi ke customer saat status berubah
     */
    private function notifyCustomer($order_id, $new_status) {
        $order = $this->db->get_where('orders', ['id' => $order_id])->row_array();
        $message = 'Status pesanan #' . $order_id . ' berubah menjadi: ' . $new_status;
        $this->db->insert('notifications', [
            'user_id'    => $order['user_id'],
            'message'    => $message,
            'is_read'    => 0,
            'created_at' => date('Y-m-d H:i:s'),
        ]);
        $this->Mailer->send([
            'to'      => $order['email'],
            'subject' => 'Order Status Update',
            'body'    => $message,
        ]);
    }
}
