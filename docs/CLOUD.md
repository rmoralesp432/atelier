# Cloud operation

Use the existing checkout at `/workspace/atelier`. Each cloud task is already isolated; do not create a Git worktree unless the user explicitly requests it.

Run `bash scripts/cloud-setup.sh` to refresh locked dependencies, run tests and build. npm's cache is placed in `/workspace/.npm-cache` because the home directory can be read-only. Dependencies and `dist/` can survive a snapshot; live processes cannot be assumed to survive.

Start `bash scripts/cloud-start.sh` in a retained terminal session. It now starts the combined Express/Vite application on port 5173, not a frontend-only service. Identify any existing port owner before replacing it; stop only an ATELIER service you started. Validate `/api/config` as well as the ATELIER HTML. Missing credentials must return `configured:false`; that does not prevent direct geometry editing. `/api/plan` must return a clear 503 when no provider is configured.

`ATELIER_OPENAI_API_KEY` is a server-only credential requirement for `api.openai.com`. Configure it securely in environment settings, allow that destination, and restart the app. Existing proxy and CA trust must be preserved. The current onboarding session has no configured key, so live text and voice cannot be claimed ready. Do not ask for the key in chat. Never copy it into a tracked file, browser storage, Vite build variable, logs or an exported model.

Run `npm test`, `npm run build`, and `PLAYWRIGHT_BROWSERS_PATH=/workspace/.playwright-browsers npm run test:e2e`. Run `ATELIER_TEST_PRODUCTION=1 PLAYWRIGHT_BROWSERS_PATH=/workspace/.playwright-browsers npm run check` for production assets. Run `npm run test:pages` after building to exercise the Pages prefix and bundled WASM. Contract tests use provider doubles explicitly; only `npm run test:live-ai` tests actual provider interpretation. A missing key or required clarification produces exit code 2, not a passing live check.

The application server uses Node.js 24. Chromium is available at `/usr/bin/chromium` in the validated instance. If unavailable, the setup script installs a Playwright browser; required host libraries must also be present. Real voice additionally needs HTTPS, browser microphone permission and a real WebRTC/media path to the provider. It cannot be certified by a PID, schema test or a simulated microphone.

Keep generated artifacts in ignored directories. Version-1 project data stays under its original local-storage key. Version-2 sessions and conversation history live in separate keys. Browser data is not part of a cloud filesystem snapshot; export JSON to move models across origins or browsers.

This onboarding UI has no supported public preview. Follow [browser-only hosting](HOSTING.md) to deploy the combined Node application behind HTTPS. The repository's Render blueprint prepares this service; an account and a server-side API key are still required. GitHub Pages can only serve the static geometry workspace; its manual workflow must not be presented as deploying the API backend. Production AI access requires `ATELIER_APP_PASSWORD`. The public origin is read automatically from Render's `RENDER_EXTERNAL_URL`; custom domains or other proxies require `ATELIER_ORIGIN`.

Production browser checks now start the actual Node server with `npm start`, exercising `/healthz`, `/api/config`, the honest missing-key response, and built browser assets together. Provider tests still use explicit doubles and do not certify live model/audio access. The hosting changes are on `feat/phase2-conversational-modeling`; `main` remains Phase 1 until merged. Existing saved cloud setup commands remain valid.
