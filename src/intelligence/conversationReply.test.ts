import { expect, it } from 'vitest';
import { directPlan } from './engine';
import { displaySummary } from './conversationReply';

it.each([false, true])(
  'does not promote an invented measurement to a displayed/spoken answer (agent=%s)',
  (agent) => {
    const measured = {
      ...directPlan({
        type: 'measure',
        targets: ['$focus'],
        metric: 'properties',
      }),
      message: 'There are 9999 cubic metres.',
    };
    const receipt = 'Material volume 250 m³';
    expect(displaySummary(measured, agent)).toBeUndefined();
    expect(displaySummary(measured, agent) ?? receipt).toBe(receipt);
  },
);
it('keeps a natural agent completion for a modeling turn even when it includes measurement', () => {
  const plan = directPlan({
    type: 'create',
    shape: 'box',
    width: 5,
    depth: 5,
    height: 10,
    count: 1,
  });
  plan.operations.push({
    type: 'measure',
    targets: ['$created'],
    metric: 'properties',
  });
  plan.message = 'Your study is ready.';
  expect(displaySummary(plan, true)).toBe(plan.message);
});
