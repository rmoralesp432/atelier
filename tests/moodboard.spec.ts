import { test, expect, type Page } from '@playwright/test';
import { newSession, serializeSession } from '../src/intelligence/engine';
import { initialProject } from '../src/model';
import { openTool } from './tools';
const board = {
  version: 1,
  items: [
    {
      id: 'kept',
      kind: 'note',
      title: 'Site reference',
      text: 'Keep the courtyard open',
      url: '',
      position: { x: 2, y: 1, z: 0 },
      rotation: 15,
      scale: 1,
    },
  ],
};
async function backup(page: Page) {
  const pending = page.waitForEvent('download');
  await openTool(page, 'Export project');
  const file = await pending;
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
}
test('retired moodboard is absent from menus while existing attachments survive import, save, reload and export', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-rendered',
    'true',
  );
  const session = JSON.parse(serializeSession(newSession(initialProject())));
  await page.getByLabel('Import project file').setInputFiles({
    name: 'Legacy study.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...session, moodboard: board })),
  });
  await page.waitForFunction(
    () => !!localStorage.getItem('atelier.session.v2.before-import'),
  );
  await page.getByRole('button', { name: 'Design tools', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Pull up moodboard' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Model from a reference' }),
  ).toBeVisible();
  const exported = await backup(page);
  expect(exported.moodboard).toEqual(board);
  expect(exported.project.volumes).toEqual(session.project.volumes);
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-rendered',
    'true',
  );
  const restored = await backup(page);
  expect(restored.moodboard).toEqual(board);
  expect(restored.project.volumes).toEqual(session.project.volumes);
});
