/** Read-only export of actual committed live results; no model generation. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { projectFile, readProjectCopy } from '../src/projects/transfer';
import { parseSession, serializeSession } from '../src/intelligence/engine';
import { equalData } from '../src/projects/equalData';
const root = '/workspace/atelier-campaign/.cloud/workshop-campaign',
  out = 'docs/evaluations/workshop-reliability/recovery/live/models';
mkdirSync(out, { recursive: true });
for (const id of process.argv.slice(2)) {
  const marker = id.includes('-baseline-') ? '-baseline-' : '-reliability-';
  const batch = id.slice(0, id.indexOf(marker)),
    folder = join(root, batch);
  const rows = JSON.parse(readFileSync(join(folder, 'results.json'), 'utf8'));
  const result = rows.find((r: any) => r.id === id);
  assert(result?.committed, 'Only actual committed results may be exported');
  const saved = JSON.parse(
    readFileSync(join(folder, id + '-after.json'), 'utf8'),
  );
  const file = projectFile(
    { session: serializeSession(saved), messages: result.conversation },
    id,
  );
  const text = await file.text(),
    restored = parseSession(readProjectCopy(text).session);
  assert(equalData(restored.project.volumes, saved.project.volumes));
  assert(equalData(restored.project.groups, saved.project.groups));
  assert(equalData(restored.past, saved.past));
  assert(equalData(restored.future, saved.future));
  writeFileSync(join(out, file.name), text);
  console.log(
    id,
    saved.project.volumes.length,
    'editable objects; geometry, groups and history exact after export/read',
  );
}
