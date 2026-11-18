import type { Page } from '@playwright/test';

// Freeze the renderer's elapsed-time clock, not browser timers or rAF.
// Assertions and screenshots must still be able to wait for actual frames.
export async function pauseAnimation(page: Page) {
  await page.evaluate(() => {
    const realNow = performance.now.bind(performance);
    let held: number | null = realNow();
    let offset = 0;
    Object.defineProperty(performance, 'now', {
      configurable: true,
      value: () => held ?? realNow() + offset,
    });
    (window as any).__animationClock = {
      advance(ms: number) {
        if (held !== null) held += ms;
      },
      resume() {
        if (held !== null) offset = held - realNow();
        held = null;
      },
    };
  });
}

export async function advanceAnimation(page: Page, ms: number) {
  await page.evaluate((ms) => (window as any).__animationClock.advance(ms), ms);
}

export async function resumeAnimation(page: Page) {
  await page.evaluate(() => (window as any).__animationClock.resume());
}
