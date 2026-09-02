# services/crypto

The security core. Pure functions over `Uint8Array`. Implements
`docs/technical/03-cryptography-spec.md`.

**Owns:** key derivation, AEAD, wrapping, recovery encoding, zeroization.
**Does not own:** network, React, Next, Supabase, UI, the in-memory vault keystore.
**Imports:** `libsodium-wrappers-sumo` (only from `src/sodium.ts`) and `@scure/bip39`.
**Contracts:** none. It is a sink. Callers import `@/services/crypto`.

Argon2id runs inline in Node tests. In a browser it runs in `src/worker.ts` so a 64 MiB
stretch does not freeze the UI.

`test/vectors.json` is frozen. Changing a value is a breaking change.

```bash
pnpm test:crypto          # 100% branch coverage on src/
pnpm check:crypto         # one libsodium import, no Math.random, no console, no TBD vectors
```
