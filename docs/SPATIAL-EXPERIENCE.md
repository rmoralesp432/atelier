# ATELIER — assembled architecture, sun studies and voice companion

This update builds on the deployed intelligence work. It preserves saved projects, the existing backend, API configuration, modeling history and import limits.

## What changed in this update

### Exploded axonometric

- Façade components now leave their own side of the building, perpendicular to their thin dimension. Windows do not all move in the same direction.
- Each façade displacement uses one local horizontal axis. Floors and roofs move vertically; the assembly guides connect directly to the original locations. Rotated assemblies retain their local axes, so an axis can naturally look diagonal in an axonometric projection.
- Nearby floor footprints provide the reference, preventing an offset terrace or distant second building from reversing the façade direction. Hosted parts follow their host. Trees and people stay put.
- Exploding remains a reversible presentation state; it does not move saved geometry. Reassemble restores the ordinary view.

### Separate editable construction

The AI tool catalog now offers `building_components` for ordinary floor-and-glass construction. The old combined-building operation remains compatible with existing local controls and recipes but is no longer offered to the provider as the default construction shortcut.

The operation generates independent slabs, a roof, glazing and frame members, with stable identities, component roles, levels and a shared group. A pane can be selected and recolored without recoloring the rest. Creation is one transaction and one Undo. Existing combined buildings can still be separated with the component tools. Custom and unequal-height buildings use the existing generic assembly/profile operations.

This is geometric modeling, not automatic structural design. The existing 200-object workspace budget remains; a construction that would exceed it fails clearly rather than silently dropping parts. Imported models are not automatically decomposed into semantic BIM components.

### Seasonal sun diagram

- Added a curved seasonal band, date arcs, civil-hour curves and horizon ring, using the same astronomical calculation and true-north transform as the light.
- Equinox/solstice buttons now select solar noon on the chosen date. Previously a midnight slider value could leave the sun below the horizon and make the disk disappear.
- Added a **Sun disk size** slider from 0.5× to 4×. This changes the diagram marker, not solar intensity or the physical shadow direction.
- Seasonal geometry is cached while changing the time of day. The diagram uses actual site coordinates and the chosen UTC offset, including any daylight-saving adjustment supplied by the user. Polar night can legitimately have no visible sun.

Open **Tools → Sun**. Enable **Show sun path** and **Compare solstices & equinoxes** for the full diagram. This remains a directional solar study, not an energy simulation or a terrain-shadow certification.

### Welcome screen

ATELIER now opens with a quiet project entrance before loading the 3D workspace. Choose **Continue with AI** using the existing workspace password, or **Continue without AI**. The password is not an API key and is not saved in browser storage by this screen.

Choose an existing project, resume the current workspace, make an editable sample copy, or name a blank project. With AI enabled, the glass orb appears and **Talk to Atelier** starts the real voice connection. The project concierge receives the available project names and IDs and can open only a listed choice. Microphone access and paid voice activity begin only after that explicit action. Opening the screen or enabling AI alone does not start a model call.

The entrance retains a lightweight list of project names and loads the chosen saved project on demand, avoiding retention of every project's geometry and history just to display the list.

The optional **Open my last project directly next time** preference skips this entrance. AI settings include a way to restore it. Projects remain stored in the current browser; this screen does not introduce cloud synchronization.

### Audio-reactive orb and minimized conversation

- With AI enabled, minimizing conversation leaves a compact glass orb, microphone control and typing button.
- Real microphone and assistant-output streams feed a Web Audio analyser. Measured energy drives the orb; a distinct thinking animation represents processing. Silence is not portrayed as speech.
- Clarification questions remain accessible in a small popup with a text reply; the same voice session can answer them. Destructive-change review remains available before applying the edit.
- The full conversation shows a smaller orb during activity. Reduced-motion preferences are respected; the orb uses CSS rather than a second 3D renderer.
- Stopping voice or leaving the welcome screen releases audio resources. The existing password protection, server-side keys and shared text/voice modeling engine remain in use.

## Consolidated summary of the preceding intelligence improvements

These changes were implemented in the earlier merged releases and are retained here; they are not new features introduced by the orb update.

1. **Staged construction:** complex instructions can be built privately in multiple steps, with actual resulting object IDs and measurements returned to the planner. Only a completed result enters the project, with one Undo. Cancellation or failure leaves the original intact.
2. **Architectural assemblies and context:** independently editable members, roles, levels, groups, host relationships and scoped queries; correct host remapping for copies/arrays; retained design notes and construction recipes; up to six reference images sent together.
3. **Expanded geometric tools:** arbitrary profile solids and I-sections, same-identity profile replacement, circular/elliptical wall cuts, fitted independent glass and annular frames, revolved shells and oculi, unequal level schedules, progressive arrays, anchored resizing and checked bridge landings. Existing sweeps, lofts, extrusion and true Manifold Booleans remain available.
4. **Intent verification:** a retained design brief declares editable objects, protected properties, assumptions and measurable completion criteria. The engine independently checks counts, dimensions, elevations, layouts, profiles, materials and genuine solid relationships. Incorrect or incomplete proposals return measured feedback for bounded correction instead of being called complete.
5. **Reasoning guidance:** distinguishes grid lines from bays, radius from diameter, floor-to-floor from clear height, two tall stories from one double-height void, an opening from its glass, and geometric steel substitutions from structural equivalence. Documented drawing dimensions and assumptions are kept separate.

Detailed coverage and limitations: [Intelligence sprint](INTELLIGENCE-SPRINT.md), [Volumetric intelligence](VOLUMETRIC-INTELLIGENCE.md), [Design reasoning](DESIGN-REASONING.md). Existing interface and phone interaction work is documented in [Interface refinement](INTERFACE.md), [Interaction refinement](INTERACTION-REFINEMENT.md) and [Explore design](EXPLORE-DESIGN.md).

## Verification and remaining boundaries

Automated tests execute actual geometry for component construction, rotated outward explosion, independent pane editing, save/reload and Undo. Solar tests check curved above-horizon paths, true-north rotation and seasonal noon. Provider-schema tests check the component-first catalog and constrained project-opening tool. Voice lifecycle tests verify cleanup and rejection of unlisted project IDs.

Production browser tests exercise desktop/phone entry, existing project management, real rendering, component construction, solar presets and disk sizing, the orb and minimized clarification replies. The audio test feeds a generated audio stream through the real Web Audio analyser; its Realtime transport is an explicit fixture. This tests audio reactivity, not live provider speech.

Local release checks passed: **276 unit/integration tests across 63 files**, **18 distinct production browser scenarios**, TypeScript/Vite production build, repository formatting and whitespace checks. The final startup checks also reopen an inactive project from the lightweight project list and enable AI after manual entry before changing projects.

**No live OpenAI language, vision or voice calls were made for this update, as requested.** Flexible-language accuracy, the spoken project concierge and physical iPhone microphone behavior still need the user's API-enabled trial. The engine is not an unrestricted CAD/BIM intelligence, and it cannot guarantee that a model-generated brief perfectly captures every request or reference image.

This release does not claim new native-iPhone AR fidelity, large-OBJ AR stability, survey-grade terrain, or cloud project storage. Those require their own validation and are not masked by the interface improvements.
