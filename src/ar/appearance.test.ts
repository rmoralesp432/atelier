import { expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { cloneARView, disposeARView, setARTransparency } from './appearance';
import { exportARModel } from './model';

it('toggles solid/see-through without changing shared project materials or natural glass', async () => {
  const model = new Group();
  const solid = new MeshStandardMaterial({ opacity: 1 });
  const glass = new MeshStandardMaterial({
    opacity: 0.3,
    transparent: true,
    depthWrite: false,
  });
  model.add(
    new Mesh(new BoxGeometry(), solid),
    new Mesh(new BoxGeometry(), glass),
  );
  const view = cloneARView(model);
  setARTransparency(view, true);
  const a = (view.children[0] as Mesh).material as MeshStandardMaterial;
  const b = (view.children[1] as Mesh).material as MeshStandardMaterial;
  expect(a.opacity).toBe(0.25);
  expect(a.depthWrite).toBe(false);
  expect(solid.opacity).toBe(1);
  const usdz = new TextDecoder().decode(await exportARModel(model, 1, 0, true));
  expect(usdz).toContain('float inputs:opacity = 0.25');
  expect(solid.opacity).toBe(1);
  setARTransparency(view, false);
  expect(a.opacity).toBe(1);
  expect(a.transparent).toBe(false);
  expect(a.depthWrite).toBe(true);
  expect(b.opacity).toBe(0.3);
  expect(b.transparent).toBe(true);
  expect(b.depthWrite).toBe(false);
  disposeARView(view);
});
