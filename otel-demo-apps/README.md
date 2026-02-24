# OTel Demo Apps

Uninstrumented microservices for demonstrating the OpenTelemetry Operator's auto-instrumentation capabilities.

## Architecture

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Frontend   │───▶│   Catalog    │───▶│  Inventory   │───▶│    Order     │───▶│   Payment    │
│   (Node.js)  │    │   (Python)   │    │     (Go)     │    │    (.NET)    │    │    (Java)    │
│  Express.js  │    │    Flask     │    │   net/http   │    │  ASP.NET     │    │ Spring Boot  │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

Each service calls the next in the chain, creating distributed traces that span all 5 services when instrumented.

## Services

| Service | Language | Framework | Port | Purpose |
|---------|----------|-----------|------|---------|
| frontend | Node.js | Express | 8080 | Web UI + API gateway |
| catalog | Python | Flask | 8080 | Product catalog |
| inventory | Go | net/http | 8080 | Stock levels |
| order | .NET | ASP.NET Core | 8080 | Order processing |
| payment | Java | Spring Boot | 8080 | Payment validation |

## Quick Start

### Prerequisites

- Docker with buildx support
- Kubernetes cluster
- Helm 3.x
- kubectl configured

**For auto-instrumentation demo (installed in Step 0 below):**
- cert-manager (required by OTel Operator)
- OpenTelemetry Operator
- Grafana Alloy (via k8s-monitoring chart) or OTel Collector for receiving telemetry

### 1. Build & Push Images

```bash
# Set your Docker Hub username
export REPO=your-dockerhub-username

# Build and push all images (multi-arch: AMD64 + ARM64)
make build REPO=$REPO
```

### 2. Deploy to Kubernetes

```bash
# Deploy with Helm
helm upgrade --install otel-demo-apps ./helm/otel-demo-apps \
  --set global.image.repository=$REPO \
  --namespace demo --create-namespace
```

### 3. Verify Deployment

```bash
# Check pods are running
kubectl get pods -n demo

# Port-forward to access the frontend
kubectl port-forward -n demo svc/otel-demo-apps-frontend 8080:8080

# Open http://localhost:8080 in your browser
```

## Enabling Auto-Instrumentation

### Step 0: Install the OpenTelemetry Operator

The OTel Operator must be installed before auto-instrumentation will work. It watches for Instrumentation CRs and injects the appropriate SDKs into annotated pods.

```bash
# Add the OpenTelemetry Helm repo
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo update

# Install cert-manager (required by OTel Operator for webhook certificates)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.4/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --for=condition=Available deployment/cert-manager -n cert-manager --timeout=300s
kubectl wait --for=condition=Available deployment/cert-manager-webhook -n cert-manager --timeout=300s

# Install the OpenTelemetry Operator
helm upgrade --install opentelemetry-operator open-telemetry/opentelemetry-operator \
  --namespace opentelemetry-operator-system \
  --create-namespace \
  --set "manager.collectorImage.repository=otel/opentelemetry-collector-k8s" \
  --set admissionWebhooks.certManager.enabled=true

# Verify the operator is running
kubectl get pods -n opentelemetry-operator-system
```

### Step 1: Apply Instrumentation CR

First, ensure your Instrumentation CR points to your Alloy/Collector:

```bash
# Edit the endpoint in k8s/instrumentation/instrumentation.yaml
# Default: http://alloy.monitoring.svc.cluster.local:4317

kubectl apply -f k8s/instrumentation/instrumentation.yaml -n demo
```

### Step 2: Enable Instrumentation on Apps

**Option A: Use the helper script**

```bash
./k8s/instrumentation/enable-all.sh demo otel-demo-apps
```

**Option B: Via Helm values**

```bash
helm upgrade otel-demo-apps ./helm/otel-demo-apps \
  --set frontend.instrumentation.enabled=true \
  --set catalog.instrumentation.enabled=true \
  --set inventory.instrumentation.enabled=true \
  --set order.instrumentation.enabled=true \
  --set payment.instrumentation.enabled=true \
  -n demo
```

**Option C: Manually patch deployments**

```bash
# Example: Enable Java instrumentation for payment service
kubectl patch deployment otel-demo-apps-payment -n demo --type=merge -p '
{
  "spec": {
    "template": {
      "metadata": {
        "annotations": {
          "instrumentation.opentelemetry.io/inject-java": "true"
        }
      }
    }
  }
}'
```

### Annotation Reference

| Language | Annotation |
|----------|------------|
| Java | `instrumentation.opentelemetry.io/inject-java: "true"` |
| Node.js | `instrumentation.opentelemetry.io/inject-nodejs: "true"` |
| Python | `instrumentation.opentelemetry.io/inject-python: "true"` |
| .NET | `instrumentation.opentelemetry.io/inject-dotnet: "true"` |
| Go | `instrumentation.opentelemetry.io/inject-go: "true"` |

## Load Generator

The k6 load generator is included for generating traffic:

```bash
# Enable via Helm
helm upgrade otel-demo-apps ./helm/otel-demo-apps \
  --set loadgen.enabled=true \
  --set loadgen.config.vus=5 \
  --set loadgen.config.duration=30m \
  -n demo
```

### Load Generator Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `loadgen.config.vus` | Virtual users (concurrent) | 3 |
| `loadgen.config.duration` | Test duration | 30m |
| `loadgen.config.slowPercentage` | % of slow requests | 10 |
| `loadgen.config.errorPercentage` | % of error requests | 5 |
| `loadgen.mode` | deployment or job | deployment |

## Local Development

### Docker Compose

```bash
# Start all services locally
make local

# Or with load generator
docker compose --profile loadgen up --build

# Access frontend at http://localhost:8080
```

### Individual Services

```bash
# Build local images (single arch, no push)
make build-local REPO=local

# Run with docker compose
docker compose up
```

## Project Structure

```
otel-demo-apps/
├── apps/
│   ├── frontend/          # Node.js Express
│   ├── catalog/           # Python Flask
│   ├── inventory/         # Go net/http
│   ├── order/             # .NET ASP.NET Core
│   └── payment/           # Java Spring Boot
├── loadgen/               # k6 load generator
├── helm/
│   └── otel-demo-apps/    # Helm chart
├── k8s/
│   └── instrumentation/   # OTel Operator manifests
├── docker-compose.yaml
├── Makefile
└── README.md
```

## Makefile Commands

| Command | Description |
|---------|-------------|
| `make build` | Build all multi-arch images and push |
| `make build-local` | Build for local arch only (no push) |
| `make push` | Push all images |
| `make local` | Run via Docker Compose |
| `make deploy` | Deploy to Kubernetes via Helm |
| `make undeploy` | Remove Kubernetes deployment |
| `make clean` | Remove local images |
| `make help` | Show all commands |

## Go Auto-Instrumentation Note

Go auto-instrumentation uses eBPF and has specific requirements:

- Linux kernel 4.4+
- May require privileged containers or specific capabilities (`SYS_PTRACE`, `CAP_BPF`)
- Won't work on some managed Kubernetes with restricted security policies

If Go instrumentation fails, you can skip it or use manual instrumentation instead.

## Node.js Logging

The frontend service uses [Winston](https://github.com/winstonjs/winston) for logging with the [@opentelemetry/winston-transport](https://www.npmjs.com/package/@opentelemetry/winston-transport) to export logs via OTLP.

### Important: Log Correlation vs Log Export

The OTel Operator's Node.js auto-instrumentation provides two distinct capabilities:

1. **Log Correlation** (automatic via `@opentelemetry/instrumentation-winston`): Adds trace_id/span_id to Winston log output
2. **Log Export** (requires `@opentelemetry/winston-transport`): Actually sends logs via OTLP to your collector

**The auto-instrumentation only does correlation, NOT export.** To export logs via OTLP, you must add the `OpenTelemetryTransportV3` to your Winston logger:

```javascript
const winston = require('winston');
const { OpenTelemetryTransportV3 } = require('@opentelemetry/winston-transport');

const log = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: SERVICE_NAME },
  transports: [
    new winston.transports.Console(),
    new OpenTelemetryTransportV3()  // Sends logs to OTel SDK → OTLP exporter
  ]
});
```

The transport uses the LoggerProvider configured by the auto-instrumentation, which exports logs to the endpoint specified in your Instrumentation CR.

## Demo Flow

1. **Before**: Deploy apps without instrumentation, show they're generating no traces
2. **Apply Instrumentation CR**: Point to your Alloy/Collector
3. **Enable instrumentation**: Add annotations to deployments
4. **After**: Show traces appearing in Grafana, spanning all 5 services
5. **Load test**: Run k6 to generate traffic and demonstrate trace sampling

## Customization

### Change Image Registry

```bash
make build REGISTRY=ghcr.io REPO=myorg TAG=v1.0.0
```

### Enable Ingress

```yaml
# values.yaml
ingress:
  enabled: true
  className: nginx
  host: otel-demo.example.com
```

### Adjust Resources

```yaml
# values.yaml
payment:
  resources:
    limits:
      memory: 1Gi  # Java needs more memory
```

## Troubleshooting

### Pods not starting
```bash
kubectl describe pod <pod-name> -n demo
kubectl logs <pod-name> -n demo
```

### OTel Operator not working
```bash
# Check operator is running
kubectl get pods -n opentelemetry-operator-system

# Check operator logs
kubectl logs -n opentelemetry-operator-system -l app.kubernetes.io/name=opentelemetry-operator

# Check cert-manager is running (required for webhooks)
kubectl get pods -n cert-manager
```

### Instrumentation not working
```bash
# Check Instrumentation CR exists
kubectl get instrumentation -n demo

# Check pod annotations
kubectl get pod <pod-name> -n demo -o jsonpath='{.metadata.annotations}'

# Check init containers were injected
kubectl get pod <pod-name> -n demo -o jsonpath='{.spec.initContainers[*].name}'

# Check operator can see the Instrumentation CR
kubectl describe instrumentation otel-instrumentation -n demo
```

### No traces appearing
1. Verify Alloy/Collector is running and accepting OTLP
2. Check exporter endpoint in Instrumentation CR
3. Check pod logs for OTel SDK errors

