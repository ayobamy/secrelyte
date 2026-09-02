import { z } from 'zod';

export const B64Url = z.string().regex(/^[A-Za-z0-9_-]+$/, 'must be base64url, unpadded');

export const Uuid = z.string().uuid();

export const Envelope = z.object({
  v: z.literal(1),
  alg: z.literal('xchacha20poly1305'),
  n: B64Url, // 24-byte nonce
  ct: B64Url, // ciphertext || tag
  aad: z.string(), // reconstructed and compared, never trusted
});
export type Envelope = z.infer<typeof Envelope>;
