import * as THREE from 'three';
import type { Volume } from '../model';
import { pullFace, type FaceAxis } from './pull';
import { isFlat } from './spatial';
export type PullFeedback = {
  axis: FaceAxis;
  size: number;
  delta: number;
  extruding: boolean;
};
export class FacePullControls {
  private root = new THREE.Group();
  private handles: THREE.Mesh[] = [];
  private drag: {
    v: Volume;
    axis: FaceAxis;
    side: 1 | -1;
    startX: number;
    startY: number;
    sx: number;
    sy: number;
    next: Volume;
    pointerId: number;
    profilePreview: THREE.Mesh | null;
  } | null = null;
  private trail = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineDashedMaterial({
      color: '#9ce4dc',
      dashSize: 0.25,
      gapSize: 0.12,
      depthTest: false,
    }),
  );
  private cleanups: (() => void)[] = [];
  constructor(
    private config: {
      scene: THREE.Scene;
      canvas: HTMLCanvasElement;
      camera: () => THREE.Camera;
      objects: Map<string, THREE.Group>;
      current: () => {
        volume: Volume | undefined;
        enabled: boolean;
        snap: boolean;
      };
      onDrag: (active: boolean) => void;
      onCommit: (v: Volume) => void;
      onFeedback: (f: PullFeedback | null) => void;
      finishMotion: () => void;
    },
  ) {
    const geometry = new THREE.SphereGeometry(1, 16, 10);
    for (const axis of ['x', 'y', 'z'] as const)
      for (const side of [-1, 1] as const) {
        const handle = new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({
            color: axis === 'y' ? '#b5f1e8' : '#faf7e8',
            depthTest: false,
            transparent: true,
            opacity: 0.95,
          }),
        );
        handle.userData = { axis, side };
        handle.renderOrder = 20;
        this.root.add(handle);
        this.handles.push(handle);
      }
    this.trail.renderOrder = 19;
    this.trail.visible = false;
    config.scene.add(this.root, this.trail);
    const listen = (name: string, fn: (e: PointerEvent) => void) => {
      config.canvas.addEventListener(name, fn as EventListener, true);
      this.cleanups.push(() =>
        config.canvas.removeEventListener(name, fn as EventListener, true),
      );
    };
    const hit = (e: PointerEvent) => {
      const b = config.canvas.getBoundingClientRect(),
        ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - b.left) / b.width) * 2 - 1,
          (-(e.clientY - b.top) / b.height) * 2 + 1,
        ),
        config.camera(),
      );
      return ray.intersectObjects(
        this.handles.filter((h) => h.visible),
        false,
      )[0];
    };
    listen('pointerdown', (e) => {
      const state = config.current();
      if (!state.enabled || !state.volume || e.button !== 0) return;
      this.update();
      const picked = hit(e);
      if (!picked) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      config.finishMotion();
      const v = structuredClone(state.volume),
        { axis, side } = picked.object.userData as {
          axis: FaceAxis;
          side: 1 | -1;
        };
      const normal = new THREE.Vector3(
        axis === 'x' ? side : 0,
        axis === 'y' ? side : 0,
        axis === 'z' ? side : 0,
      ).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        (v.rotation * Math.PI) / 180,
      );
      const c = config.camera(),
        start = picked.object.position.clone(),
        a = start.clone().project(c),
        b = start.clone().add(normal).project(c),
        box = config.canvas.getBoundingClientRect();
      let sx = ((b.x - a.x) * box.width) / 2,
        sy = (-(b.y - a.y) * box.height) / 2;
      if (Math.hypot(sx, sy) < 8) {
        sx = 0;
        sy = -Math.max(
          8,
          box.height /
            Math.max(
              v.dimensions.width,
              v.dimensions.depth,
              v.dimensions.height,
              10,
            ),
        );
      }
      let profilePreview: THREE.Mesh | null = null;
      if (isFlat(v)) {
        const shape = new THREE.Shape();
        if (v.geometry?.kind === 'circle')
          shape.absellipse(
            0,
            0,
            v.dimensions.width / 2,
            v.dimensions.depth / 2,
            0,
            Math.PI * 2,
            false,
            0,
          );
        else {
          const points =
            v.geometry?.kind === 'polygon'
              ? v.geometry.points.map(
                  (p) =>
                    new THREE.Vector2(
                      p.x * v.dimensions.width,
                      -p.z * v.dimensions.depth,
                    ),
                )
              : [
                  new THREE.Vector2(
                    -v.dimensions.width / 2,
                    -v.dimensions.depth / 2,
                  ),
                  new THREE.Vector2(
                    v.dimensions.width / 2,
                    -v.dimensions.depth / 2,
                  ),
                  new THREE.Vector2(
                    v.dimensions.width / 2,
                    v.dimensions.depth / 2,
                  ),
                  new THREE.Vector2(
                    -v.dimensions.width / 2,
                    v.dimensions.depth / 2,
                  ),
                ];
          shape.setFromPoints(points);
        }
        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth: 1,
          bevelEnabled: false,
          curveSegments: 32,
        });
        geometry.rotateX(-Math.PI / 2);
        profilePreview = new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({
            color: v.color ?? '#99dcd4',
            roughness: 0.3,
            transparent: true,
            opacity: 0.85,
          }),
        );
        profilePreview.position.set(v.position.x, v.position.y, v.position.z);
        profilePreview.rotation.y = (v.rotation * Math.PI) / 180;
        profilePreview.scale.y = 0.001;
        config.scene.add(profilePreview);
      }
      this.drag = {
        v,
        axis,
        side,
        startX: e.clientX,
        startY: e.clientY,
        sx,
        sy,
        next: v,
        pointerId: e.pointerId,
        profilePreview,
      };
      config.canvas.setPointerCapture(e.pointerId);
      config.onDrag(true);
    });
    listen('pointermove', (e) => {
      if (!this.drag) {
        if (config.current().enabled)
          config.canvas.style.cursor = hit(e) ? 'grab' : '';
        return;
      }
      e.stopImmediatePropagation();
      e.preventDefault();
      const d = this.drag;
      let delta =
        ((e.clientX - d.startX) * d.sx + (e.clientY - d.startY) * d.sy) /
        (d.sx * d.sx + d.sy * d.sy);
      if (config.current().snap) delta = Math.round(delta / 0.5) * 0.5;
      const key = { x: 'width', y: 'height', z: 'depth' }[d.axis] as
        'width' | 'height' | 'depth';
      const base = isFlat(d.v) ? 0 : d.v.dimensions[key];
      delta = Math.max(0.1 - base, Math.min(500 - base, delta));
      if (d.axis === 'y' && d.side === -1)
        delta = Math.min(delta, d.v.position.y);
      try {
        d.next = pullFace(d.v, d.axis, d.side, delta);
      } catch {
        return;
      }
      const g = config.objects.get(d.v.id);
      if (g) {
        g.position.set(d.next.position.x, d.next.position.y, d.next.position.z);
        if (!isFlat(d.v))
          g.scale.set(
            d.next.dimensions.width / d.v.dimensions.width,
            d.next.dimensions.height / d.v.dimensions.height,
            d.next.dimensions.depth / d.v.dimensions.depth,
          );
      }
      if (d.profilePreview) d.profilePreview.scale.y = d.next.dimensions.height;
      config.onFeedback({
        axis: d.axis,
        size: d.next.dimensions[key],
        delta,
        extruding: isFlat(d.v),
      });
      const a = this.facePoint(d.v, d.axis, d.side),
        b = this.facePoint(d.next, d.axis, d.side);
      this.trail.geometry.dispose();
      this.trail.geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
      this.trail.computeLineDistances();
      this.trail.visible = true;
      this.update();
    });
    const end = (e: PointerEvent, commit: boolean) => {
      if (!this.drag) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      this.finish(commit);
    };
    listen('pointerup', (e) => end(e, true));
    listen('pointercancel', (e) => end(e, false));
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.drag) {
        e.stopImmediatePropagation();
        this.finish(false);
      }
    };
    window.addEventListener('keydown', escape, true);
    this.cleanups.push(() =>
      window.removeEventListener('keydown', escape, true),
    );
  }
  private facePoint(v: Volume, axis: FaceAxis, side: 1 | -1) {
    const p = new THREE.Vector3(
      axis === 'x' ? (side * v.dimensions.width) / 2 : 0,
      axis === 'y'
        ? side === 1
          ? v.dimensions.height
          : 0
        : v.dimensions.height / 2,
      axis === 'z' ? (side * v.dimensions.depth) / 2 : 0,
    );
    if (isFlat(v)) p.y = 0;
    return p
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), (v.rotation * Math.PI) / 180)
      .add(new THREE.Vector3(v.position.x, v.position.y, v.position.z));
  }
  update() {
    const state = this.config.current(),
      v = this.drag?.next ?? state.volume;
    this.root.visible = state.enabled && !!v;
    if (!v || !state.enabled) return;
    const camera = this.config.camera(),
      rect = this.config.canvas.getBoundingClientRect();
    const points: Record<string, { x: number; y: number }> = {};
    for (const h of this.handles) {
      const { axis, side } = h.userData as { axis: FaceAxis; side: 1 | -1 };
      h.visible = !isFlat(this.drag?.v ?? v) || (axis === 'y' && side === 1);
      h.position.copy(this.facePoint(v, axis, side));
      const size =
        camera instanceof THREE.OrthographicCamera
          ? (camera.top - camera.bottom) / camera.zoom
          : 2 *
            h.position.distanceTo(camera.position) *
            Math.tan(
              THREE.MathUtils.degToRad(
                (camera as THREE.PerspectiveCamera).fov / 2,
              ),
            );
      h.scale.setScalar((size / rect.height) * 6);
      const p = h.position.clone().project(camera);
      if (h.visible)
        points[`${axis}${side}`] = {
          x: ((p.x + 1) * rect.width) / 2 + rect.left,
          y: ((1 - p.y) * rect.height) / 2 + rect.top,
        };
    }
    this.config.canvas.dataset.pullHandles = JSON.stringify(points);
  }
  private finish(commit: boolean) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    const g = this.config.objects.get(d.v.id);
    if (g) {
      g.scale.set(1, 1, 1);
      g.position.set(d.v.position.x, d.v.position.y, d.v.position.z);
    }
    if (d.profilePreview) {
      this.config.scene.remove(d.profilePreview);
      d.profilePreview.geometry.dispose();
      (d.profilePreview.material as THREE.Material).dispose();
    }
    if (this.config.canvas.hasPointerCapture(d.pointerId))
      this.config.canvas.releasePointerCapture(d.pointerId);
    this.config.onDrag(false);
    this.trail.visible = false;
    this.config.onFeedback(null);
    if (commit && JSON.stringify(d.next) !== JSON.stringify(d.v))
      this.config.onCommit(d.next);
  }
  dispose() {
    this.finish(false);
    this.cleanups.forEach((f) => f());
    this.config.scene.remove(this.root, this.trail);
    this.handles[0].geometry.dispose();
    this.handles.forEach((h) => (h.material as THREE.Material).dispose());
    this.trail.geometry.dispose();
    (this.trail.material as THREE.Material).dispose();
  }
}
