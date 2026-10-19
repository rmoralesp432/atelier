import WalkPlacement from './studio/WalkPlacement';
import type { WalkPlacement as Placement } from './studio/walkPlacement';
import { spatialGrid } from './geometry/spatialGrid';
import Sketch from './drawing/Sketch';
import type { DrawingTool } from './drawing/profile';
import type { Operation } from './intelligence/plan';
import { sectionPlaneControls } from './geometry/SectionPlaneControls';
import { shiftMap, type Site } from './studio/site';
import { transformSelection } from './geometry/selectionTransform';
import { isVisible, isLocked } from './model';
import { boxSelection } from './geometry/BoxSelection';
import { WalkControls } from './geometry/WalkControls';
import type { CameraSettings } from './studio/camera';
import type { SolarStudy } from './studio/solar';
import { solarPosition } from './studio/solar';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import {
  FacePullControls,
  type PullFeedback,
} from './geometry/FacePullControls';
import type { SectionView } from './studio/section';
import { sectionCap } from './geometry/section';
import { siteTiles } from './studio/site';
import type { Appearance } from './studio/appearance';
import { groupBounds } from './geometry/spatial';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { curvedWireframe } from './geometry/curvedWireframe';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Project, Volume } from './model';
import { constructionFrame } from './geometry/construction';
import { round } from './model';
import { isProfile, renderMeshData } from './geometry/kernel';
import type { CameraContext } from './intelligence/context';

export type Tool = 'select' | 'translate' | 'rotate' | 'reshape' | DrawingTool;
type Props = {
  project: Project;
  tool: Tool;
  onDraw: (operation: Operation) => Promise<void>;
  onTool: (tool: Tool) => void;
  presenting: boolean;
  suspended: boolean;
  cameraSettings: CameraSettings;
  solar: SolarStudy;
  onSelectMany: (ids: string[], additive: boolean) => void;
  turntable: boolean;
  snap: boolean;
  angleSnap: number;
  motion: { revision: number; ids: string[]; changedIds: string[] };
  renderMode: Appearance['mode'];
  appearance: Appearance;
  mapVisible: boolean;
  mapFrame: number;
  alignMap: boolean;
  onMapSite: (site: Site) => void;
  placingCamera: boolean;
  onPlaceCamera: (placement: Placement | null) => void;
  section: SectionView;
  sectionEditing: boolean;
  onSectionChange: (section: SectionView) => void;
  view: { mode: 'perspective' | 'orthographic' | 'top'; revision: number };
  onSelect: (id: string | null, additive?: boolean) => void;
  onCamera?: (camera: CameraContext) => void;
  onTransform: (id: string, patch: Partial<Volume>) => void;
  onChange: (id: string, patch: Partial<Volume>) => void;
};
type Runtime = {
  scene: THREE.Scene;
  outline: OutlinePass;
  setTheme: (day: boolean) => void;
  setMapVisible: (visible: boolean) => void;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  setProjection: (orthographic: boolean) => void;
  renderer: THREE.WebGLRenderer;
  orbit: OrbitControls;
  transform: TransformControls;
  objects: Map<string, THREE.Group>;
  signatures: Map<string, string>;
  updateShadows: () => void;
  applyLens: () => void;
  fit: (top: boolean, focusIds?: string[], mapSpan?: number) => void;
  beginConstruction: (
    v: Volume,
    g: THREE.Group,
    index: number,
    editing?: boolean,
  ) => void;
  finishConstruction: () => void;
  motionRevision: number;
};
function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
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
  const clippingPlane = useRef(new THREE.Plane(new THREE.Vector3(0, -1, 0), 3));
  const [pullFeedback, setPullFeedback] = useState<PullFeedback | null>(null);
  const [mapError, setMapError] = useState('');
  const [error, setError] = useState('');
  const [manipulating, setManipulating] = useState(false);
  const [measurement, setMeasurement] = useState<{
    id: string;
    mode: string;
    distance: number;
    position: { x: number; y: number; z: number };
    delta: { x: number; y: number; z: number };
    angle: number;
    turn: number;
  } | null>(null);
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
    renderer.setClearColor('#151719');
    renderer.localClippingEnabled = true;
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
    scene.fog = new THREE.Fog('#151719', 250, 1800);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.45;
    room.dispose();
    pmrem.dispose();
    let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera =
      new THREE.PerspectiveCamera(40, 1, 0.1, 5000);
    camera.position.set(32, 26, 34);
    const orbit = new OrbitControls<
      THREE.PerspectiveCamera | THREE.OrthographicCamera
    >(camera, renderer.domElement);
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
      new THREE.PlaneGeometry(40000, 40000),
      new THREE.MeshStandardMaterial({
        color: '#151719',
        roughness: 0.9,
        metalness: 0.05,
      }),
    );
    // Fade the floor before the far clipping plane, so extreme zoom never
    // reveals a hard floor boundary against the studio background.
    ground.material.transparent = true;
    ground.material.depthWrite = false;
    ground.material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\n gl_FragColor.a *= 1.0 - smoothstep(1200.0, 2500.0, length(vViewPosition));',
      );
    };
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.035;
    ground.receiveShadow = true;
    // The fading floor must render before glass and construction context.
    ground.renderOrder = -2;
    scene.add(ground);
    const grid = spatialGrid();
    scene.add(grid.mesh);
    const transform = new TransformControls(camera, renderer.domElement);
    transform.setSize(0.85);
    scene.add(transform.getHelper());
    const composer = new EffectComposer(renderer);
    const basePass = new RenderPass(scene, camera);
    composer.addPass(basePass);
    const outline = new OutlinePass(new THREE.Vector2(1, 1), scene, camera);
    outline.edgeStrength = 4;
    outline.edgeGlow = 1.2;
    outline.edgeThickness = 2;
    outline.visibleEdgeColor.set('#d2e8dd');
    outline.hiddenEdgeColor.set('#173a40');
    // Keep transform controls out of the selection mask (their visibility setters
    // deliberately override traversal visibility, unlike ordinary meshes).
    const renderOutline = outline.render.bind(outline);
    outline.render = (...args) => {
      const helper = transform.getHelper(),
        visible = helper.visible;
      helper.visible = false;
      const gridVisible = grid.mesh.visible;
      grid.mesh.visible = false;
      try {
        renderOutline(...args);
      } finally {
        helper.visible = visible;
        grid.mesh.visible = gridVisible;
      }
    };
    outline.overlayMaterial.uniforms.daylight = { value: false };
    outline.overlayMaterial.uniforms.selectionTint = {
      value: new THREE.Color('#008bad'),
    };
    outline.overlayMaterial.fragmentShader =
      outline.overlayMaterial.fragmentShader
        .replace(
          'uniform bool usePatternTexture;',
          'uniform bool usePatternTexture; uniform bool daylight; uniform vec3 selectionTint;',
        )
        .replace(
          'gl_FragColor = finalColor;',
          'gl_FragColor = daylight ? vec4(selectionTint, clamp(max(finalColor.r, max(finalColor.g, finalColor.b)), 0.0, 1.0)) : finalColor;',
        );
    composer.addPass(outline);
    const bokeh = new BokehPass(scene, camera, {
      focus: 20,
      aperture: 0,
      maxblur: 0.008,
    });
    bokeh.enabled = false;
    composer.addPass(bokeh);
    composer.addPass(new OutputPass());
    const applyLens = () => {
      const settings = latest.current.cameraSettings;
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = settings.fov;
        camera.updateProjectionMatrix();
      }
      bokeh.camera = camera;
      const uniforms = bokeh.uniforms as Record<string, { value: number }>;
      uniforms.focus.value = settings.focus;
      uniforms.aperture.value = settings.blur * 0.0002;
      bokeh.enabled =
        settings.blur > 0 && camera instanceof THREE.PerspectiveCamera;
    };
    const setTheme = (day: boolean) => {
      const color = day ? '#f5f6f8' : '#151719';
      renderer.setClearColor(color);
      (scene.fog as THREE.Fog).color.set(color);
      ground.material.color.set(color);
      ambient.groundColor.set(day ? '#b5c3ce' : '#252c34');
      ambient.intensity = day ? 1.2 : 0.8;
      outline.visibleEdgeColor.set(day ? '#ffffff' : '#d2e8dd');
      outline.overlayMaterial.uniforms.daylight.value = day;
      outline.overlayMaterial.blending = day
        ? THREE.NormalBlending
        : THREE.AdditiveBlending;
      outline.overlayMaterial.needsUpdate = true;
      grid.theme(day);
    };
    const setProjection = (orthographic: boolean) => {
      if (orthographic === camera instanceof THREE.OrthographicCamera) return;
      const next = orthographic
        ? new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, camera.far)
        : new THREE.PerspectiveCamera(
            40,
            container.clientWidth / Math.max(1, container.clientHeight),
            0.1,
            camera.far,
          );
      next.position.copy(camera.position);
      next.quaternion.copy(camera.quaternion);
      camera = next;
      orbit.object = next;
      transform.camera = next;
      basePass.camera = next;
      outline.renderCamera = next;
      bokeh.camera = next;
      applyLens();
      outline.prepareMaskMaterial.fragmentShader =
        outline.prepareMaskMaterial.fragmentShader.replace(
          /(?:perspective|orthographic)DepthToViewZ/g,
          orthographic ? 'orthographicDepthToViewZ' : 'perspectiveDepthToViewZ',
        );
      outline.prepareMaskMaterial.needsUpdate = true;
      if (runtime.current) runtime.current.camera = next;
    };
    const objects = new Map<string, THREE.Group>();
    const constructions = new Map<
      string,
      {
        group: THREE.Group;
        guide: THREE.Line;
        scan: THREE.Line | null;
        start: number;
        fade: boolean;
        editing: boolean;
      }
    >();
    const formationContext = new Map<
      THREE.Material,
      { opacity: number; transparent: boolean; depthWrite: boolean }
    >();
    let contextStart = 0,
      animationTime = 0;
    const restoreContext = () => {
      for (const [material, original] of formationContext) {
        Object.assign(material, original);
        material.needsUpdate = true;
      }
      formationContext.clear();
      container.dataset.formationContext = '0';
    };
    const softenContext = () => {
      if (formationContext.size) return;
      contextStart = animationTime;
      objects.forEach((group, id) => {
        if (latest.current.motion.ids.includes(id)) return;
        group.traverse((object) => {
          if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
            for (const material of Array.isArray(object.material)
              ? object.material
              : [object.material]) {
              if (formationContext.has(material)) continue;
              formationContext.set(material, {
                opacity: material.opacity,
                transparent: material.transparent,
                depthWrite: material.depthWrite,
              });
              material.transparent = true;
              material.depthWrite = false;
              material.needsUpdate = true;
            }
          }
        });
      });
      container.dataset.formationContext = String(formationContext.size);
    };
    const progress = document.createElement('div');
    progress.className = 'creation-progress';
    progress.setAttribute('aria-label', 'Geometry formation');
    const progressLabel = document.createElement('span'),
      progressBar = document.createElement('i');
    progress.append(progressLabel, progressBar);
    progress.hidden = true;
    container.appendChild(progress);
    const spatialLabel = document.createElement('div');
    spatialLabel.className = 'spatial-creation-label';
    spatialLabel.hidden = true;
    const spatialName = document.createElement('strong'),
      spatialMeasure = document.createElement('span');
    spatialLabel.append(spatialName, spatialMeasure);
    container.appendChild(spatialLabel);
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
      if (c.scan) {
        c.group.remove(c.scan);
        c.scan.geometry.dispose();
        (c.scan.material as THREE.Material).dispose();
      }
      c.group.remove(c.guide);
      c.guide.geometry.dispose();
      (c.guide.material as THREE.Material).dispose();
      constructions.delete(id);
      if (!constructions.size) restoreContext();
    };
    const finishConstruction = () => {
      for (const id of [...constructions.keys()]) finishOne(id);
      progress.hidden = true;
      spatialLabel.hidden = true;
      container.dataset.constructionActive = 'false';
      container.dataset.constructionPhase = 'complete';
    };
    const beginConstruction = (
      v: Volume,
      g: THREE.Group,
      index: number,
      editing = false,
    ) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (!editing) softenContext();
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
      let guideGeometry = new THREE.BufferGeometry().setFromPoints(traced);
      if (editing) {
        const edges: number[] = [];
        g.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            const geometry = new THREE.EdgesGeometry(o.geometry, 24);
            for (const value of geometry.getAttribute('position').array)
              edges.push(value);
            geometry.dispose();
          }
        });
        guideGeometry.dispose();
        guideGeometry = new THREE.BufferGeometry().setAttribute(
          'position',
          new THREE.Float32BufferAttribute(edges, 3),
        );
      }
      const Line = editing ? THREE.LineSegments : THREE.Line;
      const guide = new Line(
        guideGeometry,
        new THREE.LineBasicMaterial({
          color: '#d7e5db',
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
      const fade = editing || v.geometry?.kind === 'mesh' || isProfile(v);
      const scan = fade
        ? null
        : new THREE.Line(
            guide.geometry.clone(),
            new THREE.LineBasicMaterial({
              color: '#f1eadb',
              transparent: true,
              opacity: 0.65,
              depthTest: false,
            }),
          );
      if (scan) {
        scan.position.y = v.dimensions.height;
        scan.renderOrder = 5;
        scan.userData.construction = true;
        g.add(scan);
      }
      if (!fade) g.scale.y = 0.002;
      constructions.set(v.id, {
        group: g,
        guide,
        scan,
        editing,
        start: animationTime + Math.min(index * 60, 180),
        fade,
      });
      container.dataset.constructionActive = 'true';
      container.dataset.constructionPhase = 'footprint';
      container.dataset.constructionKind = editing ? 'reshape' : 'create';
    };
    let dragging = false;
    let dragStart: {
      position: THREE.Vector3;
      rotation: number;
      lastYaw: number | null;
      totalYaw: number;
    } | null = null;
    const pointer = new THREE.Vector2();
    const trackPointer = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
    };
    renderer.domElement.addEventListener('pointerdown', trackPointer, true);
    renderer.domElement.addEventListener('pointermove', trackPointer, true);
    const yawAtPointer = (origin: THREE.Vector3) => {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(pointer, camera);
      const hit = ray.ray.intersectPlane(
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -origin.y),
        new THREE.Vector3(),
      );
      if (!hit || Math.hypot(hit.x - origin.x, hit.z - origin.z) < 0.0001)
        return null;
      return Math.atan2(-(hit.z - origin.z), hit.x - origin.x);
    };
    const trail = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: '#55cbdc',
        depthTest: false,
        transparent: true,
        opacity: 0.9,
      }),
    );
    trail.visible = false;
    trail.renderOrder = 10;
    scene.add(trail);
    const updateMeasurement = () => {
      const obj = transform.object;
      if (!obj || !dragStart) return;
      if (transform.mode === 'rotate' && transform.axis === 'Y') {
        const yaw = yawAtPointer(dragStart.position);
        if (yaw !== null && dragStart.lastYaw !== null) {
          dragStart.totalYaw += Math.atan2(
            Math.sin(yaw - dragStart.lastYaw),
            Math.cos(yaw - dragStart.lastYaw),
          );
          let angle = dragStart.rotation + dragStart.totalYaw;
          if (latest.current.snap) {
            const step = THREE.MathUtils.degToRad(latest.current.angleSnap);
            angle = Math.round(angle / step) * step;
          }
          obj.rotation.set(0, angle, 0);
        }
        if (yaw !== null) dragStart.lastYaw = yaw;
      }
      obj.position.y = Math.max(0, obj.position.y);
      let preview: Project;
      try {
        preview = transformSelection(latest.current.project, obj.userData.id, {
          position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
          rotation: THREE.MathUtils.radToDeg(obj.rotation.y),
        });
      } catch {
        return;
      }
      for (const v of preview.volumes) {
        const group = objects.get(v.id);
        if (group) {
          group.position.set(v.position.x, v.position.y, v.position.z);
          group.rotation.y = THREE.MathUtils.degToRad(v.rotation);
        }
      }
      const delta = obj.position.clone().sub(dragStart.position);
      const angle = THREE.MathUtils.radToDeg(obj.rotation.y),
        turn = angle - THREE.MathUtils.radToDeg(dragStart.rotation);
      setMeasurement({
        id: obj.userData.id,
        mode: transform.mode,
        distance: delta.length(),
        position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
        delta: { x: delta.x, y: delta.y, z: delta.z },
        angle: ((angle % 360) + 360) % 360,
        turn,
      });
      const points: THREE.Vector3[] = [];
      if (transform.mode === 'rotate') {
        const v = latest.current.project.volumes.find(
          (v) => v.id === obj.userData.id,
        )!;
        const radius = Math.max(v.dimensions.width, v.dimensions.depth) * 0.65;
        const base = obj.position.clone().add(new THREE.Vector3(0, 0.06, 0));
        points.push(base);
        for (let i = 0; i <= 64; i++) {
          const a =
            dragStart.rotation +
            ((obj.rotation.y - dragStart.rotation) * i) / 64;
          points.push(
            base
              .clone()
              .add(
                new THREE.Vector3(
                  Math.cos(a) * radius,
                  0,
                  -Math.sin(a) * radius,
                ),
              ),
          );
        }
        points.push(base);
      } else
        points.push(
          dragStart.position.clone().add(new THREE.Vector3(0, 0.06, 0)),
          obj.position.clone().add(new THREE.Vector3(0, 0.06, 0)),
        );
      trail.geometry.dispose();
      trail.geometry = new THREE.BufferGeometry().setFromPoints(points);
      trail.visible = true;
    };
    transform.addEventListener('objectChange', updateMeasurement);
    transform.addEventListener('dragging-changed', (event) => {
      dragging = Boolean(event.value);
      setManipulating(dragging);
      orbit.enabled = !dragging;
      if (dragging && transform.object) {
        dragStart = {
          position: transform.object.position.clone(),
          rotation: transform.object.rotation.y,
          lastYaw: yawAtPointer(transform.object.position),
          totalYaw: 0,
        };
        updateMeasurement();
      }
      if (!dragging) {
        dragStart = null;
        trail.visible = false;
      }
      if (!dragging && transform.object) {
        const obj = transform.object;
        latest.current.onTransform(obj.userData.id, {
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
        for (const v of latest.current.project.volumes) {
          const group = objects.get(v.id);
          if (group) {
            group.position.set(v.position.x, v.position.y, v.position.z);
            group.rotation.y = THREE.MathUtils.degToRad(v.rotation);
          }
        }
      }
    });
    const cancelTransform = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !transform.dragging) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      dragStart = null;
      transform.reset();
      for (const v of latest.current.project.volumes) {
        const g = objects.get(v.id);
        if (g) {
          g.position.set(v.position.x, v.position.y, v.position.z);
          g.rotation.y = THREE.MathUtils.degToRad(v.rotation);
        }
      }
      transform.dragging = false;
      setMeasurement(null);
    };
    window.addEventListener('keydown', cancelTransform, true);
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
        latest.current.tool.startsWith('draw_') ||
        latest.current.placingCamera ||
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
        .intersectObjects(
          [...objects.values()].filter((g) => g.visible),
          true,
        )
        .find(
          (hit) =>
            hit.object instanceof THREE.Mesh &&
            (!latest.current.section.enabled ||
              clippingPlane.current.distanceToPoint(hit.point) >= 0),
        );
      latest.current.onSelect(
        hit ? hit.object.parent!.userData.id : null,
        event.shiftKey || event.ctrlKey || event.metaKey,
      );
    };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointerup', up);
    const facePull = new FacePullControls({
      scene,
      canvas: renderer.domElement,
      camera: () => camera,
      objects,
      current: () => ({
        enabled:
          latest.current.tool === 'reshape' &&
          !latest.current.placingCamera &&
          !latest.current.sectionEditing &&
          !latest.current.cameraSettings.walk,
        snap: latest.current.snap,
        volume: latest.current.project.volumes.find(
          (v) =>
            v.id === latest.current.project.selectedId &&
            isVisible(v, latest.current.project) &&
            !isLocked(v, latest.current.project),
        ),
      }),
      onDrag: (active) => {
        orbit.enabled = !active;
        dragging = active;
        setManipulating(active);
      },
      onCommit: (v) => {
        const before = latest.current.project.volumes.find(
          (o) => o.id === v.id,
        );
        latest.current.onChange(v.id, {
          dimensions: v.dimensions,
          position: v.position,
          ...(JSON.stringify(before?.geometry) !== JSON.stringify(v.geometry)
            ? { geometry: v.geometry }
            : {}),
        });
      },
      onFeedback: setPullFeedback,
      finishMotion: finishConstruction,
    });
    const walk = new WalkControls(
      renderer.domElement,
      () => camera,
      orbit,
      () => latest.current.cameraSettings,
      () => {
        const b = new THREE.Box3();
        objects.forEach((g) => {
          if (g.visible) b.expandByObject(g);
        });
        return b;
      },
    );
    const sectionPlane = sectionPlaneControls({
      scene,
      canvas: renderer.domElement,
      camera: () => camera,
      current: () => ({
        project: latest.current.project,
        section: latest.current.section,
        interactive:
          latest.current.sectionEditing &&
          !latest.current.tool.startsWith('draw_'),
        enabled:
          !latest.current.presenting &&
          !latest.current.placingCamera &&
          !latest.current.alignMap &&
          !latest.current.cameraSettings.walk,
        snap: latest.current.snap,
      }),
      onChange: (s) => latest.current.onSectionChange(s),
      onDrag: (active) => {
        dragging = active;
        orbit.enabled = !active;
      },
    });
    const disposeBoxSelection = boxSelection({
      canvas: renderer.domElement,
      container,
      camera: () => camera,
      objects,
      enabled: () =>
        !latest.current.cameraSettings.walk &&
        !latest.current.placingCamera &&
        !latest.current.presenting &&
        !latest.current.alignMap &&
        !latest.current.sectionEditing &&
        !latest.current.tool.startsWith('draw_'),
      selectMode: () => latest.current.tool === 'select',
      onSelect: (ids, additive) => latest.current.onSelectMany(ids, additive),
    });
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
    const fit = (top: boolean, focusIds?: string[], mapSpan?: number) => {
      const box = new THREE.Box3();
      if (mapSpan)
        box.set(
          new THREE.Vector3(-mapSpan / 2, 0, -mapSpan / 2),
          new THREE.Vector3(mapSpan / 2, 0, mapSpan / 2),
        );
      else if (focusIds?.length) {
        const volumes = latest.current.project.volumes.filter(
          (v) =>
            focusIds.includes(v.id) && isVisible(v, latest.current.project),
        );
        if (!volumes.length) return;
        const b = groupBounds(volumes);
        box.set(
          new THREE.Vector3(b.min.x, b.min.y, b.min.z),
          new THREE.Vector3(b.max.x, b.max.y, b.max.z),
        );
      } else
        objects.forEach((g) => {
          if (g.visible) box.expandByObject(g);
        });
      const center = box.isEmpty()
        ? new THREE.Vector3(0, 2, 0)
        : box.getCenter(new THREE.Vector3());
      const size = box.isEmpty()
        ? new THREE.Vector3(20, 10, 20)
        : box.getSize(new THREE.Vector3());
      let distance =
        ((Math.max(size.x, size.y, size.z, focusIds ? 1 : 10) /
          (2 *
            Math.tan(
              THREE.MathUtils.degToRad(latest.current.cameraSettings.fov / 2),
            ))) *
          (focusIds ? 1.6 : 1.65)) /
        Math.min(
          container.clientWidth / Math.max(container.clientHeight, 1),
          1,
        );
      if (focusIds)
        distance = Math.min(distance, camera.position.distanceTo(orbit.target));
      container.dataset.cameraFraming = mapSpan
        ? 'map'
        : focusIds
          ? 'creation'
          : 'all';
      container.dataset.cameraFocusIds = focusIds?.join(',') ?? '';
      container.dataset.cameraGoalDistance = String(distance);
      if (camera instanceof THREE.OrthographicCamera) {
        const half = focusIds
            ? Math.min(
                (camera.top - camera.bottom) / camera.zoom / 2,
                distance *
                  Math.tan(
                    THREE.MathUtils.degToRad(
                      latest.current.cameraSettings.fov / 2,
                    ),
                  ),
              )
            : distance *
              Math.tan(
                THREE.MathUtils.degToRad(latest.current.cameraSettings.fov / 2),
              ),
          aspect = container.clientWidth / Math.max(container.clientHeight, 1);
        camera.left = -half * aspect;
        camera.right = half * aspect;
        camera.top = half;
        camera.bottom = -half;
        camera.zoom = 1;
        camera.updateProjectionMatrix();
      }
      const to = center
        .clone()
        .add(
          (top
            ? new THREE.Vector3(0, 1, 0.001)
            : focusIds
              ? camera.position.clone().sub(orbit.target)
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
      updateShadows();
    };
    const sunPath = new THREE.Group();
    scene.add(sunPath);
    const updateShadows = () => {
      const vs = latest.current.project.volumes;
      if (!vs.length) return;
      const bounds = groupBounds(vs);
      const center = new THREE.Vector3(
        (bounds.min.x + bounds.max.x) / 2,
        bounds.max.y / 2,
        (bounds.min.z + bounds.max.z) / 2,
      );
      // Include the ground and a generous margin for projected shadows, not just camera framing.
      const radius = Math.max(
        80,
        Math.hypot(
          bounds.max.x - bounds.min.x,
          bounds.max.y,
          bounds.max.z - bounds.min.z,
        ) * 0.9,
      );
      light.position
        .copy(center)
        .add(new THREE.Vector3(-2, 4, 2).multiplyScalar(radius));
      light.target.position.copy(center);
      Object.assign(light.shadow.camera, {
        left: -radius,
        right: radius,
        top: radius,
        bottom: -radius,
        near: 1,
        far: radius * 9,
      });
      light.shadow.camera.updateProjectionMatrix();
      sunPath.children.slice().forEach((o) => {
        sunPath.remove(o);
        disposeObject(o);
      });
      const site = latest.current.project.site,
        study = latest.current.solar;
      if (site && study.enabled) {
        const sun = solarPosition(site, study),
          dir = new THREE.Vector3(
            sun.direction.x,
            sun.direction.y,
            sun.direction.z,
          );
        light.position
          .copy(center)
          .addScaledVector(dir, Math.max(100, radius * 2));
        light.intensity = sun.altitude > 0 ? 2 : 0;
        ambient.intensity = sun.altitude > 0 ? 0.7 : 0.12;
        container.dataset.sunAltitude = String(sun.altitude);
        container.dataset.sunAzimuth = String(sun.azimuth);
        if (study.path) {
          const points: THREE.Vector3[] = [];
          for (let minutes = 0; minutes < 1440; minutes += 10) {
            const p = solarPosition(site, { ...study, minutes });
            if (p.altitude > 0)
              points.push(
                new THREE.Vector3(p.direction.x, p.direction.y, p.direction.z)
                  .multiplyScalar(
                    Math.max(
                      12,
                      Math.hypot(
                        bounds.max.x - bounds.min.x,
                        bounds.max.y - bounds.min.y,
                        bounds.max.z - bounds.min.z,
                      ) * 0.7,
                    ),
                  )
                  .add(center),
              );
          }
          if (points.length > 1)
            sunPath.add(
              new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(points),
                new THREE.LineBasicMaterial({
                  color: '#e6be7a',
                  transparent: true,
                  opacity: 0.5,
                }),
              ),
            );
          if (sun.altitude > 0) {
            const sphere = new THREE.Mesh(
              new THREE.SphereGeometry(Math.max(0.3, radius * 0.008), 16, 12),
              new THREE.MeshBasicMaterial({ color: '#ffe0a1' }),
            );
            sphere.position
              .copy(center)
              .addScaledVector(
                dir,
                Math.max(
                  12,
                  Math.hypot(
                    bounds.max.x - bounds.min.x,
                    bounds.max.y - bounds.min.y,
                    bounds.max.z - bounds.min.z,
                  ) * 0.7,
                ),
              );
            sunPath.add(sphere);
          }
        }
      } else {
        light.intensity = 2;
        ambient.intensity =
          latest.current.appearance.theme === 'day' ? 1.2 : 0.8;
        delete container.dataset.sunAltitude;
        delete container.dataset.sunAzimuth;
      }

      container.dataset.shadowSpan = String(radius * 2);
      container.dataset.shadowCenter = `${center.x},${center.y},${center.z}`;
    };
    runtime.current = {
      scene,
      outline,
      setTheme,
      setProjection,
      setMapVisible: (visible) => {
        const coverage = visible
          ? (latest.current.project.site?.coverage ?? 0)
          : 0;
        orbit.maxDistance = Math.max(2500, coverage * 8);
        camera.far = Math.max(5000, coverage * 12);
        camera.updateProjectionMatrix();
        ground.visible = !visible;
        grid.mesh.visible = !visible;
        container.dataset.baseGroundVisible = String(!visible);
      },
      camera,
      renderer,
      orbit,
      transform,
      objects,
      signatures: new Map(),
      updateShadows,
      applyLens,
      fit,
      beginConstruction,
      finishConstruction,
      motionRevision: 0,
    };
    const resize = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      renderer.setSize(width, height);
      composer.setSize(width, height);
      if (camera instanceof THREE.PerspectiveCamera)
        camera.aspect = width / Math.max(height, 1);
      else {
        const halfWidth = camera.top * (width / Math.max(height, 1));
        camera.left = -halfWidth;
        camera.right = halfWidth;
      }
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
    let frame = 0,
      lastFrame = performance.now();
    const render = () => {
      const now = performance.now(),
        delta = (now - lastFrame) / 1000;
      lastFrame = now;
      if (latest.current.suspended) {
        frame = requestAnimationFrame(render);
        return;
      }
      // Slow frames and a background tab must not skip the formation the user came to see.
      if (document.visibilityState === 'visible')
        animationTime += Math.min(delta * 1000, 250);
      if (transition && !latest.current.cameraSettings.walk) {
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
      container.dataset.gridSpacing = String(grid.update(camera, orbit.target));
      container.dataset.cameraDistance = String(
        camera.position.distanceTo(orbit.target),
      );
      ground.position.x = camera.position.x;
      ground.position.z = camera.position.z;
      sectionPlane.update();
      if (
        constructions.size &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      )
        finishConstruction();
      if (formationContext.size) {
        const elapsed = animationTime - contextStart;
        const restore = THREE.MathUtils.smoothstep(elapsed, 2700, 3600);
        const soften =
          THREE.MathUtils.smoothstep(elapsed, 0, 300) * (1 - restore);
        for (const [material, original] of formationContext)
          material.opacity = original.opacity * (1 - 0.82 * soften);
      }
      for (const [id, c] of constructions) {
        const frame = constructionFrame(
          animationTime - c.start,
          c.editing ? 1800 : 3600,
        );
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
        if (c.scan) {
          c.scan.geometry.setDrawRange(
            0,
            Math.ceil(
              frame.trace * c.scan.geometry.getAttribute('position').count,
            ),
          );
          (c.scan.material as THREE.LineBasicMaterial).opacity =
            frame.phase === 'footprint' ? 0 : frame.guideOpacity * 0.7;
        }
        progress.hidden = false;
        const volume = latest.current.project.volumes.find((v) => v.id === id);
        if (volume) {
          const pos = new THREE.Vector3(
            volume.position.x,
            volume.position.y +
              (isProfile(volume) ? 0 : volume.dimensions.height * frame.height),
            volume.position.z,
          ).project(camera);
          spatialLabel.hidden =
            pos.z > 1 ||
            pos.z < -1 ||
            Math.abs(pos.x) > 0.85 ||
            Math.abs(pos.y) > 0.85;
          spatialLabel.style.left = `${((pos.x + 1) * container.clientWidth) / 2}px`;
          spatialLabel.style.top = `${((-pos.y + 1) * container.clientHeight) / 2}px`;
          spatialName.textContent = volume.name;
          spatialMeasure.textContent = `${volume.dimensions.width} × ${volume.dimensions.depth}${isProfile(volume) ? '' : ` × ${volume.dimensions.height}`} m`;
        }
        const phaseLabel = c.editing
          ? 'Revealing the updated geometry'
          : frame.phase === 'footprint'
            ? 'Tracing the footprint'
            : frame.phase === 'extruding'
              ? 'Forming the volume'
              : 'Settling into place';
        if (progressLabel.textContent !== phaseLabel)
          progressLabel.textContent = phaseLabel;
        progress.style.setProperty(
          '--formation',
          String(
            Math.min(
              1,
              Math.max(
                0,
                (animationTime - c.start) / (c.editing ? 1800 : 3600),
              ),
            ),
          ),
        );
        if (c.fade)
          c.group.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              const m = o.material as THREE.MeshPhysicalMaterial;
              if (!m.transparent) m.needsUpdate = true;
              m.transparent = true;
              m.opacity =
                (o.userData.restOpacity ?? 1) *
                (c.editing ? 0.35 + 0.65 * frame.opacity : frame.opacity);
            }
          });
        else c.group.scale.y = frame.height;
        container.dataset.constructionPhase = frame.phase;
        container.dataset.constructionProgress = String(frame.height);
      }
      container.dataset.constructionActive = String(constructions.size > 0);
      if (!constructions.size) {
        spatialLabel.hidden = true;
        container.dataset.constructionPhase = 'complete';
        progress.hidden = true;
      }
      walk.update(delta);
      orbit.autoRotate =
        latest.current.turntable && !latest.current.cameraSettings.walk;
      orbit.autoRotateSpeed = 0.35;
      if (!latest.current.cameraSettings.walk) orbit.update(delta);
      else publishCamera();
      facePull.update();
      container.dataset.projection = camera.type;
      outline.enabled =
        outline.selectedObjects.length > 0 &&
        !latest.current.section.enabled &&
        !latest.current.presenting;
      if (outline.enabled || bokeh.enabled) composer.render();
      else renderer.render(scene, camera);
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
      window.removeEventListener('keydown', cancelTransform, true);
      cancelAnimationFrame(frame);
      sectionPlane.dispose();
      facePull.dispose();
      walk.dispose();
      disposeBoxSelection();
      disposeObject(sunPath);
      bokeh.dispose();
      finishConstruction();
      resize.disconnect();
      renderer.domElement.removeEventListener(
        'pointerdown',
        trackPointer,
        true,
      );
      renderer.domElement.removeEventListener(
        'pointermove',
        trackPointer,
        true,
      );
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      transform.dispose();
      orbit.dispose();
      disposeObject(scene);
      environment.dispose();
      composer.passes.forEach((pass) => pass.dispose());
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      progress.remove();
      spatialLabel.remove();
      runtime.current = null;
    };
  }, []);
  useEffect(() => {
    const r = runtime.current;
    if (!r) return;
    // Selection/tool updates must not cancel the creation they just triggered.
    if (
      r.motionRevision !== props.motion.revision ||
      props.cameraSettings.walk ||
      props.presenting
    )
      r.finishConstruction();
    r.setTheme(props.appearance.theme === 'day');
    let cancelled = false;
    const built = new Map<string, THREE.Group>();
    async function rebuild() {
      try {
        const signatures = new Map<string, string>();
        await Promise.all(
          props.project.volumes
            .filter((v) => isVisible(v, props.project))
            .map(async (v) => {
              const signature = JSON.stringify([
                v.dimensions,
                v.geometry,
                v.display,
                v.material,
              ]);
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
                  geometries.push({
                    geometry: shaded,
                    material: part.material,
                  });
                }
              const curves = curvedWireframe(v);
              if (curves.length) {
                const lines = new THREE.LineSegments(
                  new THREE.BufferGeometry().setAttribute(
                    'position',
                    new THREE.Float32BufferAttribute(curves, 3),
                  ),
                  new THREE.LineBasicMaterial({
                    transparent: true,
                    clippingPlanes: latest.current.section.enabled
                      ? [clippingPlane.current]
                      : [],
                  }),
                );
                lines.userData.symbolicWireframe = true;
                g.add(lines);
              }
              for (const part of geometries) {
                const glass = part.material === 'glass',
                  frame = part.material === 'frame',
                  foliage = part.material === 'foliage';
                const mesh = new THREE.Mesh(
                  part.geometry,
                  new THREE.MeshPhysicalMaterial({
                    color: glass ? '#8dc9d2' : frame ? '#38464e' : '#d8d9d4',
                    roughness:
                      v.geometry?.kind === 'tree'
                        ? 0.85
                        : glass
                          ? 0.13
                          : frame
                            ? 0.4
                            : 0.32,
                    metalness: frame ? 0.5 : 0.08,
                    transparent: glass || foliage,
                    opacity: foliage ? 0.42 : glass ? 0.32 : 1,
                    depthWrite: !glass && !foliage,
                    side:
                      isProfile(v) ||
                      glass ||
                      foliage ||
                      part.material === 'reference'
                        ? THREE.DoubleSide
                        : THREE.FrontSide,
                    clippingPlanes: latest.current.section.enabled
                      ? [clippingPlane.current]
                      : [],
                    clipShadows: true,
                    clearcoat:
                      v.geometry?.kind === 'tree' ? 0 : glass ? 1 : 0.3,
                    envMapIntensity: glass ? 1.4 : 0.35,
                  }),
                );
                mesh.userData.materialKind = part.material;
                mesh.castShadow = !glass;
                mesh.receiveShadow = true;
                g.add(mesh);
                {
                  const edges = new THREE.LineSegments(
                    new THREE.EdgesGeometry(part.geometry, 24),
                    new THREE.LineBasicMaterial({
                      clippingPlanes: latest.current.section.enabled
                        ? [clippingPlane.current]
                        : [],
                      color: '#d6e0e2',
                      transparent: true,
                      opacity: 0.12,
                    }),
                  );
                  edges.userData.materialKind = part.material;
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
        r!.updateShadows();
        r!.outline.selectedObjects = [];
        for (const v of props.project.volumes.filter((v) =>
          isVisible(v, props.project),
        )) {
          const g = r!.objects.get(v.id)!;
          g.position.set(v.position.x, v.position.y, v.position.z);
          g.rotation.y = THREE.MathUtils.degToRad(v.rotation);
          const selected =
            v.id === props.project.selectedId ||
            props.project.selectedIds?.includes(v.id);
          g.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              if (
                selected &&
                !props.placingCamera &&
                !props.cameraSettings.walk
              )
                r!.outline.selectedObjects.push(o);
              const material = o.material as THREE.MeshPhysicalMaterial;
              const kind = o.userData.materialKind;
              const mode = props.renderMode;
              material.color.set(
                mode === 'hidden-line'
                  ? props.appearance.surfaceColor
                  : (v.color ??
                      (kind === 'glass'
                        ? '#8dc9d2'
                        : kind === 'frame'
                          ? '#38464e'
                          : '#e2e7e6')),
              );
              material.emissive.set(
                mode === 'hidden-line'
                  ? props.appearance.surfaceColor
                  : selected
                    ? '#183033'
                    : '#000000',
              );
              material.emissiveIntensity =
                mode === 'hidden-line' ? 0.35 : selected ? 0.12 : 0;
              const transparent =
                mode === 'wireframe' ||
                kind === 'foliage' ||
                (mode === 'studio' && kind === 'glass');
              if (material.transparent !== transparent)
                material.needsUpdate = true;
              material.transparent = transparent;
              material.opacity =
                mode === 'wireframe'
                  ? 0
                  : kind === 'foliage'
                    ? 0.42
                    : mode === 'studio' && kind === 'glass'
                      ? 0.32
                      : 1;
              material.depthWrite =
                kind !== 'foliage' &&
                (mode === 'hidden-line' ||
                  (mode === 'studio' && kind !== 'glass'));
              material.polygonOffset = mode === 'hidden-line';
              material.polygonOffsetFactor = 1;
              material.polygonOffsetUnits = 1;
              o.castShadow = mode === 'studio' && kind !== 'glass';
              o.receiveShadow = mode === 'studio';
            } else if (o instanceof THREE.Line) {
              if (o.userData.symbolicWireframe)
                o.visible = props.renderMode === 'wireframe';
              const material = o.material as THREE.LineBasicMaterial;
              material.color.set(
                props.renderMode === 'studio'
                  ? selected
                    ? '#b9eeec'
                    : '#d6e0e2'
                  : selected
                    ? '#a4e4dd'
                    : props.appearance.lineColor,
              );
              material.opacity =
                o.userData.materialKind === 'foliage'
                  ? selected
                    ? 0.55
                    : props.renderMode === 'studio'
                      ? 0.1
                      : 0.4
                  : props.renderMode === 'studio'
                    ? selected
                      ? 0.55
                      : 0.12
                    : 1;
              material.depthTest = props.renderMode !== 'wireframe';
            }
          });
        }
        const selected = r!.objects.get(props.project.selectedId ?? '');
        const selectedVolume = props.project.volumes.find(
          (v) => v.id === props.project.selectedId,
        );
        if (
          selected &&
          selectedVolume &&
          !isLocked(selectedVolume, props.project) &&
          (props.tool === 'translate' || props.tool === 'rotate') &&
          !props.sectionEditing &&
          !props.cameraSettings.walk &&
          !props.placingCamera
        )
          r!.transform.attach(selected);
        r!.transform.setMode(props.tool === 'rotate' ? 'rotate' : 'translate');
        r!.transform.showX = props.tool !== 'rotate';
        r!.transform.showY = true;
        r!.transform.showZ = props.tool !== 'rotate';
        r!.transform.setTranslationSnap(props.snap ? 0.5 : null);
        r!.transform.setRotationSnap(
          props.snap ? THREE.MathUtils.degToRad(props.angleSnap) : null,
        );
        host.current!.dataset.selectionGlow = String(
          r!.outline.selectedObjects.length,
        );
        host.current!.dataset.transformTool = r!.transform.object
          ? props.tool
          : 'none';
        host.current!.dataset.theme = props.appearance.theme;
        host.current!.dataset.modelObjects = String(r!.objects.size);
        host.current!.dataset.renderMode = props.renderMode;
        host.current!.dataset.meshBuilds = String(
          Number(host.current!.dataset.meshBuilds || 0) + built.size,
        );
        if (!hadObjects && r!.objects.size && !props.motion.ids.length) {
          // Open architectural scenes close to the work; distant entourage
          // remains available through Frame all without shrinking the house.
          const architecture = props.project.volumes.filter(
            (v) =>
              isVisible(v, props.project) &&
              v.geometry?.kind !== 'tree' &&
              v.geometry?.kind !== 'person',
          );
          const hasEntourage =
            architecture.length <
            props.project.volumes.filter((v) => isVisible(v, props.project))
              .length;
          r!.fit(
            props.view.mode === 'top',
            hasEntourage && architecture.length
              ? architecture.map((v) => v.id)
              : undefined,
          );
        }
        if (r!.motionRevision !== props.motion.revision) {
          r!.motionRevision = props.motion.revision;
          if (props.motion.ids.length && !props.cameraSettings.walk)
            r!.fit(props.view.mode === 'top', props.motion.ids);
          props.motion.ids.forEach((id, i) => {
            const v = props.project.volumes.find((o) => o.id === id),
              g = r!.objects.get(id);
            if (v && g) r!.beginConstruction(v, g, i);
          });
          props.motion.changedIds.forEach((id, i) => {
            const v = props.project.volumes.find((o) => o.id === id),
              g = r!.objects.get(id);
            if (v && g && built.has(id)) r!.beginConstruction(v, g, i, true);
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
  }, [
    props.project,
    props.tool,
    props.snap,
    props.angleSnap,
    props.renderMode,
    props.appearance,
    props.motion,
    props.presenting,
    props.cameraSettings.walk,
    props.placingCamera,
    props.sectionEditing,
  ]);
  useEffect(() => {
    const r = runtime.current;
    if (!r) return;
    if (props.cameraSettings.walk) r.setProjection(false);
    r.applyLens();
  }, [props.cameraSettings]);
  useEffect(() => {
    if (props.placingCamera) runtime.current?.finishConstruction();
  }, [props.placingCamera]);
  useEffect(() => {
    runtime.current?.updateShadows();
  }, [props.solar, props.project.site]);
  useEffect(() => {
    runtime.current?.setProjection(props.view.mode !== 'perspective');
    runtime.current?.fit(props.view.mode === 'top');
  }, [props.view]);
  useEffect(() => {
    const site = props.project.site,
      r = runtime.current;
    if (!props.mapFrame || !site || !r) return;
    const coverage = site.coverage ?? siteTiles(site)[0].size * 4;
    const a = (site.bearing * Math.PI) / 180;
    r.fit(
      true,
      undefined,
      coverage * (Math.abs(Math.sin(a)) + Math.abs(Math.cos(a))),
    );
  }, [props.mapFrame]);

  useEffect(() => {
    const r = runtime.current;
    if (!r) return;
    const section = props.section,
      axis = { x: 0, y: 1, z: 2 }[section.axis],
      normal = new THREE.Vector3();
    normal.setComponent(axis, section.flip ? 1 : -1);
    clippingPlane.current.set(
      normal,
      -section.position * normal.getComponent(axis),
    );
    r.objects.forEach((g) =>
      g.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          const materials = Array.isArray(o.material)
            ? o.material
            : [o.material];
          materials.forEach((m) => {
            m.clippingPlanes = section.enabled ? [clippingPlane.current] : [];
            m.needsUpdate = true;
          });
        }
      }),
    );
    if (host.current) {
      host.current.dataset.section = section.enabled ? section.axis : 'off';
      host.current.dataset.sectionPosition = String(section.position);
    }
    let cancelled = false;
    const caps = new THREE.Group();
    r.scene.add(caps);
    const timer = setTimeout(() => {
      if (!section.enabled) return;
      void Promise.all(
        props.project.volumes
          .filter((v) => isVisible(v, props.project))
          .map((v) => sectionCap(v, section)),
      )
        .then((parts) => {
          if (cancelled) return;
          const positions = parts.flat();
          if (positions.length) {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute(
              'position',
              new THREE.Float32BufferAttribute(positions, 3),
            );
            geometry.computeVertexNormals();
            const mesh = new THREE.Mesh(
              geometry,
              new THREE.MeshBasicMaterial({
                color: '#111318',
                side: THREE.DoubleSide,
                polygonOffset: true,
                polygonOffsetFactor: -1,
                polygonOffsetUnits: -1,
              }),
            );
            caps.add(mesh);
          }
          if (host.current)
            host.current.dataset.sectionCapTriangles = String(
              positions.length / 9,
            );
        })
        .catch(() => {
          if (!cancelled)
            setError(
              'Section faces could not be calculated. Turn off section to see the whole model.',
            );
        });
    }, 140);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      r.scene.remove(caps);
      disposeObject(caps);
    };
  }, [props.section, props.project.volumes, props.appearance.theme]);

  useEffect(() => {
    const r = runtime.current,
      site = props.project.site;
    if (!r || !site || !props.mapVisible) return;
    r.setMapVisible(true);
    let disposed = false,
      loaded = 0,
      failed = 0;
    const group = new THREE.Group(),
      textures: THREE.Texture[] = [];
    group.name = 'site-map';
    group.rotation.y = (site.bearing * Math.PI) / 180;
    r.scene.add(group);
    const tiles = siteTiles(site);
    const status = () => {
      if (host.current) {
        host.current.dataset.mapTiles = String(loaded);
        host.current.dataset.mapStatus = failed
          ? 'error'
          : loaded === tiles.length
            ? 'ready'
            : 'loading';
      }
    };
    status();
    for (const tile of tiles) {
      const texture = new THREE.TextureLoader().load(
        tile.url,
        () => {
          if (disposed) {
            texture.dispose();
            return;
          }
          loaded++;
          status();
        },
        undefined,
        () => {
          if (!disposed) {
            failed++;
            status();
            setMapError(
              'Map imagery could not load. Check your connection or hide the map. Your model is preserved.',
            );
          }
        },
      );
      textures.push(texture);
      texture.colorSpace = THREE.SRGBColorSpace;
      const geometry = new THREE.PlaneGeometry(tile.width, tile.depth);
      const uv = geometry.getAttribute('uv');
      for (let i = 0; i < uv.count; i++)
        uv.setXY(
          i,
          THREE.MathUtils.lerp(tile.uv.u0, tile.uv.u1, uv.getX(i)),
          THREE.MathUtils.lerp(tile.uv.v0, tile.uv.v1, uv.getY(i)),
        );
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 1,
          metalness: 0,
          color: '#bac3c8',
          fog: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(tile.x, -0.012, tile.z);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    setMapError('');
    return () => {
      disposed = true;
      r.setMapVisible(false);
      r.scene.remove(group);
      disposeObject(group);
      textures.forEach((t) => t.dispose());
      if (host.current) {
        delete host.current.dataset.mapStatus;
        delete host.current.dataset.mapTiles;
      }
    };
  }, [
    props.project.site?.latitude,
    props.project.site?.longitude,
    props.project.site?.style,
    props.project.site?.coverage,
    props.mapVisible,
  ]);
  useEffect(() => {
    const group = runtime.current?.scene.getObjectByName('site-map');
    if (group)
      group.rotation.y = ((props.project.site?.bearing ?? 0) * Math.PI) / 180;
  }, [props.project.site?.bearing]);
  useEffect(() => {
    const r = runtime.current,
      site = props.project.site;
    if (!r || !site || !props.alignMap || !props.mapVisible) return;
    const canvas = r.renderer.domElement,
      ray = new THREE.Raycaster(),
      plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let start: THREE.Vector3 | null = null,
      delta = new THREE.Vector3(),
      pointerId: number | null = null;
    const point = (e: PointerEvent) => {
      const b = canvas.getBoundingClientRect();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - b.left) / b.width) * 2 - 1,
          (-(e.clientY - b.top) / b.height) * 2 + 1,
        ),
        r.camera,
      );
      return ray.ray.intersectPlane(plane, new THREE.Vector3());
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || pointerId !== null) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      start = point(e);
      delta.set(0, 0, 0);
      pointerId = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      r.orbit.enabled = false;
    };
    const move = (e: PointerEvent) => {
      if (!start || e.pointerId !== pointerId) return;
      e.stopImmediatePropagation();
      const p = point(e);
      if (!p) return;
      delta.copy(p).sub(start);
      r.scene.getObjectByName('site-map')?.position.set(delta.x, 0, delta.z);
    };
    const finish = (e?: PointerEvent, cancel = false) => {
      if (pointerId === null || (e && e.pointerId !== pointerId)) return;
      e?.stopImmediatePropagation();
      if (canvas.hasPointerCapture(pointerId))
        canvas.releasePointerCapture(pointerId);
      pointerId = null;
      start = null;
      r.orbit.enabled = true;
      r.scene.getObjectByName('site-map')?.position.set(0, 0, 0);
      if (!cancel && delta.length() > 0.001) {
        try {
          latest.current.onMapSite(shiftMap(site, delta.x, delta.z));
        } catch {
          setMapError('This movement is outside the supported map extent.');
        }
      }
    };
    const up = (e: PointerEvent) => finish(e),
      cancel = (e: PointerEvent) => finish(e, true),
      escape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && pointerId !== null) {
          e.stopImmediatePropagation();
          e.preventDefault();
          finish(undefined, true);
        }
      };
    canvas.addEventListener('pointerdown', down, true);
    canvas.addEventListener('pointermove', move, true);
    canvas.addEventListener('pointerup', up, true);
    canvas.addEventListener('pointercancel', cancel, true);
    window.addEventListener('keydown', escape, true);
    canvas.style.cursor = 'grab';
    return () => {
      finish(undefined, true);
      canvas.style.cursor = '';
      canvas.removeEventListener('pointerdown', down, true);
      canvas.removeEventListener('pointermove', move, true);
      canvas.removeEventListener('pointerup', up, true);
      canvas.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('keydown', escape, true);
    };
  }, [props.alignMap, props.mapVisible, props.project.site]);
  return (
    <div
      className="viewport-canvas"
      ref={host}
      data-testid="viewport"
      data-align-map={props.alignMap}
    >
      {props.tool.startsWith('draw_') &&
        !props.suspended &&
        !props.cameraSettings.walk && (
          <Sketch
            mode={props.tool.slice(5) as 'rectangle' | 'circle' | 'outline'}
            project={props.project}
            snap={props.snap}
            getRuntime={() => runtime.current}
            onMode={(mode) => props.onTool(`draw_${mode}`)}
            onCommit={props.onDraw}
            onClose={() => props.onTool('select')}
          />
        )}
      {props.placingCamera && (
        <WalkPlacement
          getRuntime={() => runtime.current}
          eyeHeight={props.cameraSettings.eyeHeight}
          floor={props.cameraSettings.level}
          onComplete={props.onPlaceCamera}
        />
      )}
      {props.alignMap && (
        <div className="pull-feedback" role="status">
          <strong>Move the map</strong>
          <span>Drag beneath the model · Escape cancels a drag</span>
        </div>
      )}
      {props.project.selectedId &&
        (props.tool === 'translate' || props.tool === 'rotate') &&
        !props.sectionEditing &&
        (() => {
          const v = props.project.volumes.find(
            (v) => v.id === props.project.selectedId,
          )!;
          const m =
            measurement?.id === v.id &&
            measurement.mode === props.tool &&
            (manipulating ||
              (Math.abs(measurement.angle - v.rotation) < 0.01 &&
                Math.hypot(
                  measurement.position.x - v.position.x,
                  measurement.position.y - v.position.y,
                  measurement.position.z - v.position.z,
                ) < 0.01))
              ? measurement
              : null;
          const fmt = (n: number) => Number(n.toFixed(2));
          return (
            <div
              className="transform-readout"
              aria-label="Transform measurements"
            >
              {props.tool === 'rotate' ? (
                <>
                  <strong>{fmt(m?.angle ?? v.rotation)}°</strong>
                  <span>
                    {m
                      ? `Turn ${m.turn >= 0 ? '+' : ''}${fmt(m.turn)}° · `
                      : ''}
                    {props.snap ? `${props.angleSnap}° snap` : 'Free rotation'}
                  </span>
                </>
              ) : (
                <>
                  <strong>
                    {m ? `${fmt(m.distance)} m moved` : 'Drag an arrow to move'}
                  </strong>
                  <span>
                    {m
                      ? `ΔX ${fmt(m.delta.x)} · ΔY ${fmt(m.delta.y)} · ΔZ ${fmt(m.delta.z)} m`
                      : 'Distances in meters'}
                  </span>
                </>
              )}
            </div>
          );
        })()}
      {props.tool === 'reshape' && props.project.selectedId && (
        <div className="pull-feedback" role="status">
          {pullFeedback ? (
            <>
              <strong>
                {pullFeedback.extruding
                  ? 'Extrude'
                  : pullFeedback.axis === 'y'
                    ? 'Height'
                    : pullFeedback.axis === 'x'
                      ? 'Width'
                      : 'Depth'}{' '}
                {pullFeedback.size.toFixed(2)} m
              </strong>
              <span>
                Δ {pullFeedback.delta >= 0 ? '+' : ''}
                {pullFeedback.delta.toFixed(2)} m · release to keep · Esc to
                cancel
              </span>
            </>
          ) : (
            <>
              <strong>Pull a face to shape it</strong>
              <span>Drag a luminous handle · opposite side stays fixed</span>
              <small>Curved and cut forms resize along the chosen axis.</small>
            </>
          )}
        </div>
      )}
      {props.mapVisible && props.project.site && mapError && (
        <div className="map-error" role="alert">
          {mapError}
        </div>
      )}
      {error && (
        <div className="webgl-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
