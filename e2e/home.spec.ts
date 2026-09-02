import { expect, test } from '@playwright/test';
import { HERO_BODY } from '../lib/brand/hero-copy';

test('home leads with the verb loop, then the guarantee', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Ask for it\.\s*Send it\.\s*Watch it expire\./ }),
  ).toBeVisible();
  await expect(page.getByRole('main').getByText(HERO_BODY)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Secrelyte' })).toBeVisible();
  await expect(page.getByText(/AI-powered/i)).toHaveCount(0);
});

test('hero copy is visible with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Ask for it\.\s*Send it\.\s*Watch it expire\./ }),
  ).toBeVisible();
});

test('vault route renders without third-party requests', async ({ page }) => {
  const thirdParty: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith('http://127.0.0.1') && !url.startsWith('http://localhost')) {
      thirdParty.push(url);
    }
  });
  await page.goto('/vault');
  await expect(page.getByRole('heading', { name: 'Vault' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Unlock' })).toHaveAttribute('href', '/login');
  await expect(page.getByRole('link', { name: 'Create a vault' })).toHaveAttribute(
    'href',
    '/signup',
  );
  await expect(page.getByLabel('Paste a messy block')).toHaveCount(0);
  const extra = thirdParty.filter((url) => !url.includes('supabase.co'));
  expect(extra).toEqual([]);
});

test('share route stays first-party', async ({ page }) => {
  const thirdParty: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith('http://127.0.0.1') && !url.startsWith('http://localhost')) {
      thirdParty.push(url);
    }
  });
  await page.goto('/s/preview');
  await expect(page.getByRole('heading', { name: 'Share' })).toBeVisible();
  await expect(page.getByText('Demo link')).toBeVisible();
  await expect(page.getByText('Link previe')).toHaveCount(0);
  expect(thirdParty).toEqual([]);
});

test('home preview reveals one value on click', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('sk_live_••••k4m2')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reveal for 30s' }).click();
  await expect(page.getByText('sk_live_••••k4m2')).toBeVisible();
  await page.getByRole('button', { name: 'Hide now' }).click();
  await expect(page.getByText('sk_live_••••k4m2')).toHaveCount(0);
});

test('locked vault names the current page and stays locked', async ({ page }) => {
  await page.goto('/vault');
  await expect(page.getByRole('heading', { name: 'Vault' })).toBeVisible();
  await expect(page.getByText('Locked. Keys live in memory on this device only.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Unlock' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create a vault' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Vault', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('home preview remasks at 30s', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Reveal for 30s' }).click();
  await expect(page.getByText('sk_live_••••k4m2')).toBeVisible();
  await page.clock.fastForward(30_000);
  await expect(page.getByText('sk_live_••••k4m2')).toHaveCount(0);
});
