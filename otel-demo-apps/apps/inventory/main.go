package main

import (
	"encoding/json"
	"io"
	"math/rand"
	"net/http"
	"os"
	"time"
)

var (
	port        = getEnv("PORT", "8080")
	orderURL    = getEnv("ORDER_URL", "http://order:8080")
	serviceName = getEnv("OTEL_SERVICE_NAME", "inventory")
)

// LogEntry represents a structured log entry
type LogEntry struct {
	Timestamp string                 `json:"timestamp"`
	Level     string                 `json:"level"`
	Service   string                 `json:"service"`
	Msg       string                 `json:"msg"`
	Extra     map[string]interface{} `json:"-"`
}

func (l LogEntry) MarshalJSON() ([]byte, error) {
	type Alias LogEntry
	m := map[string]interface{}{
		"timestamp": l.Timestamp,
		"level":     l.Level,
		"service":   l.Service,
		"msg":       l.Msg,
	}
	for k, v := range l.Extra {
		m[k] = v
	}
	return json.Marshal(m)
}

func logJSON(level, msg string, extra map[string]interface{}) {
	entry := LogEntry{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Level:     level,
		Service:   serviceName,
		Msg:       msg,
		Extra:     extra,
	}
	json.NewEncoder(os.Stdout).Encode(entry)
}

func logInfo(msg string, extra map[string]interface{})  { logJSON("info", msg, extra) }
func logWarn(msg string, extra map[string]interface{})  { logJSON("warn", msg, extra) }
func logError(msg string, extra map[string]interface{}) { logJSON("error", msg, extra) }

// InventoryItem represents stock for a product
type InventoryItem struct {
	ProductID int    `json:"product_id"`
	Quantity  int    `json:"quantity"`
	Warehouse string `json:"warehouse"`
}

// Response is the standard response format
type Response struct {
	Service    string          `json:"service"`
	Items      []InventoryItem `json:"items,omitempty"`
	Downstream json.RawMessage `json:"downstream,omitempty"`
	Error      string          `json:"error,omitempty"`
	Message    string          `json:"message,omitempty"`
}

// Sample inventory data
var inventory = []InventoryItem{
	{ProductID: 1, Quantity: 50, Warehouse: "US-EAST"},
	{ProductID: 2, Quantity: 200, Warehouse: "US-EAST"},
	{ProductID: 3, Quantity: 75, Warehouse: "US-WEST"},
	{ProductID: 4, Quantity: 150, Warehouse: "EU-CENTRAL"},
	{ProductID: 5, Quantity: 30, Warehouse: "US-WEST"},
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "healthy",
		"service": "inventory",
	})
}

func inventoryHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	requestID := randString(8)

	slow := r.URL.Query().Get("slow") == "true"
	triggerError := r.URL.Query().Get("error") == "true"

	logInfo("Processing inventory request", map[string]interface{}{
		"request_id": requestID,
		"slow":       slow,
		"error":      triggerError,
		"client_ip":  r.RemoteAddr,
	})

	// Check warehouse capacity
	for _, item := range inventory {
		if item.Quantity < 50 {
			logWarn("Low stock alert for warehouse", map[string]interface{}{
				"request_id": requestID,
				"product_id": item.ProductID,
				"quantity":   item.Quantity,
				"warehouse":  item.Warehouse,
				"threshold":  50,
			})
		}
	}

	// Optional simulated delay
	if slow {
		delay := 100 + rand.Intn(300)
		logWarn("Slow request mode - simulating latency", map[string]interface{}{
			"request_id": requestID,
			"delay_ms":   delay,
		})
		time.Sleep(time.Duration(delay) * time.Millisecond)
	}

	// Build downstream URL
	downstreamURL := orderURL + "/orders/check"
	if slow || triggerError {
		downstreamURL += "?"
		if slow {
			downstreamURL += "slow=true"
		}
		if triggerError {
			if slow {
				downstreamURL += "&"
			}
			downstreamURL += "error=true"
		}
	}

	logInfo("Calling order service", map[string]interface{}{
		"request_id": requestID,
		"order_url":  orderURL,
	})

	// Call order service
	start := time.Now()
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(downstreamURL)
	duration := time.Since(start).Milliseconds()

	if err != nil {
		logError("Failed to call order service", map[string]interface{}{
			"request_id":  requestID,
			"error":       err.Error(),
			"order_url":   orderURL,
			"duration_ms": duration,
		})
		w.WriteHeader(http.StatusBadGateway)
		json.NewEncoder(w).Encode(Response{
			Service: "inventory",
			Error:   "Failed to reach order service",
			Message: err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		logWarn("Order service returned error status", map[string]interface{}{
			"request_id":  requestID,
			"status_code": resp.StatusCode,
			"duration_ms": duration,
		})
	} else {
		logInfo("Order service response received", map[string]interface{}{
			"request_id":  requestID,
			"status_code": resp.StatusCode,
			"duration_ms": duration,
		})
	}

	// Log inventory summary
	totalItems := 0
	for _, item := range inventory {
		totalItems += item.Quantity
	}
	logInfo("Returning inventory data", map[string]interface{}{
		"request_id":   requestID,
		"item_count":   len(inventory),
		"total_stock":  totalItems,
		"warehouse_count": 3,
	})

	response := Response{
		Service:    "inventory",
		Items:      inventory,
		Downstream: json.RawMessage(body),
	}

	if resp.StatusCode != http.StatusOK {
		w.WriteHeader(resp.StatusCode)
	}
	json.NewEncoder(w).Encode(response)
}

func randString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

func main() {
	rand.Seed(time.Now().UnixNano())

	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/inventory", inventoryHandler)

	logInfo("Inventory service starting", map[string]interface{}{
		"port":      port,
		"order_url": orderURL,
		"warehouses": []string{"US-EAST", "US-WEST", "EU-CENTRAL"},
	})

	addr := ":" + port
	if err := http.ListenAndServe(addr, nil); err != nil {
		logError("Server failed to start", map[string]interface{}{
			"error": err.Error(),
			"port":  port,
		})
	}
}
