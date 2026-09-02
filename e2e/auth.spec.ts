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
