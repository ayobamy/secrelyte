export type MK = Uint8Array & { readonly __brand: 'MK' };
export type MEK = Uint8Array & { readonly __brand: 'MEK' };
export type AuthKey = Uint8Array & { readonly __brand: 'AuthKey' };
export type VK = Uint8Array & { readonly __brand: 'VK' };
export type DEK = Uint8Array & { readonly __brand: 'DEK' };
export type SDEK = Uint8Array & { readonly __brand: 'SDEK' };
export type LK = Uint8Array & { readonly __brand: 'LK' };
export type RK = Uint8Array & { readonly __brand: 'RK' };
export type X25519PublicKey = Uint8Array & { readonly __brand: 'X25519PublicKey' };
export type X25519SecretKey = Uint8Array & { readonly __brand: 'X25519SecretKey' };
export type Bytes16 = Uint8Array & { readonly __brand: 'Bytes16' };
export type Bytes24 = Uint8Array & { readonly __brand: 'Bytes24' };
export type Bytes32 = Uint8Array & { readonly __brand: 'Bytes32' };

function assertLen(bytes: Uint8Array, len: number, label: string): void {
  if (bytes.byteLength !== len) {
    throw new RangeError(`${label} must be ${len} bytes, got ${bytes.byteLength}`);
  }
}

export function asBytes16(bytes: Uint8Array): Bytes16 {
  assertLen(bytes, 16, 'Bytes16');
  return bytes as Bytes16;
}

export function asBytes24(bytes: Uint8Array): Bytes24 {
  assertLen(bytes, 24, 'Bytes24');
  return bytes as Bytes24;
}

export function asBytes32(bytes: Uint8Array): Bytes32 {
  assertLen(bytes, 32, 'Bytes32');
  return bytes as Bytes32;
}

export function asMk(bytes: Uint8Array): MK {
  assertLen(bytes, 32, 'MK');
  return bytes as MK;
}

export function asMek(bytes: Uint8Array): MEK {
  assertLen(bytes, 32, 'MEK');
  return bytes as MEK;
}

export function asAuthKey(bytes: Uint8Array): AuthKey {
  assertLen(bytes, 32, 'AuthKey');
  return bytes as AuthKey;
}

export function asVk(bytes: Uint8Array): VK {
  assertLen(bytes, 32, 'VK');
  return bytes as VK;
}

export function asDek(bytes: Uint8Array): DEK {
  assertLen(bytes, 32, 'DEK');
  return bytes as DEK;
}

export function asSdek(bytes: Uint8Array): SDEK {
  assertLen(bytes, 32, 'SDEK');
  return bytes as SDEK;
}

export function asLk(bytes: Uint8Array): LK {
  assertLen(bytes, 32, 'LK');
  return bytes as LK;
}

export function asRk(bytes: Uint8Array): RK {
  assertLen(bytes, 32, 'RK');
  return bytes as RK;
}

export function asX25519PublicKey(bytes: Uint8Array): X25519PublicKey {
  assertLen(bytes, 32, 'X25519 public key');
  return bytes as X25519PublicKey;
}

export function asX25519SecretKey(bytes: Uint8Array): X25519SecretKey {
  assertLen(bytes, 32, 'X25519 secret key');
  return bytes as X25519SecretKey;
}

export type EnvelopeV1 = {
  v: 1;
  alg: 'xchacha20poly1305';
  n: string;
  ct: string;
  aad: string;
};

export const KDF = {
  saltInfo: 'secrelyte:salt:v1',
  authInfo: 'secrelyte:auth:v1',
  mekInfo: 'secrelyte:mek:v1',
  recoveryInfo: 'secrelyte:recovery:v1',
  argon2: { mKib: 65536, t: 3, p: 1, outLen: 32 },
} as const;

export const AAD = {
  wrapVk: 'wrap:vk:v1',
  wrapSk: 'wrap:sk:v1',
  wrapVkRk: 'wrap:vk:rk:v1',
  wrapSkRk: 'wrap:sk:rk:v1',
  wrapDek: (productId: string) => `wrap:dek:v1|${productId}`,
  secret: (productId: string, secretId: string, version: number) =>
    `secret:v1|${productId}|${secretId}|${version}`,
  share: (shareId: string) => `share:v1|${shareId}`,
  shareWrap: (shareId: string) => `share:wrap|${shareId}`,
} as const;
