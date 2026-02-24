const express = require('express');
const winston = require('winston');
const { OpenTelemetryTransportV3 } = require('@opentelemetry/winston-transport');
const Pyroscope = require('@pyroscope/nodejs');

const app = express();
const PORT = process.env.PORT || 8080;
const CATALOG_URL = process.env.CATALOG_URL || 'http://catalog:8080';
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'frontend';

Pyroscope.init({
    serverAddress: process.env.PYROSCOPE_SERVER_ADDRESS || 'http://grafana-alloy-receiver.observability.svc.cluster.local:4040',
    appName: process.env.PYROSCOPE_APPLICATION_NAME || 'otel-demo-apps-frontend',
    tags: {
      service: 'otel-demo-apps-frontend',
      namespace: 'demo'
    },
    wall: {
      collectCpuTime: true
    }
});

Pyroscope.start()

// Winston logger with JSON format for OTel compatibility
// OpenTelemetryTransportV3 sends logs to the OTel SDK for OTLP export
const log = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: SERVICE_NAME },
  transports: [
    new winston.transports.Console(),
    new OpenTelemetryTransportV3()
  ]
});

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      user_agent: req.get('user-agent')
    };
    
    if (res.statusCode >= 500) {
      log.error('Request completed with server error', logData);
    } else if (res.statusCode >= 400) {
      log.warn('Request completed with client error', logData);
    } else if (req.path !== '/health') {
      log.info('Request completed', logData);
    }
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'frontend' });
});

// Main page - simple UI
app.get('/', (req, res) => {
  log.info('Serving frontend UI', { client_ip: req.ip });
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>OTel Demo - Frontend</title>
      <style>
        body { font-family: system-ui, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; background: #1a1a2e; color: #eee; }
        h1 { color: #00d9ff; }
        .card { background: #16213e; padding: 20px; border-radius: 8px; margin: 20px 0; }
        button { background: #00d9ff; color: #1a1a2e; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; font-size: 16px; margin: 5px; }
        button:hover { background: #00b8d4; }
        button.error { background: #ff6b6b; }
        button.slow { background: #ffd93d; color: #1a1a2e; }
        pre { background: #0f0f23; padding: 15px; border-radius: 4px; overflow-x: auto; }
        .status { padding: 10px; border-radius: 4px; margin-top: 10px; }
        .success { background: #2d5a27; }
        .failure { background: #5a2727; }
      </style>
    </head>
    <body>
      <h1>🔭 OTel Demo - Uninstrumented Apps</h1>
      <div class="card">
        <h2>Service Chain</h2>
        <p>Frontend → Catalog → Inventory → Order → Payment</p>
        <button onclick="callChain()">Call Service Chain</button>
        <button class="slow" onclick="callChain(true)">Slow Request</button>
        <button class="error" onclick="callChain(false, true)">Trigger Error</button>
      </div>
      <div class="card">
        <h2>Response</h2>
        <pre id="response">Click a button to make a request...</pre>
        <div id="status"></div>
      </div>
      <script>
        async function callChain(slow = false, error = false) {
          const responseEl = document.getElementById('response');
          const statusEl = document.getElementById('status');
          responseEl.textContent = 'Loading...';
          statusEl.className = 'status';
          statusEl.textContent = '';
          
          try {
            const params = new URLSearchParams();
            if (slow) params.set('slow', 'true');
            if (error) params.set('error', 'true');
            const url = '/api/products' + (params.toString() ? '?' + params : '');
            
            const start = Date.now();
            const res = await fetch(url);
            const duration = Date.now() - start;
            const data = await res.json();
            
            responseEl.textContent = JSON.stringify(data, null, 2);
            statusEl.textContent = 'Status: ' + res.status + ' | Duration: ' + duration + 'ms';
            statusEl.className = 'status ' + (res.ok ? 'success' : 'failure');
          } catch (err) {
            responseEl.textContent = 'Error: ' + err.message;
            statusEl.className = 'status failure';
            statusEl.textContent = 'Request failed';
          }
        }
      </script>
    </body>
    </html>
  `);
});

// API endpoint - calls catalog service
app.get('/api/products', async (req, res) => {
  const slow = req.query.slow === 'true';
  const error = req.query.error === 'true';
  const requestId = Math.random().toString(36).substring(7);
  
  log.info('Processing product request', { request_id: requestId, slow, error });
  
  // Optional simulated delay
  if (slow) {
    const delay = Math.random() * 500 + 200;
    log.warn('Slow request mode enabled', { request_id: requestId, delay_ms: Math.round(delay) });
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  if (error) {
    log.warn('Error mode enabled, downstream will fail', { request_id: requestId });
  }
  
  try {
    const params = new URLSearchParams();
    if (slow) params.set('slow', 'true');
    if (error) params.set('error', 'true');
    const url = `${CATALOG_URL}/catalog` + (params.toString() ? '?' + params : '');
    
    log.info('Calling catalog service', { request_id: requestId, url: CATALOG_URL });
    
    const start = Date.now();
    const response = await fetch(url);
    const duration = Date.now() - start;
    const data = await response.json();
    
    if (response.status >= 400) {
      log.warn('Catalog returned error status', { request_id: requestId, status: response.status, duration_ms: duration });
    } else {
      log.info('Catalog response received', { request_id: requestId, status: response.status, duration_ms: duration });
    }
    
    res.status(response.status).json({
      service: 'frontend',
      downstream: data,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    log.error('Failed to call catalog service', { request_id: requestId, error: err.message, catalog_url: CATALOG_URL });
    res.status(502).json({
      service: 'frontend',
      error: 'Failed to reach catalog service',
      message: err.message
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  log.info('Frontend service started', { port: PORT, catalog_url: CATALOG_URL });
});
