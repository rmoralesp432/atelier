# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: verification-reliability.spec.ts >> saved real-AI displaced replay through browser commits and storage
- Location: tests/verification-reliability.spec.ts:21:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'Dismiss', exact: true })
Expected: visible
Timeout: 80000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('button', { name: 'Dismiss', exact: true }) with timeout 80000ms
  - waiting for getByRole('button', { name: 'Dismiss', exact: true })

```

```yaml
- banner:
  - link "ATELIER home":
    - /url: ./
  - button "Projects": Untitled study
  - button "Show objects": Objects
  - button "Create a 3D shape": Create
  - button "Explore design": Explore
  - button "Design tools": Tools
- main:
  - region "Modeling workspace":
    - combobox "Camera view":
      - option "Perspective" [selected]
      - option "Orthographic"
      - option "Top view"
    - button "Switch to Night"
    - button "Appearance"
    - text: ↑ Project N
    - toolbar "Modeling tools":
      - button "Select" [pressed]
      - button "Move"
      - button "Rotate"
      - button "Push / pull"
      - button "Draw 2D": Draw
      - button "Create and transform": Create
      - button "Frame all"
    - button "Snap 0.5 m / 45°" [pressed]
    - combobox "Rotation snap angle":
      - option "15°"
      - option "45°" [selected]
      - option "90°"
    - button "Atelier Close conversation" [expanded]: Conversation
    - button "Minimize conversation"
    - combobox "Conversation language":
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
    - log "Design conversation":
      - paragraph: "Move the three pieces in “Display pieces” into the mirror image of their current plan arrangement across the line passing through X = 1.1 m, Z = -0.8 m at 34 degrees from +X toward +Z. Reflect their positions only: keep each piece’s height above ground, size, shape and facing direction unchanged. Move the existing pieces rather than duplicating them, and leave the reference objects untouched."
      - paragraph: Controlled negative result rejected. No scripted geometry repair.
    - textbox "Message Atelier":
      - /placeholder: Ask Atelier to create or change anything…
    - button "Attach a reference photo": Add reference
    - text: Design with Atelier
    - button "Start voice conversation" [disabled]
    - button "Send message" [disabled]
    - alert: Controlled negative result rejected. No scripted geometry repair.
- contentinfo:
  - text: 5 volumes No selection
  - button "Undo" [disabled]
  - button "Redo" [disabled]
```

# Test source

```ts
  58  |           : value && typeof value === 'object'
  59  |             ? Object.fromEntries(
  60  |                 Object.entries(value).map(([k, v]) => [k, remap(v)]),
  61  |               )
  62  |             : value;
  63  |     await page.route('**/api/config', (r) =>
  64  |       r.fulfill({
  65  |         json: {
  66  |           configured: true,
  67  |           authenticated: true,
  68  |           agentConfigured: true,
  69  |           voiceConfigured: false,
  70  |         },
  71  |       }),
  72  |     );
  73  |     await page.route('**/api/plan', async (r) => {
  74  |       const body = r.request().postDataJSON(),
  75  |         stage = f.stages[models++];
  76  |       if (body.validationFeedback) {
  77  |         expect(scenario).toBe('displaced');
  78  |         expect(
  79  |           body.validationFeedback.verification.checks
  80  |             .filter((c: any) => c.outcome === 'incorrect')
  81  |             .map((c: any) => c.id),
  82  |         ).toEqual(['check-2']);
  83  |         return r.fulfill({
  84  |           status: 422,
  85  |           json: {
  86  |             error:
  87  |               'Controlled negative result rejected. No scripted geometry repair.',
  88  |           },
  89  |         });
  90  |       }
  91  |       for (const original of stage?.scene.objects ?? []) {
  92  |         const found = body.scene.objects.filter(
  93  |           (o: any) => o.name === original.name,
  94  |         );
  95  |         if (found.length === 1) mapping.set(original.id, found[0].id);
  96  |       }
  97  |       const plan = stage
  98  |         ? remap(stage.response)
  99  |         : {
  100 |             intent: 'finish',
  101 |             message: 'Saved-response replay completed',
  102 |             operations: [],
  103 |           };
  104 |       if (scenario === 'displaced' && models === 1)
  105 |         plan.operations.find(
  106 |           (op: any) => op.type === 'position' && op.targets[0] === 'display-1',
  107 |         ).x += 0.04;
  108 |       await r.fulfill({ json: plan });
  109 |     });
  110 |     await page.route('**/api/completion-criteria', async (r) => {
  111 |       reviews++;
  112 |       const body = r.request().postDataJSON();
  113 |       for (const original of f.candidate.project.volumes) {
  114 |         const found = body.candidate.filter(
  115 |           (o: any) => o.name === original.name,
  116 |         );
  117 |         if (found.length === 1) {
  118 |           mapping.set(original.id, found[0].id);
  119 |           if (original.groupId && found[0].groupId)
  120 |             mapping.set(original.groupId, found[0].groupId);
  121 |         }
  122 |       }
  123 |       expect(model(await saved(page))).toEqual(model(f.before));
  124 |       const c = remap(f.criteria);
  125 |       if (body.revision) {
  126 |         expect(reviews).toBe(2);
  127 |         expect(
  128 |           body.revision.issues.every(
  129 |             (i: any) => i.code === 'invalid_calculation',
  130 |           ),
  131 |         ).toBe(true);
  132 |       }
  133 |       return r.fulfill({
  134 |         json:
  135 |           body.revision && scenario !== 'unresolved' ? binaryCorrection(c) : c,
  136 |       });
  137 |     });
  138 |     await page.goto(baseURL!);
  139 |     await expect(page.getByTestId('viewport')).toHaveAttribute(
  140 |       'data-model-objects',
  141 |       String(f.before.project.volumes.length),
  142 |     );
  143 |     await expect
  144 |       .poll(async () => model(await saved(page)))
  145 |       .toEqual(model(f.before));
  146 |     await page.getByRole('textbox', { name: 'Message Atelier' }).fill(f.prompt);
  147 |     await page
  148 |       .getByRole('button', { name: 'Send message', exact: true })
  149 |       .click();
  150 |     const commits = ['group', 'reflection'].includes(scenario);
  151 |     if (commits)
  152 |       await expect
  153 |         .poll(async () => (await saved(page)).past.length, { timeout: 80000 })
  154 |         .toBe(f.before.past.length + 1);
  155 |     else {
  156 |       await expect(
  157 |         page.getByRole('button', { name: 'Dismiss', exact: true }),
> 158 |       ).toBeVisible({ timeout: 80000 });
      |         ^ Error: expect(locator).toBeVisible() failed
  159 |       if (scenario === 'unresolved')
  160 |         await expect(
  161 |           page.getByText(/proposed changes have not been saved/),
  162 |         ).toBeVisible();
  163 |     }
  164 |     const after = await saved(page);
  165 |     expect(
  166 |       after.project.volumes.filter((v: any) => v.id.startsWith('reference-')),
  167 |     ).toEqual(
  168 |       f.before.project.volumes.filter((v: any) =>
  169 |         v.id.startsWith('reference-'),
  170 |       ),
  171 |     );
  172 |     let facts: any[] = [];
  173 |     if (commits) {
  174 |       facts = await oracle(
  175 |         scenario === 'group' ? 'W3' : 'D-H2',
  176 |         f.before,
  177 |         f.before,
  178 |         after,
  179 |         false,
  180 |       );
  181 |       expect(pass(facts)).toBe(true);
  182 |       await page.reload();
  183 |       await expect(page.getByTestId('viewport')).toBeVisible();
  184 |       await expect
  185 |         .poll(async () => model(await saved(page)))
  186 |         .toEqual(model(after));
  187 |       await page.getByRole('button', { name: 'Undo', exact: true }).click();
  188 |       await expect
  189 |         .poll(async () => (await saved(page)).project.volumes)
  190 |         .toEqual(f.before.project.volumes);
  191 |       await page.getByRole('button', { name: 'Redo', exact: true }).click();
  192 |       await expect
  193 |         .poll(async () => (await saved(page)).project.volumes)
  194 |         .toEqual(after.project.volumes);
  195 |     } else {
  196 |       expect(model(after)).toEqual(model(f.before));
  197 |       await page.reload();
  198 |       await expect(page.getByTestId('viewport')).toBeVisible();
  199 |       await expect
  200 |         .poll(async () => model(await saved(page)))
  201 |         .toEqual(model(f.before));
  202 |     }
  203 |     expect(reviews).toBe(scenario === 'group' ? 1 : 2);
  204 |     expect(models).toBe(
  205 |       scenario === 'group' ? f.stages.length : scenario === 'displaced' ? 2 : 1,
  206 |     );
  207 |     const report = {
  208 |       scenario,
  209 |       provenance: f.provenance,
  210 |       label:
  211 |         'Offline saved model responses and scripted reviewer correction through normal browser. No fresh AI.',
  212 |       committed: commits,
  213 |       models,
  214 |       reviews,
  215 |       facts,
  216 |       unrelatedPreserved: true,
  217 |       reload: true,
  218 |       undoRedo: commits,
  219 |       after,
  220 |     };
  221 |     await info.attach('result', {
  222 |       body: JSON.stringify(report, null, 2),
  223 |       contentType: 'application/json',
  224 |     });
  225 |     mkdirSync('docs/evaluations/workshop-reliability/browser', {
  226 |       recursive: true,
  227 |     });
  228 |     writeFileSync(
  229 |       `docs/evaluations/workshop-reliability/browser/${scenario}.json`,
  230 |       JSON.stringify(report, null, 2),
  231 |     );
  232 |     await page.screenshot({
  233 |       path: `docs/evaluations/workshop-reliability/browser/${scenario}.png`,
  234 |     });
  235 |     await context.close();
  236 |   });
  237 | }
  238 | 
```