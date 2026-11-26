import assert from 'node:assert/strict';
import { mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { applyPlan } from '../../src/intelligence/engine';
import { verifyCompletion } from '../../src/intelligence/completion';
import { sceneContext } from '../../src/intelligence/context';
import { compactScene } from '../../server/agent';
import { equalData } from '../../src/projects/equalData';
import { openBrowser, save, state, stopOnFeedback } from './browser';
import {
  trace,
  seed,
  empty,
  startFrame,
  savedBuild,
  savedFinish,
  savedCriteria,
  scannerCriteria,
  obstruction,
  corner,
  circularOccupancy,
  inspectSolids,
  prompts,
  asPlan,
  object,
} from './case';

const folder = resolve(process.argv[2] ?? '.cloud/seeded-decision/scanner-1');
assert(!existsSync(join(folder, 'summary.json')), 'Preserve every attempt');
mkdirSync(folder, { recursive: true });
const result: any = {
  label:
    'Offline scanner replay; manual diagnostic criteria, no fresh AI or application changes',
  paidCalls: 0,
  cases: [],
  status: 'RUNNING',
};
const publish = () => save(join(folder, 'summary.json'), result);
publish();
const original = seed();
const frames = trace.events.map((e: any) => ({
  kind: e.kind,
  frame: e.input.scene.camera,
  compactFrame: compactScene(e.input.scene).camera,
}));
assert(
  frames.every(
    (x: any) =>
      equalData(x.frame, startFrame) && equalData(x.compactFrame, startFrame),
  ),
);
const cube = object(original, 'Separate storage cube');
result.requestStartFrame = {
  allFourCapturedInputsIdentical: true,
  compactTransportRetainsCamera: true,
  frame: startFrame,
  requestedLeftDistanceM: 2,
  formula: 'delta = -distance * request_start.camera.right',
  expected: { x: -2 * startFrame.right.x, y: 0, z: -2 * startFrame.right.z },
  actualInitialCube: cube.position,
  savedReviewer: { axis: 'x', value: -2 },
  conclusion:
    'Transport is consistent; saved reviewer used world-X semantics despite receiving the same request-start frame.',
};
save(join(folder, 'frame-audit.json'), result.requestStartFrame);
save(join(folder, 'original-criteria.json'), savedCriteria);
save(join(folder, 'diagnostic-criteria.json'), scannerCriteria());
save(join(folder, 'criterion-provenance.json'), {
  label: 'Evaluator-authored diagnostic, not a corrected fresh reviewer answer',
  changed: [
    'check-12 unavailable → existing region(empty)',
    'check-18 world-X -2 → -2 * request-start right.x',
    'added Z counterpart -2 * request-start right.z',
  ],
  retained:
    '32 cm signed Y gap, all other checks, 1 mm tolerances, unsupported physical stability caveat and normal save guard',
  sourceValues: {
    diameter: {
      value: 70,
      unit: 'cm',
      quote: 'circular turntable 70 cm across',
    },
    top: { value: 24, unit: 'cm', quote: 'its top 24 cm above the floor' },
    gap: {
      value: 32,
      unit: 'cm',
      quote:
        'Leave exactly 32 cm clear between the turntable top and the underside of the light panel',
    },
    left: { value: 2, unit: 'm', quote: 'two meters to the left' },
  },
  calculation:
    'metres: diameter=70/100; top=24/100; gap=32/100; box center Y=top+gap/2=0.40; full size=(0.70,0.32,0.70); X/Z offsets=-2*captured right components',
  frame:
    'world XYZ, Y up; request-start camera basis for left, fixed for entire request',
  limitations:
    'Box encloses the turntable footprint and proves sufficient empty space only when it passes. No approach/insertion path is specified. Circle-exterior corner occupancy needs separate assessment; do not treat it as evidence of circular-space obstruction.',
});
try {
  // Retain the original verdict without changing any check.
  result.originalHost = await verifyCompletion(
    savedCriteria,
    empty(),
    original,
  );
  assert(!result.originalHost.canCommit);
  // Measured kernel test of a genuinely obstructed circle, plus a corner-only
  // control that exposes the square envelope's limitation explicitly.
  for (const [name, extra] of [
    ['valid', null],
    ['obstructed', obstruction],
    ['corner-only', corner],
  ] as const) {
    const candidate = extra
      ? (await applyPlan(original, asPlan([extra]), startFrame, true)).session
      : original;
    const report = await verifyCompletion(
        scannerCriteria(),
        empty(),
        candidate,
      ),
      circle = await circularOccupancy(candidate);
    const entry = { name, report, circle };
    result.cases.push(entry);
    save(join(folder, `${name}-geometry.json`), entry);
    if (name === 'valid') {
      assert(report.canCommit);
      assert(circle.occupiedM3 < 1e-9);
    } else if (name === 'obstructed') {
      assert(!report.canCommit);
      assert(circle.occupiedM3 > 1e-6);
    } else {
      assert(!report.canCommit);
      assert(circle.occupiedM3 < 1e-9);
    }
  }
  // The saved world-X correction is not a camera-left displacement. Check it
  // under the same consistent frame criteria without reinterpreting the request.
  const world = (
    await applyPlan(
      original,
      asPlan([{ type: 'position', targets: [cube.id], x: -2, y: 0, z: 0 }]),
      startFrame,
      true,
    )
  ).session;
  result.worldXVariant = await verifyCompletion(
    scannerCriteria(),
    empty(),
    world,
  );
  assert(!result.worldXVariant.canCommit);
  // Independent rotated request frames demonstrate the same vector contract.
  result.rotatedFrames = [];
  for (const angle of [31, 123]) {
    const a = (angle * Math.PI) / 180,
      frame = {
        ...startFrame,
        pose: {
          ...startFrame.pose,
          position: {
            x:
              -Math.sin(a) *
              Math.hypot(
                startFrame.pose.position.x,
                startFrame.pose.position.z,
              ),
            y: startFrame.pose.position.y,
            z:
              Math.cos(a) *
              Math.hypot(
                startFrame.pose.position.x,
                startFrame.pose.position.z,
              ),
          },
        },
        right: { x: Math.cos(a), y: 0, z: Math.sin(a) },
        forward: { x: Math.sin(a), y: 0, z: -Math.cos(a) },
      };
    const s = (
      await applyPlan(
        empty(),
        savedBuild,
        frame,
        true,
        trace.events[1].input.scene.design.notes[0].decision.origin,
      )
    ).session;
    const r = await verifyCompletion(scannerCriteria(frame), empty(), s);
    assert(r.canCommit);
    result.rotatedFrames.push({
      angle,
      frame,
      expected: { x: -2 * frame.right.x, z: -2 * frame.right.z },
      actual: object(s, 'Separate storage cube').position,
      canCommit: r.canCommit,
    });
  }
  // Normal browser, real transaction and save guard. The saved build operations
  // remain unchanged except the deliberately injected obstructing solid.
  for (const name of ['valid', 'obstructed'] as const) {
    const local = join(folder, `browser-${name}`);
    let capturedFrame: any;
    const h = await openBrowser(
      local,
      empty(),
      [],
      (input, event) => {
        stopOnFeedback(input);
        capturedFrame ??= input.scene.camera;
        assert(equalData(input.scene.camera, capturedFrame));
        if (event === 0) {
          const p = structuredClone(savedBuild);
          if (name === 'obstructed') p.operations.push(obstruction);
          return p;
        }
        return savedFinish;
      },
      (input) => {
        assert(equalData(input.scene.camera, capturedFrame));
        return scannerCriteria(capturedFrame);
      },
    );
    try {
      const t = await h.send(name, prompts[0]);
      h.result.committed = t.committed;
      if (name === 'valid') {
        assert(t.committed);
        h.result.measurements = await inspectSolids(
          1,
          t.before,
          t.after,
          capturedFrame,
        );
        assert(h.result.measurements.fullyMeasured);
        h.result.history = await h.history(t.before, t.after, name);
        await h.exportProject('validated-scanner-offline');
      } else {
        assert(!t.committed);
        assert(equalData(state(t.before), state(t.after)));
        const feedback = h.result.events.find(
          (e: any) => e.input.validationFeedback,
        )?.input.validationFeedback;
        h.result.feedback = feedback;
        assert(
          feedback?.verification?.checks.some(
            (c: any) => c.id === 'check-12' && c.outcome === 'incorrect',
          ),
        );
        h.result.blockType = 'MEASURED_GEOMETRY_REJECTION';
        h.result.reload = await h.reload(t.after);
      }
      h.result.status = 'PASS';
      result.cases.push({
        name: `browser-${name}`,
        committed: t.committed,
        status: 'PASS',
        blockType: h.result.blockType,
      });
    } catch (error) {
      h.result.status = 'FAIL';
      h.result.error = String(error);
      throw error;
    } finally {
      await h.close();
      publish();
    }
  }
  result.status = 'PASS';
} catch (error) {
  result.status = 'FAIL';
  result.error = String(error);
  process.exitCode = 1;
} finally {
  publish();
  console.log(
    JSON.stringify({
      status: result.status,
      cases: result.cases.map((c: any) => ({
        name: c.name,
        status: c.status,
        canCommit: c.report?.canCommit,
        committed: c.committed,
      })),
      error: result.error,
      paidCalls: 0,
    }),
  );
}
