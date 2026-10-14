import { expect, test } from '@playwright/test';
import {
  LIVE_VAULT,
  LIVE_VAULT_REASON,
  VAULT_FLOW_TIMEOUT_MS,
  signUpAndOpenVault,
} from './helpers/vault';

/**
 * Unlock used to run the slowest step twice and wait on three avoidable round trips. Each test
 * pins one of the fixes, observed in the browser rather than inferred.
 */

/** Counts Argon2 workers: each derivation runs in a fresh one. */
async function countWorkers(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __workerCount: number };
    w.__workerCount = 0;
    const Original = window.Worker;
    window.Worker = class extends Original {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        w.__workerCount += 1;
      }
    } as typeof Worker;
  });
}

test.beforeEach(() => {
  test.skip(!LIVE_VAULT, LIVE_VAULT_REASON);
  test.setTimeout(VAULT_FLOW_TIMEOUT_MS);
});

test('unlock derives the key once, looks up its parameters early, and opens a prefetched vault', async ({
  page,
}) => {
  await countWorkers(page);
  const credentials = await signUpAndOpenVault(page);
  await page.getByRole('button', { name: 'lock' }).click();

  const lookups: number[] = [];
  const vaultLoads: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.pathname === '/api/kdf-params') lookups.push(Date.now());
    if (url.pathname === '/vault' && !req.headers()['next-router-prefetch']) {
      vaultLoads.push(`${req.method()} ${req.headers()['rsc'] ? 'rsc' : 'document'}`);
    }
  });

  await page.goto('/login');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  // The parameters are fetched while the password is typed, before Unlock is pressed.
  await expect.poll(() => lookups.length).toBe(1);
  vaultLoads.length = 0;
  await page.evaluate(() => {
    (window as unknown as { __workerCount: number }).__workerCount = 0;
  });

  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByLabel('Product name')).toBeVisible();

  expect(
    await page.evaluate(() => (window as unknown as { __workerCount: number }).__workerCount),
  ).toBe(1);
  expect(lookups).toHaveLength(1);
  // /vault was fetched ahead, so moving there asks the server for nothing.
  expect(vaultLoads).toEqual([]);
});
