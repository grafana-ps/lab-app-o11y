# Un-Instrumented Demo Apps for OpenTelemetry Operator

## Architecture

A service chain simulating an e-commerce order flow:

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Frontend   │───▶│   Catalog    │───▶│  Inventory   │───▶│    Order     │───▶│   Payment    │
│   (Node.js)  │    │   (Python)   │    │     (Go)     │    │    (.NET)    │    │    (Java)    │
│  Express.js  │    │    Flask     │    │   net/http   │    │  ASP.NET     │    │ Spring Boot  │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

Each service calls the next in the chain, creating a trace that spans all 5 services when instrumented.

## Services

| Service | Language | Framework | Purpose |

|---------|----------|-----------|---------|

| frontend | Node.js | Express | Web UI + API gateway, calls catalog |

| catalog | Python | Flask | Product listings, calls inventory |

| inventory | Go | net/http | Stock levels, calls order |

| order | .NET | ASP.NET Core | Order processing, calls payment |

| payment | Java | Spring Boot | Payment processing (terminal service) |

## Location

All code will be created in `~/workspace/otel-demo-apps/`

## Project Structure

```
otel-demo-apps/
├── apps/
│   ├── frontend/          # Node.js Express app
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── catalog/           # Python Flask app
│   │   ├── app.py
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   ├── inventory/         # Go app
│   │   ├── main.go
│   │   ├── Dockerfile
│   │   └── go.mod
│   ├── order/             # .NET app
│   │   ├── Program.cs
│   │   ├── Dockerfile
│   │   └── Order.csproj
│   └── payment/           # Java Spring Boot app
│       ├── src/
│       ├── Dockerfile
│       └── pom.xml
├── loadgen/
│   ├── script.js          # k6 test script
│   ├── Dockerfile         # k6 image with script baked in
│   └── scenarios/         # Optional additional scenarios
│       └── stress.js
├── helm/
│   └── otel-demo/
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
│           ├── _helpers.tpl
│           ├── frontend-deployment.yaml
│           ├── catalog-deployment.yaml
│           ├── inventory-deployment.yaml
│           ├── order-deployment.yaml
│           ├── payment-deployment.yaml
│           └── services.yaml
└── README.md
```

## Library/Framework Verification

Before building, we'll verify each framework is supported by the OpenTelemetry Operator's auto-instrumentation:

| Language | Framework | OTel Auto-Instrumentation Support |

|----------|-----------|-----------------------------------|

| Node.js | Express.js | Supported via `nodejs` instrumentation |

| Python | Flask | Supported via `python` instrumentation |

| Go | net/http | Supported via `go` instrumentation (eBPF-based) |

| .NET | ASP.NET Core | Supported via `dotnet` instrumentation |

| Java | Spring Boot | Supported via `java` instrumentation (JVMTI agent) |

Will verify against current OTel Operator documentation before implementation.

## Load Generator (k6)

The k6 load generator will support:

- **Configurable VUs** - Virtual users to simulate concurrent load
- **Duration** - How long to run the test
- **Request rate** - Requests per second targeting
- **Error injection** - Query param to trigger errors in services
- **Scenarios** - Pre-built profiles (smoke, load, stress, spike)

Deployed as a Kubernetes Job or CronJob via the Helm chart with configurable parameters in values.yaml.

## Key Design Decisions

1. **No OTel dependencies** - Zero OpenTelemetry SDK, agent, or auto-instrumentation in any app. Pure vanilla frameworks.

2. **HTTP-based communication** - All services communicate via REST APIs, which the OTel Operator can easily instrument.

3. **Configurable endpoints** - Each service reads the next service URL from environment variables, making it Kubernetes-friendly.

4. **Health endpoints** - Each service exposes `/health` for K8s probes.

5. **Simulated latency** - Optional random delays to make traces more interesting.

## Helm Chart Features

- Namespace configurable via values
- Image repository/tag per service for flexibility
- Resource limits configurable
- Ingress optional for frontend
- Annotations for OTel Operator auto-instrumentation (disabled by default, user enables to demo)

## Container Registry

Images will be pushed to **Docker Hub**. The Makefile will support configurable `REGISTRY` and `TAG` variables.

## Additional Tooling

### Makefile

- `make build` - Build all multi-arch images (AMD64 + ARM64) by default
- `make build-<service>` - Build individual service (multi-arch)
- `make push` - Push all images to Docker Hub
- `make push-<service>` - Push individual service
- `make local` - Run via Docker Compose locally

### Docker Compose

For local testing without K8s - spins up all 5 services + k6 load generator.

### Sample Instrumentation CRs

Ready-to-apply manifests in `k8s/instrumentation/` configured for **Grafana Alloy** (via k8s-monitoring chart):

- Per-language Instrumentation CRs pointing to Alloy's OTLP endpoint
- Pod annotation examples for selective instrumentation
- Namespace-wide auto-instrumentation option
- Default endpoint: `alloy.{namespace}.svc.cluster.local:4317` (configurable)

## Files to Create

~35 files total:

- 5 apps (~50-150 lines each)
- 5 Dockerfiles (multi-stage, multi-arch ready)
- k6 load generator scripts
- Helm chart templates
- Docker Compose file
- Makefile
- Instrumentation CR samples
- README with full documentation