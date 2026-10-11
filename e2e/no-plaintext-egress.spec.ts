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

// The product's core claim: across a full session, nothing the user types as a secret leaves
// the browser, in any form or channel the watcher knows (see egress-watch.spec.ts, which proves
// it catches each one). That covers the stored value, the password (only a derived login key
// may be sent), and the recovery key in every shape the kit gives it: the phrase, the word
// list, the base32 fallback and the raw key bytes.
test('no secret, password or recovery phrase appears in any outbound request', async ({
  page,
  context,
}) => {
  test.skip(!LIVE_VAULT, LIVE_VAULT_REASON);
  test.setTimeout(VAULT_FLOW_TIMEOUT_MS);
  const egress = await watchEgress(context);
  egress.watch('stored secret', SENTINEL);

  const credentials = await signUpAndOpenVault(page);
  egress.watch('password', credentials.password);
  egress.watch('recovery phrase', credentials.words.join(' '));
  egress.watch('recovery words', JSON.stringify(credentials.words));
  egress.watch('recovery key (base32)', credentials.base32);
  egress.watch('recovery key (bytes)', credentials.rk);

  await storeSecret(page, { product: 'Production', name: 'api_key', value: SENTINEL });

  // Reading it back completes the session, and proves the stored ciphertext is the secret
  // rather than a row that merely exists.
  await page.getByRole('button', { name: 'Reveal for 30s' }).click();
  await expect(page.getByText(SENTINEL, { exact: true })).toBeVisible();

  const { violations, unreadable } = await egress.finish();
  expect(violations).toEqual([]);
  // A body the watcher could not read is a blind spot, not a pass.
  expect(unreadable).toEqual([]);
});
