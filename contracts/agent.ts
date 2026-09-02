import { z } from 'zod';
import { Uuid } from './primitives';

export const ProposeShareArgs = z.object({
  productQuery: z.string().max(120),
  keyNames: z.array(z.string().max(120)).optional(),
  recipientEmail: z.string().email(),
  expiresInHours: z.number().int().min(1).max(720).default(24),
  maxViews: z.number().int().min(1).max(20).default(3),
});
export type ProposeShareArgs = z.infer<typeof ProposeShareArgs>;

export const ToolProposal = z.object({
  proposalId: Uuid,
  tool: z.enum(['propose_share', 'propose_store', 'propose_delete', 'propose_revoke']),
  args: z.unknown(),
  resolved: z.object({
    productName: z.string(),
    itemCount: z.number(),
    recipientEmail: z.string(),
    isNewRecipient: z.boolean(),
    isNonTeamDomain: z.boolean(),
    hasSuspiciousScript: z.boolean(),
  }),
  expiresAt: z.string().datetime(),
});
export type ToolProposal = z.infer<typeof ToolProposal>;
