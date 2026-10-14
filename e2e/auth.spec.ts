import { expect, test } from '@playwright/test';

test('signup password field can reveal the value', async ({ page }) => {
  await page.goto('/signup');
  const field = page.getByLabel('Password', { exact: true });
  await field.fill('correct-horse-battery');
  await expect(field).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(field).toHaveAttribute('type', 'text');
  await expect(field).toHaveValue('correct-horse-battery');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(field).toHaveAttribute('type', 'password');
});

test('login password field can reveal the value', async ({ page }) => {
  await page.goto('/login');
  const field = page.getByLabel('Password', { exact: true });
  await field.fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(field).toHaveAttribute('type', 'text');
  await expect(field).toHaveValue('correct-horse-battery');
});

// Native validation still gates the form; only the browser's bubble is replaced by an inline
// message. A click that lands before hydration gets the bubble instead, so the submit retries.
test('signup refuses a short password inline, announced and tied to the field', async ({
  page,
}) => {
  await page.goto('/signup');
  await page.getByLabel('Email').fill('person@example.com');
  const field = page.getByLabel('Password', { exact: true });
  await field.fill('short');
  const error = page.getByRole('alert').filter({ hasText: 'Use at least 12 characters.' });
  await expect(async () => {
    await page.getByRole('button', { name: 'Create vault' }).click();
    await expect(error).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(field).toBeFocused();
  const errorId = await error.getAttribute('id');
  expect((await field.getAttribute('aria-describedby'))?.split(' ')).toContain(errorId);

  await field.fill('correct-horse-battery-staple-orbit');
  await expect(error).toHaveCount(0);
  await expect(field).not.toHaveAttribute('aria-invalid', 'true');
});

test('signup rates the password while it is typed', async ({ page }) => {
  await page.goto('/signup');
  const field = page.getByLabel('Password', { exact: true });
  const meter = async () => page.locator(`[id="${await field.getAttribute('aria-describedby')}"]`);
  await expect(async () => {
    await field.fill('password1234');
    await expect(await meter()).toContainText('Choose a stronger passphrase', { timeout: 1_000 });
  }).toPass();
  await field.fill('correct-horse-battery-staple-orbit');
  await expect(await meter()).toContainText(/strong/i);
});

// The cross-links used to be plain text until hovered.
for (const [path, name] of [
  ['/signup', 'Unlock'],
  ['/login', 'Create a vault'],
] as const) {
  test(`the ${path} cross-link reads as a link before any hover`, async ({ page }) => {
    await page.goto(path);
    const link = page.getByRole('main').getByRole('link', { name, exact: true });
    await expect(link).toHaveCSS('text-decoration-line', 'underline');
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);
  });
}

// A submit before hydration runs the browser's default GET. With no named fields it sends
// nothing; one name attribute would put the email or the password in the URL.
for (const path of ['/signup', '/login'] as const) {
  test(`${path} names no credential field, so a pre-hydration submit sends nothing`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.locator('form [name]')).toHaveCount(0);
  });
}

// A handler error used to outlive the value it was about: fixing the password after a weak
// submit turned the field message into a form-level alert that said the old reason.
test('a weak-password error clears once the password is replaced', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Email').fill('person@example.com');
  const field = page.getByLabel('Password', { exact: true });
  await field.fill('password1234');
  const alerts = page.getByRole('main').getByRole('alert');
  await expect(async () => {
    await page.getByRole('button', { name: 'Create vault' }).click();
    await expect(alerts.filter({ hasText: 'Choose a stronger passphrase' })).toBeVisible({
      timeout: 1_000,
    });
  }).toPass();
  await expect(field).toHaveAttribute('aria-invalid', 'true');

  await field.fill('correct-horse-battery-staple-orbit');
  await expect(alerts).toHaveCount(0);
  await expect(field).not.toHaveAttribute('aria-invalid', 'true');
});

// Smooth scrolling on the app screens animated a scroll into view under the pointer: the press
// landed on Create vault or Add product and the release somewhere else, so no click fired. It
// belongs to the landing page's in-page links only.
test('scrolling is smooth on the landing page only', async ({ page }) => {
  const scrollBehavior = () =>
    page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
  await page.goto('/');
  expect(await scrollBehavior()).toBe('smooth');
  for (const path of ['/signup', '/login', '/vault']) {
    await page.goto(path);
    expect(await scrollBehavior()).toBe('auto');
  }
});
