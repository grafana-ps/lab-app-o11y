# Kafka Infrastructure for Demo

## Quick Reference

```bash
# Deploy minimal Kafka (recommended)
kubectl apply -f k8s/kafka/kafka-minimal.yaml

# Check Kafka is running
kubectl get pods -n demo -l app=kafka

# Check kafka-demo logs for trace context
kubectl logs -n demo -l app.kubernetes.io/component=kafka-demo -c kafka-demo --tail=20
```

This directory contains instructions for deploying Kafka to test the `kafka-demo` service.

## Quick Start with Bitnami Kafka Helm Chart

The easiest way to deploy Kafka for testing is using the Bitnami Helm chart with Kraft mode (no Zookeeper required).

### Prerequisites

- Kubernetes cluster
- Helm 3.x installed
- `kubectl` configured for your cluster

### Deploy Kafka

```bash
# Add Bitnami repo (if not already added)
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Install Kafka in the demo namespace
# Option 1: With persistence (recommended) - specify your storage class
helm install kafka bitnami/kafka \
  --namespace demo \
  --create-namespace \
  --set listeners.client.protocol=PLAINTEXT \
  --set controller.replicaCount=1 \
  --set kraft.enabled=true \
  --set zookeeper.enabled=false \
  --set controller.persistence.storageClass=gp3  # Change to your storage class (e.g., gp2, standard, etc.)

# Option 2: Without persistence (for quick testing only)
helm install kafka bitnami/kafka \
  --namespace demo \
  --create-namespace \
  --set listeners.client.protocol=PLAINTEXT \
  --set controller.replicaCount=1 \
  --set kraft.enabled=true \
  --set zookeeper.enabled=false \
  --set controller.persistence.enabled=false
```

> **Note**: If using Karpenter or a cluster without a default storage class, you must either:
> - Specify `--set controller.persistence.storageClass=YOUR_STORAGE_CLASS`
> - Or disable persistence with `--set controller.persistence.enabled=false`

### Verify Installation

```bash
# Check pods are running
kubectl get pods -n demo -l app.kubernetes.io/name=kafka

# Check the service
kubectl get svc -n demo -l app.kubernetes.io/name=kafka
```

### Service Endpoints

Once deployed, Kafka will be available at:
- **Internal**: `kafka.demo.svc.cluster.local:9092`
- **Headless**: `kafka-controller-headless.demo.svc.cluster.local:9092`

The `kafka-demo` Helm values default to `kafka:9092`, which will work if:
1. Kafka is installed in the same namespace as the demo apps
2. You're using the Bitnami chart with default naming

If you installed Kafka with a different release name or namespace, update the `kafkaDemo.kafka.brokers` value accordingly:

```yaml
# In your values override
kafkaDemo:
  enabled: true
  kafka:
    brokers: "kafka.demo.svc.cluster.local:9092"  # Adjust as needed
```

## Enable kafka-demo Service

Once Kafka is running, deploy the kafka-demo service:

```bash
# Build and push the kafka-demo image
make build-kafka-demo REPO=your-dockerhub-username

# Deploy with kafka-demo enabled
helm upgrade --install otel-demo-apps ./helm/otel-demo-apps \
  --namespace demo \
  --set global.image.repository=your-dockerhub-username \
  --set kafkaDemo.enabled=true

# To enable OTel auto-instrumentation as well:
helm upgrade --install otel-demo-apps ./helm/otel-demo-apps \
  --namespace demo \
  --set global.image.repository=your-dockerhub-username \
  --set kafkaDemo.enabled=true \
  --set kafkaDemo.instrumentation.enabled=true
```

## Verify Traces

After deploying with instrumentation enabled:

1. **Check the kafka-demo pod has OTel init container**:
   ```bash
   kubectl describe pod -n demo -l app.kubernetes.io/component=kafka-demo
   ```
   Look for an init container like `opentelemetry-auto-instrumentation-nodejs`.

2. **Check logs for trace context**:
   ```bash
   kubectl logs -n demo -l app.kubernetes.io/component=kafka-demo -f
   ```

3. **View traces in Grafana**:
   - Navigate to Explore > Traces
   - Search for `service.name = "otel-demo-apps-kafka-demo"`
   - You should see spans like:
     - `kafka.producer.send`
     - `kafka.consumer.eachMessage`
   - Span attributes should include:
     - `messaging.system: kafka`
     - `messaging.destination: demo-topic`

## Cleanup

```bash
# Remove Kafka
helm uninstall kafka -n demo

# Remove kafka-demo (disable it in the helm release)
helm upgrade otel-demo-apps ./helm/otel-demo-apps \
  --namespace demo \
  --set kafkaDemo.enabled=false
```

## Alternative: Minimal Kafka Manifest

If you prefer a standalone manifest without Helm, you can use the following minimal Kafka deployment. Note: this is for development/testing only and is not production-ready.

See `kafka-minimal.yaml` in this directory (if created).

## Troubleshooting

### kafka-demo pod is CrashLoopBackOff

1. **Kafka not ready**: The pod will crash if it can't connect to Kafka. Check that Kafka pods are running and ready.
   ```bash
   kubectl get pods -n demo -l app.kubernetes.io/name=kafka
   ```

2. **Wrong broker address**: Verify the broker address matches your Kafka installation.
   ```bash
   kubectl get svc -n demo -l app.kubernetes.io/name=kafka
   ```

3. **Check logs for connection errors**:
   ```bash
   kubectl logs -n demo -l app.kubernetes.io/component=kafka-demo
   ```

### No traces appearing

1. **Instrumentation not enabled**: Check the pod annotations:
   ```bash
   kubectl get pod -n demo -l app.kubernetes.io/component=kafka-demo -o yaml | grep instrumentation
   ```

2. **OTel Operator not installed**: Ensure the OpenTelemetry Operator is installed:
   ```bash
   kubectl get pods -n opentelemetry-operator-system
   ```

3. **Instrumentation CR not applied**: Apply the instrumentation config:
   ```bash
   kubectl apply -f k8s/instrumentation/instrumentation.yaml
   ```

4. **Check collector endpoint**: Verify Alloy/collector is running and receiving traces.
