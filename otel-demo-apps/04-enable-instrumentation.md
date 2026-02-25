# Step 4: Enable Auto-Instrumentation

Apply the OpenTelemetry Instrumentation CR and annotate the demo app deployments so the OTel Operator injects language-specific SDKs into each pod. After this step, all services produce distributed traces with full context propagation across the entire chain.

## Prerequisites

- Step 1 completed -- demo apps running in namespace `demo`
- Step 2 completed -- cert-manager and OTel Operator installed
- Step 3 completed -- k8s-monitoring deployed (Alloy receiving OTLP on port 4317)

## How it works

The OTel Operator auto-instrumentation is a two-part process:

1. **Instrumentation CR** -- a cluster-wide resource that defines which SDK images to inject and where to send telemetry (the Alloy OTLP receiver)
2. **Pod annotations** -- per-deployment annotations that tell the Operator which language SDK to inject into that workload

When both are in place, the Operator mutates new pods to add an init container that copies the SDK agent into the application container. No code changes required.

## 4.1 Apply the Instrumentation CR

The Instrumentation CR is at `../configs/cluster-wide-instrumentation.yaml`. It configures:

- **Exporter endpoint**: `http://grafana-k8s-monitoring-alloy-receiver.grafana-k8s-monitoring.svc.cluster.local:4317`
- **Propagators**: W3C TraceContext, Baggage, B3
- **Sampler**: 100% sampling (for demo purposes)
- **Language SDKs**: Java (Grafana distro), Node.js, Python, .NET

```shell
make apply-instrumentation-cr
```

This runs:
```shell
kubectl apply -f ../configs/cluster-wide-instrumentation.yaml -n opentelemetry-operator-system
```

Verify:
```shell
kubectl get instrumentation -n opentelemetry-operator-system

# Expected:
# NAME                             AGE
# cluster-wide-instrumentation     ...
```

## 4.2 Enable instrumentation on the demo apps

Annotate each deployment with the language-specific injection annotation. This triggers a rolling restart with the SDK injected.

```shell
make enable-instrumentation
```

This runs `./k8s/instrumentation/otel-apply-instrumentations.sh` which patches each deployment:

| Service | Language | Annotation |
|---------|----------|------------|
| frontend | Node.js | `instrumentation.opentelemetry.io/inject-nodejs` |
| catalog | Python | `instrumentation.opentelemetry.io/inject-python` |
| order | .NET | `instrumentation.opentelemetry.io/inject-dotnet` |
| payment | Java | `instrumentation.opentelemetry.io/inject-java` |

Note: **Go (inventory)** is not listed. The OTel Operator does not inject a Go SDK -- Go auto-instrumentation is handled by Beyla via eBPF, which was already deployed with k8s-monitoring in step 3.

## 4.3 Verify instrumentation

Watch the pods restart with init containers:
```shell
kubectl get pods -n demo -w
```

Once all pods are Running, check that the SDK init containers were injected:
```shell
# Check a specific pod (e.g., payment/Java)
kubectl get pod -n demo -l app.kubernetes.io/component=payment \
  -o jsonpath='{.items[0].spec.initContainers[*].name}'

# Should include: opentelemetry-auto-instrumentation-java (or similar)
```

Verify the Instrumentation CR is being referenced:
```shell
kubectl describe instrumentation cluster-wide-instrumentation -n opentelemetry-operator-system
```

## What you should see in Grafana Cloud

Generate some traffic by clicking buttons in the frontend UI (or let the loadgen run), then check Grafana Cloud:

- **Application Observability** -- all 5 services appear with RED metrics (Rate, Errors, Duration)
- **Distributed traces** -- traces span the full chain: frontend -> catalog -> inventory -> order -> payment
- **Service map** -- shows the dependency graph between services
- **Logs** -- trace IDs correlated in log lines (especially for Node.js with Winston)

The key difference from step 3 is **distributed context propagation** -- the OTel SDKs inject trace context headers (`traceparent`) into outgoing HTTP calls, so a single user request produces one trace spanning all 5 services. Beyla alone could not do this.

## Annotation reference

| Language | Annotation | Value |
|----------|------------|-------|
| Java | `instrumentation.opentelemetry.io/inject-java` | `opentelemetry-operator-system/cluster-wide-instrumentation` |
| Node.js | `instrumentation.opentelemetry.io/inject-nodejs` | `opentelemetry-operator-system/cluster-wide-instrumentation` |
| Python | `instrumentation.opentelemetry.io/inject-python` | `opentelemetry-operator-system/cluster-wide-instrumentation` |
| .NET | `instrumentation.opentelemetry.io/inject-dotnet` | `opentelemetry-operator-system/cluster-wide-instrumentation` |
| Go | _N/A -- use Beyla_ | |

The annotation value references the Instrumentation CR by `namespace/name`. Setting it to `"true"` would look for an Instrumentation CR in the same namespace as the pod.

## Troubleshooting

### Pods not restarting after annotation

```shell
# Check the operator logs for mutation webhook errors
kubectl logs -n opentelemetry-operator-system -l app.kubernetes.io/name=opentelemetry-operator

# Verify the annotation is on the pod template (not the pod itself)
kubectl get deployment otel-demo-apps-payment -n demo \
  -o jsonpath='{.spec.template.metadata.annotations}'
```

### Init container failing

```shell
# Check init container logs
kubectl logs -n demo <pod-name> -c opentelemetry-auto-instrumentation-java --previous
```

### No traces appearing

1. Verify Alloy receiver is accepting OTLP:
   ```shell
   kubectl get svc -n grafana-k8s-monitoring | grep receiver
   ```
2. Check that the exporter endpoint in the Instrumentation CR matches the Alloy receiver service
3. Check pod logs for OTel SDK errors:
   ```shell
   kubectl logs -n demo -l app.kubernetes.io/component=payment | grep -i otel
   ```

## Rollback

To remove auto-instrumentation and return to the uninstrumented baseline:

```shell
make disable-instrumentation
```

This removes the annotations and triggers a rolling restart without the SDK.

---

Previous: [Step 3: Deploy k8s-monitoring](03-deploy-k8s-monitoring.md)
