#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# The cloud home directory may be read-only. Keep npm's cache in the workspace.
npm ci --cache /workspace/.npm-cache --no-audit --no-fund
npm test
npm run build
if ! command -v chromium >/dev/null 2>&1 && [ -z "${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-}" ]; then
  PLAYWRIGHT_BROWSERS_PATH=/workspace/.playwright-browsers npx playwright install chromium
fi
