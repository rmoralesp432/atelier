import * as THREE from 'three';
import { isVisible, type Project } from '../model';
import type { SectionView } from '../studio/section';
import { groupBounds } from './spatial';
/** An independent view-plane manipulator: never edits model geometry or selection. */
export function sectionPlaneControls(config: {
  scene: THREE.Scene;
  canvas: HTMLCanvasElement;
  camera: () => THREE.Camera;
  current: () => {
    project: Project;
    section: SectionView;
    enabled: boolean;
    interactive: boolean;
    snap: boolean;
  };
  onChange: (section: SectionView) => void;
  onDrag: (active: boolean) => void;
}) {
  const root = new THREE.Group(),
    planeGeometry = new THREE.BufferGeometry(),
    outlineGeometry = new THREE.BufferGeometry();
  const face = new THREE.Mesh(
    planeGeometry,
    new THREE.MeshBasicMaterial({
      color: '#e8b475',
      transparent: true,
      opacity: 0.035,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const outline = new THREE.LineLoop(
    outlineGeometry,
    new THREE.LineBasicMaterial({
      color: '#e8b475',
      transparent: true,
      opacity: 0.85,
      depthTest: false,
    }),
  );
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({ color: '#e8b475', depthTest: false }),
  );
  const arrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(),
    2,
    0xe8b475,
  );
  root.add(face, outline, knob, arrow);
  root.renderOrder = 12;
  outline.renderOrder = 12;
  knob.renderOrder = 13;
  config.scene.add(root);
  let previousProject: Project | undefined,
    previousAxis: string | undefined,
    size = 10;
  const normal = new THREE.Vector3(),
    ray = new THREE.Raycaster();
  let drag: {
    id: number;
    x: number;
    y: number;
    sx: number;
    sy: number;
    original: SectionView;
  } | null = null;
  const screen = (p: THREE.Vector3) => {
    const b = config.canvas.getBoundingClientRect(),
      v = p.clone().project(config.camera());
    return {
      x: b.left + ((v.x + 1) * b.width) / 2,
      y: b.top + ((1 - v.y) * b.height) / 2,
    };
  };
  const update = () => {
    const { project, section, enabled, interactive } = config.current();
    knob.visible = interactive;
    arrow.visible = interactive;
    root.visible = enabled && !!section.planeVisible;
    config.canvas.dataset.sectionPlaneVisible = String(root.visible);
    if (!root.visible) {
      delete config.canvas.dataset.sectionHandle;
      return;
    }
    if (project !== previousProject || section.axis !== previousAxis) {
      previousProject = project;
      previousAxis = section.axis;
      const volumes = project.volumes.filter((v) => isVisible(v, project));
      const bounds = volumes.length
        ? groupBounds(volumes)
        : { min: { x: -5, y: 0, z: -5 }, max: { x: 5, y: 10, z: 5 } };
      const center = new THREE.Vector3(
        (bounds.min.x + bounds.max.x) / 2,
        (bounds.min.y + bounds.max.y) / 2,
        (bounds.min.z + bounds.max.z) / 2,
      );
      root.position.copy(center);
      normal.set(0, 0, 0);
      normal[section.axis] = 1;
      const axes = (['x', 'y', 'z'] as const).filter((a) => a !== section.axis),
        u = new THREE.Vector3(),
        v = new THREE.Vector3();
      const width =
          Math.max(8, bounds.max[axes[0]] - bounds.min[axes[0]]) * 1.3,
        height = Math.max(8, bounds.max[axes[1]] - bounds.min[axes[1]]) * 1.3;
      size = Math.max(width, height);
      u[axes[0]] = width / 2;
      v[axes[1]] = height / 2;
      const corners = [
        u.clone().negate().sub(v),
        u.clone().sub(v),
        u.clone().add(v),
        v.clone().sub(u),
      ];
      planeGeometry.setFromPoints(corners);
      planeGeometry.setIndex([0, 1, 2, 0, 2, 3]);
      planeGeometry.computeVertexNormals();
      planeGeometry.computeBoundingSphere();
      outlineGeometry.setFromPoints(corners);
      outlineGeometry.computeBoundingSphere();
      knob.position.copy(u);
      knob.scale.setScalar(Math.max(0.18, size * 0.018));
      arrow.position.copy(u);
      arrow.setDirection(normal);
      arrow.setLength(
        Math.max(1.5, size * 0.13),
        Math.max(0.3, size * 0.03),
        Math.max(0.2, size * 0.02),
      );
    }
    root.position[section.axis] = section.position;
    root.updateMatrixWorld(true);
    config.canvas.dataset.sectionHandle = JSON.stringify(
      screen(knob.getWorldPosition(new THREE.Vector3())),
    );
  };
  const down = (e: PointerEvent) => {
    if (
      e.button !== 0 ||
      !root.visible ||
      !config.current().interactive ||
      drag
    )
      return;
    const b = config.canvas.getBoundingClientRect();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - b.left) / b.width) * 2 - 1,
        (-(e.clientY - b.top) / b.height) * 2 + 1,
      ),
      config.camera(),
    );
    ray.params.Line = { threshold: Math.max(0.1, size * 0.01) };
    if (!ray.intersectObjects([knob, arrow, outline], true).length) return;
    const point = knob.getWorldPosition(new THREE.Vector3()),
      a = screen(point),
      c = screen(point.clone().add(normal)),
      sx = c.x - a.x,
      sy = c.y - a.y;
    if (Math.hypot(sx, sy) < 0.2) return; // End-on views need a different viewing angle or the precise position field.
    e.stopImmediatePropagation();
    e.preventDefault();
    drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      sx,
      sy,
      original: { ...config.current().section },
    };
    config.canvas.setPointerCapture(e.pointerId);
    config.onDrag(true);
  };
  const move = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const d = drag,
      delta =
        ((e.clientX - d.x) * d.sx + (e.clientY - d.y) * d.sy) /
        (d.sx * d.sx + d.sy * d.sy),
      step = config.current().snap ? 0.1 : 0.01;
    const position = Math.max(
      -1000,
      Math.min(1000, Math.round((d.original.position + delta) / step) * step),
    );
    config.onChange({
      ...config.current().section,
      position: Number(position.toFixed(2)),
    });
    update();
  };
  const finish = (cancel: boolean) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (config.canvas.hasPointerCapture(d.id))
      config.canvas.releasePointerCapture(d.id);
    config.onDrag(false);
    if (cancel) config.onChange(d.original);
  };
  const up = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    e.stopImmediatePropagation();
    finish(false);
  };
  const cancel = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    e.stopImmediatePropagation();
    finish(true);
  };
  const escape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && drag) {
      e.stopImmediatePropagation();
      e.preventDefault();
      finish(true);
    }
  };
  for (const [name, fn] of [
    ['pointerdown', down],
    ['pointermove', move],
    ['pointerup', up],
    ['pointercancel', cancel],
  ] as const)
    config.canvas.addEventListener(name, fn, true);
  window.addEventListener('keydown', escape, true);
  return {
    update,
    dispose: () => {
      finish(true);
      config.scene.remove(root);
      root.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            m.dispose(),
          );
        }
      });
      for (const [name, fn] of [
        ['pointerdown', down],
        ['pointermove', move],
        ['pointerup', up],
        ['pointercancel', cancel],
      ] as const)
        config.canvas.removeEventListener(name, fn, true);
      window.removeEventListener('keydown', escape, true);
    },
  };
}
