#!/bin/bash
# Script to remove OpenTelemetry auto-instrumentation annotations from deployments
#
# Usage:
#   ./otel-remove-instrumentations.sh [namespace] [release-name]
#
# If namespace is not provided, defaults to 'demo'
# If release-name is not provided, defaults to 'otel-demo-apps'

set -e

NAMESPACE="${1:-demo}"
RELEASE_NAME="${2:-otel-demo-apps}"

echo "Removing OTel auto-instrumentation annotations from namespace: ${NAMESPACE}"

# Bash 3.2 on macOS does not support associative arrays.
ANNOTATIONS=(
    "frontend:instrumentation.opentelemetry.io/inject-nodejs"
    "catalog:instrumentation.opentelemetry.io/inject-python"
    "order:instrumentation.opentelemetry.io/inject-dotnet"
    "payment:instrumentation.opentelemetry.io/inject-java"
)

for entry in "${ANNOTATIONS[@]}"; do
    service="${entry%%:*}"
    ANNOTATION_KEY="${entry#*:}"
    DEPLOYMENT_NAME="${RELEASE_NAME}-${service}"
    
    echo "Removing annotation from ${DEPLOYMENT_NAME}..."
    
    # Check if deployment exists
    if ! kubectl get deployment "${DEPLOYMENT_NAME}" -n "${NAMESPACE}" &>/dev/null; then
        echo "  Warning: Deployment ${DEPLOYMENT_NAME} not found in namespace ${NAMESPACE}, skipping..."
        continue
    fi
    
    # Use index() so keys with dots/slashes are read safely.
    ANNOTATION_VALUE="$(kubectl get deployment "${DEPLOYMENT_NAME}" -n "${NAMESPACE}" \
        -o go-template="{{ if .spec.template.metadata.annotations }}{{ index .spec.template.metadata.annotations \"${ANNOTATION_KEY}\" }}{{ end }}" 2>/dev/null || true)"

    # Check if annotation exists before trying to remove it
    if [ -n "${ANNOTATION_VALUE}" ] && [ "${ANNOTATION_VALUE}" != "<no value>" ]; then
        # Remove annotation using kubectl patch
        # JSON patch requires escaping: ~ becomes ~0, / becomes ~1
        # Escape ~ first (to avoid double-escaping), then escape /
        ESCAPED_KEY="${ANNOTATION_KEY//\~/~0}"  # Escape ~ first
        ESCAPED_KEY="${ESCAPED_KEY//\//~1}"     # Then escape /
        ESCAPED_PATH="/spec/template/metadata/annotations/${ESCAPED_KEY}"
        
        kubectl patch deployment "${DEPLOYMENT_NAME}" -n "${NAMESPACE}" \
            --type='json' \
            -p="[
                {
                    \"op\": \"remove\",
                    \"path\": \"${ESCAPED_PATH}\"
                }
            ]"
        echo "  ✓ Annotation removed from ${DEPLOYMENT_NAME}"
    else
        echo "  ℹ Annotation not found on ${DEPLOYMENT_NAME}, skipping..."
    fi
done

echo ""
echo "All annotations removed successfully!"
echo "Note: Pods will be recreated without the annotations on the next rollout."
