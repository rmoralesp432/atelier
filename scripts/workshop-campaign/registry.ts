import * as recovery from './recovery';
import * as base from './geometry';
import * as transfer from './transfer';
export { seed, arcPoints, pass, wrong } from './geometry';
const extra = (id: string) => ['W5', 'W6'].includes(id);
export const referenceScene = (id: string) =>
  extra(id) ? transfer.fixture(id) : base.referenceScene(id);
export const oracle = (
  id: string,
  initial: any,
  before: any,
  after: any,
  edit = false,
) =>
  id === 'D-R1'
    ? recovery.oracle(initial, before, after, edit)
    : extra(id)
      ? transfer.oracle(id, initial, before, after, edit)
      : base.oracle(id, initial, before, after, edit);
