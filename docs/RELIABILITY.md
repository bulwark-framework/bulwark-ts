# Reliability

Status: proposed. No runtime exists.

## Intended operational model

- Temporal owns retries, timeouts, and durability. Each activity declares its own retry policy: intake 3 attempts with backoff, researcher 2, decide 5 with short backoff.
- Idempotency keys: intake on artefact content hash, researcher on (scheme version, state hash), compile on (scheme, corpus hashes, base version).
- A failed intake facet parks that facet for triage and lets the others continue.
- Human steps are Signals with SLA timers that escalate on expiry.
- The registry serves published versions from immutable storage; a registry outage blocks new case starts but never a running case, which already holds its pinned rubric.

## Diagnostics

Temporal event history is the primary diagnostic. Search attributes planned: `scheme`, `qs_version`, `route`, `assessor_id`, `sla_due`.

## Known limitations

- TypeSafe state is text only. Images enter as captions.
- The TypeSafe SDK retries 408, 429, and 5xx by default with two retries; the activity retry policy wraps that.
