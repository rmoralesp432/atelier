import * as THREE from 'three';
import type { ARSessionControl } from './webxr';
import type { CameraContext } from '../intelligence/context';
import { arCameraContext } from './context';
import {
  bringModelInFront,
  frameCameraModel,
  modelBounds,
  transformAround,
} from './controls';
import { cloneARView, disposeARView, setARTransparency } from './appearance';

/**
 * A real camera feed with manual 3D alignment. Deliberately not world-tracked AR:
 * web camera permission does not provide ARKit poses, depth or real-world scale.
 */
export async function startCameraOverlay(
  model: THREE.Group,
  overlay: HTMLElement,
  scale: number,
  status: (text: string) => void,
  onEnd: () => void,
  signal?: AbortSignal,
  onCamera?: (camera: CameraContext) => void,
  rotation = 0,
  onRotation?: (degrees: number) => void,
): Promise<ARSessionControl> {
  if (signal?.aborted) throw new Error('Camera preview was closed.');
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error(
      'Camera preview needs HTTPS and camera access in Safari or Chrome.',
    );
  const stream = await navigator.mediaDevices
    .getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    })
    .catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'NotAllowedError')
        throw new Error(
          'Camera permission was denied. Allow camera access for ATELIER in your browser settings, then retry.',
        );
      if (error instanceof DOMException && error.name === 'NotFoundError')
        throw new Error('No camera was found on this device.');
      throw error;
    });
  if (signal?.aborted) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('Camera preview was closed.');
  }
  const video = document.createElement('video');
  video.className = 'ar-camera-feed';
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  video.setAttribute('aria-label', 'Live rear camera');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.02, 10000);
  camera.position.set(0, 1.6, 0);
  const anchor = new THREE.Group();
  let copy = cloneARView(model),
    transparent = false;
  copy.scale.setScalar(scale);
  copy.rotation.y = (rotation * Math.PI) / 180;
  anchor.add(copy);
  scene.add(anchor);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x697778, 2.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(4, 10, 6);
  scene.add(sun);
  let pivot = new THREE.Vector3(),
    renderer: THREE.WebGLRenderer | undefined;
  let frame = 0,
    ended = false,
    lastContext = -Infinity;
  const pointers = new Map<number, { x: number; y: number }>();
  const publish = () => {
    overlay.dataset.cameraPosition = anchor.position
      .toArray()
      .map((n) => n.toFixed(3))
      .join(',');
    overlay.dataset.cameraRotation = String(
      Math.round((copy.rotation.y * 180) / Math.PI),
    );
    overlay.dataset.cameraScale = String(copy.scale.x);
    overlay.dataset.cameraTransparent = String(transparent);
  };
  const resize = () => {
    if (!renderer) return;
    const w = overlay.clientWidth || innerWidth,
      h = overlay.clientHeight || innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const front = () => {
    // Include the camera eye in the projection even for a tiny tabletop model.
    anchor.position.y = scale < 0.1 ? 1.2 : 0;
    pivot = bringModelInFront(anchor, copy, camera);
    publish();
  };
  const fit = () => {
    pivot = frameCameraModel(anchor, copy, camera);
    publish();
    status(
      'Whole model in view · ratio unchanged. Position is a manual visual alignment.',
    );
  };
  const cleanup = () => {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(frame);
    stream.getTracks().forEach((t) => t.stop());
    video.pause();
    video.srcObject = null;
    video.remove();
    removeEventListener('resize', resize);
    signal?.removeEventListener('abort', cleanup);
    renderer?.dispose();
    renderer?.domElement.remove();
    disposeARView(copy);
    for (const name of [
      'cameraPosition',
      'cameraRotation',
      'cameraScale',
      'cameraTransparent',
    ])
      delete overlay.dataset[name];
    onEnd();
  };
  signal?.addEventListener('abort', cleanup, { once: true });
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.domElement.className = 'ar-manual-canvas';
    renderer.domElement.setAttribute(
      'aria-label',
      'Drag to position model; two fingers to turn',
    );
    overlay.append(video, renderer.domElement);
    await video.play();
    if (ended) throw new Error('Camera preview was closed.');
    resize();
    addEventListener('resize', resize);
    fit();
    const canvas = renderer.domElement;
    canvas.onpointerdown = (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    canvas.onpointermove = (e) => {
      const previous = pointers.get(e.pointerId);
      if (!previous) return;
      const now = { x: e.clientX, y: e.clientY };
      const other = [...pointers.entries()].find(
        ([id]) => id !== e.pointerId,
      )?.[1];
      if (other) {
        const a = Math.atan2(previous.y - other.y, previous.x - other.x);
        const b = Math.atan2(now.y - other.y, now.x - other.x);
        transformAround(
          anchor,
          copy,
          pivot,
          copy.scale.x,
          (copy.rotation.y * 180) / Math.PI + ((b - a) * 180) / Math.PI,
        );
      } else {
        // Screen-space dragging at the current model depth, preserving scale.
        const distance = Math.max(0.5, Math.abs(anchor.position.z));
        const mPerPixel =
          (2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) /
          canvas.clientHeight;
        anchor.position.x += (now.x - previous.x) * mPerPixel;
        anchor.position.y -= (now.y - previous.y) * mPerPixel;
      }
      pointers.set(e.pointerId, now);
      publish();
      if (other) onRotation?.(Math.round((copy.rotation.y * 180) / Math.PI));
    };
    canvas.onpointerup = canvas.onpointercancel = (e) =>
      pointers.delete(e.pointerId);
    const render = (time: number) => {
      if (ended) return;
      renderer!.render(scene, camera);
      if (time - lastContext > 200) {
        onCamera?.(arCameraContext(copy, camera));
        lastContext = time;
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    status(
      'Manual camera alignment · drag to move, two fingers to turn. Not world tracked.',
    );
    return {
      end: async () => cleanup(),
      scale: (value) => {
        transformAround(
          anchor,
          copy,
          pivot,
          value,
          (copy.rotation.y * 180) / Math.PI,
        );
        publish();
      },
      rotate: (degrees) => {
        transformAround(anchor, copy, pivot, copy.scale.x, degrees);
        publish();
      },
      transparency: (value) => {
        transparent = value;
        setARTransparency(copy, value);
        publish();
      },
      nudge: (right, forward, up = 0) => {
        if (
          ![right, forward, up].every(
            (n) => Number.isFinite(n) && Math.abs(n) <= 10,
          )
        )
          return;
        anchor.position.x += right;
        anchor.position.z -= forward;
        anchor.position.y += up;
        publish();
        status(
          'Manual alignment · model moved. Camera distance and scale are approximate.',
        );
      },
      bringInFront: () => {
        front();
        status(
          'Nearest edge ahead. Adjust distance and height to align visually.',
        );
      },
      fitInView: fit,
      reposition: () => {
        front();
        status(
          'Placement reset. Drag the model to align it with the camera view.',
        );
      },
      fitWidth: () =>
        status(
          'Use tracked AR for measuring between real surface points. This view has no depth tracking.',
        ),
      updateModel: (nextModel) => {
        const next = cloneARView(nextModel);
        next.scale.copy(copy.scale);
        next.rotation.copy(copy.rotation);
        setARTransparency(next, transparent);
        anchor.remove(copy);
        disposeARView(copy);
        copy = next;
        anchor.add(copy);
        pivot.clamp(modelBounds(copy).min, modelBounds(copy).max);
        publish();
      },
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}
