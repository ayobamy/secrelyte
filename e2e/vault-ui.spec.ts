import { expect, test } from '@playwright/test';
import {
  LIVE_VAULT,
  LIVE_VAULT_REASON,
  VAULT_FLOW_TIMEOUT_MS,
  signUpAndOpenVault,
  storeSecret,
} from './helpers/vault';

/** The vault screens' interface contract, against a real signup on local Supabase. */

test.beforeEach(() => {
  test.skip(!LIVE_VAULT, LIVE_VAULT_REASON);
  test.setTimeout(VAULT_FLOW_TIMEOUT_MS);
});

// The unlock error used to be a plain paragraph: on screen, never announced, tied to nothing.
test('a wrong password at unlock is announced and tied to both fields', async ({ page }) => {
  const credentials = await signUpAndOpenVault(page);
  // Not unlockFromLogin: that helper waits for /vault, and this unlock is meant to fail.
  await page.goto('/login');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill('not-the-password-for-this-vault');
  await page.getByRole('button', { name: 'Unlock' }).click();
  const alert = page.getByRole('alert').filter({ hasText: 'The vault did not open.' });
  await expect(alert).toBeVisible({ timeout: 30_000 });
  await expect(alert).toContainText('Wrong email or password.');
  const alertId = await alert.getAttribute('id');
  for (const field of [page.getByLabel('Email'), page.getByLabel('Password', { exact: true })]) {
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    expect((await field.getAttribute('aria-describedby'))?.split(' ')).toContain(alertId);
  }
});

// The paste composer used to look usable while doing nothing. It is Next, and says so.
test('the empty vault labels the paste feature Next and offers no input for it', async ({
  page,
}) => {
  await signUpAndOpenVault(page);
  const main = page.getByRole('main');
  await expect(main.getByText('No products yet')).toBeVisible();
  await expect(main.getByText('Paste a messy block')).toBeVisible();
  await expect(main.getByText('Next', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Paste a messy block')).toHaveCount(0);
  await expect(main.locator('textarea')).toHaveCount(0);
});

test('a revealed value renders in its own key row, and switching product masks it', async ({
  page,
}) => {
  const value = 'sk_live_ROW_e2e_reveal_in_place';
  await signUpAndOpenVault(page);
  await storeSecret(page, { product: 'Rows', name: 'row_key', value });
  await page.getByRole('button', { name: 'Reveal for 30s' }).click();
  const row = page.getByRole('listitem').filter({ hasText: 'row_key' });
  await expect(row.getByText(value, { exact: true })).toBeVisible();

  await page.getByLabel('Product name').fill('Other');
  await page.getByRole('button', { name: 'Add product' }).click();
  await page.getByRole('button', { name: 'Other', exact: true }).click();
  await page.getByRole('button', { name: 'Rows', exact: true }).click();
  await expect(page.getByText(value, { exact: true })).toHaveCount(0);
  expect(await page.content()).not.toContain(value);
});

// The vault's own forms used the browser's bubble; they now speak inline, like the sign-in forms.
test('the vault forms refuse empty fields inline, announced and tied to the field', async ({
  page,
}) => {
  await signUpAndOpenVault(page);
  const productName = page.getByLabel('Product name');
  await page.getByRole('button', { name: 'Add product' }).click();
  const productError = page.getByRole('alert').filter({ hasText: 'Name the product' });
  await expect(productError).toBeVisible();
  await expect(productName).toHaveAttribute('aria-invalid', 'true');
  await expect(productName).toBeFocused();
  expect((await productName.getAttribute('aria-describedby'))?.split(' ')).toContain(
    await productError.getAttribute('id'),
  );
  await productName.fill('Forms');
  await expect(productError).toHaveCount(0);
  await page.getByRole('button', { name: 'Add product' }).click();

  await page.getByRole('button', { name: 'Store ciphertext' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Name the key' })).toBeVisible();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Paste the value to seal' }),
  ).toBeVisible();
  await expect(page.getByLabel('Secret name')).toBeFocused();
  await expect(page.getByLabel('Secret value')).toHaveAttribute('aria-invalid', 'true');
});

// The name fields used to keep the last value, so it read like a prefill for the next one.
test('a stored product and key leave their name fields empty for the next one', async ({
  page,
}) => {
  await signUpAndOpenVault(page);
  await storeSecret(page, { product: 'Reset', name: 'reset_key', value: 'sk_live_reset_value' });
  await expect(page.getByLabel('Product name')).toHaveValue('');
  await expect(page.getByLabel('Secret name')).toHaveValue('');
  await expect(page.getByLabel('Secret value')).toHaveValue('');
});

// A wrong word used to raise an error that pointed at nothing and stayed while it was fixed.
test('a wrong recovery word marks the word fields and clears once corrected', async ({ page }) => {
  let wrongLabel = '';
  const credentials = await signUpAndOpenVault(page, {
    expectOpen: false,
    beforeOpen: async () => {
      const first = page.getByLabel(/^Word \d+$/).first();
      wrongLabel = (await first.getAttribute('id')) ?? '';
      await first.fill('notaword');
    },
  });
  const alert = page.getByRole('alert').filter({ hasText: 'do not match the kit' });
  await expect(alert).toBeVisible();
  const wrong = page.locator(`[id="${wrongLabel}"]`);
  await expect(wrong).toHaveAttribute('aria-invalid', 'true');
  expect((await wrong.getAttribute('aria-describedby'))?.split(' ')).toContain(
    await alert.getAttribute('id'),
  );

  const label = await page.locator(`label[for="${wrongLabel}"]`).innerText();
  const n = Number(label.replace(/\D/g, ''));
  await wrong.fill(credentials.words[n - 1] ?? '');
  await expect(alert).toHaveCount(0);
  await page.getByRole('button', { name: 'Open the vault' }).click();
  await expect(page.getByLabel('Product name')).toBeVisible();
});

// The value being added is masked by CSS where the engine supports it, and falls back to a
// password field where it does not, so it is never typed in plain text.
test('the secret value field is masked, with a fallback where text masking is unsupported', async ({
  page,
}) => {
  await signUpAndOpenVault(page);
  await page.getByLabel('Product name').fill('Masked');
  await page.getByRole('button', { name: 'Add product' }).click();
  const value = page.getByLabel('Secret value');
  await expect(value).toHaveCSS('-webkit-text-security', 'disc');
  await page.getByRole('button', { name: 'Show value' }).click();
  await expect(value).toHaveCSS('-webkit-text-security', 'none');
});

test('the secret value falls back to a password field without CSS text masking', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = CSS.supports.bind(CSS);
    Object.defineProperty(CSS, 'supports', {
      value: (property: string, value?: string) =>
        property === '-webkit-text-security'
          ? false
          : value === undefined
            ? original(property)
            : original(property, value),
    });
  });
  await signUpAndOpenVault(page);
  await page.getByLabel('Product name').fill('Fallback');
  await page.getByRole('button', { name: 'Add product' }).click();
  const value = page.getByLabel('Secret value');
  await expect(value).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show value' }).click();
  await expect(value).toHaveAttribute('type', 'text');
});

// The kit lived only in this tab while its screen linked away (the logo, Vault, Share and the
// footer): one click before the PDF was saved left an account that could never be opened.
test('the recovery kit cannot be left before its PDF is saved, and Back keeps the kit', async ({
  page,
}) => {
  await signUpAndOpenVault(page, {
    beforeDownload: async () => {
      await expect(page.getByRole('banner').getByRole('link')).toHaveText(['Skip to content']);
      await expect(page.getByRole('contentinfo')).toHaveCount(0);

      // In-app navigation keeps the kit: Back to signup, Forward, and it is still there. (The
      // phrase check is headed "Recovery kit" too, so look for the kit's own Download PDF.)
      await page.goBack();
      await page.waitForURL('**/signup');
      await page.goForward();
      await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible();

      // A reload or a closed tab asks first. Dismissing keeps the page.
      const dialog = page.waitForEvent('dialog');
      await page.close({ runBeforeUnload: true });
      const asked = await dialog;
      expect(asked.type()).toBe('beforeunload');
      await asked.dismiss();
      await expect(page.getByRole('heading', { name: 'Recovery kit' })).toBeVisible();
    },
  });

  // Saved and acknowledged: the tab closes without asking.
  let asked = false;
  page.on('dialog', () => {
    asked = true;
  });
  await page.close({ runBeforeUnload: true });
  await expect.poll(() => page.isClosed()).toBe(true);
  expect(asked).toBe(false);
});

// A double click used to submit twice: two products, or a duplicate key answered with "Nothing
// was saved." beside the row the first click had saved.
test('a double click on Add product or Store ciphertext acts once', async ({ page }) => {
  const posts = { products: 0, secrets: 0 };
  page.on('request', (request) => {
    if (request.method() !== 'POST') return;
    const { pathname } = new URL(request.url());
    if (pathname === '/rest/v1/products') posts.products += 1;
    if (pathname === '/rest/v1/secrets') posts.secrets += 1;
  });
  await signUpAndOpenVault(page);

  await page.getByLabel('Product name').fill('Twice');
  await page.getByRole('button', { name: 'Add product' }).dblclick();
  const product = page.getByRole('button', { name: 'Twice', exact: true });
  await expect(product).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add product' })).toBeEnabled();
  await expect(product).toHaveCount(1);
  expect(posts.products).toBe(1);

  await product.click();
  await page.getByLabel('Secret name').fill('twice_key');
  await page.getByLabel('Secret value').fill('twice-value-0001');
  await page.getByRole('button', { name: 'Store ciphertext' }).dblclick();
  await expect(page.getByRole('listitem').filter({ hasText: 'twice_key' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Store ciphertext' })).toBeEnabled();
  expect(posts.secrets).toBe(1);
  await expect(
    page.getByRole('alert').filter({ hasText: /Could not|Nothing was saved/ }),
  ).toHaveCount(0);
});

// Reveal and Hide now remove the button that was pressed. Focus used to drop to the page, so a
// keyboard user started again from the top.
test('revealing and hiding a key keeps keyboard focus in its row', async ({ page }) => {
  await signUpAndOpenVault(page);
  await storeSecret(page, { product: 'Focus', name: 'focus_key', value: 'focus-value-0001' });
  const row = page.getByRole('listitem').filter({ hasText: 'focus_key' });

  await row.getByRole('button', { name: 'Reveal for 30s' }).focus();
  await page.keyboard.press('Enter');
  await expect(row.getByRole('button', { name: 'Copy' })).toBeFocused();
  await expect(row.getByRole('status')).toHaveText(
    'focus_key shown. It masks again in 30 seconds.',
  );

  await row.getByRole('button', { name: 'Hide now' }).focus();
  await page.keyboard.press('Enter');
  await expect(row.getByRole('button', { name: 'Reveal for 30s' })).toBeFocused();
  await expect(row.getByRole('status')).toHaveText('');

  // The sticky header keeps Lock in reach; focus moving up must not land under it.
  const padding = await page.evaluate(
    () => getComputedStyle(document.documentElement).scrollPaddingTop,
  );
  expect(padding).toBe('88px');
});
