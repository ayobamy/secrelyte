import { expect, test, type Page, type Route } from '@playwright/test';
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

/** The browser's email and password sign-in, and only that (not a token refresh). */
function isPasswordSignIn(url: URL): boolean {
  return url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password';
}

/** What local GoTrue answers when a request runs past its 10 second limit. */
function timeOut(route: Route): Promise<void> {
  return route.fulfill({
    status: 504,
    contentType: 'application/json',
    body: '{"code":"request_timeout","message":"Processing this request timed out, please retry after a moment."}',
  });
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
  // Nothing of the empty vault may show: not its heading, not its Next card.
  await expect(page.getByText('No products yet')).toHaveCount(0);
  await expect(page.getByText('Paste a messy block')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
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

// The sign-in right after signup used to be fire-and-forget: a gateway timeout there (local
// GoTrue answers 504 after 10s under load) left the tab with no session, and every click on
// "Open the vault" then failed with a message that blamed the connection.
test('a timed-out sign-in after signup is retried, and the vault opens', async ({ page }) => {
  let signIns = 0;
  await page.route(isPasswordSignIn, (route) => {
    signIns += 1;
    return signIns === 1 ? timeOut(route) : route.continue();
  });
  await signUpAndOpenVault(page);
  expect(signIns).toBe(2);
});

test('a sign-in that keeps failing after signup says so on the kit, and Unlock finishes it', async ({
  page,
}) => {
  let signIns = 0;
  await page.route(isPasswordSignIn, (route) => {
    signIns += 1;
    return timeOut(route);
  });
  let acks = 0;
  page.on('request', (request) => {
    if (request.url().includes('/rest/v1/rpc/ack_recovery_kit')) acks += 1;
  });
  const credentials = await signUpAndOpenVault(page, { expectOpen: false });
  await expect(page.getByRole('alert').filter({ hasText: 'could not sign in' })).toHaveText(
    'This tab could not sign in, so the kit cannot be recorded here. Your account exists: keep the PDF you downloaded, then go to Unlock and type its 24 words to finish.',
  );
  await expectVaultShut(page);
  expect(signIns).toBe(3);
  expect(acks).toBe(0);

  // The way out the alert names: unlock, then confirm the kit with the words from the PDF.
  await page.unroute(isPasswordSignIn);
  await page.getByRole('link', { name: 'go to Unlock' }).click();
  await page.waitForURL('**/login');
  await unlockFromLogin(page, credentials);
  await expect(page.getByLabel('24-word phrase')).toBeVisible({ timeout: 60_000 });
  await page.getByLabel('24-word phrase').fill(credentials.words.join(' '));
  await page.getByRole('button', { name: 'Confirm kit' }).click();
  await expectVaultOpen(page);
});

// With email confirmation on, signup skips the sign-in on purpose. The kit screen used to blame
// a failed sign-in (and before that, the connection) for a session that was never attempted.
test('a signup that must confirm its email says so on the kit, not that sign-in failed', async ({
  page,
}) => {
  // The response a server with SECRELYTE_REQUIRE_EMAIL_CONFIRM=1 gives; the rest is unchanged.
  await page.route('**/api/signup', async (route) => {
    const response = await route.fetch();
    const body = { ...(await response.json()), confirmRequired: true };
    await route.fulfill({ response, json: body });
  });
  let signIns = 0;
  page.on('request', (request) => {
    if (isPasswordSignIn(new URL(request.url()))) signIns += 1;
  });
  await signUpAndOpenVault(page, { expectOpen: false });
  await expect(page.getByRole('alert').filter({ hasText: 'confirming' })).toHaveText(
    'Your account exists, and its email address needs confirming before the kit can be recorded. Keep the PDF you downloaded, confirm the address, then go to Unlock and type its 24 words to finish.',
  );
  await expect(page.getByRole('alert').filter({ hasText: 'could not sign in' })).toHaveCount(0);
  await expectVaultShut(page);
  expect(signIns).toBe(0);
});

// auth-js throws, rather than answers, on a sign-in response it cannot read (a proxy answering
// 200 with junk). That throw used to land in the form's catch: "Signup failed." for an account
// that now existed without its kit.
test('a sign-in that throws after signup still goes on to the kit', async ({ page }) => {
  await page.route(isPasswordSignIn, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
  );
  let created = 0;
  page.on('response', (response) => {
    if (response.url().endsWith('/api/signup') && response.status() === 200) created += 1;
  });
  await signUpAndOpenVault(page, { expectOpen: false });
  expect(created).toBe(1);
  await expect(page.getByRole('alert').filter({ hasText: 'not created' })).toHaveCount(0);
  await expect(page.getByRole('alert').filter({ hasText: 'could not sign in' })).toBeVisible();
  await expectVaultShut(page);
});

/** Fills the signup form with a fresh address and submits it. */
async function submitSignup(page: Page): Promise<void> {
  await page.goto('/signup');
  await page
    .getByLabel('Email')
    .fill(`e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('correct-horse-battery-staple-orbit');
  await page.getByRole('button', { name: 'Create vault' }).click();
}

// A tab opened before a deploy asks for a key worker file that no longer exists. That used to
// read "Signup failed."; it now says to reload, and nothing reaches the server.
test('keys that cannot be derived say to reload, and nothing is sent', async ({ page }) => {
  await page.addInitScript(() => {
    const RealWorker = window.Worker;
    window.Worker = class extends RealWorker {
      constructor(...args: ConstructorParameters<typeof Worker>) {
        super('/_next/static/gone-since-the-last-deploy.js', args[1]);
      }
    };
  });
  let sent = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/api/signup')) sent += 1;
  });
  await submitSignup(page);
  await expect(page.getByRole('alert').filter({ hasText: 'not created' })).toContainText(
    'Keys could not be derived in this tab. Reload the page and try again.',
    { timeout: 30_000 },
  );
  expect(sent).toBe(0);
});

// The server can create the vault and lose its answer on the way back. The retry used to derive
// new keys and words, hear "email taken", and strand the first vault behind 24 words the user
// never saw. It now resends the same request and picks that vault up.
test('a signup whose answer is lost picks its vault up on the next press', async ({ page }) => {
  let taken = 0;
  page.on('response', (response) => {
    if (response.url().endsWith('/api/signup') && response.status() === 409) taken += 1;
  });
  await page.route(
    '**/api/signup',
    async (route) => {
      await route.fetch();
      await route.abort('connectionreset');
    },
    { times: 1 },
  );
  await signUpAndOpenVault(page, {
    afterSubmit: async () => {
      await expect(page.getByRole('alert').filter({ hasText: 'not created' })).toContainText(
        'No answer came back, so the vault may have been created. Press Create vault again on this page, without reloading, to finish.',
        { timeout: 30_000 },
      );
      await page.getByRole('button', { name: 'Create vault' }).click();
    },
  });
  // The second press heard "email taken", proved the vault was this one, and opened its kit.
  expect(taken).toBe(1);
});

// A gateway timeout at unlock used to read "Wrong email or password."
test('a timed-out unlock says the server did not answer, not that the password is wrong', async ({
  page,
}) => {
  const credentials = await signUpAndOpenVault(page);
  await page.route(isPasswordSignIn, timeOut);
  await page.goto('/login');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Unlock' }).click();
  const alert = page.getByRole('alert').filter({ hasText: 'did not open' });
  await expect(alert).toContainText(
    'Could not reach Secrelyte. Check your connection and try again.',
    { timeout: 30_000 },
  );
  await expect(alert).not.toContainText('Wrong email or password.');
});

// After a sign-in the server accepted, a failed key fetch read "No keys on this account" and a
// key row this tab could not open read "Check the password". Neither was about the password.
test('unlock failures after the password is accepted do not blame the password', async ({
  page,
}) => {
  const credentials = await signUpAndOpenVault(page);
  const unlock = async () => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(credentials.email);
    await page.getByLabel('Password', { exact: true }).fill(credentials.password);
    await page.getByRole('button', { name: 'Unlock' }).click();
    return page.getByRole('alert').filter({ hasText: 'did not open' });
  };

  await page.route('**/rest/v1/rpc/get_own_keys*', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  );
  await expect(await unlock()).toContainText(
    'Could not reach Secrelyte. Check your connection and try again.',
    { timeout: 30_000 },
  );
  await page.unroute('**/rest/v1/rpc/get_own_keys*');

  await page.route('**/rest/v1/rpc/get_own_keys*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { wrapped_vault_key: '\\x00', wrapped_private_key: '\\x00', recovery_ack_at: null },
      ]),
    }),
  );
  const alert = await unlock();
  await expect(alert).toContainText(
    'Could not open the vault in this tab. Reload the page and try again.',
    { timeout: 30_000 },
  );
  await expect(alert).not.toContainText('password');
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
