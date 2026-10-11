import { expect, test, type Page } from '@playwright/test';
import {
  LIVE_VAULT,
  LIVE_VAULT_REASON,
  VAULT_FLOW_TIMEOUT_MS,
  signUpAndOpenVault,
  storeSecret,
} from './helpers/vault';
import { pauseClock } from './helpers/clock';

const VALUE = 'sk_live_TIMING_e2e_reveal_window';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

// A revealed secret re-masks at 30s and a copied one leaves the clipboard at 45s
// (services/vault/src/timing.ts). Each deadline is checked from both sides, a quarter second
// before and a quarter second after (the reveal ticks every 250ms), against the real vault.
test('reveal re-masks at 30s and the clipboard clears at 45s, not earlier or later', async ({
  page,
}) => {
  test.skip(!LIVE_VAULT, LIVE_VAULT_REASON);
  test.setTimeout(VAULT_FLOW_TIMEOUT_MS);
  // Before any navigation, so the app's timers and Date.now are the controllable ones. Time
  // still flows normally until pauseClock, so signup and Argon2id are unaffected.
  await page.clock.install();

  await signUpAndOpenVault(page);
  await storeSecret(page, { product: 'Timing', name: 'reveal_key', value: VALUE });

  // Masked by default: the value is not in the DOM at all, not merely hidden.
  expect(await page.content()).not.toContain(VALUE);

  await pauseClock(page);
  await page.getByRole('button', { name: 'Reveal for 30s' }).click();
  await expect(page.getByText(VALUE, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Copy' }).click();
  await expect.poll(() => readClipboard(page)).toBe(VALUE);
  await expect(page.getByRole('status').filter({ hasText: 'Copied.' })).toBeVisible();

  await page.clock.runFor(29_750);
  await expect(page.getByText(VALUE, { exact: true })).toBeVisible();

  await page.clock.runFor(500);
  await expect(page.getByText(VALUE, { exact: true })).toHaveCount(0);
  expect(await page.content()).not.toContain(VALUE);

  // 44.75s after the copy: still on the clipboard.
  await page.clock.runFor(14_500);
  expect(await readClipboard(page)).toBe(VALUE);

  // 45.25s after the copy: cleared, and the page says so.
  await page.clock.runFor(500);
  await expect.poll(() => readClipboard(page)).toBe('');
  await expect(page.getByRole('status').filter({ hasText: 'Clipboard cleared.' })).toBeVisible();
});

/**
 * Makes the page refuse the clearing write while `setUnfocused(page, true)` is in force, the
 * way a browser refuses clipboard writes from a tab without focus.
 */
async function refuseClearsWhileUnfocused(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const clipboard = navigator.clipboard;
    const write = clipboard.writeText.bind(clipboard);
    clipboard.writeText = (text: string) =>
      (window as unknown as { __unfocused?: boolean }).__unfocused && text === ''
        ? Promise.reject(new DOMException('Document is not focused.', 'NotAllowedError'))
        : write(text);
  });
}

function setUnfocused(page: Page, unfocused: boolean): Promise<void> {
  return page.evaluate((value) => {
    (window as unknown as { __unfocused?: boolean }).__unfocused = value;
  }, unfocused);
}

async function revealAndCopy(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Reveal for 30s' }).click();
  await page.getByRole('button', { name: 'Copy' }).click();
  await expect.poll(() => readClipboard(page)).toBe(VALUE);
}

// Browsers refuse clipboard writes from a tab without focus, and a user who copied a secret has
// usually switched away to paste it. The clear used to fail silently in that case and leave
// the secret on the clipboard indefinitely.
test('a refused clear stays visible and retries when the tab is back in focus', async ({
  page,
}) => {
  test.skip(!LIVE_VAULT, LIVE_VAULT_REASON);
  test.setTimeout(VAULT_FLOW_TIMEOUT_MS);
  await refuseClearsWhileUnfocused(page);
  await page.clock.install();

  await signUpAndOpenVault(page);
  await storeSecret(page, { product: 'Timing', name: 'focus_key', value: VALUE });

  await pauseClock(page);
  await revealAndCopy(page);

  await setUnfocused(page, true);
  await page.clock.runFor(45_500);
  await expect(
    page.getByRole('status').filter({ hasText: 'The clipboard still holds the secret.' }),
  ).toBeVisible();
  expect(await readClipboard(page)).toBe(VALUE);

  await setUnfocused(page, false);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => readClipboard(page)).toBe('');
  await expect(page.getByRole('status').filter({ hasText: 'Clipboard cleared.' })).toBeVisible();
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

test('clear clipboard now clears it at once, without waiting for the timer', async ({ page }) => {
  test.skip(!LIVE_VAULT, LIVE_VAULT_REASON);
  test.setTimeout(VAULT_FLOW_TIMEOUT_MS);

  await signUpAndOpenVault(page);
  await storeSecret(page, { product: 'Timing', name: 'manual_key', value: VALUE });
  await revealAndCopy(page);

  await page.getByRole('button', { name: 'Clear clipboard now' }).click();
  await expect.poll(() => readClipboard(page)).toBe('');
  await expect(page.getByRole('status').filter({ hasText: 'Clipboard cleared.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clear clipboard now' })).toHaveCount(0);
});

// Locking is the moment a user walks away, so the copied secret goes with the keys.
test('locking the vault clears the clipboard, and the lock screen says so', async ({ page }) => {
  test.skip(!LIVE_VAULT, LIVE_VAULT_REASON);
  test.setTimeout(VAULT_FLOW_TIMEOUT_MS);

  await signUpAndOpenVault(page);
  await storeSecret(page, { product: 'Timing', name: 'lock_key', value: VALUE });
  await revealAndCopy(page);

  await page.getByRole('button', { name: 'lock' }).click();
  await expect(page.getByLabel('Product name')).toHaveCount(0);
  await expect.poll(() => readClipboard(page)).toBe('');
  await expect(page.getByRole('status').filter({ hasText: 'Clipboard cleared.' })).toBeVisible();
});

// A lock from an unfocused tab (the idle timer) cannot clear. The locked screen must keep the
// warning up and offer the click that browsers always allow.
test('a refused clear on lock stays on the lock screen until cleared by hand', async ({ page }) => {
  test.skip(!LIVE_VAULT, LIVE_VAULT_REASON);
  test.setTimeout(VAULT_FLOW_TIMEOUT_MS);
  await refuseClearsWhileUnfocused(page);

  await signUpAndOpenVault(page);
  await storeSecret(page, { product: 'Timing', name: 'locked_key', value: VALUE });
  await revealAndCopy(page);

  await setUnfocused(page, true);
  await page.getByRole('button', { name: 'lock' }).click();
  await expect(page.getByLabel('Product name')).toHaveCount(0);
  await expect(
    page.getByRole('status').filter({ hasText: 'The clipboard still holds the secret.' }),
  ).toBeVisible();
  expect(await readClipboard(page)).toBe(VALUE);

  await setUnfocused(page, false);
  await page.getByRole('button', { name: 'Clear clipboard now' }).click();
  await expect.poll(() => readClipboard(page)).toBe('');
  await expect(page.getByRole('status').filter({ hasText: 'Clipboard cleared.' })).toBeVisible();
});

// A reload runs no cleanup, and browsers drop a clipboard write made while a page is being
// left, so the copied secret used to stay on the clipboard for good. The reloaded page (locked,
// since the keys lived in memory) now clears it.
test('a reload with a secret on the clipboard clears it on the way back', async ({ page }) => {
  test.skip(!LIVE_VAULT, LIVE_VAULT_REASON);
  test.setTimeout(VAULT_FLOW_TIMEOUT_MS);
  // Marks when the clipboard guard reads its note, which it does once, as it is created.
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (this: Storage, key: string) {
      if (key === 'secrelyte.clipboard-uncleared') {
        (window as unknown as { __noteRead?: boolean }).__noteRead = true;
      }
      return getItem.call(this, key);
    };
  });

  await signUpAndOpenVault(page);
  await storeSecret(page, { product: 'Timing', name: 'reload_key', value: VALUE });
  await revealAndCopy(page);

  await page.reload();
  await expect.poll(() => readClipboard(page)).toBe('');
  await expect(page.getByRole('status').filter({ hasText: 'Clipboard cleared.' })).toBeVisible();

  // Once cleared, the next reload must leave alone whatever the user copied since.
  await page.evaluate(() => navigator.clipboard.writeText('copied elsewhere'));
  await page.reload();
  // The guard reads its note as it starts; after that it has had its chance to clear.
  await page.waitForFunction(() => (window as unknown as { __noteRead?: boolean }).__noteRead);
  expect(await readClipboard(page)).toBe('copied elsewhere');
  await expect(page.getByRole('status').filter({ hasText: 'Clipboard' })).toHaveCount(0);
});
