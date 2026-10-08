import { expect, test } from '@playwright/test';

test('vault sends a Content-Security-Policy in enforce mode', async ({ request }) => {
  const res = await request.get('/vault');
  expect(res.ok()).toBe(true);
  const csp = res.headers()['content-security-policy'];
  expect(csp).toBeTruthy();
  expect(csp).toContain("default-src 'none'");
  expect(csp).toContain('nonce-');
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
  expect(res.headers()['referrer-policy']).toBe('no-referrer');
  expect(res.headers()['x-frame-options']).toBe('DENY');
});

test('share route uses no-referrer to protect a fragment key', async ({ request }) => {
  const res = await request.get('/s/example-token');
  expect(res.ok()).toBe(true);
  expect(res.headers()['referrer-policy']).toBe('no-referrer');
  expect(res.headers()['cache-control']).toContain('no-store');
});

// Regression: strict routes send COEP require-corp, and Chrome will not start a dedicated
// worker whose script does not itself assert COEP. The Argon2id worker is a /_next/static
// chunk, which proxy.ts does not cover, so signup, unlock and password change all failed
// with ERR_BLOCKED_BY_RESPONSE until next.config.ts added these headers.
test('static chunks assert COEP whenever a strict route requires it', async ({ request }) => {
  const page = await request.get('/signup');
  expect(page.ok()).toBe(true);
  if (page.headers()['cross-origin-embedder-policy'] !== 'require-corp') {
    test.skip(true, 'COEP is only sent in production builds');
  }
  const html = await page.text();
  const chunk = html.match(/\/_next\/static\/chunks\/[^"']+\.js/)?.[0];
  expect(chunk, 'a static chunk referenced from /signup').toBeTruthy();
  const res = await request.get(chunk!);
  expect(res.ok()).toBe(true);
  expect(res.headers()['cross-origin-embedder-policy']).toBe('require-corp');
  expect(res.headers()['cross-origin-resource-policy']).toBe('same-origin');
});

test('the argon2 worker starts on /signup', async ({ page }) => {
  const blocked: string[] = [];
  page.on('requestfailed', (req) => {
    if (req.failure()?.errorText.includes('BLOCKED')) blocked.push(req.url());
  });
  await page.goto('/signup');
  const worker = page.waitForEvent('worker', { timeout: 15_000 });
  await page.getByLabel('Email').fill(`worker-${Date.now()}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('correct-horse-battery-staple-orbit');
  await page.getByRole('button', { name: 'Create vault' }).click();
  // Derivation runs client-side before any POST, so this needs no backend.
  await worker;
  expect(blocked).toEqual([]);
});
