# services/agent

AI tools, guards, prompt assembly, confirmation cards. The model proposes. A human click executes.

**Owns:** tool definitions, injection guards, proposal expiry, scrubber coordination.
**Does not own:** encryption, share protocol execution, email send.
**Imports:** `contracts/agent`. Never `services/crypto`.
**Contracts:** `ProposeShareArgs`, `ToolProposal`.
**Evals:** `evals/` is empty until Phase 5. Structural injection rows land there.
