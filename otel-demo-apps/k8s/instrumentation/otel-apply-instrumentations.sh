#!/bin/bash
# Quick script to enable auto-instrumentation on all demo apps
# Usage: ./enable-all.sh [namespace]

NAMESPACE=${1:-demo}
RELEASE_NAME=${2:-otel-demo-apps}

echo "Enabling OTel auto-instrumentation for all demo apps in namespace: $NAMESPACE"

# Frontend (Node.js)
kubectl patch deployment ${RELEASE_NAME}-frontend -n $NAMESPACE --type=merge -p '
{
  "spec": {
    "template": {
      "metadata": {
        "annotations": {
          "instrumentation.opentelemetry.io/inject-nodejs": "opentelemetry-operator-system/cluster-wide-instrumentation"
        }
      }
    }
  }
}'

# Catalog (Python)
kubectl patch deployment ${RELEASE_NAME}-catalog -n $NAMESPACE --type=merge -p '
{
  "spec": {
    "template": {
      "metadata": {
        "annotations": {
          "instrumentation.opentelemetry.io/inject-python": "opentelemetry-operator-system/cluster-wide-instrumentation"
        }
      }
    }
  }
}'

# Order (.NET)
kubectl patch deployment ${RELEASE_NAME}-order -n $NAMESPACE --type=merge -p '
{
  "spec": {
    "template": {
      "metadata": {
        "annotations": {
          "instrumentation.opentelemetry.io/inject-dotnet": "opentelemetry-operator-system/cluster-wide-instrumentation"
        }
      }
    }
  }
}'

# Payment (Java)
kubectl patch deployment ${RELEASE_NAME}-payment -n $NAMESPACE --type=merge -p '
{
  "spec": {
    "template": {
      "metadata": {
        "annotations": {
          "instrumentation.opentelemetry.io/inject-java": "opentelemetry-operator-system/cluster-wide-instrumentation"
        }
      }
    }
  }
}'

echo "Done! Pods will restart with instrumentation enabled."
echo "Watch rollout: kubectl get pods -n $NAMESPACE -w"

