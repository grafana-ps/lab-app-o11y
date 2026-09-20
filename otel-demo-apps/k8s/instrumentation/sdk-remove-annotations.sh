#!/bin/bash
# Script to opt deployments out of Grafana SDK injection
#
# Usage:
#   ./sdk-remove-annotations.sh [namespace] [release]
#
# Removes k8s.grafana.com/sdk-inject from each deployment's pod template and
# restarts the deployment. The restart is what actually removes the SDK:
# dropping out of the selector leaves an already running pod instrumented.

set -e

NAMESPACE="${1:-demo}"
RELEASE_NAME="${2:-otel-demo-apps}"

echo "Disabling SDK injection in namespace: ${NAMESPACE}"

SERVICES=("frontend" "catalog" "order" "payment")

for service in "${SERVICES[@]}"; do
    DEPLOYMENT_NAME="${RELEASE_NAME}-${service}"

    if ! kubectl get deployment "${DEPLOYMENT_NAME}" -n "${NAMESPACE}" >/dev/null 2>&1; then
        echo "  skipping ${DEPLOYMENT_NAME}: not found"
        continue
    fi

    echo "  removing annotation from ${DEPLOYMENT_NAME}"
    kubectl patch deployment "${DEPLOYMENT_NAME}" -n "${NAMESPACE}" --type=json -p \
      '[{"op":"remove","path":"/spec/template/metadata/annotations/k8s.grafana.com~1sdk-inject"}]' \
      2>/dev/null || echo "    annotation was not set"

    kubectl rollout restart deployment "${DEPLOYMENT_NAME}" -n "${NAMESPACE}"
done

echo ""
echo "Done. Replacement pods start without the injected SDK."
