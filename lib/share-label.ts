/** Display label for a share token. Never truncate the demo slug into "previe". */
export function shareLinkLabel(token: string): string {
  if (token === 'preview') {
    return 'Demo link';
  }
  if (token.length <= 6) {
    return `Link ${token}`;
  }
  return `Link ${token.slice(0, 6)}…`;
}
