#!/bin/bash
# Script to opt deployments in to Grafana SDK injection
#
# Usage:
#   ./sdk-apply-annotations.sh [namespace] [release]
#
# Adds k8s.grafana.com/sdk-inject=true to each deployment's pod template. The
# injection controller rolls the workload and its admission webhook mounts the
# OpenTelemetry SDK payload into the new pods.
#
# inventory is omitted on purpose: it is a Go service and the SDK injector
# supports Java, .NET, Node.js and Python only. Go is covered by Beyla eBPF.

set -e

NAMESPACE="${1:-demo}"
RELEASE_NAME="${2:-otel-demo-apps}"

echo "Enabling SDK injection in namespace: ${NAMESPACE}"

SERVICES=("frontend" "catalog" "order" "payment")

for service in "${SERVICES[@]}"; do
    DEPLOYMENT_NAME="${RELEASE_NAME}-${service}"

    if ! kubectl get deployment "${DEPLOYMENT_NAME}" -n "${NAMESPACE}" >/dev/null 2>&1; then
        echo "  skipping ${DEPLOYMENT_NAME}: not found"
        continue
    fi

    echo "  annotating ${DEPLOYMENT_NAME}"
    kubectl patch deployment "${DEPLOYMENT_NAME}" -n "${NAMESPACE}" --type=merge -p \
      '{"spec":{"template":{"metadata":{"annotations":{"k8s.grafana.com/sdk-inject":"true"}}}}}'
done

echo ""
echo "Done. The controller rolls each workload; watch with:"
echo "  kubectl get pods -n ${NAMESPACE} -w"
echo ""
echo "Then confirm a pod carries the injection marker:"
echo "  kubectl get pod -n ${NAMESPACE} -l app.kubernetes.io/component=payment \\"
echo "    -o jsonpath='{.items[0].metadata.annotations.beyla\.grafana\.com/inject}'"
