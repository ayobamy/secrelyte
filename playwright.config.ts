import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 3457);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm start',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: String(port),
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        'sb_publishable_ci_placeholder_not_real',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? baseURL,
      // POST /api/signup parses this, so the vault specs cannot run without it. The
      // placeholder keeps the non-vault specs booting; only the local-Supabase job passes a
      // usable value, and those specs skip unless E2E_VAULT is set.
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ?? 'sb_secret_ci_placeholder_not_real',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
