# Quiet studio update

## Six requested changes

1. **Moving companion:** one soft inner form, with no outer sphere, rim or nested glass shell. Its wavy contour continuously folds and relaxes, using native SVG morphing and gentle CSS motion. Actual microphone/output levels add audio response only during voice use. No microphone or paid request starts automatically. The device's Reduce Motion preference is respected.
2. **Minimal welcome:** a shared geometric, rune-like A replaces the serif letter in the welcome screen, workspace and favicon. The welcome has one heading, moving orb and Open studio button; AI settings remain in the corner. New project stays above existing projects. The password popup closes when entry succeeds.
3. **Minimized conversation:** the moving orb replaces the chat bubble in both manual and AI modes. Tap the orb to type. When voice is available a compact microphone control stays beside it; live questions and confirmations retain their existing reply/review flow. The microphone target is 44 pixels.
4. **Moodboard removed:** no menu, viewport overlay, lazy viewer bundle or AI workspace command is offered. Existing project attachments remain in saved/imported/exported project data; they are not deleted. Conversation reference-image uploads and panorama imports remain available.
5. **Volumetric interpretation:** shared text/voice planning instructions explicitly permit abstract massing. Preserve major wings, height hierarchy, relative proportions, silhouette, dominant roof forms, setbacks and courtyard/through-voids with a small editable composition. Do not automatically create every slab, column, window and frame. Detailed components remain available when requested. Approximate scale/depth must be stated; measured reconstruction and exact landmarks are not implied. Conflicting default instructions demanding detailed components in every building were corrected.
6. **Sun study without its menu:** choose **Sun → Watch in viewport**, or play the study and close its panel. Playback belongs to the workspace and continues with the panel closed. A small time/play/settings/stop control remains over the viewport. Reopening settings retains the time. Pausing or stopping does not edit geometry. Animation skips hidden-tab updates and stops if the site or solar lighting becomes unavailable.

## Verification and limits

All 292 unit tests and the production build pass. The static-site smoke test also passes at the /atelier/ path, including actual solid rendering, direct edits, reload persistence, FBX/panorama imports and worker-prepared AR export. Browser checks cover desktop/phone welcome, idle motion over time with no paid calls, real Web Audio levels through an offline voice transport, minimized questions/replies, preserved legacy attachments through import/save/reload/export, and actual solar altitude/time progression after closing the settings panel.

Live OpenAI interpretation and physical iPhone microphone/AR behavior were not tested. The massing update changes the actual model's instructions; a fixture is not proof that every reference will be interpreted correctly. No API key, billing or hosting configuration was changed.

Try: “Make a simplified volumetric interpretation of this building. Keep its silhouette, proportions, stepped roof and main courtyard; omit windows, frames and structural detail. Use an approximate overall width of 30 meters.” Attach a reference or identify the intended building. Then: “Simplify it further while keeping the courtyard and overall height.”

## Browser review

- [Welcome on iPhone-sized viewport](screenshots/quiet-studio/quiet-welcome-phone.png)
- [Minimized conversation](screenshots/quiet-studio/quiet-orb-phone.png)
- [Sun study with the menu closed](screenshots/quiet-studio/quiet-sun-phone.png)
- [Desktop welcome](screenshots/quiet-studio/quiet-welcome-desktop.png)
