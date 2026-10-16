import { expect, it } from 'vitest';
import { constructionFrame } from './construction';

it('traces a footprint before rising, then settles at exact full height', () => {
  expect(constructionFrame(-100).height).toBe(0.002);
  expect(constructionFrame(150)).toMatchObject({
    phase: 'footprint',
    height: 0.002,
    done: false,
  });
  expect(constructionFrame(150).trace).toBeGreaterThan(0);
  expect(constructionFrame(1700).phase).toBe('extruding');
  expect(constructionFrame(1700).height).toBeGreaterThan(0.2);
  expect(constructionFrame(1700).height).toBeLessThan(1);
  expect(constructionFrame(3000)).toMatchObject({
    height: 1,
    trace: 1,
    opacity: 1,
    guideOpacity: 0,
    done: true,
  });
  let previous = 0;
  for (let t = 0; t < 4000; t += 25) {
    const frame = constructionFrame(t);
    expect(frame.height).toBeGreaterThanOrEqual(previous);
    expect(frame.height).toBeLessThanOrEqual(1);
    previous = frame.height;
  }
});
