import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['scripts/design-decision-live/*.test.ts'], maxWorkers: 1 },
});
