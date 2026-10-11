import { expect, test, type Page } from '@playwright/test';
import {
  LIVE_VAULT,
  LIVE_VAULT_REASON,
  VAULT_FLOW_TIMEOUT_MS,
  expectVaultOpen,
  lockAndUnlock,
  signUpAndOpenVault,
  storeSecret,
  unlockFromLogin,
} from './helpers/vault';

/**
 * Failures the vault used to swallow. Each one is forced at the network edge with page.route,
 * against a real signup on local Supabase.
 */

async function failAck(page: Page): Promise<void> {
  await page.route('**/rest/v1/rpc/ack_recovery_kit*', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"down"}' }),
  );
}

/** The vault never rendered its controls. */
async function expectVaultShut(page: Page): Promise<void> {
  await expect(page.getByLabel('Product name')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add product' })).toHaveCount(0);
}

async function failWrites(page: Page, table: 'products' | 'secrets'): Promise<void> {
  await page.route(`**/rest/v1/${table}*`, (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"down"}' })
      : route.continue(),
  );
}

test.beforeEach(() => {
  test.skip(!LIVE_VAULT, LIVE_VAULT_REASON);
  test.setTimeout(VAULT_FLOW_TIMEOUT_MS);
});

// The two write-failure tests guard behavior that predates the hardening batch: the insert
// error was already surfaced. They stay because the batch rewrote both paths.
test('a failed product write says so and adds nothing', async ({ page }) => {
  await signUpAndOpenVault(page);
  await failWrites(page, 'products');
  await page.getByLabel('Product name').fill('Will fail');
  await page.getByRole('button', { name: 'Add product' }).click();
  await expect(page.getByText('Could not save the product. Nothing was stored.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Will fail', exact: true })).toHaveCount(0);
});

test('a failed secret write says so and keeps the pasted value', async ({ page }) => {
  await signUpAndOpenVault(page);
  await storeSecret(page, { product: 'Errors', name: 'first_key', value: 'sk_live_ok_value' });
  await failWrites(page, 'secrets');
  await page.getByLabel('Secret name').fill('second_key');
  await page.getByLabel('Secret value').fill('sk_live_kept_after_failure');
  await page.getByRole('button', { name: 'Store ciphertext' }).click();
  await expect(page.getByText('Could not store the secret. Nothing was saved.')).toBeVisible();
  await expect(page.getByLabel('Secret value')).toHaveValue('sk_live_kept_after_failure');
  await expect(page.getByRole('listitem').filter({ hasText: 'second_key' })).toHaveCount(0);
});

// A failed reload after a successful save used to empty the list with no message: the product
// the user just saved, and every one before it, vanished from view.
test('a failed reload after a save says so and keeps the list', async ({ page }) => {
  const credentials = await signUpAndOpenVault(page);
  await storeSecret(page, { product: 'Kept', name: 'kept_key', value: 'sk_live_kept_value' });
  await page.route('**/rest/v1/products*', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
      : route.continue(),
  );
  await page.getByLabel('Product name').fill('Saved anyway');
  await page.getByRole('button', { name: 'Add product' }).click();
  await expect(page.getByText('Saved, but the list could not reload.')).toHaveText(
    'Saved, but the list could not reload. Reload the page to see it.',
  );
  await expect(page.getByRole('button', { name: 'Kept', exact: true })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'kept_key' })).toBeVisible();

  // The save itself landed: once reads work again, a fresh unlock lists it.
  await page.unroute('**/rest/v1/products*');
  await lockAndUnlock(page, credentials);
  await expectVaultOpen(page);
  await expect(page.getByRole('button', { name: 'Saved anyway', exact: true })).toBeVisible();
});

// A failed read used to render "Empty", which looks like data loss.
test('a failed vault load says so instead of showing an empty vault', async ({ page }) => {
  await signUpAndOpenVault(page, {
    beforeOpen: async () => {
      await page.route('**/rest/v1/products*', (route) =>
        route.request().method() === 'GET'
          ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
          : route.continue(),
      );
    },
  });
  // Filtered by text: Next.js renders its own route announcer with role="alert" too.
  await expect(
    page.getByRole('alert').filter({ hasText: 'Could not load your vault.' }),
  ).toHaveText('Could not load your vault. Reload to try again.');
  await expect(page.getByText(/^Empty\./)).toHaveCount(0);
});

// An error from get_own_keys used to skip the recovery-kit gate and open the vault anyway.
test('the vault stays shut when the recovery-kit check fails', async ({ page }) => {
  const credentials = await signUpAndOpenVault(page);
  let calls = 0;
  // Login reads the keys once to unwrap them; the vault reads them again for the gate.
  await page.route('**/rest/v1/rpc/get_own_keys*', (route) => {
    calls += 1;
    return calls === 1
      ? route.continue()
      : route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });
  await lockAndUnlock(page, credentials);
  await expect(
    page.getByRole('alert').filter({ hasText: 'Could not check your recovery kit' }),
  ).toHaveText(
    'Could not check your recovery kit, so the vault stays closed. Reload to try again.',
  );
  await expect(page.getByRole('button', { name: 'Add product' })).toHaveCount(0);
  expect(calls).toBe(2);
});

// get_own_keys answering with no row (a deleted or never-written key row) is not "no kit
// needed". It used to fall through to the open vault.
test('the vault stays shut when the recovery-kit check finds no key row', async ({ page }) => {
  const credentials = await signUpAndOpenVault(page);
  let calls = 0;
  await page.route('**/rest/v1/rpc/get_own_keys*', (route) => {
    calls += 1;
    return calls === 1
      ? route.continue()
      : route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await lockAndUnlock(page, credentials);
  await expect(
    page.getByRole('alert').filter({ hasText: 'Could not check your recovery kit' }),
  ).toBeVisible();
  await expectVaultShut(page);
  expect(calls).toBe(2);
});

// A failed acknowledgement used to be ignored: the vault opened and the server still had no
// record that the kit was stored, so the next unlock asked for it again with no explanation.
test('a failed kit acknowledgement at signup keeps the vault shut, and a retry opens it', async ({
  page,
}) => {
  await signUpAndOpenVault(page, { beforeOpen: () => failAck(page), expectOpen: false });
  await expect(page.getByRole('alert').filter({ hasText: 'Could not record' })).toHaveText(
    'Could not record that you stored the kit. Check your connection and try again.',
  );
  await expect(page.getByRole('heading', { name: 'Recovery kit' })).toBeVisible();
  await expectVaultShut(page);

  await page.unroute('**/rest/v1/rpc/ack_recovery_kit*');
  await page.getByRole('button', { name: 'Open the vault' }).click();
  await expectVaultOpen(page);
});

test('a failed confirmation on the phrase screen keeps the vault shut, and a retry opens it', async ({
  page,
}) => {
  // Signup with no acknowledgement on record, so the next unlock asks for the phrase.
  const credentials = await signUpAndOpenVault(page, {
    beforeOpen: () => failAck(page),
    expectOpen: false,
  });
  await expect(page.getByRole('alert').filter({ hasText: 'Could not record' })).toBeVisible();

  await unlockFromLogin(page, credentials);
  await expect(page.getByLabel('24-word phrase')).toBeVisible({ timeout: 60_000 });
  await expectVaultShut(page);
  await page.getByLabel('24-word phrase').fill(credentials.words.join(' '));
  await page.getByRole('button', { name: 'Confirm kit' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Could not record' })).toHaveText(
    'Could not record the confirmation. Check your connection and try again.',
  );
  await expectVaultShut(page);

  await page.unroute('**/rest/v1/rpc/ack_recovery_kit*');
  await page.getByRole('button', { name: 'Confirm kit' }).click();
  await expectVaultOpen(page);
});
