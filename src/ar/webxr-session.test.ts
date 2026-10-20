import { afterEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { startAR } from './webxr';
const rendererState = vi.hoisted(() => ({
  loop: null as null | ((time: number, frame?: XRFrame) => void),
  scene: null as THREE.Scene | null,
  disposed: false,
}));
vi.mock('three', async (original) => {
  const actual = await original<typeof THREE>();
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = { remove: vi.fn() };
      xr = {
        enabled: false,
        setReferenceSpaceType: vi.fn(),
        setSession: async () => {},
        getReferenceSpace: () => ({}),
      };
      setPixelRatio() {}
      setSize() {}
      setAnimationLoop(fn: typeof rendererState.loop) {
        rendererState.loop = fn;
      }
      render(scene: THREE.Scene) {
        rendererState.scene = scene;
      }
      dispose() {
        rendererState.disposed = true;
      }
    },
  };
});
afterEach(() => vi.unstubAllGlobals());
it('places and fits genuine scene geometry using explicit XR tracking fixtures; updates preserve anchor/scale and UI taps do not place', async () => {
  vi.stubGlobal('innerWidth', 390);
  vi.stubGlobal('innerHeight', 844);
  vi.stubGlobal('devicePixelRatio', 2);
  const xr = new EventTarget() as EventTarget & {
    end: () => Promise<void>;
    requestReferenceSpace: () => Promise<object>;
    requestHitTestSource: () => Promise<object>;
  };
  const cancel = vi.fn();
  xr.end = async () => {
    xr.dispatchEvent(new Event('end'));
  };
  xr.requestReferenceSpace = async () => ({});
  xr.requestHitTestSource = async () => ({ cancel });
  vi.stubGlobal('navigator', { xr: { requestSession: async () => xr } });
  const overlay = new EventTarget() as EventTarget & {
    appendChild: () => void;
  };
  overlay.appendChild = () => {};
  const model = new THREE.Group();
  model.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(20, 10, 10),
      new THREE.MeshBasicMaterial(),
    ),
  );
  const status = vi.fn(),
    ended = vi.fn(),
    fit = vi.fn();
  const control = await startAR(
    model,
    overlay as unknown as HTMLElement,
    0.01,
    status,
    ended,
    undefined,
    fit,
  );
  const frameAt = (x: number, y: number, z: number) => {
    const matrix = new THREE.Matrix4().makeTranslation(x, y, z).toArray();
    rendererState.loop!(0, {
      getHitTestResults: () => [{ getPose: () => ({ transform: { matrix } }) }],
      getViewerPose: () => ({
        views: [
          {
            transform: {
              matrix: new THREE.Matrix4().makeTranslation(0, 1.7, 0).toArray(),
            },
            projectionMatrix:
              new THREE.PerspectiveCamera().projectionMatrix.toArray(),
          },
        ],
      }),
    } as unknown as XRFrame);
  };
  // A tracked wall is not a suitable ground placement surface.
  const wall = new THREE.Matrix4().makeRotationZ(Math.PI / 2).toArray();
  rendererState.loop!(0, {
    getHitTestResults: () => [
      { getPose: () => ({ transform: { matrix: wall } }) },
    ],
  } as unknown as XRFrame);
  xr.dispatchEvent(new Event('select'));
  const unplaced = rendererState.scene!.children.find(
    (o) => o instanceof THREE.Group,
  )!;
  expect(unplaced.visible).toBe(false);
  frameAt(2, 0, 3);
  xr.dispatchEvent(new Event('select'));
  const anchor = rendererState.scene!.children.find(
    (o) => o instanceof THREE.Group,
  )!;
  expect(anchor.visible).toBe(true);
  expect(anchor.position.toArray()).toEqual([2, 0, 3]);
  expect(anchor.children[0].scale.x).toBe(0.01);
  control.fitWidth(20);
  frameAt(0, 0, 0);
  xr.dispatchEvent(new Event('select'));
  frameAt(0, 0, 2);
  xr.dispatchEvent(new Event('select'));
  expect(fit).toHaveBeenCalledWith(0.1, -90);
  expect(anchor.position.toArray()).toEqual([0, 0, 1]);
  expect(anchor.children[0].rotation.y).toBeCloseTo(-Math.PI / 2);
  const updated = model.clone(true);
  updated.children[0].position.x = 5;
  control.updateModel(updated);
  expect(anchor.position.toArray()).toEqual([0, 0, 1]);
  expect(anchor.children[0].scale.x).toBe(0.1);
  expect(anchor.children[0].children[0].position.x).toBe(5);
  // Subsequent fit compensates for shifted geometry rather than moving the width off its real span.
  control.fitWidth(20);
  frameAt(0, 0, 0);
  xr.dispatchEvent(new Event('select'));
  frameAt(0, 0, 2);
  xr.dispatchEvent(new Event('select'));
  expect(anchor.position.z).toBeCloseTo(0.5);
  control.scale(NaN);
  expect(anchor.children[0].scale.x).toBe(0.1);
  const tap = new Event('beforexrselect', { cancelable: true });
  Object.defineProperty(tap, 'target', { value: { closest: () => ({}) } });
  overlay.dispatchEvent(tap);
  expect(tap.defaultPrevented).toBe(true);
  control.scale(1);
  control.bringInFront();
  anchor.updateMatrixWorld(true);
  const front = new THREE.Box3().setFromObject(anchor);
  expect(front.max.z).toBeCloseTo(-1);
  const oldPosition = anchor.position.clone();
  control.nudge(1, 0);
  expect(anchor.position.x - oldPosition.x).toBeCloseTo(1);
  control.nudge(0, 0.1);
  expect(anchor.position.z - oldPosition.z).toBeCloseTo(-0.1);
  control.nudge(0, 0, 5);
  expect(anchor.position.y - oldPosition.y).toBeCloseTo(5);
  control.nudge(0, 0, -5);
  expect(anchor.position.y).toBeCloseTo(oldPosition.y);
  control.transparency(true);
  const shownMaterial = (anchor.children[0].children[0] as THREE.Mesh)
    .material as THREE.Material;
  expect(shownMaterial.opacity).toBe(0.25);
  expect(
    ((model.children[0] as THREE.Mesh).material as THREE.Material).opacity,
  ).toBe(1);
  control.updateModel(updated);
  expect(
    ((anchor.children[0].children[0] as THREE.Mesh).material as THREE.Material)
      .opacity,
  ).toBe(0.25);
  control.transparency(false);
  expect(
    ((anchor.children[0].children[0] as THREE.Mesh).material as THREE.Material)
      .opacity,
  ).toBe(1);
  control.reposition();
  expect(anchor.visible).toBe(false);
  await control.end();
  expect(ended).toHaveBeenCalledOnce();
  expect(cancel).toHaveBeenCalledOnce();
  expect(rendererState.loop).toBeNull();
  expect(rendererState.disposed).toBe(true);
  (model.children[0] as THREE.Mesh).geometry.dispose();
});
