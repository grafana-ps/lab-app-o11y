#!/bin/bash
# Script to apply beyla/auto-instrumentation annotations to deployments
#
# Usage:
#   ./beyla-apply-annotations.sh [namespace]
#
# If namespace is not provided, defaults to 'demo'

set -e

NAMESPACE="${1:-demo}"

echo "Applying beyla/auto-instrumentation annotations in namespace: ${NAMESPACE}"

# List of services to annotate
SERVICES=("frontend" "catalog" "inventory" "order" "payment")

for service in "${SERVICES[@]}"; do
    DEPLOYMENT_NAME="otel-demo-apps-${service}"
    
    echo "Applying annotation to ${DEPLOYMENT_NAME}..."
    
    # Check if deployment exists
    if ! kubectl get deployment "${DEPLOYMENT_NAME}" -n "${NAMESPACE}" &>/dev/null; then
        echo "  Warning: Deployment ${DEPLOYMENT_NAME} not found in namespace ${NAMESPACE}, skipping..."
        continue
    fi
    
    # Apply annotation using kubectl patch with merge type (handles missing annotations field)
    kubectl patch deployment "${DEPLOYMENT_NAME}" -n "${NAMESPACE}" \
        --type='merge' \
        -p='{
            "spec": {
                "template": {
                    "metadata": {
                        "annotations": {
                            "beyla/auto-instrumentation": "true"
                        }
                    }
                }
            }
        }'
    
    echo "  ✓ Annotation applied to ${DEPLOYMENT_NAME}"
done

echo ""
echo "All annotations applied successfully!"
echo "Note: Pods will be recreated with the new annotations on the next rollout."
