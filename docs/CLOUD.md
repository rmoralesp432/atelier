# Cloud operation

Use the existing checkout at `/workspace/atelier`. Each cloud task is already isolated; do not create a Git worktree unless the user explicitly requests it.

Run `bash scripts/cloud-setup.sh` from the repository to refresh the locked dependencies, run model tests and build. The script places npm's cache in `/workspace/.npm-cache` because the home directory can be read-only. Dependencies and `dist/` can survive an environment snapshot. Running processes cannot be assumed to survive.

Start the development service with `bash scripts/cloud-start.sh` from `/workspace/atelier` and retain its terminal session. It binds port 5173 on all interfaces with a strict port check. If the port is already occupied, identify the owner; do not kill unrelated services. Reuse the existing ATELIER server if it is healthy.

Verify an HTTP request to the local service returns the ATELIER HTML and the React entry module. Then run `PLAYWRIGHT_BROWSERS_PATH=/workspace/.playwright-browsers npm run test:e2e`; the tests start their own service on port 4173. A PID or successful HTTP response alone does not verify 3D interaction. Chromium is available at `/usr/bin/chromium` in the validated instance. If unavailable, setup downloads Playwright Chromium; its host libraries must also be available.

The application does not require secrets, API credentials, or runtime environment variables. Package installation uses the npm registry. The app itself uses bundled assets and system fonts and does not call third-party APIs.

Keep logs and generated artifacts in ignored locations. Local storage belongs to the browser, not the repository or cloud filesystem snapshot. Use project JSON export/import to move user models between browsers and origins.

This onboarding UI has no supported public web preview. A remote Vite service cannot be opened through the desktop's loopback address. Use the GitHub Pages procedure in the README or run a local checkout on the desktop. The Pages workflow has not been executed merely by creating it; publishing requires the user's explicit workflow action.
