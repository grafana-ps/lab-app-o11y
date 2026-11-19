# Step 3: Enable the SDK Injector

Nothing to install in this step. The `telemetryServices.sdkInjector` block in the values file from step 2 already deployed everything auto-instrumentation needs: the Grafana Kubernetes injection controller and Beyla. There is no separate operator, no cert-manager, and no `Instrumentation` custom resource.

## Prerequisites

- Step 1 completed -- demo apps running in namespace `demo`
- Step 2 completed -- k8s-monitoring deployed in namespace `grafana-k8s-monitoring`

## How it works

Three pieces cooperate, all from the k8s-monitoring chart:

1. **Beyla**, a DaemonSet, discovers workloads and writes the selection policy into one ConfigMap per node. Those ConfigMaps are the interface; nothing else is.
2. **The injection controller**, a Deployment, watches those ConfigMaps and registers a mutating admission webhook.
3. **The webhook** mutates matching pods as they are created, mounting the OpenTelemetry SDK payload as a read-only volume and setting the environment that activates it.

The payload is a single multi-language image, so there is no per-language image to choose. A small preloaded library detects the runtime inside the container and sets the right activation variables, such as `JAVA_TOOL_OPTIONS` for the JVM or `PYTHONPATH` for Python. Your application image is never modified.

## 3.1 Verify the controller is running

```shell
kubectl get deployment -n grafana-k8s-monitoring grafana-k8s-monitoring-k8s-injection-controller

# Expected:
# NAME                                                     READY   UP-TO-DATE   AVAILABLE
# grafana-k8s-monitoring-k8s-injection-controller           1/1     1            1
```

Wait for it to be Available before annotating any workload. The pod mutating webhook is deliberately fail-open, so a pod created while the controller is unavailable comes up uninstrumented and nothing re-injects it later.

## 3.2 Verify Beyla can write its state

Beyla needs permission to write the injector state ConfigMaps, granted by `autoInstrumentation.beyla.injector.enabled` in the values file, and its ServiceAccount has to appear in the controller's allowlist.

```shell
kubectl get role,rolebinding -n grafana-k8s-monitoring | grep beyla-injector

# Expected: one Role and one RoleBinding named
# grafana-k8s-monitoring-beyla-injector
```

```shell
kubectl get configmaps -n grafana-k8s-monitoring -l app.kubernetes.io/component=injector-state

# Expected: one ConfigMap per node, named
# grafana-k8s-monitoring-beyla-injector-state-<node>
```

If those ConfigMaps are missing, check the Beyla logs for a write that the validating webhook denied. That happens when `telemetryServices.sdkInjector.allowedConfigMapWriters` does not name the Beyla ServiceAccount, `<release>-beyla`.

```shell
kubectl logs -n grafana-k8s-monitoring -l app.kubernetes.io/name=beyla -c beyla | grep -i "injector state"
```

## What happened

The cluster now has:

- **Beyla** in namespace `grafana-k8s-monitoring` -- eBPF instrumentation plus the SDK selection policy
- **The injection controller** in the same namespace -- a mutating admission webhook waiting for annotated pods

The demo apps are still running without SDKs. No pods were restarted yet. In the next step you annotate the deployments and the controller does the rest.

## Troubleshooting

### Controller not starting

```shell
kubectl logs -n grafana-k8s-monitoring deployment/grafana-k8s-monitoring-k8s-injection-controller
```

### Beyla crashlooping

```shell
kubectl logs -n grafana-k8s-monitoring -l app.kubernetes.io/name=beyla -c beyla --tail=20
```

A configuration error shows as `wrong configuration` on the first line. One to know about: setting `injector.otel_exported_signals` in the Beyla config makes Beyla exit with `reading env vars: env: expected a pointer to a Struct`. Leave that key out; its defaults already export traces and metrics and skip logs.

### Beyla uses a lot of CPU

Beyla 3.40.0, bundled with chart 4.6.1, can use several CPU cores per node while it harvests HTTP routes from Node.js processes. Beyla 3.42.0 fixes it, so the values file pins `autoInstrumentation.beyla.image.tag: "3.42.0"` and no longer needs the `discovery.disabled_route_harvesters: [nodejs]` workaround. If you stay on the bundled 3.40.0, add that line back under `discovery`.

### Java agent attach times out

Beyla logs `java attach timed out` and `couldn't attach OpenTelemetry eBPF Java Agent` when a busy JVM does not answer within the default 10 seconds. Without the agent there is no Java TLS capture, no context propagation and no JVM class, thread, CPU or GC metrics. The values file sets `javaagent.attach_timeout: 30s`; restart the Java pods after changing it so Beyla attaches to fresh JVMs.

### No JVM metrics

JVM runtime metrics need `application_runtime` in `prometheus_export.features`; it is off by default. JVM heap metrics come from HotSpot USDT probes, which some builds, for example Amazon Corretto 21 on ARM64, do not ship. Beyla 3.43.0 adds a fallback through the Java agent (open-telemetry/opentelemetry-ebpf-instrumentation#4172); bump the image tag once it is stable.

### Injected pods fail to pull the SDK image after nodes were replaced

Injection controller releases before 0.3.0 left one state ConfigMap behind for every node that was removed, and the controller could pick a stale `image_version` from one of them. Chart 4.5.4 and newer ship 0.3.0, which cleans them up. On an older release, delete the ConfigMaps of nodes that no longer exist and restart the affected workloads.

```shell
kubectl get configmaps -n grafana-k8s-monitoring -l app.kubernetes.io/component=injector-state
kubectl get nodes
```

### Cleanup

The injector is part of the k8s-monitoring release, so there is nothing separate to uninstall. To turn it off, set `telemetryServices.sdkInjector.deploy: false` and `autoInstrumentation.beyla.injector.enabled: false`, then upgrade the release.

---

Previous: [Step 2: Deploy k8s-monitoring](02-deploy-k8s-monitoring.md)

Next: [Step 4: Enable Auto-Instrumentation](04-enable-instrumentation.md)
