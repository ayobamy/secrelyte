import { bytesToPgHex } from '@/lib/bytea';

/**
 * A Postgres bytea hex literal (`\x...`), the only shape a bytea column should receive over
 * PostgREST.
 *
 * Handing supabase-js a raw Uint8Array does not fail. It JSON-serializes the array as an
 * index-keyed object, `{"0":62,"1":218,...}`, and Postgres stores that text's UTF-8 bytes in
 * the bytea column. The row looks written, but every later read unwraps garbage. That is how
 * product DEK wraps were being stored, which made every secret insert throw. The branded
 * type means an insert row cannot be built from raw bytes by accident.
 */
export type PgHex = string & { readonly __brand: 'PgHex' };

function pgHex(bytes: Uint8Array): PgHex {
  return bytesToPgHex(bytes) as PgHex;
}

export type ProductInsertRow = {
  id: string;
  user_id: string;
  name: string;
  environment: string;
  wrapped_dek: PgHex;
};

export function productInsertRow(input: {
  id: string;
  userId: string;
  name: string;
  environment: string;
  wrappedDek: Uint8Array;
}): ProductInsertRow {
  return {
    id: input.id,
    user_id: input.userId,
    name: input.name,
    environment: input.environment,
    wrapped_dek: pgHex(input.wrappedDek),
  };
}

export type SecretInsertRow = {
  id: string;
  product_id: string;
  key_name: string;
  version: number;
  ciphertext: PgHex;
  nonce: PgHex;
};

export function secretInsertRow(input: {
  id: string;
  productId: string;
  keyName: string;
  version: number;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
}): SecretInsertRow {
  return {
    id: input.id,
    product_id: input.productId,
    key_name: input.keyName,
    version: input.version,
    ciphertext: pgHex(input.ciphertext),
    nonce: pgHex(input.nonce),
  };
}
