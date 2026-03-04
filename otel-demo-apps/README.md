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

## Workshop Lab Steps

| Step | Guide | Make target |
|------|-------|-------------|
| 1 | [Deploy the Demo Apps](01-deploy-apps.md) | `make deploy-prebuilt` or `make deploy-custom` |
| 2 | [Install the OpenTelemetry Operator](02-install-otel-operator.md) | `make install-cert-manager` / `make install-otel-operator` |
| 3 | [Deploy k8s-monitoring](03-deploy-k8s-monitoring.md) | `make install-k8s-monitoring` |
| 4 | [Enable Auto-Instrumentation](04-enable-instrumentation.md) | `make apply-instrumentation-cr` / `make enable-instrumentation` |

## Quick Start

```bash
# Deploy apps with pre-built images
make deploy-prebuilt

# Install cert-manager and OTel Operator
make install-cert-manager
make install-otel-operator

# Deploy k8s-monitoring (Grafana Alloy)
make install-k8s-monitoring
```

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
| `make deploy-prebuilt` | Deploy with pre-built public images (quickstart) |
| `make deploy-custom` | Deploy with your own registry/repo/tag |
| `make undeploy` | Remove Kubernetes deployment |
| `make install-cert-manager` | Install cert-manager (required by OTel Operator) |
| `make install-otel-operator` | Install OpenTelemetry Operator |
| `make uninstall-otel-operator` | Remove OpenTelemetry Operator |
| `make install-k8s-monitoring` | Install Grafana k8s-monitoring (Alloy + collectors) |
| `make uninstall-k8s-monitoring` | Remove k8s-monitoring |
| `make apply-instrumentation-cr` | Apply the Instrumentation CR (cluster-wide) |
| `make enable-instrumentation` | Annotate deployments for OTel auto-instrumentation |
| `make disable-instrumentation` | Remove auto-instrumentation annotations |
| `make build` | Build all multi-arch images and push |
| `make build-local` | Build for local arch only (no push) |
| `make push` | Push all images |
| `make local` | Run via Docker Compose |
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

