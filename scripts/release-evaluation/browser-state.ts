import { expect, type Page } from '@playwright/test';

// This control exists for the complete request, including the first AI wait.
// Preview controls exist only after geometry. Visibility also changes when the
// conversation is minimized, so attachment is the stable lifecycle signal.
const stop = (page: Page) =>
  page.locator('button[aria-label="Stop design request"]');
export async function waitForModelingStart(page: Page) {
  await expect(stop(page)).toBeAttached({ timeout: 20_000 });
}
export async function modelingActive(page: Page) {
  return (await stop(page).count()) > 0;
}
export async function cancelModeling(page: Page) {
  if (await modelingActive(page))
    await stop(page).evaluate((button: HTMLButtonElement) => button.click());
}
