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

### Cleanup

The injector is part of the k8s-monitoring release, so there is nothing separate to uninstall. To turn it off, set `telemetryServices.sdkInjector.deploy: false` and `autoInstrumentation.beyla.injector.enabled: false`, then upgrade the release.

---

Previous: [Step 2: Deploy k8s-monitoring](02-deploy-k8s-monitoring.md)

Next: [Step 4: Enable Auto-Instrumentation](04-enable-instrumentation.md)
