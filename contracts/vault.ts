import { z } from 'zod';
import { B64Url, Envelope, Uuid } from './primitives';

export const Product = z.object({
  id: Uuid,
  name: z.string().min(1).max(120),
  loginUrl: z.string().url().nullable(),
  username: z.string().max(200).nullable(),
  environment: z.enum(['production', 'staging', 'development']),
  wrappedDek: B64Url,
  secretCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type Product = z.infer<typeof Product>;

export const SecretRef = z.object({
  id: Uuid,
  productId: Uuid,
  keyName: z.string().min(1).max(120),
  envelope: Envelope,
  version: z.number().int().positive(),
});
export type SecretRef = z.infer<typeof SecretRef>;

export const KdfWire = z.object({
  alg: z.literal('argon2id'),
  m: z.number().int().min(19456),
  t: z.number().int().min(1),
  p: z.number().int().min(1),
  v: z.literal(1),
});
export type KdfWire = z.infer<typeof KdfWire>;

export const SignupRequest = z.object({
  email: z.string().email(),
  authPassword: B64Url,
  publicKey: B64Url,
  wrappedVaultKey: B64Url,
  wrappedPrivateKey: B64Url,
  recoveryWrappedVaultKey: B64Url,
  recoveryWrappedPrivateKey: B64Url,
  kdf: KdfWire,
});
export type SignupRequest = z.infer<typeof SignupRequest>;

export const KDF_LOOKUP_FLOOR_MS = 80;
