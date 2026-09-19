# Security

Status: proposed. No runtime exists.

## Trust boundaries

- Submitted artefacts are untrusted input. Intake extracts into a schema; nothing in an artefact is an instruction.
- Corpus documents are trusted content but untrusted as instructions. Researchers cite them; they do not execute them.
- LLM outputs are data. The compiler validates researcher output; a human filters bounded-researcher proposals.
- The approval Signal must carry an authenticated identity. Provenance records it.

## Credentials

- `TYPESAFE_API_KEY` and the LLM provider key live in worker environment only. Never in workflow inputs, never in event history, never in the registry.
- Registry write endpoints (compile, approve, reject, deprecate, proposals) require authentication. Read endpoints for published versions may be public inside the deployment boundary.

## Data handling

- Case state may contain personal data. Event history retention must match the scheme's records policy. Retention is a deployment setting, not a framework default.
- Golden sets are de-identified before they enter the repository or the registry.

## Known gaps

No threat model written. Add one before the registry service plan starts.
