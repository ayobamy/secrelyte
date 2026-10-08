import { expect, test, type Page } from '@playwright/test';
import { HERO_BODY, HERO_HEADLINE } from '../lib/brand/hero-copy';
import { DEMO_SECRET } from '../lib/brand/landing-content';

function isFirstParty(url: string) {
  return (
    url.startsWith('http://127.0.0.1') ||
    url.startsWith('http://localhost') ||
    url.startsWith('data:')
  );
}

/**
 * Opens the home page and waits until React has hydrated, so a click or key press reaches its
 * handler instead of landing on server HTML under load. RevealOnScroll sets .motion-ready on
 * <html> from an effect, which runs only after the root hydrates; with reduced motion it never
 * sets it, and those tests only read the page.
 */
async function gotoHome(page: Page) {
  await page.goto('/');
  await page.waitForFunction(
    () =>
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.classList.contains('motion-ready'),
  );
}

/** Collects CSP violations from both the console and the securitypolicyviolation event. */
async function watchCsp(page: Page) {
  const violations: string[] = [];
  page.on('console', (msg) => {
    if (/Content Security Policy/i.test(msg.text())) violations.push(msg.text());
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.error(
        `Content Security Policy violation: ${event.violatedDirective} ${event.blockedURI}`,
      );
    });
  });
  return violations;
}

test('home leads with the guarantee, then what to click', async ({ page }) => {
  await gotoHome(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1, name: HERO_HEADLINE })).toBeVisible();
  await expect(page.getByRole('main').getByText(HERO_BODY)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Secrelyte' })).toBeVisible();
  await expect(page.getByText(/AI-powered/i)).toHaveCount(0);

  const hero = page.getByRole('region', { name: HERO_HEADLINE });
  await expect(hero.getByRole('link', { name: 'Create a vault' })).toHaveAttribute(
    'href',
    '/signup',
  );
  await expect(hero.getByRole('link', { name: 'Unlock' })).toHaveAttribute('href', '/login');
  await expect(hero.getByRole('link', { name: 'See how it works' })).toHaveAttribute(
    'href',
    '#how',
  );
});

test('hero copy is visible with reduced motion, and nothing below it is hidden', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoHome(page);
  await expect(page.getByRole('heading', { level: 1, name: HERO_HEADLINE })).toBeVisible();
  // Scroll reveal must never engage under reduced motion.
  await expect(page.locator('html.motion-ready')).toHaveCount(0);
  const lastReveal = page.locator('[data-reveal]').last();
  await lastReveal.scrollIntoViewIfNeeded();
  await expect(lastReveal).toBeVisible();
  await expect(lastReveal).toHaveCSS('opacity', '1');
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

test('home preview reveals one value from the keyboard and hides it again', async ({ page }) => {
  await gotoHome(page);
  const preview = page.getByRole('figure', { name: /working preview/ });
  await expect(preview.getByText(DEMO_SECRET)).toHaveCount(0);
  const reveal = page.getByRole('button', { name: 'Reveal for 30s' });
  await reveal.focus();
  await page.keyboard.press('Enter');
  await expect(preview.getByText(DEMO_SECRET)).toBeVisible();
  const hide = page.getByRole('button', { name: 'Hide now' });
  await expect(hide).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Reveal for 30s' })).toBeVisible();
  await expect(preview.getByText(DEMO_SECRET)).toHaveCount(0);
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
  await gotoHome(page);
  const preview = page.getByRole('figure', { name: /working preview/ });
  await page.getByRole('button', { name: 'Reveal for 30s' }).click();
  await expect(preview.getByText(DEMO_SECRET)).toBeVisible();
  await page.clock.fastForward(29_000);
  await expect(preview.getByText(DEMO_SECRET)).toBeVisible();
  await page.clock.fastForward(1_500);
  await expect(preview.getByText(DEMO_SECRET)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reveal for 30s' })).toBeVisible();
});

test('how it works labels every step Live or Next and works by keyboard', async ({ page }) => {
  await gotoHome(page);
  const tabs = page.getByRole('tablist', { name: 'How it works, step by step' });
  const expected = [
    ['Pick', 'Live'],
    ['Reveal', 'Live'],
    ['Send', 'Next'],
    ['Watch', 'Next'],
  ] as const;
  for (const [name, status] of expected) {
    await expect(tabs.getByRole('tab', { name: new RegExp(`${name}\\s*${status}`) })).toBeVisible();
  }
  const pick = tabs.getByRole('tab', { name: /Pick/ });
  await pick.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const send = tabs.getByRole('tab', { name: /Send/ });
  await expect(send).toBeFocused();
  await expect(send).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: /Send/ })).toContainText('Next');
  await page.keyboard.press('End');
  await expect(tabs.getByRole('tab', { name: /Watch/ })).toHaveAttribute('aria-selected', 'true');
});

test('the Claude section is labelled Next and its confirmation card sends nothing', async ({
  page,
}) => {
  await gotoHome(page);
  const claude = page.getByRole('region', { name: /Claude will see names, never values/ });
  await expect(claude.getByText('Next', { exact: true }).first()).toBeVisible();
  await expect(claude.getByText(/^This part is Next, not live\. When it ships,/)).toBeVisible();
  await claude.getByRole('button', { name: 'Send link' }).click();
  await expect(claude.getByText(/nothing was sent/).last()).toBeVisible();
  await expect(claude.getByRole('button', { name: 'Show the card again' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(claude.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(claude.getByText('Cancelled. Nothing was sent.').last()).toBeVisible();
});

test('FAQ is numbered and opens from the keyboard', async ({ page }) => {
  await gotoHome(page);
  const faq = page.getByRole('region', { name: 'Questions, answered plainly.' });
  const first = faq.locator('summary').first();
  await expect(first).toContainText('01.');
  await first.focus();
  await page.keyboard.press('Enter');
  await expect(faq.getByText(/The server stores ciphertext it cannot open\./)).toBeVisible();
});

test('home loads with zero CSP violations and zero third-party requests', async ({ page }) => {
  const violations = await watchCsp(page);
  const thirdParty: string[] = [];
  page.on('request', (req) => {
    if (!isFirstParty(req.url())) thirdParty.push(req.url());
  });
  const response = await page.goto('/', { waitUntil: 'networkidle' });
  // style-src has no 'unsafe-inline', so a style attribute in the server HTML is blocked.
  expect(await response?.text()).not.toMatch(/\sstyle="/);
  await page.getByRole('button', { name: 'Reveal for 30s' }).click();
  await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
  await page.waitForLoadState('networkidle');
  // Script-set styles (CSSOM) are allowed by CSP. Only Next's route announcer uses one: the
  // host element and the live region inside its shadow root, which this locator pierces.
  const styled = await page.locator('[style]').evaluateAll((els) =>
    els
      .filter((el) => {
        const root = el.getRootNode();
        const inAnnouncer =
          root instanceof ShadowRoot && root.host.tagName === 'NEXT-ROUTE-ANNOUNCER';
        return el.tagName !== 'NEXT-ROUTE-ANNOUNCER' && !inAnnouncer;
      })
      .map((el) => `${el.tagName.toLowerCase()} ${el.getAttribute('style')}`),
  );
  expect(styled).toEqual([]);
  expect(violations).toEqual([]);
  expect(thirdParty).toEqual([]);
});

for (const width of [390, 360]) {
  test(`home neither scrolls sideways nor clips content at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoHome(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    // Clipped content: an in-flow, visible element that extends past the edge of an ancestor
    // which hides overflow. Excluded on purpose: one-line ellipsis truncation, sr-only text,
    // and absolutely positioned decoration. Every tab panel is checked, inactive ones too.
    const clipped = await page.evaluate(() => {
      const isSrOnly = (el: Element) => el.getBoundingClientRect().width <= 1;
      const hiders = [...document.querySelectorAll('main *')].filter((el) => {
        const style = getComputedStyle(el);
        return (
          ['hidden', 'clip'].includes(style.overflowX) &&
          style.textOverflow !== 'ellipsis' &&
          !isSrOnly(el)
        );
      });
      const found: string[] = [];
      for (const box of hiders) {
        const edge = box.getBoundingClientRect();
        for (const el of box.querySelectorAll('*')) {
          const style = getComputedStyle(el);
          const skip =
            el.closest('[aria-hidden="true"]') !== null ||
            ['absolute', 'fixed'].includes(style.position) ||
            isSrOnly(el) ||
            (el.parentElement && getComputedStyle(el.parentElement).textOverflow === 'ellipsis');
          if (skip) continue;
          const r = el.getBoundingClientRect();
          if (r.width > 0 && (r.right > edge.right + 1 || r.left < edge.left - 1)) {
            found.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? '').slice(0, 30)}"`);
          }
        }
      }
      return found;
    });
    expect(clipped).toEqual([]);
    await expect(
      page.getByRole('banner').getByRole('link', { name: /Create a vault/ }),
    ).toBeVisible();
  });
}

test('Escape hides a revealed value', async ({ page }) => {
  await gotoHome(page);
  const preview = page.getByRole('figure', { name: /working preview/ });
  await page.getByRole('button', { name: 'Reveal for 30s' }).focus();
  await page.keyboard.press('Enter');
  await expect(preview.getByText(DEMO_SECRET)).toBeVisible();
  await expect(preview.getByText(/Esc hides it now/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(preview.getByText(DEMO_SECRET)).toHaveCount(0);
});

test('Next previews in how it works respond without acting', async ({ page }) => {
  await gotoHome(page);
  await page.getByRole('tab', { name: /Send/ }).click();
  const panel = page.getByRole('tabpanel', { name: /Send/ });
  await panel.getByRole('button', { name: 'Create link' }).click();
  await expect(panel.getByText(/Preview only\. Share links are Next/).first()).toBeVisible();
  await page.getByRole('button', { name: /Continue to Watch/ }).click();
  await expect(page.getByRole('tab', { name: /Watch/ })).toHaveAttribute('aria-selected', 'true');
});
