/** Recheck retained live-AI geometry. Offline: no provider or API credential. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseSession } from '../src/intelligence/engine';
import { readProjectCopy } from '../src/projects/transfer';
import { solidStats } from '../src/geometry/kernel';
import { groupBounds } from '../src/geometry/spatial';
import type { Volume } from '../src/model';

const root = new URL('../docs/evaluations/2026-11-12-agent/', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, root), 'utf8');
const hash = (v: Volume) =>
  createHash('sha256').update(JSON.stringify(v)).digest('hex');
const near = (actual: number, expected: number) =>
  assert(
    Math.abs(actual - expected) < 0.02,
    `Expected ${expected}, observed ${actual}`,
  );
type Baseline = Pick<Volume, 'id' | 'name' | 'position' | 'dimensions'> & {
  hash: string;
  role?: string;
};
const baseline: { chair: Baseline[]; building: Baseline[] } = JSON.parse(
  read('baseline.json'),
);
const copies = new Map<string, Volume[]>();
for (const name of ['Reading-chair', 'Four-storey-study', 'Drawing-mass']) {
  const raw = read(name + '.atelier.json');
  const parts = parseSession(readProjectCopy(raw).session).project.volumes;
  assert.equal(new Set(parts.map((v) => v.id)).size, parts.length);
  for (const v of parts) {
    const stats = await solidStats(v);
    assert.equal(stats.status, 'NoError', v.name);
    assert(stats.volume > 0, v.name);
  }
  copies.set(name, parts);
}
const chair = copies.get('Reading-chair')!;
assert.equal(chair.length, 4);
for (const before of baseline.chair) {
  const after = chair.find((v) => v.id === before.id)!;
  assert(after, `Lost chair identity: ${before.id}`);
  if (!before.name.toLowerCase().includes('backrest'))
    assert.equal(hash(after), before.hash);
  else {
    near(after.dimensions.width, before.dimensions.width);
    assert(after.dimensions.depth < before.dimensions.depth);
    assert(after.dimensions.height > before.dimensions.height);
  }
}
const building = copies.get('Four-storey-study')!;
assert.equal(building.length, 153);
for (const before of baseline.building) {
  const after = building.find((v) => v.id === before.id)!;
  assert(after, `Lost building identity: ${before.id}`);
  if (before.role !== 'column') assert.equal(hash(after), before.hash);
  else {
    assert.deepEqual(after.dimensions, before.dimensions);
    near(after.position.y, before.position.y);
  }
}
const floors = building
  .filter((v) => v.component?.role === 'floor')
  .sort((a, b) => a.position.y - b.position.y);
assert.equal(floors.length, 4);
[0, 6, 9.5, 13].forEach((y, i) => {
  near(floors[i].position.y, y);
  near(floors[i].dimensions.width, 18);
  near(floors[i].dimensions.depth, 12);
});
assert(building.some((v) => v.component?.role === 'roof'));
assert(building.some((v) => v.material === 'glass'));
const columns = building.filter((v) => v.component?.role === 'column');
assert.equal(columns.length, 48);
const oldBounds = JSON.parse(read('checks.json')).building.oldColumnBounds;
const newBounds = groupBounds(columns);
for (const axis of ['x', 'z'] as const) {
  near(newBounds.min[axis], oldBounds.min[axis] + 1);
  near(newBounds.max[axis], oldBounds.max[axis] - 1);
}
const drawing = copies.get('Drawing-mass')!;
assert.equal(drawing.length, 1);
near(drawing[0].dimensions.width, 14);
near(drawing[0].dimensions.depth, 9);
near(drawing[0].dimensions.height, 3);
near((await solidStats(drawing[0])).volume, 288);
console.log(
  'Three retained live-AI projects passed solid, dimension, identity, correction and project-import checks. No API calls made.',
);
