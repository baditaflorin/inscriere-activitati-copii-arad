# ADR 0003: Go server, scraper, and Prometheus observability

## Status

Accepted

## Context

The app should run as static GitHub Pages, but also as a Docker Compose service with observability and reproducible official data refreshes.

## Decision

Use Go with `chi`, `goquery`, `zerolog`, and `prometheus/client_golang`. The scraper normalizes official HTML into checked-in JSON. The server serves `docs/`, exposes `/api/catalog`, `/api/version`, `/healthz`, `/readyz`, and `/metrics`, and adds request counters and duration metrics.

## Consequences

- Data refresh is deterministic and reviewable in Git.
- Docker deployments get health checks and Prometheus metrics.
- The server remains stateless and does not process personal form data.
