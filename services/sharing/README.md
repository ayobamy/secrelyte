# services/sharing

Share creation, recipient verification, revocation. Recipients are not auth users.

**Owns:** share payload assembly, token hashing, OTP verify, consume_share client.
**Does not own:** email delivery, vault CRUD, crypto primitives.
**Imports:** `contracts/sharing`, `services/crypto`.
**Contracts:** `CreateShareInput`, `CreateShareResult`, `ShareState`.
