// Stress test scenario for k6
// Usage: k6 run --env BASE_URL=http://localhost:8080 scenarios/stress.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');
const BASE_URL = __ENV.BASE_URL || 'http://frontend:8080';

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },   // Ramp up to 20 users
        { duration: '5m', target: 50 },   // Ramp up to 50 users
        { duration: '2m', target: 100 },  // Ramp up to 100 users
        { duration: '5m', target: 100 },  // Stay at 100 users
        { duration: '5m', target: 0 },    // Ramp down
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(99)<3000'],
    errors: ['rate<0.2'],
  },
};

export default function () {
  // Mix of normal, slow, and error requests
  const roll = Math.random() * 100;
  const slow = roll < 15;  // 15% slow
  const error = roll >= 15 && roll < 20;  // 5% errors
  
  let url = `${BASE_URL}/api/products`;
  if (slow) url += '?slow=true';
  if (error) url += '?error=true';
  
  const res = http.get(url);
  
  errorRate.add(res.status !== 200 && !error);
  
  check(res, {
    'response received': (r) => r.status !== 0,
  });
  
  sleep(Math.random() * 0.5 + 0.5);
}

