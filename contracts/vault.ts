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
