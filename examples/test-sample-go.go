// Package order — contoh Golang service untuk test AI Documentation Agent.
// Copy-paste isi file ini ke textarea di halaman /documents, pilih bahasa Go, klik Analyze.

package order

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/myapp/helpers"
	"github.com/myapp/mailer"
	"github.com/myapp/logger"
)

// OrderService manages order business logic
type OrderService struct {
	db     *sql.DB
	mailer *mailer.Client
	logger *logger.Logger
}

// CreateOrderRequest represents the incoming request payload
type CreateOrderRequest struct {
	UserID    int64       `json:"user_id"`
	Items     []OrderItem `json:"items"`
	AddressID int         `json:"address_id"`
	Total     float64     `json:"total"`
}

// OrderItem represents a single item in the order
type OrderItem struct {
	ProductID int     `json:"product_id"`
	Qty       int     `json:"qty"`
	Price     float64 `json:"price"`
}

// CreateOrder adalah entry point HTTP handler untuk membuat pesanan baru.
// Dipanggil dari router: POST /orders
func (s *OrderService) CreateOrder(w http.ResponseWriter, r *http.Request) {
	var req CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid payload", 400)
		return
	}

	if err := s.validateOrder(req); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	orderID, err := s.insertOrder(req)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	s.insertOrderItems(orderID, req.Items)
	s.calculateShipping(orderID, req.AddressID)
	s.logActivity("create_order", orderID)
	s.sendConfirmationEmail(orderID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   "ok",
		"order_id": orderID,
	})
}

// GetOrders mengambil daftar pesanan milik user
func (s *OrderService) GetOrders(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	rows, err := s.db.Query("SELECT id, total, status FROM orders WHERE user_id = $1 ORDER BY created_at DESC", userID)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	defer rows.Close()

	var orders []map[string]interface{}
	for rows.Next() {
		var id int64
		var total float64
		var status string
		rows.Scan(&id, &total, &status)
		orders = append(orders, map[string]interface{}{"id": id, "total": total, "status": status})
	}
	json.NewEncoder(w).Encode(orders)
}

// validateOrder memvalidasi data pesanan sebelum disimpan
func (s *OrderService) validateOrder(req CreateOrderRequest) error {
	if len(req.Items) == 0 {
		return helpers.NewError("items cannot be empty")
	}
	if req.Total <= 0 {
		return helpers.NewError("total must be greater than 0")
	}
	return nil
}

// insertOrder menyimpan header pesanan ke database
func (s *OrderService) insertOrder(req CreateOrderRequest) (int64, error) {
	var id int64
	err := s.db.QueryRow(
		"INSERT INTO orders (user_id, total, status) VALUES ($1, $2, 'pending') RETURNING id",
		req.UserID, req.Total,
	).Scan(&id)
	return id, err
}

// insertOrderItems menyimpan item-item dalam pesanan
func (s *OrderService) insertOrderItems(orderID int64, items []OrderItem) {
	for _, item := range items {
		s.db.Exec(
			"INSERT INTO order_items (order_id, product_id, qty, price) VALUES ($1, $2, $3, $4)",
			orderID, item.ProductID, item.Qty, item.Price,
		)
	}
}

// calculateShipping memanggil API kurir eksternal dan menyimpan biaya ongkos kirim
func (s *OrderService) calculateShipping(orderID int64, addressID int) {
	// Ambil data alamat dari database
	var city string
	s.db.QueryRow("SELECT city FROM addresses WHERE id = $1", addressID).Scan(&city)

	// Panggil API kurir eksternal
	resp, err := http.Get("https://api.courier.com/rates?city=" + city)
	if err != nil {
		s.logger.Error("courier API failed", err)
		return
	}
	defer resp.Body.Close()

	var result struct {
		Price float64 `json:"price"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	// Update ongkos kirim di database
	s.db.Exec(
		"UPDATE orders SET shipping_cost = $1 WHERE id = $2",
		result.Price, orderID,
	)
}

// logActivity mencatat aktivitas user ke tabel activity_logs
func (s *OrderService) logActivity(action string, refID int64) {
	s.db.Exec(
		"INSERT INTO activity_logs (action, ref_id, created_at) VALUES ($1, $2, NOW())",
		action, refID,
	)
}

// sendConfirmationEmail mengirim email konfirmasi kepada customer
func (s *OrderService) sendConfirmationEmail(orderID int64) {
	var email string
	var total float64
	s.db.QueryRow(
		"SELECT email, total FROM orders WHERE id = $1",
		orderID,
	).Scan(&email, &total)

	body := helpers.FormatOrderEmail(orderID, total)
	s.mailer.Send(email, "Order Confirmation #"+helpers.Int64ToString(orderID), body)
}
