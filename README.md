# ATELIER

A desktop architectural massing workspace built with React, TypeScript, and Three.js. Create exact rectangular volumes, orbit a real WebGL scene, select and manipulate objects, and edit geometry with typed commands.

## Open the actual application in a desktop browser

The Codex Cloud terminal and browser tests run on a remote machine. A port printed by Vite in that terminal is **not** a public website, and opening your own computer's localhost does not reach the cloud server. This onboarding session does not provide a public preview or port-forwarding URL.

To use a hosted version without installing anything on your desktop:

1. Commit and push the generated repository files to GitHub (or merge the Codex pull request into `main`). These files must be on GitHub before Actions can use them.
2. In `rmoralesp432/atelier`, open **Settings → Pages → Build and deployment → Source → GitHub Actions**. Repository administrator access is required. Pages availability for private repositories depends on the account plan; the published site may be public even if its source repository is private.
3. Open **Actions → Deploy ATELIER to Pages → Run workflow**, select `main`, and run it. This explicit action publishes the web app. The workflow runs tests and builds before deployment.
4. After the `deploy` job succeeds, open the **github-pages** deployment URL shown by GitHub. That is the actual interactive application. Use the URL GitHub reports; this setup does not claim the site is already deployed.

The Pages workflow verifies the production build, including a browser test under `/atelier/`. Vite uses `base: './'`, so scripts, styles and the favicon resolve under the project-site path. There is no client-side router requiring a Pages rewrite.

The Pages workflow runs only when manually triggered. It does not automatically publish on push. Model data remains in that browser's local storage; export JSON to back it up or transfer it to another browser.

Alternatively, on your desktop, install Node.js 24, clone this repository, then run:

```bash
npm ci
npm run dev
```

Open the local address printed by Vite **on that same desktop**. No API keys, database, or server-side services are required. A browser with WebGL2 enabled is required.

## Try the first modeling workflow

1. Explore the sample pavilion and annex: left-drag to orbit, right-drag to pan, scroll to zoom.
2. Select a volume by clicking it in the viewport or scene list. Click empty space to clear selection.
3. Click **Create volume**, or enter `create volume width 12 depth 8 height 6` in Command Studio.
4. Set exact width, depth, and height in the inspector; press Enter or blur a field to apply. Dimensions are in meters.
5. Press **G** (or click Move) and drag an axis handle. Press **R** for yaw rotation. **V** returns to selection. Snapping uses 0.5 m and 15°; toggle it off for finer dragging. Use the inspector for exact values.
6. Try `move selected x 4 y 0 z -2`, then `rotate selected 45`. Position is absolute, measured at the volume's base center. Y is up; X/Z form the ground plane.
7. Use **F** to frame all volumes or switch to **Top view** (a top-down perspective camera, not an orthographic drafting view).
8. Undo with Ctrl/⌘ Z, redo with Ctrl/⌘ Shift Z. Ctrl/⌘ D duplicates; Delete removes the selection. Ctrl/⌘ K focuses the command field.
9. Reload to confirm local persistence. **Export project** downloads JSON; **Import** restores it. Imports can also be undone.

## Command grammar

This first version uses a deterministic local parser, **not a connected language model**. It does not infer arbitrary natural language. The in-app Command guide offers executable examples.

```text
create volume width 12 depth 8 height 6
create box 12 x 8 x 6
move selected x 4 y 0 z -2
resize selected width 16 depth 10 height 8
rotate selected 45
duplicate selected
delete selected
```

Compact dimensions are width × depth × height. Commands are case-insensitive. Invalid or unsupported commands leave geometry unchanged. Dimensions must be 0.1–500 m, coordinates must be within ±1,000 m, and base elevation cannot be negative. Up to 200 volumes and 50 undo steps are supported. Overlapping volumes are allowed; gross footprint sums rectangles and does not compute their union. Rotation is yaw only. Handle edits are rounded to millimeters.

## Development and verification

Node.js 24 and npm are used; the lockfile is committed.

```bash
npm ci
npm test                 # geometry, command validation and project persistence
npm run build            # TypeScript check + optimized static build
npx playwright install chromium
npm run test:e2e          # launches Vite and checks the real app in Chromium
npm run check            # all of the above (browser must already be installed)
npm run test:pages       # verify dist at the GitHub Pages /atelier/ prefix
npm run preview          # serve the production build
```

Playwright automatically uses `/usr/bin/chromium` when present. Otherwise it uses the browser installed by Playwright. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to override. The headless tests enable Chromium's software WebGL renderer so the real Three.js render path runs on machines without a GPU. They are not Safari or hardware-GPU certification.

Browser tests cover WebGL rendering, orbit and top view, raycast selection, handle translation, exact inspector editing, commands, validation, undo/redo, reload persistence, and JSON import/export. Screenshots and failure traces are written under ignored `test-results/`.

In Codex Cloud:

```bash
bash scripts/cloud-setup.sh
PLAYWRIGHT_BROWSERS_PATH=/workspace/.playwright-browsers npm run test:e2e
bash scripts/cloud-start.sh
```

See [cloud operation notes](docs/CLOUD.md). All application code, scripts, tests, and workflows live in this repository. Generated dependencies and build artifacts are ignored.

See [recorded cloud validation and screenshot](docs/VALIDATION.md).

## First-version scope

Implemented: rectangular massing, selection, translation, yaw rotation, exact dimensions, local geometry commands, project persistence and export/import. Not implemented: remote AI inference, voice, BIM, terrain, collaboration, Boolean solids, or production engineering calculations. This is a concept-modeling tool, not certified CAD.
