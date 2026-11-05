import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ImagePlus,
  Minus,
  Plus,
  RotateCcw,
  Smartphone,
  Trash2,
} from 'lucide-react';
import * as THREE from 'three';
import { importPanorama, parsePanoramas, type Panoramas } from './data';
import { orientationQuaternion } from './orientation';

type View = { yaw: number; pitch: number; fov: number };
export default function PanoramaViewer({
  collection,
  onChange,
  onClose,
}: {
  collection: Panoramas;
  onChange: (value: Panoramas) => Promise<void>;
  onClose: () => void;
}) {
  const [activeId, setActiveId] = useState(collection.items[0]?.id);
  const panorama =
    collection.items.find((p) => p.id === activeId) ?? collection.items[0];
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [remove, setRemove] = useState(false);
  const [motion, setMotion] = useState(false),
    [received, setReceived] = useState(false),
    [requesting, setRequesting] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    host = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null);
  const alive = useRef(true),
    view = useRef<View>({ yaw: 0, pitch: 0, fov: 75 });
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const motionAnchor = useRef<THREE.Quaternion | null>(null),
    motionStart = useRef(new THREE.Quaternion());
  useEffect(() => {
    alive.current = true;
    dialog.current?.showModal();
    return () => {
      alive.current = false;
    };
  }, []);
  const stopInertia = useRef<(() => void) | null>(null);
  const reset = () => {
    stopInertia.current?.();
    view.current = {
      yaw: 0,
      pitch: 0,
      fov: Math.min(
        75,
        panorama
          ? ((panorama.horizontalAngle * panorama.height) / panorama.width) *
              0.85
          : 75,
      ),
    };
    motionAnchor.current = null;
  };
  useEffect(() => {
    setMotion(false);
    setReceived(false);
    setError('');
    reset();
    if (!panorama || !host.current) return;
    const element = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setError(
        'WebGL is unavailable. Enable browser graphics acceleration to view panoramas.',
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    element.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Interactive panorama');
    renderer.domElement.tabIndex = 0;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#101314');
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 30);
    cameraRef.current = camera;
    const horizontal = THREE.MathUtils.degToRad(panorama.horizontalAngle);
    const vertical = Math.min(
      Math.PI,
      (horizontal * panorama.height) / panorama.width,
    );
    const geometry = new THREE.SphereGeometry(
      10,
      96,
      64,
      Math.PI - horizontal / 2,
      horizontal,
      (Math.PI - vertical) / 2,
      vertical,
    );
    geometry.scale(-1, 1, 1);
    geometry.rotateY(-Math.PI / 2);
    let disposed = false;
    const texture = new THREE.TextureLoader().load(
      panorama.image,
      () => {
        if (!disposed) element.dataset.ready = 'true';
      },
      undefined,
      () => {
        if (!disposed) setError('The stored panorama could not be displayed.');
      },
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
    });
    scene.add(new THREE.Mesh(geometry, material));
    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    const points = new Map<number, { x: number; y: number }>();
    let span = 0,
      vx = 0,
      vy = 0,
      last = performance.now(),
      frame = 0;
    stopInertia.current = () => {
      vx = vy = 0;
    };
    const canvas = renderer.domElement;
    const distance = () => {
      const p = [...points.values()];
      return p.length === 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      setMotion(false);
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      span = distance();
      vx = vy = 0;
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      const previous = points.get(e.pointerId);
      if (!previous) return;
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size === 1) {
        vx = (e.clientX - previous.x) * 0.12;
        vy = (e.clientY - previous.y) * 0.12;
        view.current.yaw += vx;
        view.current.pitch += vy;
      } else {
        const next = distance();
        if (span && next) view.current.fov *= span / next;
        span = next;
        vx = vy = 0;
      }
    };
    const up = (e: PointerEvent) => {
      points.delete(e.pointerId);
      if (canvas.hasPointerCapture(e.pointerId))
        canvas.releasePointerCapture(e.pointerId);
      span = distance();
      if (e.type === 'pointercancel') vx = vy = 0;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      view.current.fov += e.deltaY * 0.025;
    };
    const key = (e: KeyboardEvent) => {
      if (
        !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-'].includes(
          e.key,
        )
      )
        return;
      e.preventDefault();
      setMotion(false);
      if (e.key === 'ArrowLeft') view.current.yaw += 5;
      if (e.key === 'ArrowRight') view.current.yaw -= 5;
      if (e.key === 'ArrowUp') view.current.pitch += 5;
      if (e.key === 'ArrowDown') view.current.pitch -= 5;
      if (e.key === '+') view.current.fov -= 5;
      if (e.key === '-') view.current.fov += 5;
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('keydown', key);
    const render = (now: number) => {
      const step = Math.min(2, (now - last) / 16.67);
      last = now;
      if (!points.size) {
        view.current.yaw += vx * step;
        view.current.pitch += vy * step;
        vx *= Math.pow(0.85, step);
        vy *= Math.pow(0.85, step);
      }
      const v = view.current,
        vfov = THREE.MathUtils.radToDeg(vertical);
      // A narrow partial panorama must also cover a landscape screen's width.
      const widthLimit =
        panorama.horizontalAngle < 180
          ? THREE.MathUtils.radToDeg(
              2 * Math.atan(Math.tan(horizontal / 2) / camera.aspect),
            )
          : 180;
      const maxFov = Math.min(100, vfov, widthLimit);
      v.fov = THREE.MathUtils.clamp(v.fov, Math.min(25, maxFov * 0.8), maxFov);
      const horizontalFov = THREE.MathUtils.radToDeg(
        2 *
          Math.atan(
            Math.tan(THREE.MathUtils.degToRad(v.fov / 2)) * camera.aspect,
          ),
      );
      if (panorama.horizontalAngle < 360)
        v.yaw = THREE.MathUtils.clamp(
          v.yaw,
          -Math.max(0, (panorama.horizontalAngle - horizontalFov) / 2),
          Math.max(0, (panorama.horizontalAngle - horizontalFov) / 2),
        );
      else v.yaw = ((((v.yaw + 180) % 360) + 360) % 360) - 180;
      v.pitch = THREE.MathUtils.clamp(
        v.pitch,
        -Math.max(0, (vfov - v.fov) / 2),
        Math.max(0, (vfov - v.fov) / 2),
      );
      camera.quaternion.slerp(
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            THREE.MathUtils.degToRad(v.pitch),
            THREE.MathUtils.degToRad(v.yaw),
            0,
            'YXZ',
          ),
        ),
        0.25,
      );
      if (camera.fov !== v.fov) {
        camera.fov = v.fov;
        camera.updateProjectionMatrix();
      }
      element.dataset.yaw = String(v.yaw);
      element.dataset.pitch = String(v.pitch);
      element.dataset.fov = String(v.fov);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      points.clear();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('keydown', key);
      geometry.dispose();
      texture.dispose();
      material.dispose();
      renderer.dispose();
      canvas.remove();
      cameraRef.current = null;
      stopInertia.current = null;
      delete element.dataset.ready;
    };
  }, [panorama?.id, panorama?.image, panorama?.horizontalAngle]);
  useEffect(() => {
    if (!motion) return;
    motionAnchor.current = null;
    setReceived(false);
    let gotData = false;
    const orientation = (e: DeviceOrientationEvent) => {
      const raw = orientationQuaternion(
        e.alpha,
        e.beta,
        e.gamma,
        screen.orientation?.angle ??
          (window as Window & { orientation?: number }).orientation ??
          0,
      );
      if (!raw || !cameraRef.current) return;
      if (!gotData) {
        gotData = true;
        setReceived(true);
      }
      if (!motionAnchor.current) {
        motionAnchor.current = raw.clone().invert();
        motionStart.current.copy(cameraRef.current.quaternion);
      }
      const q = motionStart.current
        .clone()
        .multiply(motionAnchor.current)
        .multiply(raw);
      const angles = new THREE.Euler().setFromQuaternion(q, 'YXZ');
      view.current.yaw = THREE.MathUtils.radToDeg(angles.y);
      view.current.pitch = THREE.MathUtils.radToDeg(angles.x);
    };
    const calibrate = () => {
      motionAnchor.current = null;
    };
    window.addEventListener('deviceorientation', orientation);
    window.addEventListener('orientationchange', calibrate);
    const timer = setTimeout(() => {
      if (!gotData) {
        setError(
          'No motion data received. Drag to look around, or check Motion & Orientation permissions in your browser.',
        );
        setMotion(false);
      }
    }, 4000);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('deviceorientation', orientation);
      window.removeEventListener('orientationchange', calibrate);
    };
  }, [motion]);
  const startMotion = async () => {
    if (motion) {
      setMotion(false);
      return;
    }
    setError('');
    if (!window.isSecureContext || !window.DeviceOrientationEvent) {
      setError(
        'Phone motion needs HTTPS and a browser with orientation sensors. Finger navigation is available.',
      );
      return;
    }
    setRequesting(true);
    try {
      const api =
        window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
          requestPermission?: () => Promise<string>;
        };
      const permission = api.requestPermission
        ? await api.requestPermission()
        : 'granted';
      if (!alive.current) return;
      if (permission !== 'granted')
        throw new Error(
          'Motion access was declined. You can still drag and pinch to look around.',
        );
      stopInertia.current?.();
      setMotion(true);
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error ? e.message : 'Motion access is unavailable.',
        );
    } finally {
      if (alive.current) setRequesting(false);
    }
  };
  const add = async (file?: File) => {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      if (collection.items.length >= 8)
        throw new Error(
          'This project already has eight panoramas. Remove one or use another project.',
        );
      const item = await importPanorama(file);
      if (!alive.current) return;
      await onChange(
        parsePanoramas({ version: 1, items: [...collection.items, item] }),
      );
      if (alive.current) setActiveId(item.id);
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error ? e.message : 'Could not import this panorama.',
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const update = async (value: Panoramas) => {
    setBusy(true);
    setError('');
    try {
      await onChange(parsePanoramas(value));
      setRemove(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      className="panorama-viewer"
      aria-label="Panorama viewer"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void add(e.dataTransfer.files[0]);
      }}
    >
      <div
        ref={host}
        className="panorama-canvas"
        data-testid="panorama-viewport"
        data-motion={motion ? (received ? 'active' : 'waiting') : 'off'}
      />
      <header className="panorama-header">
        <button aria-label="Back to model" disabled={busy} onClick={onClose}>
          <ArrowLeft size={20} />
          <span>Model</span>
        </button>
        {panorama ? (
          <select
            aria-label="Current panorama"
            value={panorama.id}
            disabled={busy}
            onChange={(e) => {
              setActiveId(e.target.value);
              setRemove(false);
            }}
          >
            {collection.items.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : (
          <strong>Panoramas</strong>
        )}
        <button
          aria-label="Import panorama"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <ImagePlus size={20} />
          <span>Import</span>
        </button>
        {panorama && (
          <button
            aria-label="Remove panorama"
            disabled={busy}
            onClick={() => setRemove(true)}
          >
            <Trash2 size={18} />
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          hidden
          aria-label="Panorama image file"
          onChange={(e) => {
            void add(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </header>
      {!panorama && (
        <div className="panorama-empty">
          <ImagePlus size={42} />
          <h1>Step inside a panorama</h1>
          <p>
            Import a 360° image or a wide panorama. Drag to look around, pinch
            to zoom, or turn your phone.
          </p>
          <button disabled={busy} onClick={() => input.current?.click()}>
            Choose panorama photo
          </button>
          <small>
            JPG · PNG · WebP · Saved with this project, on this browser. Photos
            stay on your device.
          </small>
        </div>
      )}
      {panorama && (
        <div className="panorama-bottom">
          <div className="panorama-actions">
            <button
              aria-label="Zoom out panorama"
              onClick={() => {
                view.current.fov += 10;
              }}
            >
              <Minus size={20} />
            </button>
            <button
              aria-label="Zoom in panorama"
              onClick={() => {
                view.current.fov -= 10;
              }}
            >
              <Plus size={20} />
            </button>
            <button aria-label="Reset panorama view" onClick={reset}>
              <RotateCcw size={20} />
            </button>
            <button
              aria-label="Look around with phone"
              disabled={requesting}
              aria-pressed={motion}
              onClick={() => void startMotion()}
            >
              <Smartphone size={20} />
              <span>
                {motion
                  ? received
                    ? 'Motion on'
                    : 'Waiting…'
                  : 'Phone motion'}
              </span>
            </button>
          </div>
          <details className="panorama-settings">
            <summary>
              {panorama.horizontalAngle === 360
                ? '360° panorama'
                : `Partial panorama · ${panorama.horizontalAngle}°`}{' '}
              · Settings
            </summary>
            <label>
              Captured horizontal angle
              <select
                aria-label="Panorama coverage"
                disabled={busy}
                value={panorama.horizontalAngle}
                onChange={(e) =>
                  void update({
                    version: 1,
                    items: collection.items.map((p) =>
                      p.id === panorama.id
                        ? { ...p, horizontalAngle: Number(e.target.value) }
                        : p,
                    ),
                  })
                }
              >
                {[60, 90, 120, 180, 240, 270, 360].map((n) => (
                  <option key={n} value={n}>
                    {n}°{n === 360 ? ' · full equirectangular 2:1' : ''}
                  </option>
                ))}
              </select>
            </label>
            <p>
              Choose the angle your photo actually captured. A partial panorama
              cannot show what is outside the image. This is a photographic
              view, not reconstructed 3D geometry.
            </p>
            <small>
              Stored viewing copy: {panorama.width} × {panorama.height}. Keep
              your original for full resolution.
            </small>
          </details>
          <p className="panorama-hint">
            Drag to look · Pinch to zoom · Dragging pauses phone motion
          </p>
        </div>
      )}
      {busy && (
        <div className="panorama-status" role="status">
          Preparing and saving your panorama…
        </div>
      )}
      {error && (
        <div className="panorama-status error" role="alert">
          {error}
          <button
            aria-label="Dismiss panorama message"
            onClick={() => setError('')}
          >
            ×
          </button>
        </div>
      )}
      {remove && panorama && (
        <div
          className="panorama-confirm"
          role="alertdialog"
          aria-label="Confirm panorama removal"
        >
          <strong>Remove “{panorama.name}”?</strong>
          <p>The saved photo will be removed from this project.</p>
          <button disabled={busy} onClick={() => setRemove(false)}>
            Keep panorama
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void update({
                version: 1,
                items: collection.items.filter((p) => p.id !== panorama.id),
              })
            }
          >
            Remove photo
          </button>
        </div>
      )}
    </dialog>
  );
}
