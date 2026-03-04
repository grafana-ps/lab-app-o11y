import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const requestDuration = new Trend('request_duration');

// Configuration via environment variables
const BASE_URL = __ENV.BASE_URL || 'http://frontend:8080';
const SLOW_PERCENTAGE = parseFloat(__ENV.SLOW_PERCENTAGE || '10');
const ERROR_PERCENTAGE = parseFloat(__ENV.ERROR_PERCENTAGE || '5');

// Scenarios - can be selected via K6_SCENARIO env var
export const options = {
  scenarios: {
    // Default: constant load
    constant: {
      executor: 'constant-vus',
      vus: parseInt(__ENV.VUS || '5'),
      duration: __ENV.DURATION || '5m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    errors: ['rate<0.1'],
  },
};

// Alternative scenarios (uncomment to use)
// Smoke test
export const smokeOptions = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m',
    },
  },
};

// Load test with ramping
export const loadOptions = {
  scenarios: {
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 },
        { duration: '5m', target: 10 },
        { duration: '2m', target: 20 },
        { duration: '5m', target: 20 },
        { duration: '2m', target: 0 },
      ],
    },
  },
};

// Stress test
export const stressOptions = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '5m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '5m', target: 0 },
      ],
    },
  },
};

// Spike test
export const spikeOptions = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 1 },
        { duration: '10s', target: 100 },
        { duration: '1m', target: 100 },
        { duration: '10s', target: 1 },
        { duration: '30s', target: 1 },
      ],
    },
  },
};

export default function () {
  // Determine request type based on percentages
  const roll = Math.random() * 100;
  let slow = false;
  let error = false;
  
  if (roll < ERROR_PERCENTAGE) {
    error = true;
  } else if (roll < ERROR_PERCENTAGE + SLOW_PERCENTAGE) {
    slow = true;
  }
  
  // Build URL with query params
  let url = `${BASE_URL}/api/products`;
  const params = [];
  if (slow) params.push('slow=true');
  if (error) params.push('error=true');
  if (params.length > 0) {
    url += '?' + params.join('&');
  }
  
  const startTime = Date.now();
  const res = http.get(url, {
    tags: { type: error ? 'error' : (slow ? 'slow' : 'normal') },
  });
  const duration = Date.now() - startTime;
  
  // Track metrics
  requestDuration.add(duration);
  errorRate.add(res.status !== 200);
  
  // Validate response
  check(res, {
    'status is 200 or expected error': (r) => error ? r.status === 402 : r.status === 200,
    'response has service field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.service === 'frontend';
      } catch {
        return false;
      }
    },
  });
  
  // Random sleep between requests (1-3 seconds)
  sleep(Math.random() * 2 + 1);
}

// Setup function - runs once at start
export function setup() {
  console.log(`Load test configuration:`);
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Slow request percentage: ${SLOW_PERCENTAGE}%`);
  console.log(`  Error percentage: ${ERROR_PERCENTAGE}%`);
  
  // Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  if (healthRes.status !== 200) {
    throw new Error(`Frontend health check failed: ${healthRes.status}`);
  }
  console.log('Frontend health check passed');
}

