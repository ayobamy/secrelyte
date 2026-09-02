# services/crypto

The security core. Pure functions over `Uint8Array`.

**Owns:** key derivation, AEAD, wrapping, recovery encoding, zeroization.
**Does not own:** network, React, Next, Supabase, UI.
**Imports:** nothing internal. The only module allowed to import libsodium.
**Contracts:** none. It is a sink.

Phase 1 implements this. The directory exists so import boundaries can be linted now.
