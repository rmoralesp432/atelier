import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import type { Session } from '../../src/intelligence/engine';
import type { CompletionCriteria } from '../../src/intelligence/completionSchema';
import type { Plan } from '../../src/intelligence/plan';
import { savedStaggeredRelationship } from './calculations';

/** Read immutable, already-published real-AI evidence; no network or new model call. */
export function savedRepair() {
  const archive =
    'docs/evaluations/phase3-baseline/evidence/phase3-baseline-evidence.tar.gz';
  const hashes: Record<string, string> = {};
  const read = (name: string) => {
    const raw = execFileSync('tar', ['-xOzf', archive, `live/${name}.json`], {
      maxBuffer: 16 * 1024 * 1024,
    });
    hashes[name] = createHash('sha256').update(raw).digest('hex');
    return JSON.parse(raw.toString());
  };
  const original: Session = read('R1-attempt-2-stage-0');
  const injected: Session = read('R1-attempt-2-injected');
  const repaired: Session = read('R1-attempt-2-stage-8');
  const correctBefore: Session = read('R1-attempt-2-before-injection');
  const record = read('results').find((r: any) => r.id === 'R1-attempt-2');
  const legacy: CompletionCriteria = record.events.find(
    (e: any) => e.kind === 'reviewer',
  ).response;
  const derived = structuredClone(legacy);
  derived.checks.find((c) => c.requirement.id === 'check-5')!.calculation =
    savedStaggeredRelationship();
  return {
    original,
    injected,
    repaired,
    correctBefore,
    legacy,
    derived,
    hashes,
    prompt: record.prompt as string,
    injection: record.injection,
    creationPlan: record.events.find((e: any) => e.kind === 'executor')
      .response as Plan,
  };
}
