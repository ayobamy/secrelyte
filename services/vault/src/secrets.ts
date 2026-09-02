import { AAD, fromB64url, openString, sealString, toB64url, type DEK } from '@/services/crypto';

export async function sealSecretValue(input: {
  dek: DEK;
  productId: string;
  secretId: string;
  version: number;
  value: string;
}): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
  const aad = AAD.secret(input.productId, input.secretId, input.version);
  const env = await sealString(input.dek, input.value, aad);
  return {
    ciphertext: await fromB64url(env.ct),
    nonce: await fromB64url(env.n),
  };
}

export async function openSecretValue(input: {
  dek: DEK;
  productId: string;
  secretId: string;
  version: number;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
}): Promise<string> {
  const aad = AAD.secret(input.productId, input.secretId, input.version);
  return openString(
    input.dek,
    {
      v: 1,
      alg: 'xchacha20poly1305',
      n: await toB64url(input.nonce),
      ct: await toB64url(input.ciphertext),
      aad,
    },
    aad,
  );
}
