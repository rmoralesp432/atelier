// Reproducible geometry examples, not AI responses or a production fallback.
import { mkdir, writeFile } from 'node:fs/promises';
import {
  applyPlan,
  newSession,
  serializeSession,
  type Session,
} from '../src/intelligence/engine';
import { defaultCamera } from '../src/intelligence/context';
import type { Operation } from '../src/intelligence/plan';
const edit = async (s: Session, ...operations: Operation[]) =>
  (
    await applyPlan(
      s,
      { intent: 'apply', message: 'Architectural example', operations },
      defaultCamera,
      true,
    )
  ).session;
let session = await edit(
  newSession({ volumes: [], selectedId: null }),
  {
    type: 'create_at',
    name: 'Floating pavilion',
    shape: 'box',
    width: 100,
    depth: 20,
    height: 8,
    x: 0,
    y: 4,
    z: 0,
    rotation: 0,
  },
  {
    type: 'offset_base',
    target: '$name:Floating pavilion',
    offset: 3,
    height: 4,
    name: 'Offset base',
  },
);
session = await edit(session, {
  type: 'rotate',
  targets: ['$selected'],
  degrees: 45,
  relative: true,
});
const building: Operation = {
  type: 'building',
  target: '$name:Floating pavilion',
  floors: 2,
  slabThickness: 0.25,
  facade: true,
  panelWidth: 1.5,
  mullionWidth: 0.06,
};
await mkdir('public/examples', { recursive: true });
await writeFile(
  'public/examples/raised-pavilion.json',
  serializeSession(await edit(session, building)),
);
session = await edit(
  session,
  {
    type: 'create_at',
    name: 'Central cylinder',
    shape: 'cylinder',
    width: 8,
    depth: 8,
    height: 12,
    x: 0,
    y: 0,
    z: 0,
    rotation: 0,
  },
  {
    type: 'center_on',
    target: '$name:Central cylinder',
    reference: '$name:Floating pavilion',
    vertical: 'center',
    gap: 0,
  },
  {
    type: 'boolean',
    operation: 'intersect',
    targets: ['$name:Floating pavilion', '$name:Central cylinder'],
  },
);
session = await edit(session, { ...building, target: '$selected' });
await writeFile(
  'public/examples/cylinder-intersection.json',
  serializeSession(session),
);
console.log(
  'Created both real-geometry examples with reversible modeling history. No model API was called.',
);
