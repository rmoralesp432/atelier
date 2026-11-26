import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { WalkPlacement as Placement } from './walkPlacement';
type Runtime = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  orbit: { enabled: boolean };
  objects: Map<string, THREE.Group>;
};
export default function WalkPlacement({
  getRuntime,
  eyeHeight,
  floor,
  onComplete,
}: {
  getRuntime: () => Runtime | null;
  eyeHeight: number;
  floor: number;
  onComplete: (placement: Placement | null) => void;
}) {
  const [anchored, setAnchored] = useState(false);
  const [message, setMessage] = useState('Choose a floor or ground point');
  const latest = useRef(onComplete);
  latest.current = onComplete;
  useEffect(() => {
    const r = getRuntime();
    if (!r) return;
    const canvas = r.renderer.domElement,
      marker = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({
      color: '#cbbb97',
      transparent: true,
      opacity: 0.8,
      depthTest: false,
    });
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.39, 48),
      material,
    );
    ring.rotation.x = -Math.PI / 2;
    marker.add(ring);
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.16, eyeHeight * 0.65, 12),
      material,
    );
    body.position.y = eyeHeight * 0.45;
    marker.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 8),
      material,
    );
    head.position.y = eyeHeight;
    marker.add(head);
    marker.traverse((o) => (o.renderOrder = 30));
    marker.visible = false;
    const line = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({
        color: '#998a63',
        dashSize: 0.3,
        gapSize: 0.15,
        depthTest: false,
      }),
    );
    line.renderOrder = 30;
    line.visible = false;
    r.scene.add(marker, line);
    let anchor: THREE.Vector3 | null = null;
    const ray = new THREE.Raycaster();
    const point = (e: PointerEvent) => {
      const b = canvas.getBoundingClientRect();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - b.left) / b.width) * 2 - 1,
          (-(e.clientY - b.top) / b.height) * 2 + 1,
        ),
        r.camera,
      );
      if (!anchor) {
        const hit = ray
          .intersectObjects(
            [...r.objects.values()].filter((o) => o.visible),
            true,
          )
          .find((h) => {
            if (!(h.object instanceof THREE.Mesh)) return false;
            let parent: THREE.Object3D | null = h.object;
            while (parent) {
              if (!parent.visible) return false;
              parent = parent.parent;
            }
            const materials = Array.isArray(h.object.material)
              ? h.object.material
              : [h.object.material];
            return materials.some(
              (m) =>
                !m.clippingPlanes?.some(
                  (p: THREE.Plane) => p.distanceToPoint(h.point) < -0.001,
                ),
            );
          });
        if (hit?.face) {
          const normal = hit.face.normal
            .clone()
            .transformDirection(hit.object.matrixWorld);
          if (normal.y < 0.7 || hit.point.y < -0.02 || hit.point.y > 1000)
            return null;
          return hit.point.clone().setY(Math.max(0, hit.point.y));
        }
      }
      return ray.ray.intersectPlane(
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -(anchor?.y ?? floor)),
        new THREE.Vector3(),
      );
    };
    const move = (e: PointerEvent) => {
      const p = point(e);
      canvas.style.cursor = p ? 'crosshair' : 'not-allowed';
      if (!p) return;
      marker.visible = true;
      if (!anchor) marker.position.copy(p).add(new THREE.Vector3(0, 0.025, 0));
      else {
        line.geometry.dispose();
        line.geometry = new THREE.BufferGeometry().setFromPoints([
          anchor.clone().add(new THREE.Vector3(0, 0.04, 0)),
          p.clone().add(new THREE.Vector3(0, 0.04, 0)),
        ]);
        line.computeLineDistances();
        line.visible = true;
      }
      canvas.dataset.walkPlacement = JSON.stringify((anchor ?? p).toArray());
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const p = point(e);
      if (!p) {
        setMessage('Choose a horizontal surface or ground point');
        return;
      }
      if (!anchor) {
        anchor = p;
        marker.position.copy(p).y += 0.025;
        marker.visible = true;
        setAnchored(true);
        setMessage(`Floor ${p.y.toFixed(2)} m · click where to look`);
      } else {
        latest.current({
          position: { x: anchor.x, y: anchor.y, z: anchor.z },
          lookAt: { x: p.x, y: p.y, z: p.z },
        });
        canvas.focus();
      }
    };
    const up = (e: PointerEvent) => {
      if (e.button === 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        latest.current(null);
      }
    };
    canvas.addEventListener('pointerdown', down, true);
    canvas.addEventListener('pointerup', up, true);
    canvas.addEventListener('pointermove', move, true);
    window.addEventListener('keydown', key, true);
    return () => {
      canvas.removeEventListener('pointerdown', down, true);
      canvas.removeEventListener('pointerup', up, true);
      canvas.removeEventListener('pointermove', move, true);
      window.removeEventListener('keydown', key, true);
      canvas.style.cursor = '';
      delete canvas.dataset.walkPlacement;
      r.scene.remove(marker, line);
      ring.geometry.dispose();
      body.geometry.dispose();
      head.geometry.dispose();
      material.dispose();
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    };
  }, []);
  return (
    <div className="walk-placement-bar" role="status">
      <span className="placement-step">{anchored ? '02' : '01'}</span>
      <div>
        <strong>
          {anchored ? 'Set your direction' : 'Place yourself in the model'}
        </strong>
        <span>{message}</span>
      </div>
      <button onClick={() => onComplete(null)}>Cancel</button>
    </div>
  );
}
