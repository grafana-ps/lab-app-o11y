# Step 3: Install the OpenTelemetry Operator

Install cert-manager and the OpenTelemetry Operator so that the cluster can auto-instrument workloads. The Operator watches for `Instrumentation` custom resources and injects the appropriate language SDKs into annotated pods.

## Prerequisites

- Step 1 completed -- demo apps running in namespace `demo`
- Helm 3.x installed

## 2.1 Install cert-manager

The OTel Operator uses admission webhooks that require TLS certificates managed by cert-manager.

```shell
make install-cert-manager
```

This runs:

``` shell
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.4/cert-manager.yaml
kubectl wait --for=condition=Available deployment/cert-manager-webhook -n cert-manager --timeout=300s
```

Verify:

``` shell
kubectl get pods -n cert-manager

# Expected: 3 pods Running
# cert-manager-...              1/1   Running
# cert-manager-cainjector-...   1/1   Running
# cert-manager-webhook-...      1/1   Running
```

## 2.2 Install the OpenTelemetry Operator

``` shell
make install-otel-operator
```

This runs:

``` shell
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo update open-telemetry
helm upgrade --install opentelemetry-operator open-telemetry/opentelemetry-operator \
  --namespace opentelemetry-operator-system --create-namespace \
  --set hostNetwork=true
```

Verify:

``` shell
kubectl get pods -n opentelemetry-operator-system

# Expected:
# opentelemetry-operator-...   2/2   Running
```

## What happened

The cluster now has:

- **cert-manager** in namespace `cert-manager` -- manages TLS certificates for webhook endpoints
- **OpenTelemetry Operator** in namespace `opentelemetry-operator-system` -- watches for `Instrumentation` CRs and injects OTel SDK init containers into annotated pods

The demo apps are still running uninstrumented. No pods were restarted and no telemetry is being produced yet. In the next step we will create an `Instrumentation` CR and annotate the deployments to activate auto-instrumentation.

## Troubleshooting

### cert-manager webhook not ready

```shell
# Check events
kubectl describe deployment cert-manager-webhook -n cert-manager

# Check logs
kubectl logs -n cert-manager -l app.kubernetes.io/component=webhook
```

### OTel Operator not starting

```shell
# Check operator logs
kubectl logs -n opentelemetry-operator-system -l app.kubernetes.io/name=opentelemetry-operator

# Ensure cert-manager is fully running first
kubectl get pods -n cert-manager
```

## Cleanup

```shell
make uninstall-otel-operator
```

---

Previous: [Step 2: Deploy k8s-monitoring](02-deploy-k8s-monitoring.md)

Next: [Step 4: Enable Auto-Instrumentation](04-enable-instrumentation.md)
