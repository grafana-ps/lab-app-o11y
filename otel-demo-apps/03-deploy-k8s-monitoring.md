# Step 3: Deploy k8s-monitoring (Grafana Alloy)

Deploy the Grafana k8s-monitoring Helm chart. This installs Grafana Alloy collectors that handle infrastructure metrics, pod logs, cluster events, application traces/metrics/logs (via OTLP), Beyla auto-instrumentation, and continuous profiling -- all forwarded to Grafana Cloud.

## Prerequisites

- Step 1 completed -- demo apps running in namespace `demo`
- Step 2 completed -- cert-manager and OTel Operator installed
- A Grafana Cloud stack with an access policy token

## 3.1 Configure the values file

The values file is at `../configs/k8s-monitoring-values.yaml`. Before deploying, replace the placeholder tokens with your Grafana Cloud credentials.

```shell
# Edit the values file
vi ../configs/k8s-monitoring-values.yaml
```

Replace every occurrence of `REPLACE_WITH_ACCESS_POLICY_TOKEN` with your Grafana Cloud access policy token. There are three destinations that need it:

| Destination | Type | What it receives |
|-------------|------|------------------|
| `grafana-cloud-metrics` | Prometheus | Infrastructure metrics (cadvisor, KSM, annotation autodiscovery) |
| `grafana-cloud-otlp-endpoint` | OTLP | Application traces, metrics, logs from SDKs and Beyla |
| `grafana-cloud-profiles` | Pyroscope | Continuous profiling data (eBPF, Java, pprof) |

Also verify the URLs match your Grafana Cloud stack region.

## 3.2 Install k8s-monitoring

```shell
make install-k8s-monitoring
```

This runs:
```shell
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update grafana
helm upgrade --install grafana-k8s-monitoring grafana/k8s-monitoring \
  --namespace grafana-k8s-monitoring --create-namespace \
  --values ../configs/k8s-monitoring-values.yaml
```

If your values file is in a different location:
```shell
make install-k8s-monitoring K8S_MONITORING_VALUES=/path/to/your/values.yaml
```

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

Previous: [Step 2: Install the OpenTelemetry Operator](02-install-otel-operator.md)

Next: [Step 4: Enable Auto-Instrumentation](04-enable-instrumentation.md)

