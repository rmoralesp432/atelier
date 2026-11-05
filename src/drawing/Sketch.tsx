import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Circle, Square, PenLine, X, Undo2 } from 'lucide-react';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Operation } from '../intelligence/plan';
import { isVisible, type Project } from '../model';
import {
  profileOperation,
  previewPoints,
  drawingPoint,
  type DrawingMode,
  type Point,
} from './profile';

type Runtime = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  orbit: OrbitControls;
  finishConstruction: () => void;
};
type Props = {
  mode: DrawingMode;
  project: Project;
  snap: boolean;
  getRuntime: () => Runtime | null;
  onMode: (m: DrawingMode) => void;
  onCommit: (op: Operation) => Promise<void>;
  onClose: () => void;
};
export default function Sketch(props: Props) {
  const latest = useRef(props);
  latest.current = props;
  const [elevation, setElevation] = useState(0);
  const [count, setCount] = useState(0);
  const [readout, setReadout] = useState('Click to place the first corner');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [exactA, setExactA] = useState('');
  const [exactB, setExactB] = useState('');
  const actions = useRef<{
    finish: () => void;
    back: () => void;
    exact: (a: number, b: number) => void;
  } | null>(null);
  useEffect(() => {
    const r = latest.current.getRuntime();
    if (!r) return;
    r.finishConstruction();
    const canvas = r.renderer.domElement,
      mode = props.mode;
    const oldMiddle = r.orbit.mouseButtons.MIDDLE;
    r.orbit.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
    const oldCursor = canvas.style.cursor;
    canvas.style.cursor = 'crosshair';
    const root = new THREE.Group();
    r.scene.add(root);
    const line = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: '#d8eee6',
        depthTest: false,
        transparent: true,
        opacity: 0.9,
      }),
    );
    line.renderOrder = 20;
    root.add(line);
    const fill = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: '#b6cfc6',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.17,
        depthWrite: false,
        depthTest: false,
      }),
    );
    fill.renderOrder = 19;
    root.add(fill);
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 8),
      new THREE.MeshBasicMaterial({ color: '#f5eee0', depthTest: false }),
    );
    marker.renderOrder = 21;
    root.add(marker);
    marker.visible = false;
    const ray = new THREE.Raycaster(),
      plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -elevation);
    let points: Point[] = [],
      cursor: Point = { x: 0, z: 0 },
      disposed = false,
      committing = false;
    let pointer: { id: number; x: number; y: number } | null = null;
    let inference = '';
    setCount(0);
    setError('');
    setExactA('');
    setExactB('');
    setReadout(
      mode === 'circle'
        ? 'Click to place the center'
        : 'Click to place the first corner',
    );
    const world = (e: PointerEvent): Point | null => {
      const b = canvas.getBoundingClientRect();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - b.x) / b.width) * 2 - 1,
          (-(e.clientY - b.y) / b.height) * 2 + 1,
        ),
        latest.current.getRuntime()!.camera,
      );
      const hit = ray.ray.intersectPlane(plane, new THREE.Vector3());
      if (!hit || Math.abs(hit.x) > 1000 || Math.abs(hit.z) > 1000) return null;
      let p = drawingPoint(
        mode,
        hit,
        latest.current.snap ? 0.5 : 0.001,
        points.at(-1),
        e.shiftKey,
      );
      inference =
        e.shiftKey && points.length
          ? mode === 'rectangle'
            ? 'Square'
            : 'Axis locked'
          : latest.current.snap
            ? '0.5 m snap'
            : '';
      // Screen-space endpoint inference remains useful at every zoom level.
      const endpoints: Point[] = [...points];
      latest.current.project.volumes
        .filter(
          (v) =>
            isVisible(v, latest.current.project) &&
            Math.abs(v.position.y - elevation) < 0.02,
        )
        .forEach((v) => {
          const shape = v.geometry?.kind;
          if (
            shape &&
            !['box', 'rectangle', 'polygon', 'extrusion'].includes(shape)
          )
            return;
          if (
            shape === 'extrusion' &&
            v.geometry?.kind === 'extrusion' &&
            v.geometry.profile === 'circle'
          )
            return;
          const local =
            v.geometry?.kind === 'polygon'
              ? v.geometry.points.map((p) => ({
                  x: p.x * v.dimensions.width,
                  z: p.z * v.dimensions.depth,
                }))
              : [
                  { x: -v.dimensions.width / 2, z: -v.dimensions.depth / 2 },
                  { x: v.dimensions.width / 2, z: -v.dimensions.depth / 2 },
                  { x: v.dimensions.width / 2, z: v.dimensions.depth / 2 },
                  { x: -v.dimensions.width / 2, z: v.dimensions.depth / 2 },
                ];
          const angle = (v.rotation * Math.PI) / 180;
          endpoints.push(
            ...local.map((p) => ({
              x: v.position.x + p.x * Math.cos(angle) + p.z * Math.sin(angle),
              z: v.position.z - p.x * Math.sin(angle) + p.z * Math.cos(angle),
            })),
          );
        });
      let nearest = 10;
      if (!e.shiftKey)
        for (const point of endpoints) {
          const screen = new THREE.Vector3(point.x, elevation, point.z).project(
            latest.current.getRuntime()!.camera,
          );
          const d = Math.hypot(
            ((screen.x + 1) * b.width) / 2 + b.x - e.clientX,
            ((-screen.y + 1) * b.height) / 2 + b.y - e.clientY,
          );
          if (screen.z < 1 && d < nearest) {
            nearest = d;
            p = point;
            inference =
              point === points[0] && points.length >= 3
                ? 'Close outline'
                : 'Endpoint';
          }
        }
      return p;
    };
    const redraw = () => {
      const verts = previewPoints(mode, points, cursor);
      line.geometry.dispose();
      fill.geometry.dispose();
      line.geometry = new THREE.BufferGeometry().setFromPoints(
        (verts.length ? [...verts, verts[0]] : []).map(
          (p) => new THREE.Vector3(p.x, elevation + 0.012, p.z),
        ),
      );
      if (verts.length >= 3) {
        const shape = new THREE.Shape(
          verts.map((p) => new THREE.Vector2(p.x, -p.z)),
        );
        fill.geometry = new THREE.ShapeGeometry(shape);
        fill.rotation.x = -Math.PI / 2;
        fill.position.y = elevation + 0.008;
      } else fill.geometry = new THREE.BufferGeometry();
      marker.visible = true;
      marker.position.set(cursor.x, elevation + 0.02, cursor.z);
      const camera = latest.current.getRuntime()!.camera;
      const distance = camera.position.distanceTo(marker.position);
      marker.scale.setScalar(
        camera instanceof THREE.OrthographicCamera
          ? ((camera.top - camera.bottom) / camera.zoom) * 0.004
          : distance * 0.003,
      );
      setCount(points.length);
      if (points.length) {
        const a = points[0],
          last = points.at(-1)!;
        const value =
          mode === 'rectangle'
            ? `${Math.abs(cursor.x - a.x).toFixed(2)} × ${Math.abs(cursor.z - a.z).toFixed(2)} m`
            : mode === 'circle'
              ? `Radius ${Math.hypot(cursor.x - a.x, cursor.z - a.z).toFixed(2)} m`
              : `Edge ${Math.hypot(cursor.x - last.x, cursor.z - last.z).toFixed(2)} m · ${points.length} corners`;
        setReadout(`${value}${inference ? ` · ${inference}` : ''}`);
      } else
        setReadout(
          mode === 'circle'
            ? 'Click to place the center'
            : 'Click to place the first corner',
        );
      canvas.dataset.sketchPoints = String(points.length);
      canvas.dataset.sketchCursor = `${cursor.x},${cursor.z}`;
    };
    const commit = async (vertices: Point[]) => {
      if (committing) return;
      try {
        let index = latest.current.project.volumes.length + 1;
        while (
          latest.current.project.volumes.some(
            (v) => v.name === `Drawn ${mode} ${index}`,
          )
        )
          index++;
        const op = profileOperation(
          mode,
          vertices,
          elevation,
          `Drawn ${mode} ${index}`,
        );
        committing = true;
        setPending(true);
        setError('');
        await latest.current.onCommit(op);
      } catch (e) {
        if (!disposed)
          setError(
            e instanceof Error ? e.message : 'Could not create this face.',
          );
      } finally {
        committing = false;
        if (!disposed) setPending(false);
      }
    };
    const finish = () => {
      if (mode === 'outline') void commit(points);
    };
    const back = () => {
      points.pop();
      setError('');
      redraw();
    };
    actions.current = {
      finish,
      back,
      exact: (a, b) => {
        if (!points.length) return;
        const first = points[0];
        if (mode === 'rectangle')
          void commit([
            first,
            {
              x: first.x + (cursor.x < first.x ? -a : a),
              z: first.z + (cursor.z < first.z ? -b : b),
            },
          ]);
        else if (mode === 'circle')
          void commit([first, { x: first.x + a, z: first.z }]);
        else {
          const last = points.at(-1)!,
            length = Math.hypot(cursor.x - last.x, cursor.z - last.z);
          if (length < 0.001) {
            setError('Move the pointer to choose an edge direction first.');
            return;
          }
          cursor = {
            x: last.x + ((cursor.x - last.x) * a) / length,
            z: last.z + ((cursor.z - last.z) * a) / length,
          };
          points.push({ ...cursor });
          redraw();
        }
      },
    };
    const stop = (e: Event) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || !e.isPrimary || committing) return;
      stop(e);
      canvas.focus({ preventScroll: true });
      pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!e.isPrimary || committing) return;
      const p = world(e);
      if (!p) return;
      cursor = p;
      redraw();
      if (pointer) stop(e);
    };
    const up = (e: PointerEvent) => {
      if (e.button !== 0 || !pointer || pointer.id !== e.pointerId) return;
      stop(e);
      const down = pointer;
      pointer = null;
      if (canvas.hasPointerCapture(e.pointerId))
        canvas.releasePointerCapture(e.pointerId);
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return;
      const p = world(e);
      if (!p) return;
      cursor = p;
      if (
        mode === 'outline' &&
        points.length >= 3 &&
        p.x === points[0].x &&
        p.z === points[0].z
      ) {
        finish();
        return;
      }
      if (points.length && mode !== 'outline') {
        void commit([points[0], p]);
        return;
      }
      if (points.length >= 64) {
        setError(
          'An outline can have up to 64 corners. Close this face first.',
        );
        return;
      }
      if (
        !points.length ||
        Math.hypot(p.x - points.at(-1)!.x, p.z - points.at(-1)!.z) > 0.001
      ) {
        points.push({ ...p });
        setError('');
      }
      redraw();
    };
    const cancel = () => {
      pointer = null;
    };
    const key = (e: KeyboardEvent) => {
      if (
        document.querySelector('dialog[open]') ||
        (e.target instanceof HTMLElement &&
          (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) ||
            e.target.isContentEditable))
      )
        return;
      if (e.key === 'Escape') {
        stop(e);
        if (points.length) {
          points = [];
          setError('');
          redraw();
        } else latest.current.onClose();
      } else if (
        e.key === 'Delete' ||
        e.key === 'Backspace' ||
        ((e.ctrlKey || e.metaKey) &&
          !e.shiftKey &&
          e.key.toLowerCase() === 'z' &&
          points.length > 0)
      ) {
        stop(e);
        back();
      } else if (e.key === 'Enter' && mode === 'outline') {
        stop(e);
        finish();
      }
    };
    canvas.addEventListener('pointerdown', down, true);
    canvas.addEventListener('pointermove', move, true);
    canvas.addEventListener('pointerup', up, true);
    canvas.addEventListener('pointercancel', cancel, true);
    window.addEventListener('keydown', key, true);
    return () => {
      disposed = true;
      actions.current = null;
      if (pointer && canvas.hasPointerCapture(pointer.id))
        canvas.releasePointerCapture(pointer.id);
      canvas.style.cursor = oldCursor;
      r.orbit.mouseButtons.MIDDLE = oldMiddle;
      canvas.removeEventListener('pointerdown', down, true);
      canvas.removeEventListener('pointermove', move, true);
      canvas.removeEventListener('pointerup', up, true);
      canvas.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('keydown', key, true);
      r.scene.remove(root);
      root.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      delete canvas.dataset.sketchPoints;
      delete canvas.dataset.sketchCursor;
    };
  }, [props.mode, elevation]);
  return (
    <section className="sketch-bar" aria-label="Draw in space">
      <div className="sketch-heading">
        <span>
          <i />
          Draw in space
        </span>
        <button aria-label="Close drawing" onClick={props.onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="sketch-modes">
        {(
          [
            { mode: 'rectangle', label: 'Rectangle', Icon: Square },
            { mode: 'circle', label: 'Circle', Icon: Circle },
            { mode: 'outline', label: 'Outline', Icon: PenLine },
          ] as const
        ).map(({ mode, label, Icon }) => (
          <button
            key={mode}
            aria-label={`Draw ${label.toLowerCase()}`}
            aria-pressed={props.mode === mode}
            onClick={() => props.onMode(mode)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </div>
      <output className="sketch-readout" aria-live="off">
        {readout}
      </output>
      <p>
        {props.mode === 'outline'
          ? 'Click corners, then the first point to close. Enter also finishes.'
          : 'Click once to start. Move to preview. Click again to finish.'}
      </p>
      <small>
        {props.mode === 'rectangle'
          ? 'Shift makes a square'
          : 'Shift locks an axis'}{' '}
        · Middle-drag to orbit · Scroll to zoom
      </small>
      <details>
        <summary>Measurements & drawing plane</summary>
        <label>
          Elevation · m
          <input
            aria-label="Drawing elevation"
            type="number"
            min="0"
            max="1000"
            step="any"
            value={elevation}
            disabled={pending}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n >= 0 && n <= 1000) setElevation(n);
            }}
          />
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            actions.current?.exact(Number(exactA), Number(exactB));
          }}
        >
          <label>
            {props.mode === 'circle'
              ? 'Radius'
              : props.mode === 'rectangle'
                ? 'Width'
                : 'Next edge'}{' '}
            · m
            <input
              aria-label="Exact drawing size"
              type="number"
              min="0.1"
              max={props.mode === 'circle' ? 250 : 500}
              step="any"
              required
              value={exactA}
              onChange={(e) => setExactA(e.target.value)}
            />
          </label>
          {props.mode === 'rectangle' && (
            <label>
              Depth · m
              <input
                aria-label="Exact drawing depth"
                type="number"
                min="0.1"
                max="500"
                step="any"
                required
                value={exactB}
                onChange={(e) => setExactB(e.target.value)}
              />
            </label>
          )}
          <button disabled={!count || pending} type="submit">
            {props.mode === 'outline' ? 'Set edge' : 'Create exact face'}
          </button>
        </form>
      </details>
      {count > 0 && (
        <div className="sketch-actions">
          <button
            aria-label="Remove last drawing point"
            onClick={() => actions.current?.back()}
            disabled={pending}
          >
            <Undo2 size={14} />
            Back
          </button>
          {props.mode === 'outline' && (
            <button
              disabled={count < 3 || pending}
              onClick={() => actions.current?.finish()}
            >
              Finish face
            </button>
          )}
          <span>Esc cancels</span>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {pending && <p role="status">Creating your face…</p>}
    </section>
  );
}
