/** Post-trial forensic analysis only. No provider, paid call, browser seeding, or
 * altered acceptance criterion. Reconstruct the rejected fresh proposal from
 * its recorded operations; preserve the live result as NOT_COMMITTED. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { applyPlan, type Session } from '../../src/intelligence/engine';
import { sceneContext } from '../../src/intelligence/context';
import { verifyCompletion } from '../../src/intelligence/completion';
import { equalData } from '../../src/projects/equalData';
import { inventory, oracle } from '../design-decision-live/geometry';
import {
  cloneSolid,
  box,
  vertical,
  mapSolid,
} from '../phase3-evaluation/geometry';

const dir = '.cloud/design-decision-live/live-1';
const out = join(dir, 'offline-forensics');
assert(!existsSync(out), 'Do not replace previous forensic evidence');
mkdirSync(out);
const read = (name: string) =>
  JSON.parse(readFileSync(join(dir, name), 'utf8'));
const save = (name: string, value: unknown) =>
  writeFileSync(join(out, name), JSON.stringify(value, null, 2));
const result = read('results.json');
const turn = result.turns[0];
assert.equal(turn.status, 'NOT_COMMITTED');
const [build, finish, review, repair] = turn.events;
const before: Session = read('turn-1-before.json');
const beforeBytes = JSON.stringify(before);
const recorded = finish.input.scene;
const decision = recorded.design.notes[0].decision;
let reconstructed = (
  await applyPlan(
    before,
    build.response,
    build.input.scene.camera,
    true,
    decision.origin,
  )
).session;

// applyPlan allocates random UUIDs. Rebind only those IDs to the recorded UUIDs,
// then demand exact agreement with the live inspector's full object records.
const ids = new Map<string, string>();
for (const v of reconstructed.project.volumes) {
  const matches = recorded.objects.filter((o: any) => o.name === v.name);
  assert.equal(matches.length, 1, 'Unique recorded object identity required');
  ids.set(v.id, matches[0].id);
}
for (const g of reconstructed.project.groups ?? []) {
  const matches = recorded.groups.filter((o: any) => o.name === g.name);
  assert.equal(matches.length, 1, 'Unique recorded group identity required');
  ids.set(g.id, matches[0].id);
}
ids.set(reconstructed.project.design!.notes![0].decision!.id, decision.id);
const remap = (v: any): any =>
  typeof v === 'string'
    ? (ids.get(v) ?? v)
    : Array.isArray(v)
      ? v.map(remap)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, remap(x)]))
        : v;
reconstructed = remap(reconstructed);
const reconstructedScene = sceneContext(
  reconstructed.project,
  reconstructed.context,
  recorded.camera,
);
for (const field of ['objects', 'groups', 'design', 'conversation'] as const)
  assert.deepEqual(
    reconstructedScene[field],
    recorded[field],
    `Replay must match captured ${field}`,
  );
save('first-proposal.session.json', reconstructed);
const criteria = review.response;
const firstReport = await verifyCompletion(criteria, before, reconstructed);
save('first-host-report.json', firstReport);
const corrected = (
  await applyPlan(
    reconstructed,
    repair.response,
    repair.input.scene.camera,
    true,
    decision.origin,
  )
).session;
save('corrected-proposal.session.json', corrected);
const finalReport = await verifyCompletion(criteria, before, corrected);
save('final-host-report.json', finalReport);
assert.equal(
  finalReport.canCommit,
  false,
  'Untouched live criteria must still block',
);
assert(
  !finalReport.checks.some((c) => c.outcome === 'incorrect'),
  'All supported geometry checks should pass after recorded repair',
);
assert.equal(
  JSON.stringify(before),
  beforeBytes,
  'Source session must remain intact',
);

const byName = (name: string) => {
  const matches = corrected.project.volumes.filter((v) => v.name === name);
  assert.equal(matches.length, 1);
  return matches[0].id;
};
const binding = {
  turntable: byName('Circular turntable'),
  light: byName('Overhead rectangular light panel'),
  cube: byName('Separate storage cube'),
  frame: corrected.project.volumes
    .filter(
      (v) =>
        ![
          'Turntable pedestal',
          'Circular turntable',
          'Separate storage cube',
        ].includes(v.name),
    )
    .map((v) => v.id),
};
// This post-trial binding is explicit because the frozen name heuristic would
// match both the fresh agent's pedestal and platter. It is NOT a scored retry.
const measurements = await oracle(
  1,
  before,
  corrected,
  binding,
  build.input.scene.camera,
);
save('independent-measurements.json', {
  label: 'Offline measurements of saved fresh operations; not a live commit',
  bindingMethod:
    'Unique recorded names associate roles; actual kernel solids establish dimensions and occupancy',
  ...measurements,
});
const rows = await inventory(corrected);
save('solid-inventory.json', rows);

// Additional diagnostic probes with dimensions derived from the USER request,
// not a substitute acceptance check. Boundaries inset 1 mm to avoid contact.
// The front rectangular corridor establishes just one axis-aligned insertion
// envelope, not every bulky sample shape, motion path or structural property.
const eps = 0.001;
const probes = [
  {
    name: 'Requested circular loading volume',
    solid: mapSolid(vertical(0.32 - 2 * eps, 0.35 - eps), (s) =>
      s.translate([0, 0.24 + eps, 0]),
    ),
    source:
      'Request: diameter 0.70 m, top 0.24 m, clear height 0.32 m; Y-up world frame; 1 mm boundary inset',
  },
  {
    name: 'One front rectangular insertion envelope',
    solid: box(0.7 - 2 * eps, 0.32 - 2 * eps, 1.35, 0, 0.24 + eps, -0.325),
    source:
      'Diagnostic corridor X +/-0.349 m, Y 0.241..0.559 m, Z -1..0.35 m; front approach chosen for offline analysis only',
  },
];
const loading: any[] = [];
for (const probe of probes) {
  const intersections: any[] = [];
  try {
    for (const v of corrected.project.volumes) {
      const solid = await cloneSolid(v);
      try {
        const intersection = solid.intersect(probe.solid);
        try {
          intersections.push({
            id: v.id,
            name: v.name,
            intersectionM3: intersection.volume(),
          });
        } finally {
          intersection.delete();
        }
      } finally {
        solid.delete();
      }
    }
    loading.push({
      name: probe.name,
      source: probe.source,
      intersections,
      clear: intersections.every((x) => Math.abs(x.intersectionM3) < 1e-10),
    });
  } finally {
    probe.solid.delete();
  }
}
save('loading-volume-diagnostics.json', loading);
const changed = reconstructed.project.volumes.filter(
  (v) =>
    !equalData(
      v,
      corrected.project.volumes.find((o) => o.id === v.id),
    ),
);
assert.deepEqual(
  changed.map((v) => v.id),
  [binding.cube],
);
assert.equal(corrected.project.design!.notes![0].decision!.revision, 1);
const summary = {
  label:
    'Post-trial offline forensic replay; no new paid calls and no browser commit',
  trialStatus: result.status,
  liveSavedObjects: turn.objects,
  firstProposalMatchesRecordedInspector: true,
  objects: rows.length,
  allEditable: rows.every((r) => r.editable),
  originalPreserved: JSON.stringify(before) === beforeBytes,
  allIdentitiesPreservedDuringRepair: reconstructed.project.volumes.every((v) =>
    corrected.project.volumes.some((o) => o.id === v.id),
  ),
  changedComponentsDuringRepair: changed.map((v) => ({
    id: v.id,
    name: v.name,
  })),
  unchangedComponentsDuringRepair: reconstructed.project.volumes
    .filter((v) => !changed.includes(v))
    .map((v) => ({ id: v.id, name: v.name })),
  hostBefore: {
    status: firstReport.status,
    canCommit: firstReport.canCommit,
    incorrect: firstReport.checks.filter((c) => c.outcome === 'incorrect'),
  },
  hostAfter: {
    status: finalReport.status,
    canCommit: finalReport.canCommit,
    verified: finalReport.checks.filter((c) => c.outcome === 'verified').length,
    incorrect: finalReport.checks.filter((c) => c.outcome === 'incorrect')
      .length,
    unverified: finalReport.checks.filter((c) => c.outcome === 'unverified'),
  },
  independentGeometry: {
    correct: measurements.correct,
    fullyMeasured: measurements.fullyMeasured,
    nonVerified: measurements.facts.filter((f) => f.status !== 'verified'),
  },
  additionalLoadingProbes: loading.map((p) => ({
    name: p.name,
    clear: p.clear,
  })),
  unsupported: criteria.checks.filter(
    (c: any) => c.requirement.kind === 'unavailable',
  ),
  provisionalCapture: corrected.project.design!.notes![0].decision,
  durableCapture: false,
  recall: 'NOT_REACHED',
  explicitRevision: 'NOT_REACHED',
  note: 'Same-turn note paraphrase update is idempotent, not evidence of honoring a later user revision.',
  limitations: [
    'Probe evidence is offline diagnostic only; live reviewer never saw these measurements.',
    'No real material, load, connection strength or stability certification.',
    'Fresh-trial saved geometry, geometry Undo/Redo, recall and explicit revision were not reached.',
  ],
};
save('summary.json', summary);
console.log(JSON.stringify(summary, null, 2));
