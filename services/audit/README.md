# services/audit

Hash-chained append-only log and detection rules.

**Owns:** append, chain verify, redaction, export.
**Does not own:** product/secret CRUD, UI timeline rendering (that is `app/` + components).
**Imports:** `contracts` error codes only.
**Contracts:** none yet. Event shapes freeze in Phase 6.
