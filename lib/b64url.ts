export function b64urlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (padded.length % 4)) % 4;
  return Uint8Array.from(Buffer.from(padded + '='.repeat(pad), 'base64'));
}
