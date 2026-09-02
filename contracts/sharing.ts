import { z } from 'zod';
import { B64Url, Envelope, Uuid } from './primitives';

export const CreateShareInput = z.object({
  tokenHash: B64Url,
  payload: Envelope,
  wrappedSdek: B64Url,
  passphraseSalt: B64Url.nullable(),
  recipientBlindIndex: B64Url,
  recipientCiphertext: B64Url,
  secretIds: z.array(Uuid).min(1).max(50),
  expiresInHours: z.number().int().min(1).max(720),
  maxViews: z.number().int().min(1).max(20),
});
export type CreateShareInput = z.infer<typeof CreateShareInput>;

export const CreateShareResult = z.object({
  shareId: Uuid,
  expiresAt: z.string().datetime(),
});
export type CreateShareResult = z.infer<typeof CreateShareResult>;

export const ShareState = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('verify_required'),
    shareId: Uuid,
    hasPassphrase: z.boolean(),
  }),
  z.object({ state: z.literal('unavailable') }),
  z.object({ state: z.literal('locked') }),
]);
export type ShareState = z.infer<typeof ShareState>;
