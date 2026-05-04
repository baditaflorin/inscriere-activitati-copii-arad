# ADR 0004: Local hooks instead of GitHub Actions

## Status

Accepted

## Context

The project should avoid GitHub Actions and catch issues before deployment.

## Decision

Use `lefthook` for local `pre-commit`, `pre-push`, and `post-merge` hooks. The canonical checks live in `Makefile` so developers can run the same commands manually.

## Consequences

- No CI files are added.
- Contributors need to run `make install-hooks` locally.
- `make check` and `make smoke` are the release gates before pushing or publishing Docker images.
