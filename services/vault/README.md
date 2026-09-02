# services/vault

Product and secret CRUD. Ciphertext in, ciphertext out. In-memory key store on the client.

**Owns:** signup/unlock orchestration, product/secret records, idle lock.
**Does not own:** AEAD primitives, share protocol, AI tools.
**Imports:** `contracts/vault`, `services/crypto` (client-only).
**Contracts:** `Product`, `SecretRef`.
