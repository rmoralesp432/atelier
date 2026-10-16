import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Project, Volume } from './model';
import { constructionFrame } from './geometry/construction';
import { round } from './model';
import { isProfile, renderMeshData } from './geometry/kernel';
import type { CameraContext } from './intelligence/context';

export type Tool = 'select' | 'translate' | 'rotate';
type Props = {
  project: Project;
  tool: Tool;
  snap: boolean;
  motion: { revision: number; ids: string[] };
  renderMode: 'studio' | 'outline';
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
  signatures: Map<string, string>;
  fit: (top: boolean) => void;
  beginConstruction: (v: Volume, g: THREE.Group, index: number) => void;
  finishConstruction: () => void;
  motionRevision: number;
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
    renderer.setClearColor('#0b1014');
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.setAttribute(
      'aria-label',
      'Interactive 3D modeling viewport',
    );
    renderer.domElement.setAttribute('tabindex', '0');
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#0b1014', 100, 900);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.45;
    room.dispose();
    pmrem.dispose();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 5000);
    camera.position.set(32, 26, 34);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.08;
    orbit.rotateSpeed = 0.65;
    orbit.zoomSpeed = 0.8;
    orbit.maxPolarAngle = Math.PI / 2 - 0.015;
    orbit.minDistance = 2;
    orbit.maxDistance = 2500;
    orbit.target.set(0, 2, 0);
    const ambient = new THREE.HemisphereLight('#e7edf3', '#252c34', 0.8);
    scene.add(ambient);
    const light = new THREE.DirectionalLight('#fff4df', 2);
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
    light.shadow.bias = -0.00015;
    light.shadow.normalBias = 0.025;
    scene.add(light, light.target);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 4000),
      new THREE.MeshStandardMaterial({
        color: '#080c10',
        roughness: 0.9,
        metalness: 0.05,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.035;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(400, 80, '#556572', '#42515e');
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.045;
    grid.position.y = -0.02;
    scene.add(grid);
    const transform = new TransformControls(camera, renderer.domElement);
    transform.setSize(0.85);
    scene.add(transform.getHelper());
    const objects = new Map<string, THREE.Group>();
    const constructions = new Map<
      string,
      { group: THREE.Group; guide: THREE.Line; start: number; fade: boolean }
    >();
    const finishOne = (id: string) => {
      const c = constructions.get(id);
      if (!c) return;
      c.group.scale.set(1, 1, 1);
      c.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const m = o.material as THREE.MeshPhysicalMaterial;
          m.opacity = o.userData.restOpacity ?? 1;
          if (m.transparent !== (o.userData.restTransparent ?? false))
            m.needsUpdate = true;
          m.transparent = o.userData.restTransparent ?? false;
        }
      });
      c.group.remove(c.guide);
      c.guide.geometry.dispose();
      (c.guide.material as THREE.Material).dispose();
      constructions.delete(id);
    };
    const finishConstruction = () => {
      for (const id of [...constructions.keys()]) finishOne(id);
      container.dataset.constructionActive = 'false';
      container.dataset.constructionPhase = 'complete';
    };
    const beginConstruction = (v: Volume, g: THREE.Group, index: number) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const points: THREE.Vector3[] = [];
      const d = v.dimensions;
      if (v.geometry?.kind === 'polygon')
        points.push(
          ...v.geometry.points.map(
            (p) => new THREE.Vector3(p.x * d.width, 0.012, p.z * d.depth),
          ),
        );
      else if (
        v.geometry?.kind === 'cylinder' ||
        v.geometry?.kind === 'sphere' ||
        v.geometry?.kind === 'circle' ||
        (v.geometry?.kind === 'extrusion' && v.geometry.profile === 'circle')
      )
        for (let i = 0; i < 64; i++)
          points.push(
            new THREE.Vector3(
              (Math.cos((i * Math.PI) / 32) * d.width) / 2,
              0.012,
              (Math.sin((i * Math.PI) / 32) * d.depth) / 2,
            ),
          );
      else
        points.push(
          new THREE.Vector3(-d.width / 2, 0.012, -d.depth / 2),
          new THREE.Vector3(d.width / 2, 0.012, -d.depth / 2),
          new THREE.Vector3(d.width / 2, 0.012, d.depth / 2),
          new THREE.Vector3(-d.width / 2, 0.012, d.depth / 2),
        );
      points.push(points[0].clone());
      const traced = points.flatMap((point, i) =>
        i === points.length - 1
          ? [point]
          : Array.from({ length: 16 }, (_, step) =>
              point.clone().lerp(points[i + 1], step / 16),
            ),
      );
      const guide = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(traced),
        new THREE.LineBasicMaterial({
          color: '#a4f2e8',
          transparent: true,
          opacity: 0.85,
          depthTest: false,
        }),
      );
      guide.renderOrder = 5;
      guide.userData.construction = true;
      g.add(guide);
      g.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const m = o.material as THREE.MeshPhysicalMaterial;
          o.userData.restOpacity = m.opacity;
          o.userData.restTransparent = m.transparent;
        }
      });
      const fade = v.geometry?.kind === 'mesh' || isProfile(v);
      if (!fade) g.scale.y = 0.002;
      constructions.set(v.id, {
        group: g,
        guide,
        start: performance.now() + Math.min(index * 60, 180),
        fade,
      });
      container.dataset.constructionActive = 'true';
      container.dataset.constructionPhase = 'footprint';
    };
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
      finishConstruction();
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
      const hit = raycaster
        .intersectObjects([...objects.values()], true)
        .find((hit) => hit.object instanceof THREE.Mesh);
      latest.current.onSelect(
        hit ? hit.object.parent!.userData.id : null,
        event.shiftKey || event.ctrlKey || event.metaKey,
      );
    };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointerup', up);
    let transition: {
      start: number;
      from: THREE.Vector3;
      to: THREE.Vector3;
      targetFrom: THREE.Vector3;
      targetTo: THREE.Vector3;
    } | null = null;
    orbit.addEventListener('start', () => {
      transition = null;
    });
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
          1.65) /
        Math.min(camera.aspect, 1);
      const to = center
        .clone()
        .add(
          (top
            ? new THREE.Vector3(0, 1, 0.001)
            : new THREE.Vector3(1, 0.7, 1.6)
          )
            .normalize()
            .multiplyScalar(distance),
        );
      transition = {
        start:
          performance.now() -
          (window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 500
            : 0),
        from: camera.position.clone(),
        to,
        targetFrom: orbit.target.clone(),
        targetTo: center,
      };
      const shadowSize = Math.max(size.x, size.y, size.z, 25) * 0.85;
      light.position
        .copy(center)
        .add(new THREE.Vector3(-shadowSize, shadowSize * 2, shadowSize));
      light.target.position.copy(center);
      Object.assign(light.shadow.camera, {
        left: -shadowSize,
        right: shadowSize,
        top: shadowSize,
        bottom: -shadowSize,
        far: shadowSize * 6,
      });
      light.shadow.camera.updateProjectionMatrix();
    };
    runtime.current = {
      scene,
      camera,
      renderer,
      orbit,
      transform,
      objects,
      signatures: new Map(),
      fit,
      beginConstruction,
      finishConstruction,
      motionRevision: 0,
    };
    const resize = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      if (objects.size) fit(latest.current.view.mode === 'top');
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
      if (transition) {
        const t = Math.min(1, (performance.now() - transition.start) / 500);
        const ease = 1 - Math.pow(1 - t, 3);
        camera.position.lerpVectors(transition.from, transition.to, ease);
        orbit.target.lerpVectors(
          transition.targetFrom,
          transition.targetTo,
          ease,
        );
        if (t === 1) transition = null;
      }
      for (const [id, c] of constructions) {
        const frame = constructionFrame(performance.now() - c.start);
        if (frame.done) {
          finishOne(id);
          publishCamera();
          continue;
        }
        c.guide.geometry.setDrawRange(
          0,
          Math.ceil(
            frame.trace * c.guide.geometry.getAttribute('position').count,
          ),
        );
        (c.guide.material as THREE.LineBasicMaterial).opacity =
          frame.guideOpacity;
        if (c.fade)
          c.group.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              const m = o.material as THREE.MeshPhysicalMaterial;
              if (!m.transparent) m.needsUpdate = true;
              m.transparent = true;
              m.opacity = (o.userData.restOpacity ?? 1) * frame.opacity;
            }
          });
        else c.group.scale.y = frame.height;
        container.dataset.constructionPhase = frame.phase;
        container.dataset.constructionProgress = String(frame.height);
      }
      container.dataset.constructionActive = String(constructions.size > 0);
      if (!constructions.size) container.dataset.constructionPhase = 'complete';
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
      finishConstruction();
      resize.disconnect();
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      transform.dispose();
      orbit.dispose();
      disposeObject(scene);
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      runtime.current = null;
    };
  }, []);
  useEffect(() => {
    const r = runtime.current;
    if (!r) return;
    r.finishConstruction();
    let cancelled = false;
    const built = new Map<string, THREE.Group>();
    async function rebuild() {
      try {
        const signatures = new Map<string, string>();
        await Promise.all(
          props.project.volumes.map(async (v) => {
            const signature = JSON.stringify([v.dimensions, v.geometry]);
            signatures.set(v.id, signature);
            if (r!.signatures.get(v.id) === signature) return;
            const g = new THREE.Group();
            g.userData.id = v.id;
            built.set(v.id, g);
            const parts = isProfile(v) ? null : await renderMeshData(v);
            if (cancelled) return;
            const geometries: {
              geometry: THREE.BufferGeometry;
              material: string;
            }[] = [];
            if (!parts) {
              const polygon =
                v.geometry?.kind === 'polygon' ? v.geometry : null;
              const geometry = polygon
                ? new THREE.ShapeGeometry(
                    new THREE.Shape(
                      polygon.points.map((p) => new THREE.Vector2(p.x, -p.z)),
                    ),
                  )
                : v.geometry?.kind === 'circle'
                  ? new THREE.CircleGeometry(1, 64)
                  : new THREE.PlaneGeometry(2, 2);
              geometry.rotateX(-Math.PI / 2);
              geometry.scale(
                v.dimensions.width / (polygon ? 1 : 2),
                1,
                v.dimensions.depth / (polygon ? 1 : 2),
              );
              geometry.translate(0, 0.015, 0);
              geometries.push({ geometry, material: 'solid' });
            } else
              for (const part of parts) {
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute(
                  'position',
                  new THREE.BufferAttribute(part.positions, 3),
                );
                geometry.setIndex(new THREE.BufferAttribute(part.indices, 1));
                // Preserve crisp slab/box corners while smoothing curved sides.
                const shaded = toCreasedNormals(geometry, Math.PI / 6);
                if (shaded !== geometry) geometry.dispose();
                geometries.push({ geometry: shaded, material: part.material });
              }
            for (const part of geometries) {
              const glass = part.material === 'glass',
                frame = part.material === 'frame';
              const mesh = new THREE.Mesh(
                part.geometry,
                new THREE.MeshPhysicalMaterial({
                  color: glass ? '#8dc9d2' : frame ? '#38464e' : '#d8d9d4',
                  roughness: glass ? 0.13 : frame ? 0.4 : 0.32,
                  metalness: frame ? 0.5 : 0.08,
                  transparent: glass,
                  opacity: glass ? 0.32 : 1,
                  depthWrite: !glass,
                  side:
                    isProfile(v) || glass || part.material === 'reference'
                      ? THREE.DoubleSide
                      : THREE.FrontSide,
                  clearcoat: glass ? 1 : 0.3,
                  envMapIntensity: glass ? 1.4 : 0.35,
                }),
              );
              mesh.userData.materialKind = part.material;
              mesh.castShadow = !glass;
              mesh.receiveShadow = true;
              g.add(mesh);
              if (!glass) {
                const edges = new THREE.LineSegments(
                  new THREE.EdgesGeometry(part.geometry, 24),
                  new THREE.LineBasicMaterial({
                    color: '#d6e0e2',
                    transparent: true,
                    opacity: 0.12,
                  }),
                );
                g.add(edges);
              }
            }
          }),
        );
        if (cancelled) {
          built.forEach(disposeObject);
          return;
        }
        const hadObjects = r!.objects.size;
        const added = props.project.volumes.some((v) => !r!.objects.has(v.id));
        r!.transform.detach();
        for (const [id, group] of r!.objects) {
          if (!signatures.has(id) || built.has(id)) {
            r!.scene.remove(group);
            disposeObject(group);
            r!.objects.delete(id);
          }
        }
        built.forEach((g, id) => {
          r!.scene.add(g);
          r!.objects.set(id, g);
        });
        r!.signatures = signatures;
        for (const v of props.project.volumes) {
          const g = r!.objects.get(v.id)!;
          g.position.set(v.position.x, v.position.y, v.position.z);
          g.rotation.y = THREE.MathUtils.degToRad(v.rotation);
          const selected =
            v.id === props.project.selectedId ||
            props.project.selectedIds?.includes(v.id);
          g.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              const material = o.material as THREE.MeshPhysicalMaterial;
              const kind = o.userData.materialKind;
              material.color.set(
                kind === 'glass'
                  ? '#8dc9d2'
                  : kind === 'frame'
                    ? '#38464e'
                    : selected
                      ? '#c0dfdf'
                      : '#e2e7e6',
              );
              material.emissive.set(selected ? '#183033' : '#000000');
              material.emissiveIntensity = selected ? 0.2 : 0;
              if (kind !== 'glass') {
                if (material.transparent !== (props.renderMode === 'outline'))
                  material.needsUpdate = true;
                material.transparent = props.renderMode === 'outline';
                material.opacity = props.renderMode === 'outline' ? 0.055 : 1;
                material.depthWrite = props.renderMode !== 'outline';
              }
            } else if (o instanceof THREE.LineSegments) {
              const material = o.material as THREE.LineBasicMaterial;
              material.color.set(selected ? '#8de2e7' : '#d6e0e2');
              material.opacity =
                props.renderMode === 'outline'
                  ? selected
                    ? 0.9
                    : 0.6
                  : selected
                    ? 0.4
                    : 0.08;
            }
          });
        }
        const selected = r!.objects.get(props.project.selectedId ?? '');
        if (selected && props.tool !== 'select') r!.transform.attach(selected);
        r!.transform.setMode(props.tool === 'rotate' ? 'rotate' : 'translate');
        r!.transform.showX = props.tool !== 'rotate';
        r!.transform.showY = true;
        r!.transform.showZ = props.tool !== 'rotate';
        r!.transform.setTranslationSnap(props.snap ? 0.5 : null);
        r!.transform.setRotationSnap(props.snap ? Math.PI / 12 : null);
        host.current!.dataset.modelObjects = String(r!.objects.size);
        host.current!.dataset.renderMode = props.renderMode;
        host.current!.dataset.meshBuilds = String(
          Number(host.current!.dataset.meshBuilds || 0) + built.size,
        );
        if ((!hadObjects || added) && r!.objects.size)
          r!.fit(props.view.mode === 'top');
        if (r!.motionRevision !== props.motion.revision) {
          r!.motionRevision = props.motion.revision;
          props.motion.ids.forEach((id, i) => {
            const v = props.project.volumes.find((o) => o.id === id),
              g = r!.objects.get(id);
            if (v && g) r!.beginConstruction(v, g, i);
          });
        }
        setError('');
        r!.orbit.dispatchEvent({ type: 'change' });
      } catch (e) {
        built.forEach(disposeObject);
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
  }, [props.project, props.tool, props.snap, props.renderMode, props.motion]);
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
