import {
  MathUtils,
  OrthographicCamera,
  PerspectiveCamera,
  Spherical,
  Vector2,
  Vector3,
} from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** One gesture owner: two fingers pan, pinch AND twist without changing tools.
 * Capture handlers keep selection and transform controls out of navigation. */
export function installTouchNavigation(
  canvas: HTMLCanvasElement,
  controls: OrbitControls<PerspectiveCamera | OrthographicCamera>,
  mode: () => 'orbit' | 'pan' | null,
) {
  const points = new Map<number, Vector2>();
  let moved = false,
    multi = false,
    start = new Vector2(),
    previousDamping = true;
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let held = false;
  let lastTap = { time: -Infinity, x: 0, y: 0 };
  const cancelHold = () => {
    clearTimeout(holdTimer);
    holdTimer = undefined;
  };
  const action = (kind: 'hold' | 'double', x: number, y: number) =>
    canvas.dispatchEvent(
      new CustomEvent('atelier-touch-action', { detail: { kind, x, y } }),
    );
  const metrics = () => {
    const p = [...points.values()];
    return {
      center:
        p.length > 1
          ? p[0].clone().add(p[1]).multiplyScalar(0.5)
          : p[0].clone(),
      distance: p.length > 1 ? p[0].distanceTo(p[1]) : 0,
      angle: p.length > 1 ? Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x) : 0,
    };
  };
  const pan = (dx: number, dy: number) => {
    const camera = controls.object,
      height = Math.max(1, canvas.clientHeight);
    const scale =
      camera instanceof PerspectiveCamera
        ? (2 *
            camera.position.distanceTo(controls.target) *
            Math.tan(MathUtils.degToRad(camera.fov / 2))) /
          height
        : (camera.top - camera.bottom) / camera.zoom / height;
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0),
      up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const shift = right
      .multiplyScalar(-dx * scale)
      .addScaledVector(up, dy * scale);
    camera.position.add(shift);
    controls.target.add(shift);
  };
  const turn = (dx: number, dy: number) => {
    const camera = controls.object,
      offset = camera.position.clone().sub(controls.target);
    const sphere = new Spherical().setFromVector3(offset);
    sphere.theta -= dx;
    sphere.phi = MathUtils.clamp(sphere.phi - dy, 0.05, controls.maxPolarAngle);
    camera.position
      .copy(controls.target)
      .add(new Vector3().setFromSpherical(sphere));
  };
  const stop = (e: PointerEvent) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const down = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || !mode()) return;
    if (!points.size) {
      moved = false;
      held = false;
      multi = false;
      start.set(e.clientX, e.clientY);
      previousDamping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
    }
    points.set(e.pointerId, new Vector2(e.clientX, e.clientY));
    if (points.size > 1) {
      multi = true;
      cancelHold();
      lastTap.time = -Infinity;
    } else {
      cancelHold();
      holdTimer = setTimeout(() => {
        if (!moved && !multi && points.size === 1) {
          held = true;
          lastTap.time = -Infinity;
          action('hold', e.clientX, e.clientY);
        }
      }, 550);
    }
    canvas.setPointerCapture(e.pointerId);
    // Let the viewport record the tap start; block OrbitControls in bubble phase.
    if (points.size === 1)
      canvas.dispatchEvent(
        new CustomEvent('atelier-touch-start', {
          detail: { x: e.clientX, y: e.clientY },
        }),
      );
    stop(e);
    controls.dispatchEvent({ type: 'start' });
  };
  const move = (e: PointerEvent) => {
    if (!points.has(e.pointerId)) return;
    if (held) {
      stop(e);
      return;
    }
    const before = metrics();
    points.get(e.pointerId)!.set(e.clientX, e.clientY);
    const after = metrics();
    moved ||= multi || start.distanceTo(points.get(e.pointerId)!) > 8;
    if (moved) {
      cancelHold();
      lastTap.time = -Infinity;
    }
    const delta = after.center.clone().sub(before.center),
      camera = controls.object;
    if (points.size > 1) {
      pan(delta.x, delta.y);
      if (before.distance > 4 && after.distance > 4) {
        const ratio = MathUtils.clamp(
          before.distance / after.distance,
          0.8,
          1.25,
        );
        if (camera instanceof PerspectiveCamera) {
          const offset = camera.position.clone().sub(controls.target);
          offset.setLength(
            MathUtils.clamp(offset.length() * ratio, 0.2, controls.maxDistance),
          );
          camera.position.copy(controls.target).add(offset);
        } else {
          camera.zoom = MathUtils.clamp(camera.zoom / ratio, 0.05, 2000);
          camera.updateProjectionMatrix();
        }
      }
      const angle = Math.atan2(
        Math.sin(after.angle - before.angle),
        Math.cos(after.angle - before.angle),
      );
      turn(angle, 0);
    } else if (mode() === 'pan') pan(delta.x, delta.y);
    else
      turn(
        (delta.x / canvas.clientHeight) * Math.PI,
        (delta.y / canvas.clientHeight) * Math.PI,
      );
    camera.lookAt(controls.target);
    controls.update();
    controls.dispatchEvent({ type: 'change' });
    stop(e);
  };
  const end = (e: PointerEvent) => {
    if (!points.has(e.pointerId)) return;
    cancelHold();
    let doubled = false;
    if (!moved && !multi && !held && e.type === 'pointerup') {
      const now = e.timeStamp;
      if (
        now - lastTap.time < 450 &&
        Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 28
      ) {
        doubled = true;
        lastTap.time = -Infinity;
        action('double', e.clientX, e.clientY);
      } else lastTap = { time: now, x: e.clientX, y: e.clientY };
    } else lastTap.time = -Infinity;
    points.delete(e.pointerId);
    if (canvas.hasPointerCapture(e.pointerId))
      canvas.releasePointerCapture(e.pointerId);
    // A tap still reaches the normal picker, with a fresh matching down position.
    if (moved || multi || held || doubled || e.type !== 'pointerup') stop(e);
    if (!points.size) {
      controls.enableDamping = previousDamping;
      controls.dispatchEvent({ type: 'end' });
    }
  };
  canvas.addEventListener('pointerdown', down, true);
  canvas.addEventListener('pointermove', move, true);
  canvas.addEventListener('pointerup', end, true);
  canvas.addEventListener('pointercancel', end, true);
  return () => {
    canvas.removeEventListener('pointerdown', down, true);
    canvas.removeEventListener('pointermove', move, true);
    canvas.removeEventListener('pointerup', end, true);
    canvas.removeEventListener('pointercancel', end, true);
    cancelHold();
    points.clear();
    controls.enableDamping = previousDamping;
  };
}
