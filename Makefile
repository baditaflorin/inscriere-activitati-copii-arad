SHELL := /bin/sh

APP_NAME := inscriere-activitati-copii-arad
IMAGE := ghcr.io/baditaflorin/$(APP_NAME)
VERSION := $(shell sed -n '1p' VERSION.md)
GITLEAKS := $(CURDIR)/.bin/gitleaks
GO_PACKAGES := $(shell go list ./... | grep -v '/node_modules/' || true)

.PHONY: install dev build-pages frontend-lint frontend-typecheck frontend-test go-test pdf-smoke secret-scan check smoke docker-smoke docker-build-amd64 docker-push-amd64 install-hooks clean

install:
	npm ci
	go mod download

dev:
	npm run dev

build-pages:
	rm -rf docs/assets docs/data docs/index.html docs/.vite docs/favicon.svg
	npm run build:pages
	touch docs/.nojekyll

frontend-lint:
	npm run lint

frontend-typecheck:
	npm run typecheck

frontend-test:
	npm run test -- --run --passWithNoTests

go-test:
	CGO_ENABLED=0 go test $(GO_PACKAGES)

pdf-smoke:
	npm run pdf:smoke

$(GITLEAKS):
	mkdir -p .bin
	GOBIN=$(CURDIR)/.bin go install github.com/zricethezav/gitleaks/v8@latest

secret-scan: $(GITLEAKS)
	$(GITLEAKS) detect --source . --no-banner --redact

check: frontend-lint frontend-typecheck frontend-test go-test secret-scan

smoke: build-pages pdf-smoke
	npm run smoke

docker-smoke:
	./scripts/docker-smoke.sh

docker-build-amd64:
	docker buildx build --platform linux/amd64 --load -t $(IMAGE):$(VERSION) .

docker-push-amd64:
	docker buildx build --platform linux/amd64 --push -t $(IMAGE):$(VERSION) -t $(IMAGE):latest .

install-hooks:
	npm run hooks:install

clean:
	rm -rf docs/assets docs/data docs/index.html docs/.vite test-results playwright-report .bin
