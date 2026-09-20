# Step 4: Enable Auto-Instrumentation

Annotate the demo app deployments so the injection controller mounts the OpenTelemetry SDK into each pod. After this step, the annotated services produce distributed traces with context propagation across the chain.

## Prerequisites

- Step 1 completed -- demo apps running in namespace `demo`
- Step 2 completed -- k8s-monitoring deployed, Alloy receiving OTLP
- Step 3 completed -- injection controller Available and the per-node injector state ConfigMaps present

## How it works

One annotation drives everything. The values file selects workloads by pod annotation:

```yaml
autoInstrumentation:
  beyla:
    config:
      data:
        injector:
          instrument:
            - k8s_pod_annotations:
                k8s.grafana.com/sdk-inject: "true"
```

When you add that annotation to a deployment's **pod template**, Beyla records the workload in its state ConfigMap, the controller rolls the workload, and the webhook mutates the replacement pods. Two details matter:

- The annotation must be on the pod template, not on the Deployment metadata and not on a live pod. Injection happens at pod admission, so the pod has to be recreated.
- Removing the annotation later does not strip the SDK from a running pod. The workload needs a restart.

## 4.1 Enable instrumentation on the demo apps

```shell
make enable-instrumentation
```

This runs `./k8s/instrumentation/sdk-apply-annotations.sh` which patches each deployment's pod template with `k8s.grafana.com/sdk-inject: "true"`, triggering a rolling restart:

| Service | Language | Injected |
|---------|----------|----------|
| frontend | Node.js | yes |
| catalog | Python | yes |
| order | .NET | yes |
| payment | Java | yes |
| inventory | Go | no |

Go is absent by design. The injector supports Java, .NET, Node.js and Python, and skips a process whose runtime it cannot identify, so a Go service can carry the annotation and still emit nothing. Go is covered by Beyla eBPF, deployed in step 2.

## 4.2 Verify instrumentation

Watch the pods roll:

```shell
kubectl get pods -n demo -w
```

Each injected pod carries a configuration-hash annotation from the webhook:

```shell
kubectl get pod -n demo -l app.kubernetes.io/component=payment \
  -o jsonpath='{.items[0].metadata.annotations.beyla\.grafana\.com/inject}{"\n"}'

# Expected: a short hash, for example 8l4iuel466nnk
```

Check the mounted payload and the activation environment:

```shell
POD=$(kubectl get pod -n demo -l app.kubernetes.io/component=catalog -o jsonpath='{.items[0].metadata.name}')

kubectl get pod -n demo $POD -o jsonpath='{range .spec.volumes[*]}{.name}{"\n"}{end}'
# Expected to include: otel-inject-instrumentation

kubectl get pod -n demo $POD -o jsonpath='{range .spec.containers[0].env[*]}{.name}={.value}{"\n"}{end}' \
  | grep -E 'LD_PRELOAD|OTEL_EXPORTER_OTLP'
# Expected:
# OTEL_EXPORTER_OTLP_ENDPOINT=http://grafana-k8s-monitoring-alloy-receiver.grafana-k8s-monitoring.svc.cluster.local:4318
# OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
# LD_PRELOAD=/__otel_sdk_auto_instrumentation__/dist/injector/libotelinject.so
```

Ask the controller what it thinks it instrumented. Its metrics endpoint is scraped by annotation autodiscovery, so `beyla_injection_pods` is queryable in Grafana Cloud, with a `status` label of `instrumented`, `unmatched`, `pending_restart` or `skipped`.

```shell
kubectl port-forward -n grafana-k8s-monitoring deployment/grafana-k8s-monitoring-k8s-injection-controller 8080:8080

curl -s http://127.0.0.1:8080/metrics | grep beyla_injection_pods
```

## What you should see in Grafana Cloud

Generate traffic from the frontend UI, or let the loadgen run, then check:

- **Application Observability** -- all five services appear with RED metrics
- **Distributed traces** -- a request spans the injected services; the Go hop breaks the chain unless its eBPF spans are stitched in
- **Service map** -- the dependency graph between services
- **Logs** -- trace IDs correlated in log lines

Context propagation comes from the controller's own SDK configuration, which defaults to the W3C `tracecontext` and `baggage` propagators. Nothing in the values file sets it.

## Disable instrumentation

```shell
make disable-instrumentation
```

This runs `./k8s/instrumentation/sdk-remove-annotations.sh`, which removes the annotation and restarts the deployments. The restart is the part that actually removes the SDK, because deselection alone leaves a running pod instrumented.

## Troubleshooting

### A pod was annotated but nothing was injected

Check the runtime first. Go is not supported. Then check that the controller was Available when the pod was created: the pod mutating webhook is fail-open, so pods created while it is down come up clean and are not retried.

### An injected service produces no telemetry

Look at the application's own stderr, not at Kubernetes. The SDK activates inside the process, so failures surface there. The one to know: OpenTelemetry Python auto-instrumentation refuses gRPC and logs `gRPC export protocol not supported and it's default for Python`. That is why the values file sets `exporter_otlp_protocol: http/protobuf` and points at port 4318 rather than 4317.

### The injector state ConfigMaps never converge to empty

They are not a completion signal. Beyla only adds entries and clears the list when the controller pod is created or updated, so entries can remain after a successful rollout. Verify with pod annotations or `beyla_injection_pods` instead.

---

Previous: [Step 3: Enable the SDK Injector](03-enable-sdk-injector.md)
