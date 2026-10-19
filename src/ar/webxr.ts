import * as THREE from 'three';
export type ARSessionControl = {
  end: () => Promise<void>;
  scale: (value: number) => void;
  rotate: (degrees: number) => void;
  reposition: () => void;
};
/** Actual camera tracking and surface hit testing, only when immersive-ar is supported. */
export async function startAR(
  model: THREE.Group,
  overlay: HTMLElement,
  scale: number,
  status: (text: string) => void,
  onEnd: () => void,
  signal?: AbortSignal,
): Promise<ARSessionControl> {
  if (signal?.aborted) throw new Error('AR was closed.');
  if (!navigator.xr) throw new Error('This browser does not support WebXR AR.');
  // Invoke the permission request in the original button gesture.
  const session = await navigator.xr.requestSession('immersive-ar', {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay'],
    domOverlay: { root: overlay },
  });
  if (signal?.aborted) {
    await session.end().catch(() => {});
    throw new Error('AR was closed.');
  }
  const abort = () => {
    void session.end().catch(() => {});
  };
  signal?.addEventListener('abort', abort, { once: true });
  const suppressUISelect = (e: Event) => {
    if ((e.target as HTMLElement).closest('button,input,select'))
      e.preventDefault();
  };
  let renderer: THREE.WebGLRenderer | undefined,
    source: XRHitTestSource | undefined,
    ended = false;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(
      60,
      innerWidth / innerHeight,
      0.01,
      10000,
    );
  const anchor = new THREE.Group(),
    copy = model.clone(true);
  copy.scale.setScalar(scale);
  anchor.add(copy);
  anchor.visible = false;
  scene.add(anchor);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 3));
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(3, 10, 5);
  scene.add(sun);
  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.12, 0.15, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#a4f5e7', side: THREE.DoubleSide }),
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);
  let placed = false;
  const cleanup = () => {
    if (ended) return;
    ended = true;
    source?.cancel();
    signal?.removeEventListener('abort', abort);
    overlay.removeEventListener('beforexrselect', suppressUISelect);
    renderer?.setAnimationLoop(null);
    renderer?.dispose();
    renderer?.domElement.remove();
    reticle.geometry.dispose();
    reticle.material.dispose();
    onEnd();
  };
  session.addEventListener('end', cleanup, { once: true });
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    overlay.appendChild(renderer.domElement);
    await renderer.xr.setSession(session);
    if (ended || signal?.aborted) throw new Error('AR was closed.');
    const viewer = await session.requestReferenceSpace('viewer');
    source = await session.requestHitTestSource!({ space: viewer });
    if (ended || signal?.aborted) {
      source?.cancel();
      throw new Error('AR was closed.');
    }
    if (!source)
      throw new Error('Surface detection is unavailable on this device.');
    const place = () => {
      if (!reticle.visible || placed) return;
      anchor.position.setFromMatrixPosition(reticle.matrix);
      anchor.visible = true;
      placed = true;
      reticle.visible = false;
      status(
        'Placed. Walk around your model. Use Reposition to place it again.',
      );
    };
    session.addEventListener('select', place);
    overlay.addEventListener('beforexrselect', suppressUISelect);
    status(
      'Move your phone slowly to find a surface. Tap the ring to place the model.',
    );
    renderer.setAnimationLoop((_time, frame) => {
      const ref = renderer!.xr.getReferenceSpace();
      if (frame && source && ref && !placed) {
        const hit = frame.getHitTestResults(source)[0],
          pose = hit?.getPose(ref);
        reticle.visible = !!pose;
        if (pose) reticle.matrix.fromArray(pose.transform.matrix);
      }
      renderer!.render(scene, camera);
    });
    return {
      end: () => session.end(),
      scale: (value) => copy.scale.setScalar(value),
      rotate: (degrees) => (copy.rotation.y = (degrees * Math.PI) / 180),
      reposition: () => {
        placed = false;
        anchor.visible = false;
        status('Find a surface and tap to place again.');
      },
    };
  } catch (error) {
    await session.end().catch(() => {});
    cleanup();
    throw error;
  }
}
