import { defaultAppearance } from '../src/studio/appearance';
import { expect, test, type Page } from '@playwright/test';
async function saved(page: Page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem('atelier.session.v2')!),
  );
}
async function openAR(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
    { timeout: 20000 },
  );
  await page.getByRole('button', { name: 'Design tools', exact: true }).click();
  await page
    .getByRole('button', { name: 'Camera settings', exact: true })
    .click();
  await page.getByRole('button', { name: 'View in your space · AR' }).click();
  await page
    .getByRole('button', { name: 'Prepare AR model', exact: true })
    .click();
  await expect(
    page.getByRole('link', { name: 'Download AR model (.usdz)' }),
  ).toBeVisible({ timeout: 30000 });
}
test('iPhone native handoff fixture keeps real USDZ scale explicit and saved geometry unchanged', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const supports = DOMTokenList.prototype.supports;
    DOMTokenList.prototype.supports = function (token: string) {
      return token === 'ar' || supports.call(this, token);
    };
  });
  await openAR(page);
  const before = await saved(page);
  await expect(
    page.getByText('Apple’s AR viewer cannot show ATELIER chat.', {
      exact: false,
    }),
  ).toBeVisible();
  const link = page.getByRole('link', { name: 'Open camera AR' });
  await expect(link).toHaveAttribute('href', /#allowsContentScaling=0$/);
  await page.getByLabel('Keep the chosen scale in iPhone AR').uncheck();
  await expect(link).not.toHaveAttribute('href', /#allowsContentScaling/);
  await page
    .getByRole('spinbutton', { name: 'Real world model width' })
    .fill('1');
  await page
    .getByRole('button', { name: 'Use this width', exact: true })
    .click();
  await expect(page.getByText('1.00 m wide in your space')).toBeVisible();
  await expect(link).toBeHidden();
  await page
    .getByRole('button', { name: 'Prepare AR model', exact: true })
    .click();
  await expect(link).toBeVisible({ timeout: 30000 });
  expect(await saved(page)).toEqual(before);
  const panel = page.getByRole('region', { name: 'View in your space' });
  expect(
    await panel.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await page.screenshot({ path: 'test-results/atelier-phone-ar-scale.png' });
});
for (const theme of ['night', 'day'] as const)
  test(`explicit XR transport fixture hosts shared AI conversation and refreshes genuine geometry in place (${theme})`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'xr', {
        configurable: true,
        value: { isSessionSupported: async () => true },
      }),
    );
    await page.addInitScript(
      (a) => localStorage.setItem('atelier.appearance', JSON.stringify(a)),
      { ...defaultAppearance, theme },
    );
    // Hardware transport only is replaced. The UI, provider validation, modeling
    // engine and createARModel mesh generation are real; this is not a device test.
    await page.route(/\/webxr(?:-[^/]+\.js|\.ts)(?:\?.*)?$/, (r) =>
      r.fulfill({
        contentType: 'application/javascript',
        body: `
    export async function startAR(model,overlay,scale,status,onEnd,signal,onFit,onCamera){
      window.__xrFixture={updates:0,scale,origin:model.userData.origin};
      status('XR transport fixture active');
      onCamera({right:{x:0,y:0,z:1},forward:{x:1,y:0,z:0},visible:[]});
      return {end:async()=>onEnd(),scale:v=>window.__xrFixture.scale=v,rotate:()=>{},reposition:()=>{},fitWidth:()=>onFit(.1,0),updateModel:m=>{window.__xrFixture.updates++;window.__xrFixture.positions=m.children.map(c=>c.position.x);window.__xrFixture.origin=m.userData.origin;}};
    }`,
      }),
    );
    await page.route('**/api/config', (r) =>
      r.fulfill({
        json: { configured: true, authenticated: true, voiceConfigured: false },
      }),
    );
    await page.route('**/api/plan', (r) =>
      r.fulfill({
        json: {
          intent: 'apply',
          message: 'Move the selected volume two meters right.',
          operations: [
            {
              type: 'move',
              targets: ['$selected'],
              direction: 'right',
              distance: 2,
            },
          ],
        },
      }),
    );
    await openAR(page);
    const before = await saved(page);
    await page
      .getByRole('button', { name: 'Open camera AR', exact: true })
      .click();
    const overlay = page.locator('.ar-overlay');
    await expect(overlay).toBeVisible();
    await expect(
      overlay.getByRole('textbox', { name: 'Message Atelier' }),
    ).toBeVisible();
    await expect(
      overlay.getByRole('textbox', { name: 'Message Atelier' }),
    ).toHaveCSS(
      'color',
      theme === 'day' ? 'rgb(39, 52, 46)' : 'rgb(241, 245, 243)',
    );
    await expect(
      overlay.getByRole('button', { name: 'Start voice conversation' }),
    ).toBeDisabled();
    expect(await page.locator('.conversation-area').count()).toBe(1);
    await overlay.getByText('Size & placement', { exact: false }).click();
    await overlay.getByLabel('Live AR scale').selectOption('1');
    await expect
      .poll(() => page.evaluate(() => (window as any).__xrFixture.scale))
      .toBe(1);
    await overlay.getByText('Size & placement', { exact: false }).click();
    await overlay
      .getByRole('textbox', { name: 'Message Atelier' })
      .fill('Move this two meters right');
    await overlay
      .getByRole('button', { name: 'Send message', exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => (window as any).__xrFixture.updates))
      .toBe(1);
    const after = await saved(page);
    expect(after.project.volumes[0].position.z).toBe(
      before.project.volumes[0].position.z + 2,
    );
    expect(after.project.volumes[0].dimensions).toEqual(
      before.project.volumes[0].dimensions,
    );
    await expect
      .poll(() => page.evaluate(() => (window as any).__xrFixture.scale))
      .toBe(1);
    await overlay
      .getByRole('textbox', { name: 'Message Atelier' })
      .fill('A draft to continue later');
    await overlay.getByRole('button', { name: 'Exit AR', exact: true }).click();
    await expect(overlay).toBeHidden();
    await page.getByRole('button', { name: 'Close AR', exact: true }).click();
    await expect(
      page.getByRole('textbox', { name: 'Message Atelier' }),
    ).toHaveValue('A draft to continue later');
    await expect(page.locator('.conversation-area')).toHaveCount(1);
  });
