import { expect, test, type Page } from '@playwright/test';
import {
  LIVE_VAULT,
  LIVE_VAULT_REASON,
  VAULT_FLOW_TIMEOUT_MS,
  signUpAndOpenVault,
  storeSecret,
} from './helpers/vault';

const VALUE = 'sk_live_TIMING_e2e_reveal_window';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

// A revealed secret re-masks at 30s and a copied one leaves the clipboard at 45s
// (services/vault/src/timing.ts). Checked against the real vault, not the homepage preview,
// and with margins either side of each deadline so neither can fire early or late unnoticed.
test('reveal re-masks at 30s and the clipboard clears at 45s', async ({ page }) => {
  test.skip(!LIVE_VAULT, LIVE_VAULT_REASON);
  test.setTimeout(VAULT_FLOW_TIMEOUT_MS);
  // Before any navigation, so the app's timers and Date.now are the controllable ones. Time
  // still flows normally until fastForward, so signup and Argon2id are unaffected.
  await page.clock.install();

  await signUpAndOpenVault(page);
  await storeSecret(page, { product: 'Timing', name: 'reveal_key', value: VALUE });

  // Masked by default: the value is not in the DOM at all, not merely hidden.
  expect(await page.content()).not.toContain(VALUE);

  await page.getByRole('button', { name: 'Reveal for 30s' }).click();
  await expect(page.getByText(VALUE, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Copy' }).click();
  await expect.poll(() => readClipboard(page)).toBe(VALUE);

  // 25s in: still revealed.
  await page.clock.fastForward(25_000);
  await expect(page.getByText(VALUE, { exact: true })).toBeVisible();

  // Past 30s: re-masked and gone from the DOM.
  await page.clock.fastForward(5_000);
  await expect(page.getByText(VALUE, { exact: true })).toHaveCount(0);
  expect(await page.content()).not.toContain(VALUE);

  // ~30s after the copy: the clipboard has not been cleared early.
  expect(await readClipboard(page)).toBe(VALUE);

  // Past 45s after the copy: cleared.
  await page.clock.fastForward(15_000);
  await expect.poll(() => readClipboard(page)).toBe('');
});

test('hide now re-masks immediately', async ({ page }) => {
  test.skip(!LIVE_VAULT, LIVE_VAULT_REASON);
  test.setTimeout(VAULT_FLOW_TIMEOUT_MS);

  await signUpAndOpenVault(page);
  await storeSecret(page, { product: 'Timing', name: 'hide_key', value: VALUE });

  await page.getByRole('button', { name: 'Reveal for 30s' }).click();
  await expect(page.getByText(VALUE, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Hide now' }).click();
  await expect(page.getByText(VALUE, { exact: true })).toHaveCount(0);
  expect(await page.content()).not.toContain(VALUE);
});
