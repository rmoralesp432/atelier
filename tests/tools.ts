import type { Page } from '@playwright/test';

/** Follow the shared desktop/phone Tools menu instead of the old full toolbar. */
export async function openTool(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true });
  if (!(await button.isVisible()))
    await page
      .getByRole('button', { name: 'Design tools', exact: true })
      .click();
  await button.click();
}
