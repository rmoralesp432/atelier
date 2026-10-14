import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import type { Project, Volume } from './model';
import { round } from './model';
import { isProfile, meshData } from './geometry/kernel';
import type { CameraContext } from './intelligence/context';

export type Tool = 'select' | 'translate' | 'rotate';
type Props = {
  project: Project;
  tool: Tool;
  snap: boolean;
  view: { mode: 'perspective' | 'top'; revision: number };
  onSelect: (id: string | null, additive?: boolean) => void;
  onCamera?: (camera: CameraContext) => void;
  onChange: (id: string, patch: Partial<Volume>) => void;
};
type Runtime = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  orbit: OrbitControls;
  transform: TransformControls;
  objects: Map<string, THREE.Group>;
  fit: (top: boolean) => void;
};
function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
      o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
        m.dispose(),
      );
    }
  });
}
export default function Viewport(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const runtime = useRef<Runtime | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [error, setError] = useState('');
  useEffect(() => {
    const container = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setError(
        'WebGL is unavailable. Enable hardware acceleration in your browser and reload to use the 3D viewport.',
      );
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor('#202326');
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute(
      'aria-label',
      'Interactive 3D modeling viewport',
    );
    renderer.domElement.setAttribute('tabindex', '0');
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#202326', 140, 500);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 5000);
    camera.position.set(32, 26, 34);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.12;
    orbit.maxPolarAngle = Math.PI / 2 - 0.015;
    orbit.minDistance = 2;
    orbit.maxDistance = 2500;
    orbit.target.set(0, 2, 0);
    const ambient = new THREE.HemisphereLight('#e7f0ed', '#3b454b', 2.6);
    scene.add(ambient);
    const light = new THREE.DirectionalLight('#fff4df', 3.2);
    light.position.set(-25, 50, 30);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    Object.assign(light.shadow.camera, {
      left: -60,
      right: 60,
      top: 60,
      bottom: -60,
      near: 1,
      far: 180,
    });
    light.shadow.bias = -0.001;
    scene.add(light);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 4000),
      new THREE.MeshStandardMaterial({ color: '#25292c', roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.035;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(200, 200, '#59616a', '#353c42');
    grid.position.y = -0.02;
    scene.add(grid);
    const transform = new TransformControls(camera, renderer.domElement);
    transform.setSize(0.85);
    scene.add(transform.getHelper());
    const objects = new Map<string, THREE.Group>();
    let dragging = false;
    transform.addEventListener('dragging-changed', (event) => {
      dragging = Boolean(event.value);
      orbit.enabled = !dragging;
      if (!dragging && transform.object) {
        const obj = transform.object;
        latest.current.onChange(obj.userData.id, {
          position: {
            x: round(obj.position.x),
            y: Math.max(0, round(obj.position.y)),
            z: round(obj.position.z),
          },
          rotation: round(
            ((THREE.MathUtils.radToDeg(obj.rotation.y) % 360) + 360) % 360,
          ),
        });
        // A rejected edit must also restore the visual model.
        const v = latest.current.project.volumes.find(
          (v) => v.id === obj.userData.id,
        );
        if (v) {
          obj.position.set(v.position.x, v.position.y, v.position.z);
          obj.rotation.y = THREE.MathUtils.degToRad(v.rotation);
        }
      }
    });
    const raycaster = new THREE.Raycaster();
    let pointerStart = { x: 0, y: 0 };
    let usedHandle = false;
    const down = (event: PointerEvent) => {
      pointerStart = { x: event.clientX, y: event.clientY };
      usedHandle = Boolean(transform.axis);
    };
    const up = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        dragging ||
        usedHandle ||
        Math.hypot(
          event.clientX - pointerStart.x,
          event.clientY - pointerStart.y,
        ) > 4
      )
        return;
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          (-(event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const meshes = [...objects.values()].map((g) => g.children[0]);
      const hit = raycaster.intersectObjects(meshes, false)[0];
      latest.current.onSelect(
        hit ? hit.object.parent!.userData.id : null,
        event.shiftKey || event.ctrlKey || event.metaKey,
      );
    };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointerup', up);
    const fit = (top: boolean) => {
      const box = new THREE.Box3();
      objects.forEach((g) => box.expandByObject(g));
      const center = box.isEmpty()
        ? new THREE.Vector3(0, 2, 0)
        : box.getCenter(new THREE.Vector3());
      const size = box.isEmpty()
        ? new THREE.Vector3(20, 10, 20)
        : box.getSize(new THREE.Vector3());
      const distance =
        ((Math.max(size.x, size.y, size.z, 10) /
          (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) *
          1.6) /
        Math.min(camera.aspect, 1);
      orbit.target.copy(center);
      camera.position
        .copy(center)
        .add(
          (top ? new THREE.Vector3(0, 1, 0.001) : new THREE.Vector3(1, 0.8, 1))
            .normalize()
            .multiplyScalar(distance),
        );
      orbit.update();
    };
    runtime.current = {
      scene,
      camera,
      renderer,
      orbit,
      transform,
      objects,
      fit,
    };
    const resize = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    });
    resize.observe(container);
    const publishCamera = () => {
      camera.updateMatrixWorld();
      const right = new THREE.Vector3().setFromMatrixColumn(
        camera.matrixWorld,
        0,
      );
      right.y = 0;
      right.normalize();
      const forward = new THREE.Vector3(-right.z, 0, right.x).negate();
      const visible = [...objects].flatMap(([id, group]) => {
        const center = new THREE.Box3()
          .setFromObject(group)
          .getCenter(new THREE.Vector3())
          .project(camera);
        return center.z >= -1 &&
          center.z <= 1 &&
          Math.abs(center.x) <= 1 &&
          Math.abs(center.y) <= 1
          ? [{ id, x: center.x, y: center.y }]
          : [];
      });
      latest.current.onCamera?.({
        right: { x: right.x, y: 0, z: right.z },
        forward: { x: forward.x, y: 0, z: forward.z },
        visible,
      });
    };
    orbit.addEventListener('change', publishCamera);
    let frame = 0;
    const render = () => {
      orbit.update();
      renderer.render(scene, camera);
      if (renderer.info.render.triangles > 0)
        container.dataset.rendered = 'true';
      frame = requestAnimationFrame(render);
    };
    render();
    const lost = (e: Event) => {
      e.preventDefault();
      setError(
        'The 3D graphics context was lost. Your saved model is preserved; reload to continue.',
      );
    };
    renderer.domElement.addEventListener('webglcontextlost', lost);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      transform.dispose();
      orbit.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
      runtime.current = null;
    };
  }, []);
  useEffect(() => {
    const r = runtime.current;
    if (!r) return;
    let cancelled = false;
    const groups = new Map<string, THREE.Group>();
    async function rebuild() {
      try {
        await Promise.all(
          props.project.volumes.map(async (v) => {
            const selected =
              v.id === props.project.selectedId ||
              props.project.selectedIds?.includes(v.id);
            let geometry: THREE.BufferGeometry;
            if (isProfile(v)) {
              geometry =
                v.geometry?.kind === 'circle'
                  ? new THREE.CircleGeometry(1, 64)
                  : new THREE.PlaneGeometry(2, 2);
              geometry.rotateX(-Math.PI / 2);
              geometry.scale(v.dimensions.width / 2, 1, v.dimensions.depth / 2);
              geometry.translate(0, 0.015, 0);
            } else {
              const data = await meshData(v);
              geometry = new THREE.BufferGeometry();
              geometry.setAttribute(
                'position',
                new THREE.BufferAttribute(data.positions, 3),
              );
              geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
              geometry.computeVertexNormals();
            }
            const g = new THREE.Group();
            g.userData.id = v.id;
            g.position.set(v.position.x, v.position.y, v.position.z);
            g.rotation.y = THREE.MathUtils.degToRad(v.rotation);
            const mesh = new THREE.Mesh(
              geometry,
              new THREE.MeshStandardMaterial({
                color: selected ? '#b7d6dc' : '#9fa8b0',
                roughness: 0.85,
                metalness: 0.02,
                flatShading: true,
                side: isProfile(v) ? THREE.DoubleSide : THREE.FrontSide,
              }),
            );
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            const edges = new THREE.LineSegments(
              new THREE.EdgesGeometry(geometry, 20),
              new THREE.LineBasicMaterial({
                color: selected ? '#95e0ed' : '#c1c9ce',
              }),
            );
            g.add(mesh, edges);
            groups.set(v.id, g);
          }),
        );
        if (cancelled) {
          groups.forEach(disposeObject);
          return;
        }
        r!.transform.detach();
        r!.objects.forEach((g) => {
          r!.scene.remove(g);
          disposeObject(g);
        });
        r!.objects.clear();
        groups.forEach((g, id) => {
          r!.scene.add(g);
          r!.objects.set(id, g);
        });
        const selected = r!.objects.get(props.project.selectedId ?? '');
        if (selected && props.tool !== 'select') r!.transform.attach(selected);
        r!.transform.setMode(props.tool === 'rotate' ? 'rotate' : 'translate');
        r!.transform.showX = props.tool !== 'rotate';
        r!.transform.showY = true;
        r!.transform.showZ = props.tool !== 'rotate';
        r!.transform.setTranslationSnap(props.snap ? 0.5 : null);
        r!.transform.setRotationSnap(props.snap ? Math.PI / 12 : null);
        host.current!.dataset.modelObjects = String(groups.size);
        setError('');
        r!.orbit.dispatchEvent({ type: 'change' });
      } catch (e) {
        groups.forEach(disposeObject);
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : 'Geometry could not be rendered.',
          );
      }
    }
    void rebuild();
    return () => {
      cancelled = true;
    };
  }, [props.project, props.tool, props.snap]);
  useEffect(() => {
    runtime.current?.fit(props.view.mode === 'top');
  }, [props.view]);
  return (
    <div className="viewport-canvas" ref={host} data-testid="viewport">
      {error && (
        <div className="webgl-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
