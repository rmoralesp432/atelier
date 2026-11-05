import { expect, test } from '@playwright/test';

for (const phone of [false, true]) {
  test(`hide, recover and undo objects on ${phone ? 'phone' : 'desktop'}`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    const view = page.getByTestId('viewport');
    const objects = page.locator('.objects-panel');
    const state = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem('atelier.session.v2')!),
      );
    await expect(view).toHaveAttribute('data-model-objects', '2', {
      timeout: 20000,
    });
    await page
      .getByRole('button', { name: 'Show objects', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Hide object Main pavilion', exact: true })
      .click();
    await expect(view).toHaveAttribute('data-model-objects', '1');
    await expect(view).toHaveAttribute('data-selection-glow', '0');
    await expect(objects).toContainText('1 hidden');
    expect((await state()).project.volumes).toHaveLength(2);
    await page.reload();
    await expect(view).toHaveAttribute('data-model-objects', '1', {
      timeout: 20000,
    });
    if (!(await objects.isVisible()))
      await page
        .getByRole('button', { name: 'Show objects', exact: true })
        .click();
    await page
      .getByRole('button', { name: 'Show object Main pavilion', exact: true })
      .click();
    await expect(view).toHaveAttribute('data-model-objects', '2');
    await page
      .getByRole('button', { name: 'Select several', exact: true })
      .click();
    await objects
      .locator('.object-row')
      .filter({ hasText: 'Main pavilion' })
      .click();
    await objects
      .locator('.object-row')
      .filter({ hasText: 'Vertical annex' })
      .click();
    await expect
      .poll(async () => (await state()).project.selectedIds.length)
      .toBe(2);
    await page
      .getByRole('button', { name: 'Hide selected', exact: true })
      .click();
    await expect(view).toHaveAttribute('data-model-objects', '0');
    await expect(view).toHaveAttribute('data-transform-tool', 'none');
    await expect(objects).toContainText('2 hidden');
    await page.getByRole('button', { name: 'Show all', exact: true }).click();
    await expect(view).toHaveAttribute('data-model-objects', '2');
    await page
      .getByRole('button', { name: 'Close objects', exact: true })
      .click();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(view).toHaveAttribute('data-model-objects', '0');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(view).toHaveAttribute('data-model-objects', '2');
    expect(
      (await state()).project.volumes.map((v: { name: string }) => v.name),
    ).toEqual(['Main pavilion', 'Vertical annex']);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}
