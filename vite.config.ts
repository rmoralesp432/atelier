import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: './',
  worker: { format: 'es' },
  test: {
    include: ['src/**/*.test.ts'],
    // Each geometry test file initializes its own WASM solid-modeling kernel.
    // Bound concurrent kernels on small CI/Render hosts; retain test timeouts
    // and geometric assertions instead of masking contention with retries.
    maxWorkers: 1,
  },
});
