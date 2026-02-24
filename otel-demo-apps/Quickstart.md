
# What is this?

5 Uninstrumented Services (service chain)

- ![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white) apps/frontend/ - Node.js Express (Web UI + API gateway)
- ![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white) apps/catalog/ - Python Flask (product catalog)
- ![Go](https://img.shields.io/badge/Go-00ADD8?logo=go&logoColor=white) apps/inventory/ - Go net/http (stock levels)
- ![.NET](https://img.shields.io/badge/.NET-512BD4?logo=dotnet&logoColor=white) apps/order/ - .NET ASP.NET Core (order processing)
- ![Java](https://img.shields.io/badge/Java-007396?logo=openjdk&logoColor=white) apps/payment/ - Java Spring Boot (payment validation)

Load Generator

- loadgen/ - k6 with configurable VUs, duration, slow%, error%

Deployment

- helm/otel-demo-apps/ - Full Helm chart with all services
- docker-compose.yaml - Local testing without K8s
- Makefile - Build, push, deploy commands

OTel Operator Integration

- k8s/instrumentation/instrumentation.yaml - Instrumentation CR pointing to Alloy
- k8s/instrumentation/enable-all.sh - Quick script to annotate all deployments
- k8s/instrumentation/annotations-example.yaml - Reference for manual patching

## Quickest start

``` shell
# Deploy to K8s cluster using pre-built container images off dockerhub
helm upgrade --install otel-demo-apps ./helm/otel-demo-apps \
  --set global.image.repository=stevenshaw212 \
  --namespace demo --create-namespace
```

## Slightly less quick start

``` shell
# Set your Docker Hub username
export REPO=your-dockerhub-username

# Log into Docker Hub
docker login

# Build & push all images
make build REPO=$REPO

# Deploy to K8s
helm upgrade --install otel-demo-apps ./helm/otel-demo-apps \
  --set global.image.repository=$REPO \
  --namespace demo --create-namespace

# Install cert-manager (required by OTel Operator)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.4/cert-manager.yaml
kubectl wait --for=condition=Available deployment/cert-manager-webhook -n cert-manager --timeout=300s

# Install OpenTelemetry Operator
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm upgrade --install opentelemetry-operator open-telemetry/opentelemetry-operator \
  --namespace opentelemetry-operator-system --create-namespace \
  --values - <<'EOF'
hostNetwork: true
EOF

# Enable auto-instrumentation
kubectl apply -f k8s/instrumentation/instrumentation.yaml -n demo
./k8s/instrumentation/otel-apply-instrumentations.sh

```

The frontend has a nice little UI at / with buttons to trigger normal, slow, and error requests through the entire chain. Perfect for showing those beautiful distributed traces once the Operator does its thing
