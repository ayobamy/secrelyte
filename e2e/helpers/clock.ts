import type { Page } from '@playwright/test';

/**
 * Pauses the page clock. With the clock paused, Playwright's auto-retrying assertions cannot
 * move fake time forward, so every deadline a test checks is checked at the instant it advances
 * to, not "somewhere in the next five seconds". Install the clock (page.clock.install) before
 * the first navigation, then call this before the action whose deadline is under test.
 *
 * The page clock keeps running while this call travels, and pauseAt refuses a time already
 * past, so the target sits a second ahead rather than a millisecond (a 1ms margin failed when
 * the round trip was slow). Callers pause before any reveal or copy starts, so the second it
 * fast-forwards through has nothing timed in it. A clock left running instead turns real
 * seconds on a loaded machine into extra fake time, which pushes a 29s check past 30s.
 */
export const PAUSE_MARGIN_MS = 1_000;

export async function pauseClock(page: Page): Promise<void> {
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + PAUSE_MARGIN_MS);
}
