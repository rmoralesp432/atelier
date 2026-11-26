import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';

// Reusable production-build regression. The replay starts an isolated local
// browser/project and mocks both AI responses; no network SDK or paid calls.
test('user decisions outlast recent messages and revisions survive atomic saves, reload and Undo/Redo', async ({}, testInfo) => {
  test.setTimeout(600000);
  const output = testInfo.outputPath('decision-replay');
  const result = await promisify(execFile)(
    process.execPath,
    [
      '--import',
      'tsx',
      'scripts/design-decision-evaluation/browser.ts',
      output,
    ],
    { env: { ...process.env, ATELIER_OPENAI_API_KEY: '' }, timeout: 570000 },
  ).catch(async (error) => {
    await writeFile(
      testInfo.outputPath('replay-error.txt'),
      `${error.stdout ?? ''}\n${error.stderr ?? ''}\n${error}`,
    );
    throw error;
  });
  await writeFile(
    testInfo.outputPath('replay.log'),
    result.stdout + result.stderr,
  );
  const evidence = JSON.parse(await readFile(`${output}/result.json`, 'utf8'));
  expect(evidence.status).toBe('PASS');
  expect(evidence.paidCalls).toBe(0);
  expect(evidence.turns).toHaveLength(24);
  expect(evidence.turns.every((t: any) => t.status === 'PASS')).toBe(true);
  expect(
    evidence.turns.filter((t: any) => t.recoversBeyondWindow),
  ).toHaveLength(2);
  expect(evidence.turns.filter((t: any) => t.undoRedo)).toHaveLength(3);
  expect(evidence.negativeControls.map((c: any) => c.status)).toEqual([
    'BLOCKED_MEASURED',
    'BLOCKED_MEASURED',
  ]);
});
