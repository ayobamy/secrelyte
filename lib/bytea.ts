export function bytesToPgHex(bytes: Uint8Array): string {
  let hex = '\\x';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}
