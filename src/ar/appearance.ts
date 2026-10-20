import { Group, Mesh, MeshStandardMaterial } from 'three';

/** Share immutable geometry, own the display materials so AR never changes the project. */
export function cloneARView(model: Group) {
  const copy = model.clone(true);
  copy.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const clone = (m: MeshStandardMaterial) => {
      const next = m.clone();
      next.userData.arOriginal = {
        opacity: m.opacity,
        transparent: m.transparent,
        depthWrite: m.depthWrite,
      };
      return next;
    };
    o.material = Array.isArray(o.material)
      ? o.material.map(clone)
      : clone(o.material);
  });
  return copy;
}

export function setARTransparency(model: Group, transparent: boolean) {
  model.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      const original = m.userData.arOriginal;
      if (!original) continue;
      m.opacity = transparent
        ? Math.min(0.25, original.opacity)
        : original.opacity;
      m.transparent = transparent || original.transparent;
      m.depthWrite = transparent ? false : original.depthWrite;
      m.needsUpdate = true;
    }
  });
}

/** Geometry belongs to the prepared model; only dispose the cloned materials here. */
export function disposeARView(model: Group) {
  model.traverse((o) => {
    if (o instanceof Mesh)
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        m.dispose();
  });
}
