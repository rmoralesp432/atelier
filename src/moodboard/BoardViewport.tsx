import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { createARModel, disposeARModel } from '../ar/model';
import type { BoardItem, Moodboard } from './data';

function dispose(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        (m as THREE.MeshBasicMaterial).map?.dispose();
    }
  });
  disposeARModel(root);
}
function noteTexture(item: Extract<BoardItem, { kind: 'note' }>) {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 560;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#e4ece8';
  c.fillRect(0, 0, 800, 560);
  c.fillStyle = '#22332e';
  c.font = '500 32px sans-serif';
  c.fillText(item.title.slice(0, 38) || 'Reference', 45, 65);
  c.font = '26px sans-serif';
  let line = '',
    y = 130;
  for (const word of item.text.split(/\s+/)) {
    if (c.measureText(`${line} ${word}`).width > 705) {
      c.fillText(line, 45, y);
      y += 40;
      line = '';
    }
    if (y > 445) {
      line = '…';
      break;
    }
    line += `${word} `;
  }
  c.fillText(line, 45, y);
  if (item.url) {
    c.fillStyle = '#4d7366';
    c.font = '20px sans-serif';
    c.fillText(new URL(item.url).hostname, 45, 520);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function settleEntry(object: THREE.Object3D) {
  const entry = object.userData.entry;
  if (!entry) return;
  object.scale.copy(entry.scale);
  object.position.copy(entry.position);
  object.traverse((o) => {
    if (o instanceof THREE.Mesh)
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        m.opacity = m.userData.entryOpacity;
        m.transparent = m.userData.entryTransparent;
        m.needsUpdate = true;
      }
  });
  delete object.userData.entry;
}
function frameBoard(
  camera: THREE.PerspectiveCamera,
  orbit: OrbitControls,
  root: THREE.Group,
) {
  const bounds = new THREE.Box3().setFromObject(root);
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new THREE.Vector3()),
    size = bounds.getSize(new THREE.Vector3());
  const distance =
    (Math.max(size.y, size.x / camera.aspect, 4) /
      Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) *
      0.7 +
    size.z;
  const direction = camera.position.clone().sub(orbit.target).normalize();
  orbit.target.copy(center);
  camera.position
    .copy(center)
    .addScaledVector(direction, Math.min(210, distance));
  orbit.update();
}
export default function BoardViewport({
  board,
  selected,
  onSelect,
  onMove,
  onError,
  day,
  frame,
}: {
  board: Moodboard;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, position: BoardItem['position']) => void;
  onError: (message: string) => void;
  day: boolean;
  frame: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const framedCount = useRef(-1);
  const knownIds = useRef(new Set<string>());
  const live = useRef({ onSelect, onMove, onError, selected });
  live.current = { onSelect, onMove, onError, selected };
  const runtime = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    orbit: OrbitControls;
    transform: TransformControls;
    root: THREE.Group;
    renderer: THREE.WebGLRenderer;
    selection: THREE.BoxHelper;
  } | null>(null);
  useEffect(() => {
    const node = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      live.current.onError(
        '3D moodboard could not start. WebGL is unavailable.',
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-label', '3D moodboard canvas');
    node.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      root = new THREE.Group();
    scene.add(root);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x7f9a92, 2.4));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(6, 12, 10);
    scene.add(light);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 1000);
    camera.position.set(2, 4, 21);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.target.set(0, 1, 0);
    orbit.enableDamping = true;
    orbit.minDistance = 2;
    orbit.maxDistance = 220;
    const transform = new TransformControls(camera, renderer.domElement);
    transform.setMode('translate');
    transform.setSize(0.7);
    scene.add(transform.getHelper());
    const selection = new THREE.BoxHelper(new THREE.Object3D(), 0x80d5c3);
    selection.visible = false;
    scene.add(selection);
    const pick = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let drag: {
      id: string;
      pointerId: number;
      object: THREE.Object3D;
      plane: THREE.Plane;
      start: THREE.Vector3;
      origin: THREE.Vector3;
      x: number;
      y: number;
      moved: boolean;
    } | null = null;
    let gizmoStart: THREE.Vector3 | null = null;
    const ray = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      pick.setFromCamera(pointer, camera);
    };
    const down = (e: PointerEvent) => {
      if (drag) {
        e.stopImmediatePropagation();
        return;
      }
      root.children.forEach(settleEntry);
      if (e.button !== 0 || transform.axis) return;
      ray(e);
      const hit = pick.intersectObject(root, true)[0];
      if (!hit) return;
      const id = hit.object.userData.boardId as string,
        object = root.children.find((o) => o.userData.boardId === id);
      if (!object) return;
      e.stopImmediatePropagation();
      renderer.domElement.setPointerCapture(e.pointerId);
      orbit.enabled = false;
      live.current.onSelect(id);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        camera.getWorldDirection(new THREE.Vector3()),
        hit.point,
      );
      drag = {
        id,
        pointerId: e.pointerId,
        object,
        plane,
        start: hit.point.clone(),
        origin: object.position.clone(),
        x: e.clientX,
        y: e.clientY,
        moved: false,
      };
    };
    const move = (e: PointerEvent) => {
      if (!drag || drag.pointerId !== e.pointerId) return;
      e.stopImmediatePropagation();
      ray(e);
      const point = pick.ray.intersectPlane(drag.plane, new THREE.Vector3());
      if (point && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 3) {
        drag.moved = true;
        drag.object.position
          .copy(drag.origin)
          .add(point.sub(drag.start))
          .clampScalar(-100, 100);
      }
    };
    const end = (e: PointerEvent) => {
      if (!drag || drag.pointerId !== e.pointerId) return;
      e.stopImmediatePropagation();
      orbit.enabled = true;
      if (renderer.domElement.hasPointerCapture(e.pointerId))
        renderer.domElement.releasePointerCapture(e.pointerId);
      if (e.type === 'pointercancel') drag.object.position.copy(drag.origin);
      else if (drag.moved)
        live.current.onMove(drag.id, { ...drag.object.position });
      drag = null;
    };
    const change = (event: { value?: unknown }) => {
      orbit.enabled = !event.value;
      if (event.value) gizmoStart = transform.object?.position.clone() ?? null;
    };
    const finish = () => {
      const object = transform.object;
      if (object && gizmoStart && !gizmoStart.equals(object.position)) {
        object.position.clampScalar(-100, 100);
        live.current.onMove(object.userData.boardId, { ...object.position });
      }
      gizmoStart = null;
    };
    transform.addEventListener('dragging-changed', change);
    transform.addEventListener('mouseUp', finish);
    renderer.domElement.addEventListener('pointerdown', down, true);
    renderer.domElement.addEventListener('pointermove', move, true);
    renderer.domElement.addEventListener('pointerup', end, true);
    renderer.domElement.addEventListener('pointercancel', end, true);
    const observer = new ResizeObserver(() => {
      const { width, height } = node.getBoundingClientRect();
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    });
    observer.observe(node);
    runtime.current = {
      scene,
      camera,
      orbit,
      transform,
      root,
      renderer,
      selection,
    };
    renderer.setAnimationLoop(() => {
      orbit.update();
      let entering = 0;
      for (const object of root.children) {
        const entry = object.userData.entry;
        if (!entry) continue;
        const t = Math.max(
          0,
          Math.min(1, (performance.now() - entry.start) / 1100),
        );
        if (t === 1 || matchMedia('(prefers-reduced-motion: reduce)').matches) {
          settleEntry(object);
          continue;
        }
        entering++;
        const ease = 1 - Math.pow(1 - t, 3);
        object.position.copy(entry.position);
        object.position.y += 0.35 * (1 - ease);
        object.scale.copy(entry.scale).multiplyScalar(0.92 + 0.08 * ease);
        object.traverse((o) => {
          if (o instanceof THREE.Mesh)
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material])
              m.opacity = m.userData.entryOpacity * ease;
        });
      }
      node.dataset.animating = String(entering > 0);
      if (selection.visible) selection.update();
      renderer.render(scene, camera);
      const bounds = renderer.domElement.getBoundingClientRect();
      node.dataset.centers = JSON.stringify(
        root.children.map((o) => {
          const p = o.position.clone().project(camera);
          return {
            id: o.userData.boardId,
            x: bounds.left + ((p.x + 1) * bounds.width) / 2,
            y: bounds.top + ((1 - p.y) * bounds.height) / 2,
          };
        }),
      );
    });
    return () => {
      runtime.current = null;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      transform.detach();
      transform.dispose();
      orbit.dispose();
      dispose(root);
      selection.geometry.dispose();
      (selection.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  useEffect(() => {
    const r = runtime.current;
    if (!r) return;
    let cancelled = false;
    r.transform.detach();
    r.selection.visible = false;
    for (const old of [...r.root.children]) {
      r.root.remove(old);
      dispose(old);
    }
    host.current!.dataset.ready = 'false';
    void (async () => {
      for (const item of board.items) {
        let object: THREE.Object3D | undefined;
        try {
          if (item.kind === 'model') {
            const model = await createARModel(item.project);
            const bounds = new THREE.Box3().setFromObject(model),
              center = bounds.getCenter(new THREE.Vector3()),
              size = bounds.getSize(new THREE.Vector3());
            model.position.sub(center);
            const container = new THREE.Group();
            container.add(model);
            container.scale.setScalar(
              3.6 / Math.max(size.x, size.y, size.z, 0.001),
            );
            object = new THREE.Group();
            object.add(container);
          } else {
            const texture =
              item.kind === 'image'
                ? await new THREE.TextureLoader().loadAsync(item.image)
                : noteTexture(item);
            texture.colorSpace = THREE.SRGBColorSpace;
            const ratio =
              item.kind === 'image'
                ? texture.image.width / texture.image.height
                : 800 / 560;
            object = new THREE.Mesh(
              new THREE.PlaneGeometry(
                4,
                4 / Math.max(0.25, Math.min(4, ratio)),
              ),
              new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
              }),
            );
          }
          if (cancelled) {
            dispose(object);
            return;
          }
          object.position.set(
            item.position.x,
            item.position.y,
            item.position.z,
          );
          object.rotation.y = THREE.MathUtils.degToRad(item.rotation);
          object.scale.multiplyScalar(item.scale);
          object.traverse((o) => {
            o.userData.boardId = item.id;
          });
          r.root.add(object);
          if (
            !knownIds.current.has(item.id) &&
            !matchMedia('(prefers-reduced-motion: reduce)').matches
          ) {
            object.userData.entry = {
              start:
                performance.now() + Math.min(r.root.children.length * 70, 280),
              position: object.position.clone(),
              scale: object.scale.clone(),
            };
            object.traverse((o) => {
              if (o instanceof THREE.Mesh)
                for (const m of Array.isArray(o.material)
                  ? o.material
                  : [o.material]) {
                  m.userData.entryOpacity = m.opacity;
                  m.userData.entryTransparent = m.transparent;
                  m.transparent = true;
                  m.needsUpdate = true;
                }
            });
          }
        } catch (e) {
          if (object) dispose(object);
          if (!cancelled)
            live.current.onError(
              `Could not display ${item.title || 'reference'}: ${(e as Error).message}`,
            );
        }
      }
      if (!cancelled) {
        const object = r.root.children.find(
          (o) => o.userData.boardId === live.current.selected,
        );
        if (object) {
          r.transform.attach(object);
          r.selection.setFromObject(object);
          r.selection.visible = true;
        }
        if (framedCount.current !== board.items.length) {
          frameBoard(r.camera, r.orbit, r.root);
          framedCount.current = board.items.length;
        }
        knownIds.current = new Set(board.items.map((i) => i.id));
        host.current!.dataset.ready = 'true';
        host.current!.dataset.items = String(r.root.children.length);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [board]);
  useEffect(() => {
    const r = runtime.current;
    if (!r) return;
    const object = r.root.children.find((o) => o.userData.boardId === selected);
    r.transform.detach();
    r.selection.visible = !!object;
    if (object) {
      r.transform.attach(object);
      r.selection.setFromObject(object);
    }
  }, [selected]);
  useEffect(() => {
    const r = runtime.current;
    if (!r) return;
    r.scene.background = new THREE.Color(day ? '#e7edeb' : '#151d20');
  }, [day]);
  useEffect(() => {
    const r = runtime.current;
    if (!r || !frame) return;
    r.root.children.forEach(settleEntry);
    frameBoard(r.camera, r.orbit, r.root);
  }, [frame]);
  return (
    <div
      className="moodboard-canvas"
      ref={host}
      data-testid="moodboard-viewport"
    />
  );
}
