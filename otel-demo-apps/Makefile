# OTel Demo Apps - Makefile
# Multi-arch builds by default (AMD64 + ARM64)

REGISTRY ?= docker.io
REPO ?= your-dockerhub-username
TAG ?= latest
PLATFORMS ?= linux/amd64,linux/arm64

SERVICES = frontend catalog inventory order payment kafka-demo
LOADGEN = loadgen

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m

.PHONY: all build push local clean help

help: ## Show this help
	@echo "OTel Demo Apps - Build & Deploy"
	@echo ""
	@echo "Usage: make [target] [REGISTRY=...] [REPO=...] [TAG=...]"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "Variables:"
	@echo "  REGISTRY  Container registry (default: docker.io)"
	@echo "  REPO      Repository/username (default: your-dockerhub-username)"
	@echo "  TAG       Image tag (default: latest)"
	@echo "  PLATFORMS Build platforms (default: linux/amd64,linux/arm64)"

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

deploy: ## Deploy to Kubernetes using Helm
	helm upgrade --install otel-demo-apps ./helm/otel-demo-apps \
		--set global.image.registry=$(REGISTRY) \
		--set global.image.repository=$(REPO) \
		--set global.image.tag=$(TAG)

undeploy: ## Remove Kubernetes deployment
	helm uninstall otel-demo-apps

# ============================================================================
# Utilities
# ============================================================================

clean: ## Remove local images
	-docker rmi $(addprefix $(REPO)/otel-demo-,$(addsuffix :$(TAG),$(SERVICES)))
	-docker rmi $(REPO)/otel-demo-loadgen:$(TAG)
	-docker buildx rm otel-demo-builder 2>/dev/null || true

lint: ## Lint all source files
	@echo "$(YELLOW)Linting not yet implemented$(NC)"

test: ## Run tests (placeholder)
	@echo "$(YELLOW)Tests not yet implemented$(NC)"

