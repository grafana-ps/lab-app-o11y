# OTel Demo Apps - Makefile
# Multi-arch builds by default (AMD64 + ARM64)

# Load .env file if it exists (Grafana Cloud credentials)
-include .env
export

REGISTRY ?= docker.io
REPO ?= baykara
TAG ?= latest
PLATFORMS ?= linux/amd64,linux/arm64
NAMESPACE ?= demo

# Pre-built public images (for quickstart)
PREBUILT_REPO ?= stevenshaw212

SERVICES = frontend catalog inventory order payment kafka-demo
LOADGEN = loadgen

# k8s-monitoring
K8S_MONITORING_NAMESPACE ?= grafana-k8s-monitoring
K8S_MONITORING_VALUES ?= ../configs/k8s-monitoring-values.yaml


# Colors for output
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m

.PHONY: all build push local clean help deploy deploy-prebuilt deploy-custom undeploy \
	\
	install-k8s-monitoring uninstall-k8s-monitoring \
	enable-instrumentation disable-instrumentation \
	clean-all

help: ## Show this help
	@echo "OTel Demo Apps - Build & Deploy"
	@echo ""
	@echo "Usage: make [target] [REGISTRY=...] [REPO=...] [TAG=...]"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "Variables:"
	@echo "  REGISTRY       Container registry (default: docker.io)"
	@echo "  REPO           Repository/username (default: baykara)"
	@echo "  TAG            Image tag (default: latest)"
	@echo "  PLATFORMS      Build platforms (default: linux/amd64,linux/arm64)"
	@echo "  NAMESPACE      Kubernetes namespace (default: demo)"
	@echo "  PREBUILT_REPO  Pre-built image repo (default: stevenshaw212)"
	@echo "  K8S_MONITORING_VALUES  Path to k8s-monitoring values file (default: ../configs/k8s-monitoring-values.yaml)"

# ============================================================================
# Build targets
# ============================================================================

build: buildx-setup $(addprefix build-,$(SERVICES)) build-loadgen ## Build all images (multi-arch)
	@echo "$(GREEN)All images built successfully$(NC)"

build-%: ## Build a specific service (multi-arch)
	@echo "$(YELLOW)Building $*...$(NC)"
	docker buildx build \
		--platform $(PLATFORMS) \
		-t $(REGISTRY)/$(REPO)/otel-demo-$*:$(TAG) \
		--push \
		apps/$*/

build-loadgen: ## Build the k6 load generator image
	@echo "$(YELLOW)Building loadgen...$(NC)"
	docker buildx build \
		--platform $(PLATFORMS) \
		-t $(REGISTRY)/$(REPO)/otel-demo-loadgen:$(TAG) \
		--push \
		loadgen/

buildx-setup: ## Setup Docker buildx for multi-arch builds
	@docker buildx inspect otel-demo-builder >/dev/null 2>&1 || \
		docker buildx create --name otel-demo-builder --use --bootstrap
	@docker buildx use otel-demo-builder

# ============================================================================
# Push targets (for pre-built images)
# ============================================================================

push: $(addprefix push-,$(SERVICES)) push-loadgen ## Push all images
	@echo "$(GREEN)All images pushed successfully$(NC)"

push-%: ## Push a specific service image
	@echo "$(YELLOW)Pushing $*...$(NC)"
	docker push $(REGISTRY)/$(REPO)/otel-demo-$*:$(TAG)

push-loadgen: ## Push the loadgen image
	@echo "$(YELLOW)Pushing loadgen...$(NC)"
	docker push $(REGISTRY)/$(REPO)/otel-demo-loadgen:$(TAG)

# ============================================================================
# Local development
# ============================================================================

local: ## Run all services locally via Docker Compose
	docker compose up --build

local-down: ## Stop local services
	docker compose down

local-logs: ## Tail logs from all local services
	docker compose logs -f

# ============================================================================
# Build single-arch (for local testing without push)
# ============================================================================

build-local: $(addprefix build-local-,$(SERVICES)) build-local-loadgen ## Build images for local arch only (no push)
	@echo "$(GREEN)All local images built$(NC)"

build-local-%:
	@echo "$(YELLOW)Building $* (local)...$(NC)"
	docker build -t $(REPO)/otel-demo-$*:$(TAG) apps/$*/

build-local-loadgen:
	@echo "$(YELLOW)Building loadgen (local)...$(NC)"
	docker build -t $(REPO)/otel-demo-loadgen:$(TAG) loadgen/

# ============================================================================
# Kubernetes deployment
# ============================================================================

deploy-prebuilt: ## Deploy using pre-built public images (quickstart)
	helm upgrade --install otel-demo-apps ./helm/otel-demo-apps \
		--set global.image.repository=$(PREBUILT_REPO) \
		--namespace $(NAMESPACE) --create-namespace

deploy-custom: ## Deploy using your own private registry images
	helm upgrade --install otel-demo-apps ./helm/otel-demo-apps \
		--set global.image.registry=$(REGISTRY) \
		--set global.image.repository=$(REPO) \
		--set global.image.tag=$(TAG) \
		--namespace $(NAMESPACE) --create-namespace

deploy: deploy-prebuilt ## Deploy (alias for deploy-prebuilt)

undeploy: ## Remove Kubernetes deployment
	helm uninstall otel-demo-apps --namespace $(NAMESPACE)

# ============================================================================
# Infrastructure (k8s-monitoring)
# ============================================================================

uninstall-k8s-monitoring: ## Install Grafana k8s-monitoring chart (Alloy + collectors)
	@echo "$(YELLOW)Installing k8s-monitoring...$(NC)"
	@test -n "$(GRAFANA_CLOUD_TOKEN)" || (echo "$(YELLOW)Error: GRAFANA_CLOUD_TOKEN is not set. Copy .env.example to .env and fill in your values.$(NC)" && exit 1)
	helm repo add grafana https://grafana.github.io/helm-charts || true
	helm repo update grafana
	envsubst < $(K8S_MONITORING_VALUES) | helm upgrade --install grafana-k8s-monitoring grafana/k8s-monitoring \
		--namespace $(K8S_MONITORING_NAMESPACE) --create-namespace \
		--values -
	@echo "$(GREEN)k8s-monitoring installed$(NC)"

uninstall-k8s-monitoring: ## Uninstall k8s-monitoring chart
	helm uninstall grafana-k8s-monitoring --namespace $(K8S_MONITORING_NAMESPACE)

# ============================================================================
# Auto-Instrumentation
# ============================================================================

enable-instrumentation: ## Annotate deployments to enable SDK injection
	@echo "$(YELLOW)Enabling SDK injection on demo apps...$(NC)"
	./k8s/instrumentation/sdk-apply-annotations.sh $(NAMESPACE)
	@echo "$(GREEN)SDK injection enabled -- the controller restarts the workloads$(NC)"

disable-instrumentation: ## Remove SDK injection annotations from deployments
	@echo "$(YELLOW)Disabling SDK injection on demo apps...$(NC)"
	./k8s/instrumentation/sdk-remove-annotations.sh $(NAMESPACE)
	@echo "$(GREEN)SDK injection disabled -- pods restart without the SDK$(NC)"

# ============================================================================
# Utilities
# ============================================================================

clean: ## Remove local images
	-docker rmi $(addprefix $(REPO)/otel-demo-,$(addsuffix :$(TAG),$(SERVICES)))
	-docker rmi $(REPO)/otel-demo-loadgen:$(TAG)
	-docker buildx rm otel-demo-builder 2>/dev/null || true

clean-all: ## Undeploy everything and delete namespaces
	@echo "$(YELLOW)Removing SDK injection annotations...$(NC)"
	-./k8s/instrumentation/sdk-remove-annotations.sh $(NAMESPACE)
	@echo "$(YELLOW)Uninstalling demo apps...$(NC)"
	-helm uninstall otel-demo-apps --namespace $(NAMESPACE)
	@echo "$(YELLOW)Uninstalling k8s-monitoring...$(NC)"
	-helm uninstall grafana-k8s-monitoring --namespace $(K8S_MONITORING_NAMESPACE)
	@echo "$(YELLOW)Deleting namespaces...$(NC)"
	-kubectl delete namespace $(NAMESPACE) $(K8S_MONITORING_NAMESPACE)
	@echo "$(GREEN)All cleaned up$(NC)"

lint: ## Lint all source files
	@echo "$(YELLOW)Linting not yet implemented$(NC)"

test: ## Run tests (placeholder)
	@echo "$(YELLOW)Tests not yet implemented$(NC)"

