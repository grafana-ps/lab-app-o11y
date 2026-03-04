#!/bin/bash
# Script to remove beyla/auto-instrumentation annotations from deployments
#
# Usage:
#   ./beyla-remove-annotations.sh [namespace]
#
# If namespace is not provided, defaults to 'demo'

set -e

NAMESPACE="${1:-demo}"
RELEASE_NAME="${RELEASE_NAME:-otel-demo-apps}"

echo "Removing beyla/auto-instrumentation annotations from namespace: ${NAMESPACE}"

# List of services to remove annotations from
SERVICES=("frontend" "catalog" "inventory" "order" "payment")

for service in "${SERVICES[@]}"; do
    DEPLOYMENT_NAME="${RELEASE_NAME}-${service}"
    
    echo "Removing annotation from ${DEPLOYMENT_NAME}..."
    
    # Check if deployment exists
    if ! kubectl get deployment "${DEPLOYMENT_NAME}" -n "${NAMESPACE}" &>/dev/null; then
        echo "  Warning: Deployment ${DEPLOYMENT_NAME} not found in namespace ${NAMESPACE}, skipping..."
        continue
    fi
    
    # Check if annotation exists before trying to remove it
    if kubectl get deployment "${DEPLOYMENT_NAME}" -n "${NAMESPACE}" -o jsonpath='{.spec.template.metadata.annotations.beyla/auto-instrumentation}' &>/dev/null; then
        # Remove annotation using kubectl patch
        kubectl patch deployment "${DEPLOYMENT_NAME}" -n "${NAMESPACE}" \
            --type='json' \
            -p='[
                {
                    "op": "remove",
                    "path": "/spec/template/metadata/annotations/beyla~1auto-instrumentation"
                }
            ]'
        echo "  ✓ Annotation removed from ${DEPLOYMENT_NAME}"
    else
        echo "  ℹ Annotation not found on ${DEPLOYMENT_NAME}, skipping..."
    fi
done

echo ""
echo "All annotations removed successfully!"
echo "Note: Pods will be recreated without the annotations on the next rollout."
