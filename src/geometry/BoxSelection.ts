import * as THREE from 'three';
export function boxSelection(config: {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  camera: () => THREE.Camera;
  objects: Map<string, THREE.Group>;
  enabled: () => boolean;
  selectMode: () => boolean;
  onSelect: (ids: string[], additive: boolean) => void;
}) {
  const box = document.createElement('div');
  box.className = 'selection-marquee';
  box.hidden = true;
  config.container.appendChild(box);
  let start: { x: number; y: number; id: number; additive: boolean } | null =
    null;
  const handlers: (() => void)[] = [];
  const listen = (name: string, fn: (e: PointerEvent) => void) => {
    config.canvas.addEventListener(name, fn as EventListener, true);
    handlers.push(() =>
      config.canvas.removeEventListener(name, fn as EventListener, true),
    );
  };
  listen('pointerdown', (e) => {
    if (
      !config.enabled() ||
      e.button !== 0 ||
      e.altKey ||
      (!config.selectMode() && !e.shiftKey)
    )
      return;
    start = {
      x: e.clientX,
      y: e.clientY,
      id: e.pointerId,
      additive: e.shiftKey || e.ctrlKey || e.metaKey,
    };
    config.canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopImmediatePropagation();
  });
  listen('pointermove', (e) => {
    if (!start) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const r = config.container.getBoundingClientRect();
    box.hidden = false;
    box.classList.toggle('crossing', e.clientX < start.x);
    Object.assign(box.style, {
      left: `${Math.min(start.x, e.clientX) - r.left}px`,
      top: `${Math.min(start.y, e.clientY) - r.top}px`,
      width: `${Math.abs(e.clientX - start.x)}px`,
      height: `${Math.abs(e.clientY - start.y)}px`,
    });
  });
  const finish = (e: PointerEvent, cancel = false) => {
    const s = start;
    if (!s) return;
    start = null;
    box.hidden = true;
    if (config.canvas.hasPointerCapture(s.id))
      config.canvas.releasePointerCapture(s.id);
    e.preventDefault();
    e.stopImmediatePropagation();
    if (cancel) return;
    const r = config.canvas.getBoundingClientRect(),
      camera = config.camera(),
      left = Math.min(s.x, e.clientX),
      right = Math.max(s.x, e.clientX),
      top = Math.min(s.y, e.clientY),
      bottom = Math.max(s.y, e.clientY);
    if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 4) {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        ),
        camera,
      );
      const hit = ray
        .intersectObjects([...config.objects.values()], true)
        .find((h) => h.object instanceof THREE.Mesh);
      config.onSelect(hit ? [hit.object.parent!.userData.id] : [], s.additive);
      return;
    }
    const ids: string[] = [];
    for (const [id, g] of config.objects) {
      if (!g.visible) continue;
      const b = new THREE.Box3().setFromObject(g),
        p: THREE.Vector3[] = [];
      for (const x of [b.min.x, b.max.x])
        for (const y of [b.min.y, b.max.y])
          for (const z of [b.min.z, b.max.z])
            p.push(new THREE.Vector3(x, y, z).project(camera));
      if (p.every((v) => v.z < -1 || v.z > 1)) continue;
      const xs = p.map((v) => ((v.x + 1) * r.width) / 2 + r.left),
        ys = p.map((v) => ((1 - v.y) * r.height) / 2 + r.top),
        minX = Math.min(...xs),
        maxX = Math.max(...xs),
        minY = Math.min(...ys),
        maxY = Math.max(...ys);
      if (
        e.clientX >= s.x
          ? minX >= left && maxX <= right && minY >= top && maxY <= bottom
          : maxX >= left && minX <= right && maxY >= top && minY <= bottom
      )
        ids.push(id);
    }
    config.onSelect(ids, s.additive);
  };
  listen('pointerup', (e) => finish(e));
  listen('pointercancel', (e) => finish(e, true));
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && start) {
      if (config.canvas.hasPointerCapture(start.id))
        config.canvas.releasePointerCapture(start.id);
      start = null;
      box.hidden = true;
      e.stopImmediatePropagation();
    }
  };
  window.addEventListener('keydown', key, true);
  return () => {
    handlers.forEach((f) => f());
    window.removeEventListener('keydown', key, true);
    box.remove();
  };
}
