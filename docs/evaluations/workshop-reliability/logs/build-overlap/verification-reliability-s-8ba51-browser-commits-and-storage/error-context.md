# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: verification-reliability.spec.ts >> saved real-AI unresolved replay through browser commits and storage
- Location: tests/verification-reliability.spec.ts:21:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('viewport')
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByTestId('viewport') with timeout 15000ms
  - waiting for getByTestId('viewport')

```

```yaml
- text: Not Found
```

# Test source

```ts
  100 |         : {
  101 |             intent: 'finish',
  102 |             message: 'Saved-response replay completed',
  103 |             operations: [],
  104 |           };
  105 |       if (scenario === 'displaced' && models === 1)
  106 |         plan.operations.find(
  107 |           (op: any) => op.type === 'position' && op.targets[0] === 'display-1',
  108 |         ).x += 0.04;
  109 |       await r.fulfill({ json: plan });
  110 |     });
  111 |     await page.route('**/api/completion-criteria', async (r) => {
  112 |       reviews++;
  113 |       const body = r.request().postDataJSON();
  114 |       for (const original of f.candidate.project.volumes) {
  115 |         const found = body.candidate.filter(
  116 |           (o: any) => o.name === original.name,
  117 |         );
  118 |         if (found.length === 1) {
  119 |           mapping.set(original.id, found[0].id);
  120 |           if (original.groupId && found[0].groupId)
  121 |             mapping.set(original.groupId, found[0].groupId);
  122 |         }
  123 |       }
  124 |       expect(model(await saved(page))).toEqual(model(f.before));
  125 |       const c = remap(f.criteria);
  126 |       if (body.revision) {
  127 |         expect(reviews).toBe(2);
  128 |         expect(
  129 |           body.revision.issues.every(
  130 |             (i: any) => i.code === 'invalid_calculation',
  131 |           ),
  132 |         ).toBe(true);
  133 |       }
  134 |       return r.fulfill({
  135 |         json:
  136 |           body.revision && scenario !== 'unresolved' ? binaryCorrection(c) : c,
  137 |       });
  138 |     });
  139 |     await page.goto(baseURL!);
  140 |     await expect(page.getByTestId('viewport')).toHaveAttribute(
  141 |       'data-model-objects',
  142 |       String(f.before.project.volumes.length),
  143 |     );
  144 |     await expect
  145 |       .poll(async () => model(await saved(page)))
  146 |       .toEqual(model(f.before));
  147 |     await page.getByRole('textbox', { name: 'Message Atelier' }).fill(f.prompt);
  148 |     await page
  149 |       .getByRole('button', { name: 'Send message', exact: true })
  150 |       .click();
  151 |     const commits = ['group', 'reflection'].includes(scenario);
  152 |     if (commits)
  153 |       await expect
  154 |         .poll(async () => (await saved(page)).past.length, { timeout: 80000 })
  155 |         .toBe(f.before.past.length + 1);
  156 |     else {
  157 |       await expect(
  158 |         page.getByRole('log', { name: 'Design conversation' }),
  159 |       ).toContainText(
  160 |         scenario === 'displaced'
  161 |           ? 'Controlled negative result rejected'
  162 |           : 'proposed changes have not been saved',
  163 |         { timeout: 80000 },
  164 |       );
  165 |     }
  166 |     const after = await saved(page);
  167 |     expect(
  168 |       after.project.volumes.filter((v: any) => v.id.startsWith('reference-')),
  169 |     ).toEqual(
  170 |       f.before.project.volumes.filter((v: any) =>
  171 |         v.id.startsWith('reference-'),
  172 |       ),
  173 |     );
  174 |     let facts: any[] = [];
  175 |     if (commits) {
  176 |       facts = await oracle(
  177 |         scenario === 'group' ? 'W3' : 'D-H2',
  178 |         f.before,
  179 |         f.before,
  180 |         after,
  181 |         false,
  182 |       );
  183 |       expect(pass(facts)).toBe(true);
  184 |       await page.reload();
  185 |       await expect(page.getByTestId('viewport')).toBeVisible();
  186 |       await expect
  187 |         .poll(async () => model(await saved(page)))
  188 |         .toEqual(model(after));
  189 |       await page.getByRole('button', { name: 'Undo', exact: true }).click();
  190 |       await expect
  191 |         .poll(async () => (await saved(page)).project.volumes)
  192 |         .toEqual(f.before.project.volumes);
  193 |       await page.getByRole('button', { name: 'Redo', exact: true }).click();
  194 |       await expect
  195 |         .poll(async () => (await saved(page)).project.volumes)
  196 |         .toEqual(after.project.volumes);
  197 |     } else {
  198 |       expect(model(after)).toEqual(model(f.before));
  199 |       await page.reload();
> 200 |       await expect(page.getByTestId('viewport')).toBeVisible();
      |                                                  ^ Error: expect(locator).toBeVisible() failed
  201 |       await expect
  202 |         .poll(async () => model(await saved(page)))
  203 |         .toEqual(model(f.before));
  204 |     }
  205 |     expect(reviews).toBe(scenario === 'group' ? 1 : 2);
  206 |     expect(models).toBe(
  207 |       scenario === 'group' ? f.stages.length : scenario === 'displaced' ? 2 : 1,
  208 |     );
  209 |     const report = {
  210 |       scenario,
  211 |       provenance: f.provenance,
  212 |       label:
  213 |         'Offline saved model responses and scripted reviewer correction through normal browser. No fresh AI.',
  214 |       committed: commits,
  215 |       models,
  216 |       reviews,
  217 |       facts,
  218 |       unrelatedPreserved: true,
  219 |       reload: true,
  220 |       undoRedo: commits,
  221 |       after,
  222 |     };
  223 |     await info.attach('result', {
  224 |       body: JSON.stringify(report, null, 2),
  225 |       contentType: 'application/json',
  226 |     });
  227 |     mkdirSync('docs/evaluations/workshop-reliability/browser', {
  228 |       recursive: true,
  229 |     });
  230 |     writeFileSync(
  231 |       `docs/evaluations/workshop-reliability/browser/${scenario}.json`,
  232 |       JSON.stringify(report, null, 2),
  233 |     );
  234 |     await page.screenshot({
  235 |       path: `docs/evaluations/workshop-reliability/browser/${scenario}.png`,
  236 |     });
  237 |     await context.close();
  238 |   });
  239 | }
  240 | 
```