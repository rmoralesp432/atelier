import assert from 'node:assert/strict';
import { test } from 'node:test';
import { piece } from '../completion-evaluation/cases';
import { baseAnchoredHorizontal, measurements } from './cases';

test('base anchoring requires horizontal proportions, the base datum and actual solid contact', async () => {
  const base = piece('Support', 'box', 5.6, 4.8, 0.27, 0, 0, 0);
  const rail = piece('Attachment', 'box', 2.6, 0.28, 0.14, 0.2, 0.27, 0.4);
  async function anchor(v: typeof rail) {
    return baseAnchoredHorizontal(
      v,
      (await measurements([v]))[0],
      [base],
      0.27,
    );
  }
  assert(await anchor(rail));
  assert(await anchor({ ...rail, rotation: 37 }));
  assert.equal(
    await anchor({ ...rail, position: { ...rail.position, x: 8 } }),
    null,
  );
  assert.equal(
    await anchor({ ...rail, position: { ...rail.position, y: 0.47 } }),
    null,
  );
  assert.equal(
    await anchor({ ...rail, dimensions: { ...rail.dimensions, height: 2 } }),
    null,
  );
});
