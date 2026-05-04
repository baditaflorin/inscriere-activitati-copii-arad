# Postmortem

## Summary

Implemented the first production-ready version of the Palatul Copiilor Arad enrollment helper as a static-first, browser-only PDF generator with an optional Go/Docker runtime.

## What went well

- The official enrollment PDF is public and small enough to ship as a static asset.
- The official Arad circles and relocation announcement are parseable from HTML, so the catalog can be refreshed deterministically.
- Browser-only PDF generation keeps parent and child data out of logs, servers, metrics, and storage.

## Issues found during implementation

- The official PDF has no AcroForm fields, so filling must use measured draw coordinates.
- The official circle line is too short for many selected activities, so multi-circle downloads now use one PDF per circle in a ZIP.
- The local Go environment had global CGO flags for ONNX Runtime; local Go tests now force `CGO_ENABLED=0`.
- `pdf-lib` needs the matching `@pdf-lib/fontkit` adapter for reliable custom-font embedding.

## Follow-up risks

- If the school changes the PDF layout, coordinates in `web/src/pdf/enrollmentPdf.ts` must be rechecked.
- If the official WordPress markup changes, scraper tests should be expanded with new fixtures before refreshing `web/src/data/catalog.json`.
- Docker publishing still depends on a local authenticated `docker login ghcr.io`.
