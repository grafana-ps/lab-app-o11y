# Step 1: Deploy the Demo Apps

Deploy 5 uninstrumented microservices to your Kubernetes cluster. At this stage there is no OpenTelemetry instrumentation -- just the bare applications running and serving traffic.

## Architecture

```
                                  Service Chain
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Frontend   │───>│   Catalog    │───>│  Inventory   │───>│    Order     │───>│   Payment    │
│   (Node.js)  │    │   (Python)   │    │     (Go)     │    │    (.NET)    │    │    (Java)    │
│  Express.js  │    │    Flask     │    │   net/http   │    │  ASP.NET     │    │ Spring Boot  │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
       ^
       │
┌──────────────┐
│   Loadgen    │
│     (k6)     │
└──────────────┘
```

## Prerequisites

- Kubernetes cluster (local or remote)
- kubectl configured and pointing to your cluster
- Helm 3.x installed

## Option A: Deploy with pre-built images (recommended)

Uses public images from DockerHub -- no build step required.

```shell
make deploy-prebuilt
```

This runs:
```shell
helm upgrade --install otel-demo-apps ./helm/otel-demo-apps \
  --set global.image.repository=stevenshaw212 \
  --namespace demo --create-namespace
```

## Option B: Deploy with your own images

Build and push images to your own registry first, then deploy.

```shell
# Set your Docker Hub username
export REPO=your-dockerhub-username

# Log into Docker Hub
docker login

# Build & push all images (multi-arch: AMD64 + ARM64)
make build REPO=$REPO

# Deploy
make deploy-custom REPO=$REPO
```

## Verify the deployment

```shell
# Check all pods are running
kubectl get pods -n demo

# Expected output (all Running, loadgen waits for frontend to be ready):
# otel-demo-apps-frontend-...    1/1   Running
# otel-demo-apps-catalog-...     1/1   Running
# otel-demo-apps-inventory-...   1/1   Running
# otel-demo-apps-order-...       1/1   Running
# otel-demo-apps-payment-...     1/1   Running
# otel-demo-apps-loadgen-...     1/1   Running
```

## Access the frontend

```shell
kubectl port-forward svc/otel-demo-apps-frontend 8080:8080 -n demo
```

Open http://localhost:8080 in your browser. The frontend has buttons to trigger normal, slow, and error requests through the entire service chain.

## What you should see

At this point the apps are running but producing no telemetry. There are no traces, no metrics from the OTel SDK, and no distributed context propagation between services. This is the baseline we will instrument in the next steps.

## Cleanup

```shell
make undeploy
```

---

Next: [Step 2: Install the OpenTelemetry Operator](02-install-otel-operator.md)
