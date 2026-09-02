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
