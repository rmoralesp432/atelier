import { cloneARView, setARTransparency, disposeARView } from './appearance';
import * as THREE from 'three';
import { fitToRealWidth } from './placement';
import { arCameraContext } from './context';
import type { CameraContext } from '../intelligence/context';
import {
  bringModelInFront,
  floorDirections,
  modelBounds,
  transformAround,
} from './controls';
export type ARSessionControl = {
  end: () => Promise<void>;
  scale: (value: number) => void;
  rotate: (degrees: number) => void;
  reposition: () => void;
  fitWidth: (width: number) => void;
  updateModel: (model: THREE.Group) => void;
  bringInFront: () => void;
  nudge: (right: number, forward: number, up?: number) => void;
  transparency: (transparent: boolean) => void;
  fitInView?: () => void;
};
/** Actual camera tracking and surface hit testing, only when immersive-ar is supported. */
export async function startAR(
  model: THREE.Group,
  overlay: HTMLElement,
  scale: number,
  status: (text: string) => void,
  onEnd: () => void,
  signal?: AbortSignal,
  onFit?: (scale: number, rotation: number) => void,
  onCamera?: (camera: CameraContext) => void,
  initialRotation = 0,
): Promise<ARSessionControl> {
  if (signal?.aborted) throw new Error('AR was closed.');
  if (!navigator.xr) throw new Error('This browser does not support WebXR AR.');
  // Invoke the permission request in the original button gesture.
  const session = await navigator.xr.requestSession('immersive-ar', {
    requiredFeatures: ['hit-test', 'dom-overlay'],
    domOverlay: { root: overlay },
  });
  if (signal?.aborted) {
    await session.end().catch(() => {});
    throw new Error('AR was closed.');
  }
  const abort = () => {
    void session.end().catch(() => {});
  };
  signal?.addEventListener('abort', abort, { once: true });
  const suppressUISelect = (e: Event) => {
    if ((e.target as HTMLElement).closest('.ar-controls,.conversation-area'))
      e.preventDefault();
  };
  let renderer: THREE.WebGLRenderer | undefined,
    source: XRHitTestSource | undefined,
    ended = false;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(
      60,
      innerWidth / innerHeight,
      0.01,
      10000,
    );
  const anchor = new THREE.Group();
  let copy = cloneARView(model);
  let transparent = false;
  copy.scale.setScalar(scale);
  copy.rotation.y = (initialRotation * Math.PI) / 180;
  let pivot = new THREE.Vector3();
  anchor.add(copy);
  anchor.visible = false;
  scene.add(anchor);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 3));
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(3, 10, 5);
  scene.add(sun);
  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.12, 0.15, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#a4f5e7', side: THREE.DoubleSide }),
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);
  let placed = false;
  let fitting: { width: number; first?: THREE.Vector3 } | null = null;
  const cleanup = () => {
    if (ended) return;
    ended = true;
    source?.cancel();
    signal?.removeEventListener('abort', abort);
    overlay.removeEventListener('beforexrselect', suppressUISelect);
    renderer?.setAnimationLoop(null);
    renderer?.dispose();
    renderer?.domElement.remove();
    disposeARView(copy);
    reticle.geometry.dispose();
    reticle.material.dispose();
    onEnd();
  };
  session.addEventListener('end', cleanup, { once: true });
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    overlay.appendChild(renderer.domElement);
    await renderer.xr.setSession(session);
    if (ended || signal?.aborted) throw new Error('AR was closed.');
    const viewer = await session.requestReferenceSpace('viewer');
    source = await session.requestHitTestSource!({ space: viewer });
    if (ended || signal?.aborted) {
      source?.cancel();
      throw new Error('AR was closed.');
    }
    if (!source)
      throw new Error('Surface detection is unavailable on this device.');
    const place = () => {
      if (!reticle.visible || (placed && !fitting)) return;
      const point = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
      if (fitting) {
        if (!fitting.first) {
          fitting.first = point;
          status(
            'First point set. Move to the other end of the width and tap.',
          );
          return;
        }
        try {
          const fit = fitToRealWidth(fitting.first, point, fitting.width);
          copy.scale.setScalar(fit.scale);
          copy.rotation.y = (fit.rotation * Math.PI) / 180;
          // Live edits can move the footprint relative to the original anchor.
          // Center the current footprint, not just its original project origin.
          const center = modelBounds(copy).getCenter(new THREE.Vector3());
          center.y = 0;
          pivot.copy(center);
          center
            .multiplyScalar(fit.scale)
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), copy.rotation.y);
          anchor.position.copy(fit.position).sub(center);
          onFit?.(fit.scale, fit.rotation);
          fitting = null;
          placed = true;
          anchor.visible = true;
          reticle.visible = false;
          status(
            `Width fitted to ${fit.distance.toFixed(2)} m in your room. Tracking is approximate.`,
          );
        } catch (e) {
          status(e instanceof Error ? e.message : 'Try those points again.');
          if (fitting) fitting.first = undefined;
        }
        return;
      }
      anchor.position.copy(point);
      pivot = modelBounds(copy).getCenter(new THREE.Vector3());
      pivot.y = 0;
      anchor.position.sub(
        pivot
          .clone()
          .multiplyScalar(copy.scale.x)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), copy.rotation.y),
      );
      anchor.visible = true;
      placed = true;
      reticle.visible = false;
      status('Placed. Walk around your model. Use Place again to move it.');
    };
    session.addEventListener('select', place);
    overlay.addEventListener('beforexrselect', suppressUISelect);
    status(
      'Move your phone slowly to find a surface. Tap the ring to place the model.',
    );
    let lastContext = -Infinity;
    const trackedCamera = new THREE.PerspectiveCamera();
    let hasCamera = false;
    renderer.setAnimationLoop((time, frame) => {
      const ref = renderer!.xr.getReferenceSpace();
      if (frame && source && ref && (!placed || fitting)) {
        const hit = frame.getHitTestResults(source)[0],
          pose = hit?.getPose(ref);
        reticle.visible = !!pose;
        if (pose) {
          reticle.matrix.fromArray(pose.transform.matrix);
          // Model elevations are measured above a floor, not a wall.
          reticle.visible =
            new THREE.Vector3()
              .setFromMatrixColumn(reticle.matrix, 1)
              .normalize().y >= 0.85;
        }
      }
      if (frame && ref) {
        const view = frame.getViewerPose?.(ref)?.views[0];
        if (view) {
          trackedCamera.matrix.fromArray(view.transform.matrix);
          trackedCamera.matrix.decompose(
            trackedCamera.position,
            trackedCamera.quaternion,
            trackedCamera.scale,
          );
          trackedCamera.projectionMatrix.fromArray(view.projectionMatrix);
          trackedCamera.projectionMatrixInverse
            .copy(trackedCamera.projectionMatrix)
            .invert();
          hasCamera = true;
          if (placed && onCamera && time - lastContext >= 200) {
            onCamera(arCameraContext(copy, trackedCamera));
            lastContext = time;
          }
        }
      }
      renderer!.render(scene, camera);
    });
    return {
      end: () => session.end(),
      scale: (value) => {
        transformAround(
          anchor,
          copy,
          pivot,
          value,
          (copy.rotation.y * 180) / Math.PI,
        );
      },
      updateModel: (model) => {
        fitting = null;
        const next = cloneARView(model);
        setARTransparency(next, transparent);
        next.scale.copy(copy.scale);
        next.rotation.copy(copy.rotation);
        anchor.remove(copy);
        disposeARView(copy);
        copy = next;
        anchor.add(copy);
      },
      fitWidth: (width) => {
        if (!(width > 0)) return;
        fitting = { width };
        status('Tap the first end of the real-world width on a level surface.');
      },
      rotate: (degrees) =>
        transformAround(anchor, copy, pivot, copy.scale.x, degrees),
      bringInFront: () => {
        if (!placed || !hasCamera) {
          status('Place the model on a detected surface first.');
          return;
        }
        fitting = null;
        reticle.visible = false;
        pivot = bringModelInFront(anchor, copy, trackedCamera);
        status(
          'Nearest edge is one meter ahead. Rotate or resize around that edge.',
        );
      },
      transparency: (value) => {
        transparent = value;
        setARTransparency(copy, value);
      },
      nudge: (right, forward, up = 0) => {
        if (!placed || !hasCamera) {
          status('Place the model on a detected surface first.');
          return;
        }
        if (
          ![right, forward, up].every(Number.isFinite) ||
          Math.abs(right) > 10 ||
          Math.abs(forward) > 10 ||
          Math.abs(up) > 10
        )
          return;
        const axes = floorDirections(trackedCamera);
        anchor.position
          .addScaledVector(axes.right, right)
          .addScaledVector(axes.forward, forward);
        anchor.position.y += up;
        status(
          `Moved ${Math.hypot(right, forward, up).toFixed(2)} m${up ? ' vertically' : ' across the floor'}. Placement can overlap real objects.`,
        );
      },
      reposition: () => {
        fitting = null;
        placed = false;
        anchor.visible = false;
        status('Find a surface and tap to place again.');
      },
    };
  } catch (error) {
    await session.end().catch(() => {});
    cleanup();
    throw error;
  }
}
