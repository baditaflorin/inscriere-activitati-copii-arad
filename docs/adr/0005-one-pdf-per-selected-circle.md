# ADR 0005: Generate one PDF per selected circle

## Status

Accepted

## Context

The official enrollment form has a single short line for `doresc inscrierea copilului la cercurile`. Joining many selected circles into that line can overflow the template and make the generated form harder to read.

## Decision

Generate one filled official PDF for each selected circle. When a parent selects more than one circle, the browser packages those PDFs into a ZIP file with `jszip`. No personal data is posted to the backend, and the e-mail helper only prepares the message body; the parent still attaches the downloaded PDF or ZIP manually.

## Consequences

- The official circle field stays readable even when many activities are selected.
- The downloaded ZIP gives families and teachers a clear one-form-per-activity workflow.
- The frontend needs `jszip`, loaded only when multiple PDFs are generated.
