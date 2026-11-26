/** Replay already-paid responses only when the actual engine recreated the same scene. */
import assert from 'node:assert/strict';

function ids(input: any) {
  return new Map<string, string>([
    ...input.scene.objects.map((o: any, i: number) => [o.id, `object:${i}`]),
    ...input.scene.groups.map((g: any, i: number) => [g.id, `group:${i}`]),
  ]);
}
function replace(value: any, mapping: Map<string, string>) {
  return JSON.parse(
    JSON.stringify(value, (_key, v) =>
      typeof v === 'string' ? (mapping.get(v) ?? v) : v,
    ),
  );
}
export function assertReplayScene(expected: any, actual: any) {
  assert.equal(actual.message, expected.message, 'Replay instruction changed.');
  for (const key of ['objects', 'groups', 'units'])
    assert.deepEqual(
      replace(actual.scene[key], ids(actual)),
      replace(expected.scene[key], ids(expected)),
      `Replay scene ${key} changed.`,
    );
}
export function replayResponse(expected: any, actual: any, response: any) {
  assertReplayScene(expected, actual);
  const actualIds = new Map(
    [...ids(actual)].map(([id, canonical]) => [canonical, id]),
  );
  const mapping = new Map(
    [...ids(expected)].map(([id, canonical]) => [
      id,
      actualIds.get(canonical)!,
    ]),
  );
  return replace(response, mapping);
}
