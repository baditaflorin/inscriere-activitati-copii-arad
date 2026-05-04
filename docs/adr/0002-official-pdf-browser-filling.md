# ADR 0002: Fill the official PDF in the browser

## Status

Accepted

## Context

The official enrollment PDF has no AcroForm fields. The output still needs to look like the school's form.

## Decision

Use `pdf-lib` and `fontkit` in the browser to load the official PDF template, embed Noto Sans for Romanian diacritics, and draw validated form data at measured coordinates.

## Consequences

- The downloaded file preserves the official one-page layout.
- Coordinates are covered by tests and smoke checks because the upstream PDF can change.
- Updating the official template requires checking the SHA-256 and adjusting coordinates if the layout changes.
