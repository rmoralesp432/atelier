# Hide and show objects

Open **Objects** and click the eye beside an object to hide or show it. Hidden rows stay in the list with a Hidden label, so they remain easy to find by name.

For several objects, turn on **Select several**, select their rows, then choose **Hide selected**. A **Hide** button also appears in the selected-object toolbar. **Show all** in Objects restores every object and layer, even if the current search filter hides some rows.

Visibility is saved with the project and can be undone/redone. It does not delete objects, change their IDs, unlock layers, or change their geometry. Showing one object in a hidden layer reveals only that object; its siblings remain hidden. Show all restores the whole scene. Locked objects can be hidden or shown without allowing geometry edits.

Hidden geometry is excluded from the viewport, selection glow/handles, OBJ export and AR snapshots. A complete project backup retains it. Imported older projects remain visible by default.

The shared text/voice plan schema supports `visibility` and `show_all`; scene context includes each object's effective visibility. Examples of intended conversational requests are “hide these”, “show it again”, and “show everything.” The deterministic operations and contextual references are tested; no paid live-model or microphone calls were made for this update.
