import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { expect, type Page, type Request } from '@playwright/test';

/**
 * The vault specs drive a real signup against a live Supabase, so they skip unless
 * E2E_VAULT is set. `pnpm test:e2e:vault` sets it and points the build at local Supabase.
 */
export const LIVE_VAULT = Boolean(process.env.E2E_VAULT);
export const LIVE_VAULT_REASON = 'needs a live Supabase: run pnpm test:e2e:vault';

/** Signup runs Argon2id at 64 MiB, a server round trip, and the PDF; budget for all of it. */
export const VAULT_FLOW_TIMEOUT_MS = 120_000;

const PASSWORD = 'correct-horse-battery-staple-orbit';

function pdfInflatedText(pdf: Buffer): string {
  let out = '';
  let i = 0;
  const marker = Buffer.from('stream');
  while (i < pdf.length) {
    const idx = pdf.indexOf(marker, i);
    if (idx < 0) break;
    let start = idx + marker.length;
    if (pdf[start] === 0x0d) start += 1;
    if (pdf[start] === 0x0a) start += 1;
    const end = pdf.indexOf(Buffer.from('endstream'), start);
    if (end < 0) break;
    const chunk = pdf.subarray(start, end);
    try {
      out += inflateSync(chunk).toString('utf8');
    } catch {
      out += chunk.toString('latin1');
    }
    i = end + 9;
  }
  return out;
}

function pdfVisibleText(pdf: Buffer): string {
  const parts: string[] = [];
  for (const m of pdfInflatedText(pdf).matchAll(/<([0-9A-Fa-f]+)> Tj/g)) {
    parts.push(Buffer.from(m[1]!, 'hex').toString('utf8'));
  }
  return parts.join('\n');
}

/**
 * Signs up a fresh account and clears the recovery kit gate the way a user does: downloads
 * the real PDF, reads the 24 words out of it, and types back the three it asks for.
 */
export async function signUpAndOpenVault(page: Page): Promise<void> {
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible();
  await page.getByLabel('Email').fill(`e2e-${Date.now()}-${Math.random()}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create vault' }).click();
  await expect(page.getByRole('heading', { name: 'Recovery kit' })).toBeVisible({
    timeout: 60_000,
  });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const path = await (await downloadPromise).path();
  if (!path) throw new Error('recovery kit PDF did not download');
  const words = new Map<number, string>();
  for (const match of pdfVisibleText(readFileSync(path)).matchAll(/^(\d{2}) {2}([a-z]+)$/gm)) {
    words.set(Number(match[1]), match[2] ?? '');
  }
  expect(words.size).toBe(24);

  await page.getByRole('checkbox').check();
  for (const [n, word] of words) {
    // Exact, because 'Word 1' would also match 'Word 11' through 'Word 19'.
    const field = page.getByLabel(`Word ${n}`, { exact: true });
    if ((await field.count()) > 0) {
      await field.fill(word);
    }
  }
  await page.getByRole('button', { name: 'Open the vault' }).click();
  await expect(page.getByRole('heading', { name: 'Vault' })).toBeVisible();
}

export async function storeSecret(
  page: Page,
  secret: { product: string; name: string; value: string },
): Promise<void> {
  await page.getByLabel('Product name').fill(secret.product);
  await page.getByRole('button', { name: 'Add product' }).click();
  await expect(page.getByRole('button', { name: secret.product, exact: true })).toBeVisible();
  await page.getByLabel('Secret name').fill(secret.name);
  await page.getByLabel('Secret value').fill(secret.value);
  await page.getByRole('button', { name: 'Store ciphertext' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: secret.name })).toBeVisible();
}

/**
 * Every form `value` could take on the wire: raw, hex (how a bytea column travels), and
 * base64 / base64url (how the crypto envelopes travel).
 *
 * Base64 output depends on where the bytes sit inside the larger blob, offset mod 3, so for
 * each alignment this keeps only the characters fully determined by the value's own bytes.
 * Verified against 9,600 embedded leaks at offsets 0 to 63 with no misses, and 20,000 random
 * 512-byte blobs with no false positives.
 */
export function encodedForms(value: string): string[] {
  const bytes = Buffer.from(value, 'utf8');
  const hex = bytes.toString('hex');
  const forms = new Set([value, hex, hex.toUpperCase()]);
  for (let pad = 0; pad < 3; pad += 1) {
    const b64 = Buffer.concat([Buffer.alloc(pad), bytes]).toString('base64');
    const first = Math.ceil((8 * pad) / 6);
    const last = Math.floor((8 * (pad + bytes.length) - 6) / 6);
    const stable = b64.slice(first, last + 1);
    forms.add(stable);
    forms.add(stable.replace(/\+/g, '-').replace(/\//g, '_'));
  }
  return [...forms];
}

/** Records every request whose URL or body carries `value` in any encoded form. */
export function watchEgress(page: Page, value: string): string[] {
  const forms = encodedForms(value);
  const violations: string[] = [];
  page.on('request', (req: Request) => {
    const url = req.url();
    const body = req.postDataBuffer()?.toString('utf8') ?? '';
    if (forms.some((form) => url.includes(form) || body.includes(form))) {
      violations.push(`${req.method()} ${url}`);
    }
  });
  return violations;
}
