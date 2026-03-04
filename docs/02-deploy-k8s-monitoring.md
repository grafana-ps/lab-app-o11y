# Step 2: Deploy k8s-monitoring (Grafana Alloy)

Deploy the Grafana k8s-monitoring Helm chart. This installs Grafana Alloy collectors that handle infrastructure metrics, pod logs, cluster events, application traces/metrics/logs (via OTLP), Beyla auto-instrumentation, and continuous profiling -- all forwarded to Grafana Cloud.

## Prerequisites

- Step 1 completed -- demo apps running in namespace `demo`
- Step 2 completed -- cert-manager and OTel Operator installed
- A Grafana Cloud stack with an access policy token

## 3.1 Configure Grafana Cloud credentials

The values file at `../configs/k8s-monitoring-values.yaml` uses environment variable placeholders for credentials. Create a `.env` file from the provided example:

```shell
cp .env.example .env
```

Edit `.env` and fill in your Grafana Cloud stack details:

```shell
# Find these in Grafana Cloud: Connections > Kubernetes > Configuration
GRAFANA_CLOUD_METRICS_URL=https://prometheus-prod-XX-prod-REGION.grafana.net./api/prom/push
GRAFANA_CLOUD_METRICS_USERNAME=YOUR_METRICS_INSTANCE_ID
GRAFANA_CLOUD_OTLP_URL=https://otlp-gateway-prod-REGION.grafana.net./otlp
GRAFANA_CLOUD_OTLP_USERNAME=YOUR_OTLP_INSTANCE_ID
GRAFANA_CLOUD_PROFILES_URL=https://profiles-prod-XXX.grafana.net
GRAFANA_CLOUD_PROFILES_USERNAME=YOUR_PROFILES_INSTANCE_ID
GRAFANA_CLOUD_TOKEN=glc_YOUR_ACCESS_POLICY_TOKEN
```

These map to the three destinations in the values file:

| Variable prefix | Destination | What it receives |
|-----------------|-------------|------------------|
| `GRAFANA_CLOUD_METRICS_*` | Prometheus | Infrastructure metrics (cadvisor, KSM, annotation autodiscovery) |
| `GRAFANA_CLOUD_OTLP_*` | OTLP | Application traces, metrics, logs from SDKs and Beyla |
| `GRAFANA_CLOUD_PROFILES_*` | Pyroscope | Continuous profiling data (eBPF, Java, pprof) |
| `GRAFANA_CLOUD_TOKEN` | All three | Single access policy token shared by all destinations |

## 3.2 Install k8s-monitoring

```shell
make install-k8s-monitoring
```

The Makefile loads `.env`, substitutes the variables into the values file via `envsubst`, and pipes the result to Helm. No credentials are written to disk beyond your `.env` file (which is gitignored).

## 3.3 Verify the deployment

```shell
kubectl get pods -n grafana-k8s-monitoring

# Expected: multiple Alloy pods running
# grafana-k8s-monitoring-alloy-logs-...        Running
# grafana-k8s-monitoring-alloy-metrics-...     Running
# grafana-k8s-monitoring-alloy-profiles-...    Running
# grafana-k8s-monitoring-alloy-receiver-...    Running
# grafana-k8s-monitoring-alloy-singleton-...   Running
```

Check that the OTLP receiver is accepting connections:

```shell
kubectl get svc -n grafana-k8s-monitoring | grep receiver

# Should show ports 4317 (gRPC) and 4318 (HTTP)
```

## What gets collected

With k8s-monitoring deployed, the cluster is now collecting:

| Signal | Source | Destination |
|--------|--------|-------------|
| Infrastructure metrics | cadvisor, KSM, node exporter | Grafana Cloud Metrics (Prometheus) |
| Pod logs | All namespaces (except kube-system) | Grafana Cloud Logs (Loki) |
| Cluster events | Kubernetes API | Grafana Cloud Logs (Loki) |
| Beyla traces + metrics | eBPF auto-instrumentation | Grafana Cloud OTLP |
| OTLP traces/metrics/logs | Alloy receiver (port 4317/4318) | Grafana Cloud OTLP |
| Profiles | eBPF, Java, pprof | Grafana Cloud Profiles (Pyroscope) |

The OTLP receiver endpoint is:

```
http://grafana-k8s-monitoring-alloy-receiver.grafana-k8s-monitoring.svc.cluster.local:4317
```

This is the endpoint that the Instrumentation CR (in the next step) will point the OTel SDKs to.

## What you should see in Grafana Cloud

At this point, even without OTel SDK instrumentation on the demo apps, you should already see:

- **Infrastructure metrics** -- CPU, memory, network for all pods in the Kubernetes Monitoring dashboards
- **Pod logs** -- stdout/stderr from all demo app pods
- **Beyla traces and metrics** -- eBPF-based HTTP request traces and RED metrics for all services (no code changes needed)
- **Profiles** -- eBPF CPU profiles for running processes

The demo apps do not yet have SDK-level distributed tracing. Beyla provides per-service traces but cannot propagate context across service boundaries. In the next step we will enable the OTel Operator auto-instrumentation to get full distributed traces spanning all 5 services.

## Cleanup

```shell
make uninstall-k8s-monitoring
```

---

Previous: [Step 1: Deploy the Demo Apps](01-deploy-apps.md)

Next: [Step 3: Install the OpenTelemetry Operator](03-install-otel-operator.md)
