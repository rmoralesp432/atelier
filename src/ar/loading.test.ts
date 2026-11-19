import { expect, it } from 'vitest';
import { isModuleLoadError } from './loading';
it('recognizes browser module failures without masking geometry or device errors', () => {
  for (const message of [
    'Importing a module script failed.',
    'Failed to fetch dynamically imported module: https://example.test/assets/model-old.js',
    'error loading dynamically imported module',
    'Unable to preload CSS for /assets/old.css',
  ])
    expect(isModuleLoadError(new TypeError(message))).toBe(true);
  for (const message of ['Invalid mesh', 'Permission denied', 'Out of memory'])
    expect(isModuleLoadError(new Error(message))).toBe(false);
});
