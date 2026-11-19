import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { CameraSettings } from '../studio/camera';
export class WalkControls {
  private keys = new Set<string>();
  private drag: { x: number; y: number } | null = null;
  private active = false;
  private placementRevision = -1;
  private previous: { position: THREE.Vector3; target: THREE.Vector3 } | null =
    null;
  private cleanup: (() => void)[] = [];
  constructor(
    private canvas: HTMLCanvasElement,
    private camera: () => THREE.Camera,
    private orbit: OrbitControls,
    private settings: () => CameraSettings,
    private bounds: () => THREE.Box3,
  ) {
    const pointer = (e: PointerEvent) => {
      if (!this.settings().walk) return;
      if (e.type === 'pointerdown' && e.button === 0) {
        canvas.focus();
        this.drag = { x: e.clientX, y: e.clientY };
        canvas.setPointerCapture(e.pointerId);
      } else if (e.type === 'pointermove' && this.drag) {
        const camera = this.camera(),
          rotation = new THREE.Euler().setFromQuaternion(
            camera.quaternion,
            'YXZ',
          );
        rotation.y -= (e.clientX - this.drag.x) * 0.003;
        rotation.x = THREE.MathUtils.clamp(
          rotation.x - (e.clientY - this.drag.y) * 0.003,
          -1.5,
          1.5,
        );
        camera.quaternion.setFromEuler(rotation);
        this.drag = { x: e.clientX, y: e.clientY };
      } else if (e.type === 'pointerup' || e.type === 'pointercancel') {
        this.drag = null;
        if (canvas.hasPointerCapture(e.pointerId))
          canvas.releasePointerCapture(e.pointerId);
      }
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    for (const name of [
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
    ]) {
      canvas.addEventListener(name, pointer as EventListener, true);
      this.cleanup.push(() =>
        canvas.removeEventListener(name, pointer as EventListener, true),
      );
    }
    const key = (e: KeyboardEvent) => {
      if (!this.settings().walk || document.activeElement !== canvas) return;
      const k = e.key.toLowerCase();
      if (
        ![
          'w',
          'a',
          's',
          'd',
          'arrowup',
          'arrowdown',
          'arrowleft',
          'arrowright',
          'shift',
        ].includes(k)
      )
        return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.type === 'keydown') this.keys.add(k);
      else this.keys.delete(k);
    };
    for (const name of ['keydown', 'keyup'] as const) {
      window.addEventListener(name, key, true);
      this.cleanup.push(() => window.removeEventListener(name, key, true));
    }
    const blur = () => {
      this.keys.clear();
      this.drag = null;
    };
    window.addEventListener('blur', blur);
    canvas.addEventListener('blur', blur);
    this.cleanup.push(() => {
      window.removeEventListener('blur', blur);
      canvas.removeEventListener('blur', blur);
    });
  }
  update(delta: number) {
    const settings = this.settings(),
      camera = this.camera();
    if (settings.walk && !this.active) {
      this.previous = {
        position: camera.position.clone(),
        target: this.orbit.target.clone(),
      };
      const b = this.bounds(),
        center = b.isEmpty()
          ? new THREE.Vector3()
          : b.getCenter(new THREE.Vector3());
      camera.position.set(
        center.x,
        settings.level + settings.eyeHeight,
        b.isEmpty() ? 8 : b.max.z + 3,
      );
      camera.lookAt(center.x, camera.position.y, center.z);
      this.orbit.enabled = false;
      this.active = true;
    } else if (!settings.walk && this.active) {
      if (this.previous) {
        camera.position.copy(this.previous.position);
        this.orbit.target.copy(this.previous.target);
      }
      this.orbit.enabled = true;
      this.active = false;
      this.keys.clear();
      this.drag = null;
    }
    if (!settings.walk) return;
    if (
      settings.placement &&
      settings.placement.revision !== this.placementRevision
    ) {
      const { position, lookAt, revision } = settings.placement;
      camera.position.set(
        position.x,
        settings.level + settings.eyeHeight,
        position.z,
      );
      const dx = lookAt.x - position.x,
        dz = lookAt.z - position.z;
      camera.lookAt(
        position.x + (Math.hypot(dx, dz) < 0.001 ? 0 : dx),
        camera.position.y,
        position.z + (Math.hypot(dx, dz) < 0.001 ? -1 : dz),
      );
      this.placementRevision = revision;
    }
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();
    const right = new THREE.Vector3(-direction.z, 0, direction.x);
    const forward =
      Number(this.keys.has('w') || this.keys.has('arrowup')) -
      Number(this.keys.has('s') || this.keys.has('arrowdown'));
    const sideways =
      Number(this.keys.has('d') || this.keys.has('arrowright')) -
      Number(this.keys.has('a') || this.keys.has('arrowleft'));
    const motion = direction
      .multiplyScalar(forward)
      .addScaledVector(right, sideways);
    if (motion.lengthSq())
      camera.position.addScaledVector(
        motion.normalize(),
        Math.min(delta, 0.05) * (this.keys.has('shift') ? 4 : 1.4),
      );
    camera.position.y = settings.level + settings.eyeHeight;
    this.orbit.target
      .copy(camera.position)
      .add(camera.getWorldDirection(new THREE.Vector3()));
    this.canvas.dataset.eyeElevation = String(camera.position.y);
    this.canvas.dataset.walkPosition = JSON.stringify(
      camera.position.toArray(),
    );
  }
  dispose() {
    this.cleanup.forEach((f) => f());
  }
}
