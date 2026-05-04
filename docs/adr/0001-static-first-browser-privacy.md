# ADR 0001: Static-first and browser-only personal data

## Status

Accepted

## Context

The public site should be easy to host on GitHub Pages and should not require parents to send personal data to a server.

## Decision

The primary deployment is a static Vite application. Parent and child details stay in React state and are written directly into a downloaded PDF in the browser. The Go server is an optional Docker runtime for serving the same static files plus health, version, catalog, and Prometheus endpoints.

## Consequences

- GitHub Pages can serve the public app without a running backend.
- No personal enrollment data is stored, logged, posted, or sent to metrics.
- Backend observability covers service health and traffic only, not form contents.
