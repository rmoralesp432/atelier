# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: completion-verification.spec.ts >> unknown verification permits safe additions with honest messaging, one Undo, and a later independently checked edit
- Location: tests/completion-verification.spec.ts:257:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 3
Received: 2

Call Log:
- Timeout 60000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - link "ATELIER home" [ref=e5] [cursor=pointer]:
      - /url: ./
    - button "Projects" [ref=e8] [cursor=pointer]:
      - generic [ref=e11]: Untitled study
    - button "Show objects" [ref=e12] [cursor=pointer]:
      - generic [ref=e17]: Objects
    - button "Create a 3D shape" [ref=e18] [cursor=pointer]:
      - generic [ref=e20]: Create
    - button "Explore design" [ref=e21] [cursor=pointer]:
      - generic [ref=e25]: Explore
    - button "Design tools" [ref=e26] [cursor=pointer]:
      - generic [ref=e30]: Tools
  - main [ref=e31]:
    - region "Modeling workspace" [ref=e32]:
      - combobox "Camera view" [ref=e34]:
        - option "Perspective" [selected]
        - option "Orthographic"
        - option "Top view"
      - generic [ref=e35]:
        - button "Switch to Night" [ref=e36] [cursor=pointer]
        - button "Appearance" [ref=e39] [cursor=pointer]
        - generic "Project north":
          - generic: ↑
          - generic: Project N
        - generic [ref=e44]:
          - generic "Interactive 3D modeling viewport" [ref=e45]
          - generic "Transform measurements":
            - strong: Drag an arrow to move
            - generic: Distances in meters
        - generic [ref=e46]:
          - generic "Object color" [ref=e47]:
            - textbox "Selected object color" [ref=e48] [cursor=pointer]: "#e2e7e6"
          - button "Edit selected dimensions" [ref=e49] [cursor=pointer]:
            - generic [ref=e50]: Main pavilion
            - strong [ref=e51]: 14 × 9 × 5 m
        - toolbar "Shape selected objects" [ref=e52]:
          - button "Pull selected face" [ref=e53] [cursor=pointer]: Push / pull
          - button "Hide selected objects" [ref=e59] [cursor=pointer]: Hide
          - button "Delete selected objects" [ref=e65] [cursor=pointer]: Delete
          - button "Slabs & windows" [ref=e69] [cursor=pointer]
          - button "Explore" [ref=e70] [cursor=pointer]
          - button "Scale" [ref=e71] [cursor=pointer]
          - button "Stretch" [ref=e72] [cursor=pointer]
        - toolbar "Modeling tools" [ref=e73]:
          - button "Select" [ref=e74] [cursor=pointer]
          - button "Move" [pressed] [ref=e77] [cursor=pointer]
          - button "Rotate" [ref=e83] [cursor=pointer]
          - button "Push / pull" [ref=e87] [cursor=pointer]
          - button "Draw 2D" [ref=e94] [cursor=pointer]:
            - generic [ref=e97]: Draw
          - button "Create and transform" [ref=e98] [cursor=pointer]:
            - generic [ref=e100]: Create
          - button "Frame all" [ref=e101] [cursor=pointer]
        - generic [ref=e108]:
          - button "Snap 0.5 m / 45°" [pressed] [ref=e109] [cursor=pointer]
          - combobox "Rotation snap angle" [ref=e112]:
            - option "15°"
            - option "45°" [selected]
            - option "90°"
      - generic [ref=e113]:
        - generic [ref=e114]:
          - button "Atelier Close conversation" [expanded] [ref=e115] [cursor=pointer]:
            - generic [ref=e118]: Conversation
          - button "Minimize conversation" [ref=e121] [cursor=pointer]
          - combobox "Conversation language" [ref=e124]:
            - option "English" [selected]
            - option "Spanish"
            - option "French"
            - option "German"
            - option "Italian"
            - option "Portuguese"
            - option "Japanese"
            - option "Chinese"
            - option "Arabic"
            - option "Korean"
            - option "Russian"
        - log "Design conversation" [ref=e125]:
          - paragraph [ref=e127]: Create one small spherical study at x=14; preserve my existing objects.
          - paragraph [ref=e129]: "The proposed changes have not been saved because verification is incomplete: Independent review: Unverified: The independent review exhausted its output allowance. Your saved project is unchanged."
        - generic [ref=e130]:
          - textbox "Message Atelier" [ref=e131]:
            - /placeholder: Ask Atelier to create or change anything…
          - generic [ref=e132]:
            - button "Attach a reference photo" [ref=e133] [cursor=pointer]:
              - generic [ref=e135]: Add reference
            - generic [ref=e136]: Design with Atelier
            - button "Start voice conversation" [disabled] [ref=e137]
            - button "Send message" [disabled] [ref=e141]
        - alert [ref=e144]: "The proposed changes have not been saved because verification is incomplete: Independent review: Unverified: The independent review exhausted its output allowance. Your saved project is unchanged."
  - contentinfo:
    - generic: 2 volumes 1 selected
    - generic [ref=e145]:
      - button "Undo" [disabled] [ref=e146]
      - button "Redo" [disabled] [ref=e150]
```

# Test source

```ts
  218 |               direction: 'up',
  219 |               distance: 1,
  220 |             },
  221 |           ])
  222 |         : finish,
  223 |     });
  224 |   });
  225 |   await send(page, 'Create four separate two-metre cubes.');
  226 |   await expect(
  227 |     page.getByText(/Target "missing-after-success"/).first(),
  228 |   ).toBeVisible({ timeout: 60000 });
  229 |   expect(calls).toBe(5);
  230 |   expect(reviewCalls).toBe(0);
  231 |   expect(await saved(page)).toEqual(before);
  232 |   failing = false;
  233 |   await page.reload();
  234 |   await expect(page.getByTestId('viewport')).toHaveAttribute(
  235 |     'data-model-objects',
  236 |     '2',
  237 |   );
  238 |   await send(page, 'New task: add one two-metre cube at x=12.');
  239 |   await expect
  240 |     .poll(async () => (await saved(page)).project.volumes.length, {
  241 |       timeout: 60000,
  242 |     })
  243 |     .toBe(3);
  244 |   expect(reviewCalls).toBe(1);
  245 |   const after = await saved(page);
  246 |   expect(after.project.volumes.map((v: any) => v.name)).not.toContain(
  247 |     'Discarded attempt',
  248 |   );
  249 |   expect(after.project.volumes.slice(0, 2)).toEqual(before.project.volumes);
  250 |   expect(after.past).toHaveLength(before.past.length + 1);
  251 |   await page.getByRole('button', { name: 'Undo', exact: true }).click();
  252 |   await expect
  253 |     .poll(async () => (await saved(page)).project)
  254 |     .toEqual(before.project);
  255 | });
  256 | 
  257 | test('unknown verification permits safe additions with honest messaging, one Undo, and a later independently checked edit', async ({
  258 |   page,
  259 | }) => {
  260 |   test.setTimeout(120000);
  261 |   await ready(page);
  262 |   const before = await saved(page);
  263 |   let changing = false,
  264 |     reviewCalls = 0,
  265 |     planCalls = 0,
  266 |     target = '';
  267 |   await page.route('**/api/completion-criteria', (r) => {
  268 |     reviewCalls++;
  269 |     const b = r.request().postDataJSON();
  270 |     return r.fulfill({
  271 |       json: changing
  272 |         ? criteria(
  273 |             [measure('requested-height', 'height', 1.4, selector([target]))],
  274 |             [target],
  275 |             b.message,
  276 |           )
  277 |         : unavailableCompletionCriteria(
  278 |             'The independent review exhausted its output allowance.',
  279 |             b.message,
  280 |           ),
  281 |     });
  282 |   });
  283 |   await page.route('**/api/plan', (r) => {
  284 |     const b = r.request().postDataJSON();
  285 |     planCalls++;
  286 |     if (b.execution.receipts.length) return r.fulfill({ json: finish });
  287 |     if (changing)
  288 |       return r.fulfill({
  289 |         json: apply([
  290 |           {
  291 |             type: 'resize',
  292 |             targets: [target],
  293 |             axis: 'height',
  294 |             mode: 'set',
  295 |             value: 1.4,
  296 |           },
  297 |         ]),
  298 |       });
  299 |     return r.fulfill({
  300 |       json: apply([
  301 |         {
  302 |           ...box('Unfamiliar study', 14, 0.7),
  303 |           shape: 'sphere',
  304 |           width: 0.7,
  305 |           depth: 0.7,
  306 |         },
  307 |       ]),
  308 |     });
  309 |   });
  310 |   await send(
  311 |     page,
  312 |     'Create one small spherical study at x=14; preserve my existing objects.',
  313 |   );
  314 |   await expect
  315 |     .poll(async () => (await saved(page)).project.volumes.length, {
  316 |       timeout: 60000,
  317 |     })
> 318 |     .toBe(3);
      |      ^ Error: expect(received).toBe(expected) // Object.is equality
  319 |   const first = await saved(page);
  320 |   target = first.project.volumes[2].id;
  321 |   expect(planCalls).toBe(2);
  322 |   expect(reviewCalls).toBe(1);
  323 |   expect(first.project.volumes.slice(0, 2)).toEqual(before.project.volumes);
  324 |   expect(first.past).toHaveLength(before.past.length + 1);
  325 |   const history = await page.evaluate(() =>
  326 |     JSON.parse(localStorage.getItem('atelier.conversation.v2') || '[]'),
  327 |   );
  328 |   expect(history.at(-1).summary).toContain('incomplete verification');
  329 |   await expect(
  330 |     page.getByRole('log', { name: 'Design conversation' }),
  331 |   ).toContainText('Changes applied with incomplete verification');
  332 |   expect(JSON.stringify(history)).not.toContain('999');
  333 |   await page.getByRole('button', { name: 'Undo', exact: true }).click();
  334 |   await expect
  335 |     .poll(async () => (await saved(page)).project)
  336 |     .toEqual(before.project);
  337 |   await page.getByRole('button', { name: 'Redo', exact: true }).click();
  338 |   await expect
  339 |     .poll(async () => (await saved(page)).project)
  340 |     .toEqual(first.project);
  341 |   changing = true;
  342 |   await send(
  343 |     page,
  344 |     'Stretch the spherical study to 1.4 meters high. Keep its identity and the other objects.',
  345 |   );
  346 |   await expect
  347 |     .poll(
  348 |       async () =>
  349 |         (await saved(page)).project.volumes.find((v: any) => v.id === target)
  350 |           ?.dimensions.height,
  351 |       { timeout: 60000 },
  352 |     )
  353 |     .toBe(1.4);
  354 |   const edited = await saved(page);
  355 |   expect(planCalls).toBe(4);
  356 |   expect(reviewCalls).toBe(2);
  357 |   expect(edited.project.volumes.slice(0, 2)).toEqual(before.project.volumes);
  358 |   expect(edited.past).toHaveLength(first.past.length + 1);
  359 |   await page.getByRole('button', { name: 'Undo', exact: true }).click();
  360 |   await expect
  361 |     .poll(async () => (await saved(page)).project)
  362 |     .toEqual(first.project);
  363 | });
  364 | 
```