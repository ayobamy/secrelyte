import { expect, test } from '@playwright/test';
import {
  LIVE_VAULT,
  LIVE_VAULT_REASON,
  VAULT_FLOW_TIMEOUT_MS,
  signUpAndOpenVault,
  storeSecret,
  watchEgress,
} from './helpers/vault';

const SENTINEL = 'sk_live_SENTINEL_e2e_plaintext_guard';

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

// The product's core claim: across a full session, no request carries the secret in any form.
// "Any form" matters: bytea columns travel hex-encoded, so a plaintext leak through the same
// path the product wraps once took would never contain the raw string.
test('no secret value appears in any outbound request', async ({ page }) => {
  test.skip(!LIVE_VAULT, LIVE_VAULT_REASON);
  test.setTimeout(VAULT_FLOW_TIMEOUT_MS);
  const violations = watchEgress(page, SENTINEL);

  await signUpAndOpenVault(page);
  await storeSecret(page, { product: 'Production', name: 'api_key', value: SENTINEL });

  // Reading it back completes the session, and proves the stored ciphertext is the secret
  // rather than a row that merely exists.
  await page.getByRole('button', { name: 'Reveal for 30s' }).click();
  await expect(page.getByText(SENTINEL, { exact: true })).toBeVisible();

  expect(violations).toEqual([]);
});
