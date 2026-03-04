import os
import sys
import time
import random
import json
import logging
import requests
from datetime import datetime
from flask import Flask, jsonify, request

app = Flask(__name__)

PORT = int(os.environ.get('PORT', 8080))
INVENTORY_URL = os.environ.get('INVENTORY_URL', 'http://inventory:8080')
SERVICE_NAME = os.environ.get('OTEL_SERVICE_NAME', 'catalog')

# Configure structured JSON logging
class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_obj = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname.lower(),
            'service': SERVICE_NAME,
            'msg': record.getMessage(),
        }
        if hasattr(record, 'extra'):
            log_obj.update(record.extra)
        if record.exc_info:
            log_obj['exception'] = self.formatException(record.exc_info)
        return json.dumps(log_obj)

handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JsonFormatter())
logging.root.handlers = [handler]
logging.root.setLevel(logging.INFO)
logger = logging.getLogger(SERVICE_NAME)

def log_with_extra(level, msg, **kwargs):
    record = logger.makeRecord(logger.name, level, '', 0, msg, (), None)
    record.extra = kwargs
    logger.handle(record)

# Sample product catalog
PRODUCTS = [
    {"id": 1, "name": "Kubernetes Handbook", "price": 49.99, "category": "books"},
    {"id": 2, "name": "Cloud Native Stickers", "price": 9.99, "category": "merch"},
    {"id": 3, "name": "Observability T-Shirt", "price": 29.99, "category": "merch"},
    {"id": 4, "name": "SRE Coffee Mug", "price": 14.99, "category": "merch"},
    {"id": 5, "name": "DevOps Hoodie", "price": 59.99, "category": "merch"},
]


@app.route('/health')
def health():
    return jsonify({"status": "healthy", "service": "catalog"})


@app.route('/catalog')
def get_catalog():
    slow = request.args.get('slow') == 'true'
    error = request.args.get('error') == 'true'
    request_id = f"{random.randint(1000, 9999)}"
    
    log_with_extra(logging.INFO, 'Processing catalog request', 
                   request_id=request_id, slow=slow, error=error, 
                   client_ip=request.remote_addr)
    
    # Optional simulated delay
    if slow:
        delay = random.uniform(0.1, 0.4)
        log_with_extra(logging.WARNING, 'Slow request mode - adding delay',
                       request_id=request_id, delay_seconds=round(delay, 3))
        time.sleep(delay)
    
    # Randomly log product access patterns
    if random.random() < 0.3:
        popular = random.choice(PRODUCTS)
        log_with_extra(logging.INFO, 'Popular product accessed frequently',
                       request_id=request_id, product_id=popular['id'], 
                       product_name=popular['name'])
    
    # Check for low inventory warning
    low_stock_threshold = 40
    for product in PRODUCTS:
        if product['id'] == 5:  # DevOps Hoodie often low
            log_with_extra(logging.WARNING, 'Product has low stock levels',
                           request_id=request_id, product_id=product['id'],
                           product_name=product['name'], threshold=low_stock_threshold)
            break
    
    try:
        params = {}
        if slow:
            params['slow'] = 'true'
        if error:
            params['error'] = 'true'
        
        log_with_extra(logging.INFO, 'Calling inventory service',
                       request_id=request_id, inventory_url=INVENTORY_URL)
        
        start = time.time()
        response = requests.get(f"{INVENTORY_URL}/inventory", params=params, timeout=10)
        duration = (time.time() - start) * 1000
        
        inventory_data = response.json()
        
        if response.status_code >= 400:
            log_with_extra(logging.WARNING, 'Inventory service returned error',
                           request_id=request_id, status_code=response.status_code,
                           duration_ms=round(duration, 2))
        else:
            log_with_extra(logging.INFO, 'Inventory response received',
                           request_id=request_id, status_code=response.status_code,
                           duration_ms=round(duration, 2), 
                           item_count=len(inventory_data.get('items', [])))
        
        # Enrich products with inventory data
        enriched_products = []
        inventory_map = {item['product_id']: item for item in inventory_data.get('items', [])}
        
        for product in PRODUCTS:
            inv = inventory_map.get(product['id'], {})
            quantity = inv.get('quantity', 0)
            enriched_products.append({
                **product,
                "in_stock": quantity > 0,
                "quantity": quantity
            })
            
            # Log out of stock items
            if quantity == 0:
                log_with_extra(logging.WARNING, 'Product is out of stock',
                               request_id=request_id, product_id=product['id'],
                               product_name=product['name'])
        
        log_with_extra(logging.INFO, 'Catalog request completed successfully',
                       request_id=request_id, product_count=len(enriched_products))
        
        return jsonify({
            "service": "catalog",
            "products": enriched_products,
            "downstream": inventory_data
        }), response.status_code if response.status_code != 200 else 200
        
    except requests.Timeout:
        log_with_extra(logging.ERROR, 'Inventory service request timed out',
                       request_id=request_id, inventory_url=INVENTORY_URL, timeout_seconds=10)
        return jsonify({
            "service": "catalog",
            "error": "Inventory service timeout",
            "message": "Request timed out after 10 seconds"
        }), 504
        
    except requests.RequestException as e:
        log_with_extra(logging.ERROR, 'Failed to call inventory service',
                       request_id=request_id, error=str(e), inventory_url=INVENTORY_URL)
        return jsonify({
            "service": "catalog",
            "error": "Failed to reach inventory service",
            "message": str(e)
        }), 502


if __name__ == '__main__':
    log_with_extra(logging.INFO, 'Catalog service starting',
                   port=PORT, inventory_url=INVENTORY_URL, product_count=len(PRODUCTS))
    app.run(host='0.0.0.0', port=PORT)
