import { afterEach, describe, expect, it, vi } from 'vitest';
import { inflateSync } from 'node:zlib';
import {
  AAD,
  AuthenticationError,
  sodiumReady,
  unwrapVaultKeyFromRecovery,
} from '@/services/crypto';
import {
  assembleSignupMaterial,
  AuthUpdatePendingError,
  applyPasswordChange,
  bytesFromWire,
  bytesToEnvelope,
  bytesToPgHex,
  buildRecoveryKitPdf,
  clearPendingAuthPassword,
  envelopeToBytes,
  IDLE_LOCK_MS,
  isUnlocked,
  lockKeys,
  openProductDek,
  openSecretValue,
  peekPendingAuthPassword,
  phraseMatchesCurrentVault,
  pickChallengeIndices,
  retryAuthPasswordUpdate,
  scorePassword,
  sealSecretValue,
  startIdleLock,
  unlockFromOwnKeys,
  unlockKeys,
  getVaultKey,
  verifyChallenge,
  wrapNewProductDek,
} from '@/services/vault';

afterEach(async () => {
  await lockKeys();
  clearPendingAuthPassword();
});

describe('scorePassword', () => {
  it('rejects short passwords', () => {
    expect(scorePassword('short').ok).toBe(false);
  });

  it('accepts a long passphrase', () => {
    expect(scorePassword('correct-horse-battery-staple-orbit').ok).toBe(true);
  });
});

describe('recovery challenge', () => {
  it('picks three sorted unique indices', () => {
    const idx = pickChallengeIndices(24, 3, () => 0.5);
    expect(idx).toHaveLength(3);
    expect(new Set(idx).size).toBe(3);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });

  it('accepts the three chosen words', () => {
    const words = Array.from({ length: 24 }, (_, i) => `w${i}`);
    expect(
      verifyChallenge(words, [
        { index: 0, value: 'w0' },
        { index: 7, value: 'W7' },
        { index: 22, value: 'w22' },
      ]),
    ).toBe(true);
  });

  it('rejects a wrong word', () => {
    const words = Array.from({ length: 24 }, (_, i) => `w${i}`);
    expect(
      verifyChallenge(words, [
        { index: 0, value: 'w0' },
        { index: 7, value: 'nope' },
        { index: 22, value: 'w22' },
      ]),
    ).toBe(false);
  });
});

describe('signup material and unlock', () => {
  it('round-trips wraps and refuses a wrong password', async () => {
    await sodiumReady();
    const material = await assembleSignupMaterial(
      'Owner@Example.com',
      'correct-horse-battery-staple-orbit',
    );
    expect(material.kit.words).toHaveLength(24);
    expect(material.publicKey.byteLength).toBe(32);
    expect(material.authPassword).not.toContain('correct-horse');
    expect(JSON.stringify(material.kdf)).not.toContain('correct-horse');

    await unlockFromOwnKeys('owner@example.com', 'correct-horse-battery-staple-orbit', {
      wrapped_vault_key: material.wrappedVaultKey,
      wrapped_private_key: material.wrappedPrivateKey,
      recovery_ack_at: null,
    });
    expect(isUnlocked()).toBe(true);

    await expect(
      unlockFromOwnKeys('owner@example.com', 'totally-wrong-passphrase-xx', {
        wrapped_vault_key: material.wrappedVaultKey,
        wrapped_private_key: material.wrappedPrivateKey,
        recovery_ack_at: null,
      }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });
});

describe('product DEK and secret AAD', () => {
  it('opens a secret only with the matching AAD binding', async () => {
    await sodiumReady();
    const material = await assembleSignupMaterial(
      'aad@example.com',
      'correct-horse-battery-staple-orbit',
    );
    unlockKeys(material.vk, material.sk);
    const productId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const secretId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const { dek, wrapped } = await wrapNewProductDek(productId);
    const openedDek = await openProductDek(productId, wrapped);
    const sealed = await sealSecretValue({
      dek: openedDek,
      productId,
      secretId,
      version: 1,
      value: 'sk_live_SENTINEL_UNIT',
    });
    const plain = await openSecretValue({
      dek: openedDek,
      productId,
      secretId,
      version: 1,
      ciphertext: sealed.ciphertext,
      nonce: sealed.nonce,
    });
    expect(plain).toBe('sk_live_SENTINEL_UNIT');
    await expect(
      openSecretValue({
        dek: openedDek,
        productId,
        secretId,
        version: 2,
        ciphertext: sealed.ciphertext,
        nonce: sealed.nonce,
      }),
    ).rejects.toBeInstanceOf(AuthenticationError);
    expect(AAD.secret(productId, secretId, 1)).toBe(`secret:v1|${productId}|${secretId}|1`);
    void dek;
  });
});

describe('envelope codec', () => {
  it('round-trips nonce and ciphertext', async () => {
    await sodiumReady();
    const material = await assembleSignupMaterial(
      'env@example.com',
      'correct-horse-battery-staple-orbit',
    );
    const env = await bytesToEnvelope(material.wrappedVaultKey, AAD.wrapVk);
    const back = await envelopeToBytes(env);
    expect(Buffer.from(back)).toEqual(Buffer.from(material.wrappedVaultKey));
  });

  it('encodes bytea as Postgres hex', () => {
    const hex = bytesToPgHex(Uint8Array.from([0x0a, 0xff]));
    expect(hex).toBe('\\x0aff');
    expect(Buffer.from(bytesFromWire(hex))).toEqual(Buffer.from([0x0a, 0xff]));
  });
});

function pdfInflatedText(pdf: Uint8Array): string {
  const buf = Buffer.from(pdf);
  let out = '';
  let i = 0;
  const marker = Buffer.from('stream');
  while (i < buf.length) {
    const idx = buf.indexOf(marker, i);
    if (idx < 0) break;
    let start = idx + marker.length;
    if (buf[start] === 0x0d) start += 1;
    if (buf[start] === 0x0a) start += 1;
    const end = buf.indexOf(Buffer.from('endstream'), start);
    if (end < 0) break;
    const chunk = buf.subarray(start, end);
    try {
      out += inflateSync(chunk).toString('utf8');
    } catch {
      out += chunk.toString('latin1');
    }
    i = end + 9;
  }
  return out;
}

function pdfVisibleText(pdf: Uint8Array): string {
  const inflated = pdfInflatedText(pdf);
  const parts: string[] = [];
  for (const m of inflated.matchAll(/<([0-9A-Fa-f]+)> Tj/g)) {
    parts.push(Buffer.from(m[1]!, 'hex').toString('utf8'));
  }
  return parts.join('\n');
}

describe('recovery kit PDF', () => {
  it('is a PDF that contains the phrase words', async () => {
    const pdf = await buildRecoveryKitPdf({
      email: 'owner@example.com',
      phrase:
        'abandon ability able about above absent absorb abstract absurd abuse access accident',
      base32: 'MFRGGZDFMY',
      createdAt: new Date('2026-09-02T00:00:00.000Z'),
    });
    expect(Buffer.from(pdf.subarray(0, 5)).toString('ascii')).toBe('%PDF-');
    const raw = pdfVisibleText(pdf);
    expect(raw).toContain('abandon');
    expect(raw).toContain('owner@example.com');
  });
});

describe('recovery phrase gate', () => {
  it('accepts the kit phrase against the recovery wrap', async () => {
    await sodiumReady();
    const material = await assembleSignupMaterial(
      'kit@example.com',
      'correct-horse-battery-staple-orbit',
    );
    unlockKeys(material.vk, material.sk);
    await expect(
      phraseMatchesCurrentVault(material.kit.phrase, material.recoveryWrappedVaultKey),
    ).resolves.toBe(true);
    await expect(
      phraseMatchesCurrentVault('not a real mnemonic at all', material.recoveryWrappedVaultKey),
    ).resolves.toBe(false);
  });
});

describe('password change', () => {
  const oldPassword = 'correct-horse-battery-staple-orbit';
  const newPassword = 'correct-horse-battery-staple-orbit-two';

  it('rewraps so only the new password unlocks, recovery wrap unchanged', async () => {
    await sodiumReady();
    const material = await assembleSignupMaterial('pw@example.com', oldPassword);
    unlockKeys(material.vk, material.sk);
    let wraps = {
      wrapped_vault_key: material.wrappedVaultKey,
      wrapped_private_key: material.wrappedPrivateKey,
    };
    const order: string[] = [];
    await applyPasswordChange({
      email: 'pw@example.com',
      newPassword,
      rotateWrapped: async (args) => {
        order.push('rotate');
        wraps = {
          wrapped_vault_key: args.wrappedVaultKey,
          wrapped_private_key: args.wrappedPrivateKey,
        };
      },
      updateAuthPassword: async () => {
        order.push('auth');
      },
    });
    expect(order).toEqual(['rotate', 'auth']);
    await lockKeys();
    await unlockFromOwnKeys('pw@example.com', newPassword, {
      ...wraps,
      recovery_ack_at: null,
    });
    expect(isUnlocked()).toBe(true);
    await expect(
      unlockFromOwnKeys('pw@example.com', oldPassword, {
        ...wraps,
        recovery_ack_at: null,
      }),
    ).rejects.toBeInstanceOf(AuthenticationError);
    const recovered = await unwrapVaultKeyFromRecovery(
      material.kit.rk,
      await bytesToEnvelope(material.recoveryWrappedVaultKey, AAD.wrapVkRk),
    );
    expect(Buffer.from(recovered)).toEqual(Buffer.from(getVaultKey()));
  });

  it('keeps wraps rotated when GoTrue fails so retry is auth-only', async () => {
    await sodiumReady();
    const material = await assembleSignupMaterial('retry@example.com', oldPassword);
    unlockKeys(material.vk, material.sk);
    let rotated = false;
    await expect(
      applyPasswordChange({
        email: 'retry@example.com',
        newPassword,
        rotateWrapped: async () => {
          rotated = true;
        },
        updateAuthPassword: async () => {
          throw new Error('gotrue down');
        },
      }),
    ).rejects.toBeInstanceOf(AuthUpdatePendingError);
    expect(rotated).toBe(true);
    expect(peekPendingAuthPassword()).toBeTruthy();
    await retryAuthPasswordUpdate(async () => undefined);
    expect(peekPendingAuthPassword()).toBeNull();
  });
});

describe('idle lock', () => {
  it('zeroes keys after the idle window', async () => {
    await sodiumReady();
    const material = await assembleSignupMaterial(
      'idle@example.com',
      'correct-horse-battery-staple-orbit',
    );
    const listeners = new Map<string, EventListener>();
    vi.stubGlobal('window', {
      addEventListener: (type: string, fn: EventListener) => {
        listeners.set(type, fn);
      },
      removeEventListener: (type: string) => {
        listeners.delete(type);
      },
    });
    unlockKeys(material.vk, material.sk);
    vi.useFakeTimers();
    const stop = startIdleLock();
    try {
      expect(isUnlocked()).toBe(true);
      vi.advanceTimersByTime(IDLE_LOCK_MS);
      await vi.runAllTimersAsync();
      expect(isUnlocked()).toBe(false);
    } finally {
      stop();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});
