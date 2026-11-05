import { it, expect } from 'vitest';
import { audioEnergy } from './audioMeter';
it('audio energy is silent at rest, responds to real samples, and is bounded', () => {
  expect(audioEnergy(new Float32Array(512))).toBe(0);
  const quiet = new Float32Array(512).fill(0.025),
    loud = new Float32Array(512).fill(0.2);
  expect(audioEnergy(loud)).toBeGreaterThan(audioEnergy(quiet));
  expect(audioEnergy(new Float32Array(512).fill(1))).toBe(1);
  expect(audioEnergy(new Float32Array())).toBe(0);
});
