# Activate AI and voice from your browser

ATELIER can run as one Render Node web service: the React/Three.js app, private OpenAI planner and voice-session endpoint share one HTTPS address. No local server, database or separate frontend deployment is needed. GitHub Pages remains available for static modeling but cannot host these API endpoints.

The repository contains `render.yaml`, with Node 24, a tested build command, health check, manual future deploys and an automatically generated workspace password. It deploys `feat/phase2-conversational-modeling`, which contains the existing Phase 2 implementation. **Do not select `main` yet; it still contains Phase 1.**

## Browser-only setup

1. **Preserve your project:** open your existing ATELIER workspace and export its project JSON. Browser storage belongs to that exact website; it does not automatically move to the new address. Keep the export and original website until you have imported and checked it on the new service.
2. **Create an OpenAI API key:** sign into [OpenAI Platform](https://platform.openai.com/api-keys), select/create a project, enable API billing and create a secret key for that project. It needs access to the Responses and Realtime APIs (`gpt-4.1` and `gpt-realtime` by default). ChatGPT subscriptions do not include API usage. Store the key in your password manager; never paste it into chat, GitHub or the ATELIER input.
3. **Create the hosted service:** sign into [Render](https://dashboard.render.com/), choose **New → Blueprint**, and connect GitHub. Grant Render access to `rmoralesp432/atelier`. Select that repository and the **`feat/phase2-conversational-modeling` branch**, using `render.yaml` at the repository root. If the repository is private, connecting GitHub is required.
4. **Enter the one required secret:** in the Blueprint setup, enter your key for **`ATELIER_OPENAI_API_KEY`**. Review the service plan and select **Deploy/Apply**. The blueprint requests the Free plan for testing; free services can sleep when idle and have usage limits. Choose a paid plan only if you want it; OpenAI usage is billed separately. Render generates `ATELIER_APP_PASSWORD` automatically.
5. **Open ATELIER:** wait until the service reports a successful deploy, then use the **HTTPS URL displayed on its service page**. This is the actual application address. The exact hostname is assigned by Render and cannot be confirmed before creation. Under the service's **Environment** settings, reveal/copy `ATELIER_APP_PASSWORD`. In ATELIER, click **Unlock AI**, enter that workspace password and choose **Unlock workspace**. Never enter the OpenAI API key in ATELIER.
6. **Verify text and voice:** type “Create two boxes,” then “Move the second one to the right” and “Make it taller.” Check actual geometry and reported dimensions. Click the microphone, allow browser microphone access and speak a modeling request. Check that the geometry changes, then stop the microphone. Import your saved project JSON when ready.

If the Blueprint flow does not offer branch selection, use **New → Web Service**, connect the same repo, and select `feat/phase2-conversational-modeling`. Choose Node and the Free plan; set build command `npm ci --include=dev && npm test && npm run build`, start command `npm start`, health check `/healthz`, and environment values `NODE_VERSION=24.19.0`, `NODE_ENV=production`, your `ATELIER_OPENAI_API_KEY`, and a long unique `ATELIER_APP_PASSWORD` from your password manager. Keep other model defaults. No terminal commands are required on your computer.

## What is automatic and what is verified

Render supplies `PORT` and `RENDER_EXTERNAL_URL`. The server binds to all interfaces and recognizes that public HTTPS origin automatically. No manual CORS setting or exposed client key is needed. For a custom domain, set `ATELIER_ORIGIN` to its exact HTTPS origin, with no path, and redeploy. Use that address consistently.

The backend exchanges WebRTC session offers with OpenAI; browser audio uses the provider's WebRTC connection. Text and spoken modeling requests share the same validated planner and geometry engine. The microphone needs HTTPS, permission and a network that permits WebRTC. The workspace password protects access to the paid APIs. Sessions last eight hours and reset on server restart; project geometry remains in browser storage.

`/healthz` checks server availability; `/api/config` reports whether a key is configured and the browser is authenticated. Neither proves that a key is valid, billing is enabled, a model is accessible or microphone audio works. Automated tests cover production startup, proxy-origin handling, authenticated API contracts, geometry and browser interactions. **A live hosted deployment and actual AI/audio require the account/key steps above and have not been verified in this cloud session.**

After setup, share only the public application URL with Codex for follow-up verification. Do not share the key or workspace password in chat. If you also want live model tests in Codex, configure `ATELIER_OPENAI_API_KEY` securely in Codex environment settings with access to `api.openai.com`; this is separate from Render's secret. The repository provides `npm run test:live-ai` for that check.

## Troubleshooting and updates

- **Build fails:** confirm the selected branch, Node 24, and `npm ci --include=dev` so TypeScript/Vite are installed even with production mode enabled. Check Render's deploy logs.
- **Connect AI instead of Unlock AI:** confirm the key is set on the Node service, then redeploy. A Pages URL has no backend.
- **Unlock request fails:** use the generated workspace password, not the API key. Check the public URL; custom domains require the matching `ATELIER_ORIGIN`.
- **Text reports a model error:** check OpenAI project billing and model access. Adjust `ATELIER_TEXT_MODEL` if necessary to an available model supporting strict structured outputs. Redeploy after environment changes.
- **Voice fails:** first verify text, then microphone permission, HTTPS, Realtime model access and browser/network WebRTC support. Try desktop Chrome on a network that allows audio calls. Do not interpret an enabled microphone button as proof of a successful conversation.
- **First load is slow:** a free service may be waking from idle. Keep the service's status page open until it is ready.
- **Future updates:** this blueprint disables automatic deployment. Use Render's **Manual Deploy → Deploy latest commit** after changes have passed tests. If the feature branch is merged and later removed, update the Render service branch and blueprint to `main`. Roll back through Render's deployment history if needed; export project JSON before opening a different app version.

Terrain development is unchanged and remains deferred.
