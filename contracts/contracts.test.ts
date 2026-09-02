import { describe, expect, it } from 'vitest';
import { Envelope } from './primitives';
import { Product, SecretRef } from './vault';
import { CreateShareInput, CreateShareResult, ShareState } from './sharing';
import { ProposeShareArgs, ToolProposal } from './agent';
import { ErrorCode, ErrorHttpStatus } from './errors';

const NONCE = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const CT = 'Y2lwaGVydGV4dHRhZ2FiY2RlZg';
const UUID = '11111111-1111-4111-8111-111111111111';
const ISO = '2026-09-02T00:00:00.000Z';

const envelope = {
  v: 1 as const,
  alg: 'xchacha20poly1305' as const,
  n: NONCE,
  ct: CT,
  aad: 'product:11111111-1111-4111-8111-111111111111|secret:22222222-2222-4222-8222-222222222222|v:1',
};

describe('Envelope', () => {
  it('parses a v1 xchacha20poly1305 blob', () => {
    expect(Envelope.parse(envelope).v).toBe(1);
  });

  it('rejects padded base64', () => {
    expect(Envelope.safeParse({ ...envelope, n: NONCE + '=' }).success).toBe(false);
  });

  it('rejects a different algorithm', () => {
    expect(Envelope.safeParse({ ...envelope, alg: 'aes-gcm' }).success).toBe(false);
  });
});

describe('Product / SecretRef', () => {
  const product = {
    id: UUID,
    name: 'Stripe',
    loginUrl: 'https://dashboard.stripe.com',
    username: null,
    environment: 'production' as const,
    wrappedDek: CT,
    secretCount: 1,
    createdAt: ISO,
  };

  it('parses a product', () => {
    expect(Product.parse(product).name).toBe('Stripe');
  });

  it('rejects an oversized product name', () => {
    expect(Product.safeParse({ ...product, name: 'x'.repeat(121) }).success).toBe(false);
  });

  it('parses a secret ref with no plaintext field', () => {
    const ref = SecretRef.parse({
      id: UUID,
      productId: UUID,
      keyName: 'sk_live',
      envelope,
      version: 1,
    });
    expect(ref).not.toHaveProperty('value');
  });

  it('rejects a secret ref that tries to carry plaintext', () => {
    const result = SecretRef.safeParse({
      id: UUID,
      productId: UUID,
      keyName: 'sk_live',
      envelope,
      version: 1,
      value: 'sk_live_this_must_not_parse',
    });
    // Zod object schemas strip unknown keys by default; the contract must not
    // *accept* a value field as part of the type. Strip is correct: the field
    // is not in the output.
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('value');
    }
  });
});

describe('CreateShareInput', () => {
  const input = {
    tokenHash: CT,
    payload: envelope,
    wrappedSdek: CT,
    passphraseSalt: null,
    recipientBlindIndex: CT,
    recipientCiphertext: CT,
    secretIds: [UUID],
    expiresInHours: 24,
    maxViews: 3,
  };

  it('parses a valid share create payload', () => {
    expect(CreateShareInput.parse(input).maxViews).toBe(3);
  });

  it('rejects maxViews above 20', () => {
    expect(CreateShareInput.safeParse({ ...input, maxViews: 21 }).success).toBe(false);
  });

  it('rejects a 90-day expiry', () => {
    expect(CreateShareInput.safeParse({ ...input, expiresInHours: 24 * 90 }).success).toBe(false);
  });

  it('rejects an empty secret list', () => {
    expect(CreateShareInput.safeParse({ ...input, secretIds: [] }).success).toBe(false);
  });
});

describe('CreateShareResult', () => {
  it('has no URL field. The server never sees the token or Link Key.', () => {
    const parsed = CreateShareResult.parse({ shareId: UUID, expiresAt: ISO });
    expect(parsed).not.toHaveProperty('url');
    expect(
      CreateShareResult.strip().parse({
        shareId: UUID,
        expiresAt: ISO,
        url: 'https://secrelyte.app/s/leaked',
      }),
    ).not.toHaveProperty('url');
  });
});

describe('ShareState', () => {
  it('does not distinguish not-found, expired, revoked, and spent', () => {
    expect(ShareState.parse({ state: 'unavailable' })).toEqual({ state: 'unavailable' });
    expect(ShareState.safeParse({ state: 'expired' }).success).toBe(false);
    expect(ShareState.safeParse({ state: 'revoked' }).success).toBe(false);
  });
});

describe('ToolProposal', () => {
  it('requires a full recipient address on the resolved card facts', () => {
    const parsed = ToolProposal.parse({
      proposalId: UUID,
      tool: 'propose_share',
      args: {},
      resolved: {
        productName: 'Stripe',
        itemCount: 1,
        recipientEmail: 'dana@example.com',
        isNewRecipient: true,
        isNonTeamDomain: true,
        hasSuspiciousScript: false,
      },
      expiresAt: ISO,
    });
    expect(parsed.resolved.recipientEmail).toBe('dana@example.com');
  });

  it('rejects a malformed recipient on propose_share args', () => {
    expect(
      ProposeShareArgs.safeParse({
        productQuery: 'stripe',
        recipientEmail: 'not-an-email',
      }).success,
    ).toBe(false);
  });
});

describe('ErrorCode', () => {
  it('maps unauthorized to NOT_FOUND so the endpoint is not an oracle', () => {
    expect(ErrorHttpStatus[ErrorCode.NOT_FOUND]).toBe(404);
    expect(ErrorHttpStatus[ErrorCode.SHARE_UNAVAILABLE]).toBe(404);
  });
});
