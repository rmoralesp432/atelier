import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      args: [
        '--no-sandbox',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
      ],
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: process.env.ATELIER_TEST_PRODUCTION
      ? 'npm start -- --port 4173'
      : 'npm run dev -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    env: {
      ATELIER_OPENAI_API_KEY: '',
      ATELIER_APP_PASSWORD: '',
      ATELIER_ORIGIN: '',
      RENDER_EXTERNAL_URL: '',
    },
  },
});
