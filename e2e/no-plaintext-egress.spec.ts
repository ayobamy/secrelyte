import { inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const SENTINEL = 'sk_live_SENTINEL_e2e_plaintext_guard';

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

test('vault RSC flight has no secret plaintext', async ({ page }) => {
  const res = await page.goto('/vault');
  await expect(page.getByRole('heading', { name: 'Vault' })).toBeVisible();
  const html = (await res?.text()) ?? '';
  const body = await page.content();
  expect(html).not.toContain(SENTINEL);
  expect(body).not.toContain(SENTINEL);
  expect(html).not.toMatch(/sk_live_[A-Za-z0-9]{8,}/);
  expect(body).not.toMatch(/sk_live_[A-Za-z0-9]{8,}/);
});

test('no secret value appears in any outbound request', async ({ page }) => {
  test.skip(!process.env.E2E_VAULT, 'set E2E_VAULT=1 against a live project to run 3.12');
  const violations: string[] = [];
  page.on('request', (req) => {
    const body = req.postData() ?? '';
    const url = req.url();
    if (body.includes(SENTINEL) || url.includes(SENTINEL)) {
      violations.push(`${req.method()} ${url}`);
    }
  });
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible();
  const stamp = Date.now();
  await page.getByLabel('Email').fill(`e2e-${stamp}@example.com`);
  await page.getByLabel('Password').fill('correct-horse-battery-staple-orbit');
  await page.getByRole('button', { name: 'Create vault' }).click();
  await expect(page.getByRole('heading', { name: 'Recovery kit' })).toBeVisible({
    timeout: 60_000,
  });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error('recovery kit PDF did not download');
  const numbered = new Map<number, string>();
  for (const match of pdfVisibleText(readFileSync(path)).matchAll(/^(\d{2}) {2}([a-z]+)$/gm)) {
    numbered.set(Number(match[1]), match[2] ?? '');
  }
  expect(numbered.size).toBe(24);
  await page.getByRole('checkbox').check();
  for (let n = 1; n <= 24; n += 1) {
    const word = numbered.get(n);
    const field = page.getByLabel(`Word ${n}`);
    if (word && (await field.count()) > 0) {
      await field.fill(word);
    }
  }
  await page.getByRole('button', { name: 'Open the vault' }).click();
  await expect(page.getByRole('heading', { name: 'Vault' })).toBeVisible();
  await page.getByLabel('Product name').fill('Production');
  await page.getByRole('button', { name: 'Add product' }).click();
  await page.getByLabel('Secret name').fill('api_key');
  await page.getByLabel('Secret value').fill(SENTINEL);
  await page.getByRole('button', { name: 'Store ciphertext' }).click();
  await expect(page.getByText('api_key')).toBeVisible();
  expect(violations).toEqual([]);
});
