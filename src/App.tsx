import { explosionOffsets } from './design/explosion';
import { explorationTransform, componentInfo } from './design/model';
import ExplorePanel from './design/ExplorePanel';
import { assembled, type Exploration, type SavedView } from './design/schema';
import { resolveIds } from './intelligence/engine';
import { downloadProject, projectFile } from './projects/transfer';
import { parsePanoramas, type Panoramas } from './panorama/data';
import { equalData } from './projects/equalData';
import { createSessionEncoder } from './projects/sessionCodec';
import { createPortal } from 'react-dom';
import { resolveWalkPlacement } from './studio/walkPlacement';
import ARPanel from './ar/ARPanel';
import { parseBoard } from './moodboard/data';
import ModelPanel from './studio/ModelPanel';
import { useToolPanels } from './studio/useToolPanels';
import { trackToolbar } from './studio/trackToolbar';
import { transformSelection } from './geometry/selectionTransform';
import { exportObj } from './geometry/export';
import { referenceImage } from './imports/reference';
import LayersPanel from './studio/LayersPanel';
import SolarPanel from './studio/SolarPanel';
import CameraPanel from './studio/CameraPanel';
import { defaultSolar } from './studio/solar';
import { defaultCameraSettings } from './studio/camera';
import AddVolumePanel from './studio/AddVolumePanel';
import { checkedPlan } from './intelligence/checkedPlanner';
import SectionPanel from './studio/SectionPanel';
import { defaultSection, sectionRange } from './studio/section';
import { mapSources, trueNorth } from './studio/site';
import { useFloatingPanel } from './studio/useFloatingPanel';
import StudioPanel from './studio/StudioPanel';
import { loadAppearance, palette } from './studio/appearance';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { WorkspaceSnapshot } from './projects/library';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUp,
  MessageCircle,
  MoreHorizontal,
  Minus,
  Moon,
  ArrowUpRight,
  Box,
  Check,
  ChevronRight,
  Copy,
  Focus,
  Eye,
  EyeOff,
  Grid2X2,
  Layers,
  Maximize,
  MapPin,
  MousePointer2,
  Move3D,
  Plus,
  PenLine,
  Redo2,
  RotateCcw,
  RotateCw,
  Mic,
  MicOff,
  PanelRightClose,
  PanelRightOpen,
  Settings2,
  Sparkles,
  Scissors,
  Presentation,
  Sun,
  Camera,
  ImagePlus,
  ChevronDown,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import MeshImportDialog from './imports/MeshImportDialog';
import { importedSession } from './imports/transaction';
import {
  isReference,
  MAX_IMPORT_BYTES,
  type PreparedImport,
} from './imports/mesh';
import { groupBounds } from './geometry/spatial';
import Viewport, { type Tool } from './Viewport';
import {
  applyPlan,
  newSession,
  parseSession,
  serializeSession,
  directPlan,
  type Session,
} from './intelligence/engine';
import { defaultCamera, type CameraContext } from './intelligence/context';
import {
  needsConfirmation,
  type Plan,
  type Operation,
} from './intelligence/plan';
import {
  connection,
  requestPlan,
  VoiceConnection,
  type Message,
  type Connection,
} from './intelligence/client';
import { isProfile, openingScale, solidStats } from './geometry/kernel';
const Moodboard = lazy(() => import('./moodboard/Moodboard'));
const SESSION_KEY = 'atelier.session.v2';
const CHAT_KEY = 'atelier.conversation.v2';

import {
  buildingSettings,
  isLocked,
  isVisible,
  COMMAND_EXAMPLES,
  executeCommand,
  initialProject,
  parseProject,
  round,
  serializeProject,
  STORAGE_KEY,
  updateVolume,
  type Project,
  type Volume,
} from './model';
function load(): { session: Session; message: string; storageSafe: boolean } {
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved)
      return {
        session: parseSession(saved),
        message: 'Workspace restored.',
        storageSafe: true,
      };
    const legacy = localStorage.getItem(STORAGE_KEY);
    return {
      session: newSession(legacy ? parseProject(legacy) : initialProject()),
      message: legacy
        ? 'Your existing project is preserved.'
        : 'Ready to explore.',
      storageSafe: true,
    };
  } catch {
    return {
      session: newSession(initialProject()),
      message:
        'Saved data could not be restored. It has not been overwritten. Export your work before leaving.',
      storageSafe: false,
    };
  }
}
function preference(key: string) {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}
function buildingEdit(
  v: Volume,
  patch: Partial<Extract<Operation, { type: 'building' }>> = {},
): Operation {
  const g = buildingSettings(v);
  return {
    type: 'building',
    target: v.id,
    floors: g?.floors ?? 2,
    slabThickness: g?.slabThickness ?? 0.25,
    facade: g?.facade ?? true,
    panelWidth: g?.panelWidth ?? 1.5,
    mullionWidth: g?.mullionWidth ?? 0.06,
    ...patch,
  };
}
function loadMessages(): Message[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CHAT_KEY) || '[]');
    return Array.isArray(raw)
      ? raw
          .filter(
            (m) =>
              ['user', 'assistant'].includes(m.role) &&
              typeof m.content === 'string',
          )
          .slice(-80)
          .map((m) => ({
            role: m.role,
            content: m.content,
            ...(typeof m.summary === 'string' ? { summary: m.summary } : {}),
            ...(Array.isArray(m.images)
              ? {
                  images: m.images
                    .filter(
                      (v: unknown) =>
                        typeof v === 'string' &&
                        v.length <= 1000000 &&
                        /^data:image\/(jpeg|png|webp);base64,/.test(v),
                    )
                    .slice(0, 2),
                }
              : {}),
          }))
      : [];
  } catch {
    return [];
  }
}
function ConversationReply({ message }: { message: Message }) {
  return (
    <>
      <p>{message.summary ?? message.content}</p>
      {message.summary && (
        <details className="conversation-measurements">
          <summary>Measurements & changes</summary>
          <p>{message.content}</p>
        </details>
      )}
    </>
  );
}
function NumericField({
  label,
  value,
  onChange,
  unit = 'm',
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  function commit() {
    const n = Number(draft);
    if (draft.trim() && Number.isFinite(n)) onChange(n);
    setDraft(String(value));
  }
  return (
    <label className="number-field">
      <span>{label}</span>
      <div>
        <input
          aria-label={label}
          type="number"
          step="0.1"
          min={min}
          max={max}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setDraft(String(value));
              e.currentTarget.blur();
            }
          }}
        />
        <span>{unit}</span>
      </div>
    </label>
  );
}
function ConversationSurface({
  target,
  children,
}: {
  target: HTMLElement | null;
  children: ReactNode;
}) {
  return target ? createPortal(children, target) : children;
}
const PanoramaViewer = lazy(() => import('./panorama/PanoramaViewer'));
export default function App({
  initialWorkspace,
  projectName,
  onSnapshot,
  projectMenu,
  onOpenSample,
  sampleBusy,
}: {
  initialWorkspace?: WorkspaceSnapshot;
  projectName?: string;
  onSnapshot?: (
    snapshot: WorkspaceSnapshot,
    safe: boolean,
  ) => void | Promise<void>;
  projectMenu?: (blocked: boolean) => ReactNode;
  onOpenSample?: () => void;
  sampleBusy?: boolean;
}) {
  const [boot] = useState(() =>
    initialWorkspace
      ? {
          session: parseSession(initialWorkspace.session),
          message: 'Workspace restored.',
          storageSafe: true,
        }
      : load(),
  );
  const [project, setProject] = useState(boot.session.project);
  const current = useRef(project);
  current.current = project;
  const undo = useRef<Project[]>(boot.session.past);
  const redo = useRef<Project[]>(boot.session.future);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [motion, setMotion] = useState<{
    revision: number;
    ids: string[];
    changedIds: string[];
  }>({
    revision: 0,
    ids: [],
    changedIds: [],
  });
  const markCreation = useCallback(
    (before: Project, next: Project, enabled = true) => {
      const ids = enabled
        ? next.volumes
            .filter((v) => {
              const old = before.volumes.find((o) => o.id === v.id);
              return !old || (isProfile(old) && !isProfile(v));
            })
            .map((v) => v.id)
        : [];
      const changedIds = enabled
        ? next.volumes
            .filter((v) => {
              const old = before.volumes.find((o) => o.id === v.id);
              return (
                old &&
                !ids.includes(v.id) &&
                !equalData(
                  [old.dimensions, old.geometry, old.display],
                  [v.dimensions, v.geometry, v.display],
                )
              );
            })
            .map((v) => v.id)
        : [];
      setMotion((m) => ({ revision: m.revision + 1, ids, changedIds }));
    },
    [],
  );
  const [exploration, setExploration] = useState<Exploration>(assembled);
  const [explorationGuides, setExplorationGuides] = useState(true);
  const [alternativePreview, setAlternativePreview] = useState<string | null>(
    null,
  );
  const [savedViewRequest, setSavedViewRequest] = useState<{
    view: SavedView;
    revision: number;
  } | null>(null);
  const previewOption = project.design?.options.find(
    (o) => o.name === alternativePreview,
  );
  const viewportProject = useMemo(
    () =>
      previewOption
        ? {
            ...project,
            volumes: previewOption.volumes,
            groups: previewOption.groups,
            selectedId: null,
            selectedIds: [],
          }
        : project,
    [project, previewOption],
  );
  const [appearance, setAppearance] = useState(loadAppearance);
  const renderMode = appearance.mode;
  const panels = useToolPanels(
    preference('atelier.ui.details') ? 'inspector' : null,
  );
  useEffect(() => {
    if (panels.active !== 'explore') setAlternativePreview(null);
  }, [panels.active]);
  const studioOpen = panels.active === 'studio',
    setStudioOpen = panels.setters.studio;
  const [studioTab, setStudioTab] = useState<'appearance' | 'site'>(
    'appearance',
  );
  const [mapVisible, setMapVisible] = useState(false);
  const [mapFrame, setMapFrame] = useState(0);
  const [alignMap, setAlignMap] = useState(false);
  useEffect(() => {
    if (!studioOpen || !mapVisible) setAlignMap(false);
  }, [studioOpen, mapVisible]);
  const [section, setSection] = useState(defaultSection);
  const sectionInitialized = useRef(false);
  const sectionOpen = panels.active === 'section',
    setSectionOpen = panels.setters.section;
  const [solar, setSolar] = useState(defaultSolar);
  const solarOpen = panels.active === 'solar',
    setSolarOpen = panels.setters.solar;
  const [cameraSettings, setCameraSettings] = useState(defaultCameraSettings);
  const cameraOpen = panels.active === 'camera',
    setCameraOpen = panels.setters.camera;
  const layersOpen = panels.active === 'layers',
    setLayersOpen = panels.setters.layers;
  const [toolsOpen, setToolsOpen] = useState(false);
  useEffect(() => {
    if (!toolsOpen) return;
    const close = (e: PointerEvent) => {
      if (
        !(e.target as Element).closest('.header-actions,.compact-tools-toggle')
      )
        setToolsOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setToolsOpen(false);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', escape);
    };
  }, [toolsOpen]);

  const [arActive, setARActive] = useState(false);
  const [arPreparing, setARPreparing] = useState(false);
  const [arFloorPreview, setARFloorPreview] = useState<number | null>(null);
  const viewportSection = useMemo(
    () =>
      arFloorPreview === null
        ? section
        : {
            enabled: true,
            planeVisible: true,
            axis: 'y' as const,
            position: arFloorPreview,
            flip: true,
          },
    [section, arFloorPreview],
  );
  const [arConversationHost, setARConversationHost] =
    useState<HTMLDivElement | null>(null);
  const [moodboard, setMoodboard] = useState(() =>
    parseBoard(initialWorkspace?.moodboard),
  );
  const [moodboardOpen, setMoodboardOpen] = useState(false);
  const [panoramas, setPanoramas] = useState(() =>
    parsePanoramas(initialWorkspace?.panoramas),
  );
  const [panoramaOpen, setPanoramaOpen] = useState(false);
  const savePanoramas = async (value: Panoramas) => {
    const checked = parsePanoramas(value);
    await onSnapshot?.(
      {
        session: serializeSession(snapshot()),
        messages,
        moodboard,
        panoramas: checked,
      },
      boot.storageSafe,
    );
    setPanoramas(checked);
  };
  const [boardSaved, setBoardSaved] = useState(false);
  const [boardSaveError, setBoardSaveError] = useState(false);
  const addingVolume = panels.active === 'adding',
    setAddingVolume = panels.setters.adding;
  const [presentation, setPresentation] = useState(false);
  const [turntable, setTurntable] = useState(false);
  const [workStage, setWorkStage] = useState('Considering your idea…');
  useEffect(() => {
    try {
      localStorage.setItem('atelier.appearance', JSON.stringify(appearance));
    } catch {
      /* Optional view preference. */
    }
  }, [appearance]);
  const [northAngle, setNorthAngle] = useState(0);
  const [phoneLayout, setPhoneLayout] = useState(
    () => matchMedia('(max-width: 800px), (pointer: coarse)').matches,
  );
  const [touchNavigation, setTouchNavigation] = useState<
    'orbit' | 'pan' | 'edit'
  >('orbit');
  useEffect(() => {
    const query = matchMedia('(max-width: 800px), (pointer: coarse)');
    const update = () => setPhoneLayout(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const [tool, setTool] = useState<Tool>('select');
  const activateTool = (next: Tool) => {
    setTouchNavigation('edit');
    setTool(next);
    if (next.startsWith('draw_')) {
      setAlignMap(false);
      setPresentation(false);
      setObjectsOpen(false);
      setChatExpanded(false);
      setCameraSettings((v) => ({ ...v, walk: false }));
      if (panels.active) panels.setters[panels.active](false);
    }
  };
  const [placingCamera, setPlacingCamera] = useState(false);
  useEffect(() => {
    if (panels.active || cameraSettings.walk || tool.startsWith('draw_'))
      setPlacingCamera(false);
  }, [panels.active, cameraSettings.walk, tool]);
  const [modelAction, setModelAction] = useState<string | null>(null);
  const [multiSelect, setMultiSelect] = useState(false);
  const [objectSearch, setObjectSearch] = useState('');
  const [snap, setSnap] = useState(true);
  const [angleSnap, setAngleSnap] = useState(45);
  const inspectorPanel = useFloatingPanel();
  useEffect(() => {
    if (project.selectedId)
      setTool((t) =>
        t === 'reshape' || t.startsWith('draw_') ? t : 'translate',
      );
  }, [project.selectedId]);
  const [view, setView] = useState<{
    mode: 'perspective' | 'orthographic' | 'top';
    revision: number;
  }>({ mode: 'perspective', revision: 0 });
  const [command, setCommand] = useState('');
  const [notice, setNotice] = useState({ text: boot.message, error: false });
  const inspectorOpen = panels.active === 'inspector',
    setInspectorOpen = panels.setters.inspector;
  const [objectsOpen, setObjectsOpen] = useState(() =>
    preference('atelier.ui.objects'),
  );
  useEffect(() => {
    try {
      localStorage.setItem('atelier.ui.details', String(inspectorOpen));
      localStorage.setItem('atelier.ui.objects', String(objectsOpen));
    } catch {
      /* Preferences must not block modeling. */
    }
  }, [inspectorOpen, objectsOpen]);
  useEffect(() => {
    if (panels.active && window.innerWidth <= 800) setObjectsOpen(false);
  }, [panels.active]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(true);
  const [chatDocked, setChatDocked] = useState(false);
  const [phoneActions, setPhoneActions] = useState(false);
  const revealConversation = () => {
    setChatDocked(false);
    setPhoneActions(false);
    if (phoneLayout) {
      if (panels.active) panels.setters[panels.active](false);
      setObjectsOpen(false);
    }
  };

  const [messages, setMessages] = useState<Message[]>(
    () => initialWorkspace?.messages ?? loadMessages(),
  );
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const conversation = useRef(boot.session.context);
  const camera = useRef<CameraContext>(defaultCamera);
  const beforeARCamera = useRef<CameraContext | null>(null);
  const setARSessionActive = useCallback((active: boolean) => {
    if (active) beforeARCamera.current = structuredClone(camera.current);
    else if (beforeARCamera.current) {
      camera.current = beforeARCamera.current;
      beforeARCamera.current = null;
    }
    setARActive(active);
  }, []);
  const [connectionState, setConnectionState] = useState<Connection>({
    configured: false,
    authenticated: true,
    voiceConfigured: false,
  });
  const [busy, setBusy] = useState(false);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [referenceWidth, setReferenceWidth] = useState('');
  const imageInput = useRef<HTMLInputElement>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [modelingBusy, setModelingBusy] = useState(0);
  const busyRef = useRef(false);
  const [pending, setPending] = useState<{
    plan: Plan;
    fingerprint: string;
    camera: CameraContext;
    prepared: { session: Session; message: string };
  } | null>(null);
  useEffect(() => {
    if (pending) setChatDocked(false);
  }, [pending]);
  useEffect(() => {
    if (panels.active) setPhoneActions(false);
  }, [panels.active]);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const [voiceStatus, setVoiceStatus] = useState('Off');
  const [voiceActive, setVoiceActive] = useState(false);
  const voice = useRef<VoiceConnection | null>(null);
  const [primitive, setPrimitive] = useState<
    'box' | 'cylinder' | 'sphere' | 'rectangle' | 'circle'
  >('box');
  const [measuredVolume, setMeasuredVolume] = useState<number | null>(null);
  const workspaceRef = useRef({
    mapVisible,
    view: view.mode,
    theme: appearance.theme,
    renderMode: appearance.mode,
    section,
  });
  workspaceRef.current = {
    mapVisible,
    view: view.mode,
    theme: appearance.theme,
    renderMode: appearance.mode,
    section,
  };
  const applyWorkspace = (plan: Plan) => {
    const state = { ...workspaceRef.current };
    const reports: string[] = [];
    for (const op of plan.operations) {
      if (op.type === 'explore') {
        setAlternativePreview(null);
        setTool('select');
        setExploration({
          mode: op.mode,
          amount: op.amount,
          targets: op.targets.length ? resolveIds(op.targets, snapshot()) : [],
        });
        panels.setters.explore(true);
        reports.push('Presentation updated; original geometry is unchanged.');
        continue;
      }
      if (op.type === 'show_view') {
        const saved = current.current.design?.views.find(
          (v) => v.name === op.name,
        );
        if (saved) {
          setAlternativePreview(null);
          setExploration(assembled);
          setCameraSettings((v) => ({
            ...v,
            walk: false,
            fov: saved.pose?.fov ?? v.fov,
          }));
          setView((v) => ({
            ...v,
            mode: saved.pose?.projection ?? 'orthographic',
          }));
          setSavedViewRequest((r) => ({
            view: saved,
            revision: (r?.revision ?? 0) + 1,
          }));
          setSection(saved.section ?? { ...defaultSection, enabled: false });
          reports.push(`Showing ${op.name}.`);
        }
        continue;
      }
      if (op.type === 'walk_to') {
        const placement = resolveWalkPlacement(current.current, op);
        setPlacingCamera(false);
        setAlignMap(false);
        setTool('select');
        setCameraSettings((v) => ({
          ...v,
          walk: true,
          fov: 65,
          level: placement.position.y,
          eyeHeight: op.eyeHeight ?? v.eyeHeight,
          placement: {
            ...placement,
            revision: (v.placement?.revision ?? 0) + 1,
          },
        }));
        setView((v) => ({ ...v, mode: 'perspective' }));
        reports.push(
          `Viewpoint placed at ${placement.position.x.toFixed(2)}, ${placement.position.z.toFixed(2)} m; floor ${placement.position.y.toFixed(2)} m. No geometry moved.`,
        );
        continue;
      }
      if (op.type === 'section') {
        sectionInitialized.current = true;
        setSection((v) => ({
          ...v,
          enabled: op.enabled,
          axis: op.axis,
          position: op.position,
          flip: op.flip,
        }));
        setSectionOpen(op.enabled);
        reports.push(
          op.enabled
            ? `Section ${op.axis.toUpperCase()} at ${op.position} m. Geometry preserved.`
            : 'Whole model visible.',
        );
        continue;
      }
      if (op.type !== 'workspace') continue;
      const a = op.action;
      if (
        a === 'draw_rectangle' ||
        a === 'draw_circle' ||
        a === 'draw_outline' ||
        a === 'tool_pushpull' ||
        a === 'tool_move' ||
        a === 'tool_rotate' ||
        a === 'tool_select'
      ) {
        activateTool(
          a === 'tool_pushpull'
            ? 'reshape'
            : a === 'tool_move'
              ? 'translate'
              : a === 'tool_rotate'
                ? 'rotate'
                : a === 'tool_select'
                  ? 'select'
                  : a,
        );
        reports.push(
          a.startsWith('draw_')
            ? 'Drawing ready. Click in the workspace to place your first point; close the face, then use Push / pull.'
            : 'Modeling tool ready.',
        );
        continue;
      }
      if (a === 'moodboard_open' || a === 'moodboard_close') {
        setMoodboardOpen(a === 'moodboard_open');
        reports.push(
          a === 'moodboard_open'
            ? 'Moodboard open. Add images, references and saved model snapshots.'
            : 'Back to your model.',
        );
        continue;
      }
      if (a === 'solar_settings' || a === 'solar_on' || a === 'solar_off') {
        setSolarOpen(true);
        setCameraOpen(false);
        setSectionOpen(false);
        if (a !== 'solar_settings' && current.current.site)
          setSolar((v) => ({ ...v, enabled: a === 'solar_on' }));
        reports.push(
          current.current.site
            ? 'Solar study controls opened.'
            : 'Choose your site location to calculate sunlight.',
        );
      } else if (
        a === 'camera_settings' ||
        a === 'walk_on' ||
        a === 'walk_off'
      ) {
        setCameraOpen(true);
        setSolarOpen(false);
        setSectionOpen(false);
        if (a !== 'camera_settings') {
          setCameraSettings((v) => ({ ...v, walk: a === 'walk_on' }));
          if (a === 'walk_on') setView((v) => ({ ...v, mode: 'perspective' }));
        }
        reports.push(
          a === 'walk_on'
            ? 'Walkthrough enabled. Click the canvas and use W A S D to walk.'
            : 'Camera controls opened.',
        );
      } else if (a === 'layers_open' || a === 'layers_close') {
        setLayersOpen(a === 'layers_open');
        reports.push(a === 'layers_open' ? 'Groups opened.' : 'Groups closed.');
      } else if (a === 'map_settings') {
        setStudioTab('site');
        setStudioOpen(true);
        reports.push('Location controls opened.');
      } else if (a === 'map_street' || a === 'map_satellite') {
        if (current.current.site) {
          commit(
            {
              ...current.current,
              site: {
                ...current.current.site,
                style: a === 'map_satellite' ? 'satellite' : 'street',
              },
            },
            false,
          );
          setMapVisible(true);
          reports.push(
            a === 'map_satellite'
              ? 'Satellite imagery enabled.'
              : 'Street map enabled.',
          );
        } else {
          setStudioTab('site');
          setStudioOpen(true);
          reports.push('Choose a location first.');
        }
      } else if (a === 'section_on' || a === 'section_off') {
        const first = !sectionInitialized.current;
        sectionInitialized.current = true;
        const r = sectionRange(current.current, section.axis);
        setSection((v) => ({
          ...v,
          enabled: a === 'section_on',
          ...(first ? { position: (r.min + r.max) / 2 } : {}),
        }));
        setSectionOpen(a === 'section_on');
        reports.push(
          a === 'section_on' ? 'Section view enabled.' : 'Whole model visible.',
        );
      } else if (a === 'section_plane_on' || a === 'section_plane_off') {
        sectionInitialized.current = true;
        setSection((v) => ({ ...v, planeVisible: a === 'section_plane_on' }));
        if (a === 'section_plane_on') setSectionOpen(true);
        reports.push(
          a === 'section_plane_on'
            ? 'Section plane visible. Drag its amber handle to move it.'
            : 'Section plane hidden; the cut is unchanged.',
        );
      } else if (a === 'presentation_on' || a === 'presentation_off') {
        setPresentation(a === 'presentation_on');
        reports.push(
          a === 'presentation_on'
            ? 'Presentation mode.'
            : 'Editing controls restored.',
        );
      } else if (a === 'map_on' || a === 'map_off' || a === 'map_toggle') {
        const visible = a === 'map_toggle' ? !state.mapVisible : a === 'map_on';
        if (visible && !current.current.site) {
          setStudioTab('site');
          setStudioOpen(true);
          if (innerWidth <= 800) setInspectorOpen(false);
          reports.push(
            'Choose a site on the map, or enter coordinates, then show the model.',
          );
        } else {
          state.mapVisible = visible;
          setMapVisible(visible);
          reports.push(visible ? 'Map enabled.' : 'Map hidden.');
        }
      } else if (a.startsWith('view_')) {
        setSavedViewRequest(null);
        state.view =
          a === 'view_top'
            ? 'top'
            : a === 'view_orthographic'
              ? 'orthographic'
              : 'perspective';
        setCameraSettings((v) => ({ ...v, walk: false }));
        setView((v) => ({ mode: state.view, revision: v.revision + 1 }));
        reports.push(
          state.view === 'top'
            ? 'Top view.'
            : state.view === 'orthographic'
              ? 'Orthographic view.'
              : 'Perspective view.',
        );
      } else if (a === 'theme_day' || a === 'theme_night') {
        state.theme = a === 'theme_day' ? 'day' : 'night';
        setAppearance((v) => ({ ...v, theme: state.theme }));
        reports.push(state.theme === 'day' ? 'Day mode.' : 'Night mode.');
      } else if (a.startsWith('display_')) {
        state.renderMode =
          a === 'display_solid'
            ? 'studio'
            : a === 'display_wireframe'
              ? 'wireframe'
              : 'hidden-line';
        setAppearance((v) => ({ ...v, mode: state.renderMode }));
        reports.push(
          a === 'display_solid'
            ? 'Solid view.'
            : a === 'display_wireframe'
              ? 'Wireframe view.'
              : 'Hidden line view.',
        );
      } else if (a === 'frame_all') {
        setSavedViewRequest(null);
        setView((v) => ({ ...v, revision: v.revision + 1 }));
        reports.push('Framed the model.');
      } else if (a === 'inspector_open' || a === 'inspector_close') {
        setInspectorOpen(a === 'inspector_open');
        if (a === 'inspector_open' && innerWidth <= 800) setStudioOpen(false);
        reports.push(
          a === 'inspector_open' ? 'Inspector opened.' : 'Inspector closed.',
        );
      } else {
        setObjectsOpen(a === 'objects_open');
        reports.push(
          a === 'objects_open' ? 'Object list opened.' : 'Object list closed.',
        );
      }
    }
    workspaceRef.current = state;
    return reports.join('\n');
  };
  const snapshot = (): Session => ({
    project: current.current,
    past: undo.current,
    future: redo.current,
    context: conversation.current,
  });
  const remember = (
    role: Message['role'],
    content: string,
    summary?: string,
    images?: string[],
  ) =>
    setMessages((m) => [
      ...m.slice(-79),
      {
        role,
        content,
        ...(summary ? { summary } : {}),
        ...(images?.length ? { images } : {}),
      },
    ]);
  const install = (session: Session, animate = true) => {
    markCreation(current.current, session.project, animate);
    current.current = session.project;
    undo.current = session.past;
    redo.current = session.future;
    conversation.current = session.context;
    setProject(session.project);
    setHistoryVersion((v) => v + 1);
  };
  const fingerprint = () => serializeSession(snapshot());
  const reviewName = (ref: string): string => {
    if (ref.startsWith('$name:')) return ref.slice(6);
    const ids =
      ref === '$operands'
        ? conversation.current.lastOperands
        : ref === '$selected'
          ? (current.current.selectedIds ??
            (current.current.selectedId ? [current.current.selectedId] : []))
          : ref === '$focus'
            ? conversation.current.focusIds
            : ref === '$created'
              ? conversation.current.lastCreatedIds
              : [ref];
    return ids
      .map(
        (id) =>
          current.current.volumes.find((v) => v.id === id)?.name ??
          undo.current.at(-1)?.volumes.find((v) => v.id === id)?.name ??
          'previous object',
      )
      .join(', ');
  };
  const reviewDescription = (op: Operation): string[] => {
    if (op.type === 'boolean') {
      const names = op.targets.map(reviewName);
      return [
        op.operation === 'intersect'
          ? `Keep only the shared solid of ${names.join(' and ')}.`
          : op.operation === 'subtract'
            ? `Cut ${names[1]} out of ${names[0]}.`
            : `Join ${names.join(' and ')} into one solid.`,
      ];
    }
    if (op.type === 'building')
      return [
        `${reviewName(op.target)}: ${op.floors} floor slabs plus a roof, ${op.slabThickness} m thick${op.facade ? `, with glazing and frames spaced at most ${op.panelWidth} m apart` : ''}.`,
      ];
    if (op.type === 'components')
      return [
        `Separate ${reviewName(op.target)} into editable windows, slabs and frame members. Procedural building controls become direct part edits; Undo restores them.`,
      ];
    if (op.type === 'opening')
      return [
        `Cut a ${op.width} × ${op.height} m opening through ${reviewName(op.target)}.`,
      ];
    if (op.type === 'attach' && op.liftExisting)
      return [
        `Lift ${reviewName(op.target)} enough to fit a ${op.height} m lower volume with ${op.gap} m clearance.`,
      ];
    if (op.type === 'hollow')
      return [
        `Hollow ${reviewName(op.target)} with ${op.thickness} m walls; ${op.openTop ? 'open top' : 'closed roof'}.`,
      ];
    if ((op.type === 'sweep' || op.type === 'loft') && op.target)
      return [
        `Replace ${reviewName(op.target)} with a ${op.type}, preserving its identity.`,
      ];
    if (op.type === 'delete')
      return [`Remove ${op.targets.map(reviewName).join(', ')}.`];
    return [];
  };
  const execute = async (
    plan: Plan,
    confirmed = false,
    frame = camera.current,
  ) => {
    setAlternativePreview(null);
    setExploration(assembled);
    if (
      plan.operations.some(
        (op) =>
          ![
            'show_view',
            'save_view',
            'room_views',
            'explore',
            'workspace',
            'section',
            'measure',
          ].includes(op.type),
      )
    )
      setSavedViewRequest(null);
    const before = fingerprint();
    const result = await applyPlan(snapshot(), plan, frame, confirmed);
    if (before !== fingerprint())
      throw new Error(
        'The scene changed while this edit was being prepared. Please try again.',
      );
    install(
      result.session,
      !plan.operations.some((op) => op.type === 'undo' || op.type === 'redo'),
    );
    if (
      plan.operations.some((op) => op.type === 'select') &&
      result.session.project.selectedId
    )
      setTool('translate');
    const message = [result.message, applyWorkspace(plan)]
      .filter(Boolean)
      .join('\n');
    setNotice({ text: message, error: false });
    return message;
  };
  const prepareReview = async (
    plan: Plan,
    frame = structuredClone(camera.current),
  ) => {
    const before = fingerprint();
    const prepared = await applyPlan(snapshot(), plan, frame, true);
    if (before !== fingerprint())
      throw new Error(
        'The scene changed while this change was being checked. Please ask again.',
      );
    const item = { plan, fingerprint: before, camera: frame, prepared };
    setPending(item);
    return item;
  };
  const acceptReview = (item: NonNullable<typeof pending>) => {
    if (item.fingerprint !== fingerprint())
      throw new Error(
        'Selection or geometry changed. Request this operation again.',
      );
    setAlternativePreview(null);
    setExploration(assembled);
    install(item.prepared.session);
    const message = [item.prepared.message, applyWorkspace(item.plan)]
      .filter(Boolean)
      .join('\n');
    setNotice({ text: message, error: false });
    return message;
  };
  const displaySummary = (plan: Plan) =>
    plan.operations.some((op) => op.type === 'measure')
      ? undefined
      : plan.message;
  const propose = async (plan: Plan) => {
    setModelingBusy((n) => n + 1);
    try {
      if (needsConfirmation(plan)) {
        await prepareReview(plan);
        return;
      }
      const message = await execute(plan);
      remember('assistant', message);
    } catch (e) {
      reportError(e);
    } finally {
      setModelingBusy((n) => n - 1);
    }
  };
  const sendConversation = async (text: string): Promise<string> => {
    if (busyRef.current) return 'Please wait for the current edit to finish.';
    busyRef.current = true;
    setBusy(true);
    setWorkStage('Considering your idea…');
    setChatExpanded(true);
    setNotice({ text: '', error: false });
    const reviewing = pendingRef.current;
    const before = fingerprint();
    const frame = structuredClone(camera.current);
    const history = [...messagesRef.current];
    const images = [...referenceImages];
    setReferenceImages([]);
    remember('user', text, undefined, images);
    try {
      const plan = await checkedPlan(
        snapshot(),
        frame,
        (feedback) =>
          requestPlan(
            text,
            snapshot(),
            frame,
            history,
            AbortSignal.timeout(60_000),
            reviewing
              ? {
                  message: reviewing.plan.message,
                  operations: reviewing.plan.operations,
                  outcome: reviewing.prepared.message.slice(0, 16000),
                }
              : null,
            {
              ...workspaceRef.current,
              mapConfigured: Boolean(current.current.site),
              arActive,
            },
            feedback,
            images,
          ),
        setWorkStage,
      );
      if (before !== fingerprint())
        throw new Error(
          'The scene changed while I was considering this request. Please send it again.',
        );
      if (plan.intent === 'clarify') {
        setChatExpanded(true);
        input.current?.focus();
        remember('assistant', plan.message);
        return plan.message;
      }
      if (plan.intent === 'confirm' || plan.intent === 'cancel') {
        if (
          !reviewing ||
          reviewing !== pendingRef.current ||
          reviewing.fingerprint !== fingerprint()
        )
          throw new Error(
            'There is no unchanged pending operation to confirm. Request the change again.',
          );
        setPending(null);
        const message =
          plan.intent === 'cancel'
            ? 'Change cancelled. Geometry was preserved.'
            : acceptReview(reviewing);
        remember(
          'assistant',
          message,
          plan.intent === 'confirm'
            ? displaySummary(reviewing.plan)
            : undefined,
        );
        return message;
      }
      if (!plan.operations.every((op) => op.type === 'measure'))
        setPending(null);
      if (needsConfirmation(plan)) {
        await prepareReview(plan, frame);
        const message =
          plan.message + ' Shall I go ahead? You can answer here or by voice.';
        remember('assistant', message);
        return message;
      }
      const result = await execute(plan, false, frame);
      remember('assistant', result, displaySummary(plan));
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'The request failed.';
      remember('assistant', message);
      setNotice({ text: message, error: true });
      return message;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const sendRef = useRef(sendConversation);
  sendRef.current = sendConversation;
  useEffect(() => {
    void connection().then(setConnectionState);
    return () => voice.current?.stop();
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
    } catch {
      /* The project save indicator reports storage failure. */
    }
  }, [messages]);
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [importAsset, setImportAsset] = useState<File | null>(null);
  const [draggingFile, setDraggingFile] = useState(false);
  const selected = project.volumes.find((v) => v.id === project.selectedId);
  const commit = useCallback((next: Project, animate = true) => {
    if (equalData(next, current.current)) return;
    markCreation(current.current, next, animate);
    undo.current = [...undo.current.slice(-49), current.current];
    redo.current = [];
    current.current = next;
    setProject(next);
    setHistoryVersion((v) => v + 1);
  }, []);
  const reportError = (e: unknown) => {
    setChatDocked(false);
    setNotice({
      text:
        e instanceof Error
          ? e.message
          : 'The operation could not be completed.',
      error: true,
    });
  };
  const change = useCallback(
    (id: string, patch: Partial<Volume>) => {
      const original = current.current;
      const finish = async () => {
        try {
          const next = updateVolume(original, id, patch),
            v = next.volumes.find((o) => o.id === id);
          if (
            v &&
            (patch.dimensions || patch.geometry) &&
            !isProfile(v) &&
            !isReference(v)
          ) {
            setModelingBusy((n) => n + 1);
            try {
              const stats = await solidStats(v);
              if (stats.volume < 0.000001)
                throw new Error(
                  'The edit would leave no solid. Your previous geometry was preserved.',
                );
            } finally {
              setModelingBusy((n) => n - 1);
            }
          }
          if (current.current !== original)
            throw new Error(
              'The model changed while this edit was checked. Please try the edit again.',
            );
          commit(next);
          setNotice({ text: 'Geometry updated.', error: false });
        } catch (e) {
          reportError(e);
        }
      };
      void finish();
    },
    [commit],
  );
  const select = useCallback((id: string | null, additive = false) => {
    if (id) setTool('translate');
    const p = current.current;
    const previous = p.selectedIds ?? (p.selectedId ? [p.selectedId] : []);
    const ids = id
      ? additive
        ? previous.includes(id)
          ? previous.filter((i) => i !== id)
          : [...previous, id]
        : [id]
      : [];
    const next = { ...p, selectedId: ids.at(-1) ?? null, selectedIds: ids };
    current.current = next;
    setProject(next);
    if (ids.length) conversation.current.focusIds = ids;
  }, []);
  const run = useCallback(
    (text: string) => {
      try {
        const beforeIds = new Set(current.current.volumes.map((v) => v.id));
        const result = executeCommand(current.current, text);
        const added = result.project.volumes
          .filter((v) => !beforeIds.has(v.id))
          .map((v) => v.id);
        if (added.length) conversation.current.lastCreatedIds = added;
        conversation.current.focusIds = result.project.selectedId
          ? [result.project.selectedId]
          : [];
        conversation.current.lastOperation = text.split(' ')[0];
        commit(result.project);
        setNotice({ text: result.message, error: false });
        return true;
      } catch (e) {
        reportError(e);
        return false;
      }
    },
    [commit],
  );
  const travel = useCallback((direction: 'undo' | 'redo') => {
    const source = direction === 'undo' ? undo.current : redo.current;
    const destination = direction === 'undo' ? redo.current : undo.current;
    const next = source.pop();
    if (!next) return;
    markCreation(current.current, next, false);
    destination.push(current.current);
    current.current = next;
    setProject(next);
    setHistoryVersion((v) => v + 1);
    setNotice({
      text: direction === 'undo' ? 'Change undone.' : 'Change restored.',
      error: false,
    });
  }, []);
  const [encodeCheckpoint] = useState(() => createSessionEncoder());
  useEffect(() => {
    let active = true;
    setBoardSaved(false);
    setBoardSaveError(false);
    setSaved(false);
    setSaving(true);
    const save = async () => {
      if (!boot.storageSafe) {
        await onSnapshot?.(
          {
            session: encodeCheckpoint(snapshot()),
            messages,
            moodboard,
            panoramas,
          },
          false,
        );
        return;
      }
      // Encode once for both checkpoints. The immutable mesh payload is cached;
      // selecting/recoloring an object only re-encodes small scene metadata.
      const session = encodeCheckpoint(snapshot());
      let localSaved = false;
      try {
        // Large models use IndexedDB. Repeatedly attempting an oversized,
        // synchronous localStorage write blocks input and cannot succeed.
        if (session.length <= 2_000_000) {
          localStorage.setItem(SESSION_KEY, session);
          localSaved = true;
        }
      } catch {
        /* The durable IndexedDB save below remains authoritative. */
      }
      await onSnapshot?.({ session, messages, moodboard, panoramas }, true);
      if (active) {
        setSaved(!!onSnapshot || localSaved);
        setBoardSaved(!!onSnapshot || localSaved);
      }
    };
    void save()
      .catch(() => {
        if (active) {
          setBoardSaveError(true);
          setSaved(false);
        }
      })
      .finally(() => {
        if (active) setSaving(false);
      });
    return () => {
      active = false;
    };
  }, [
    project,
    historyVersion,
    messages,
    moodboard,
    panoramas,
    boot.storageSafe,
    onSnapshot,
    encodeCheckpoint,
  ]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      // A modal owns keyboard input; never edit the underlying project while switching.
      if (document.querySelector('dialog[open], .ar-overlay.active')) return;
      const editing =
        e.target instanceof HTMLElement &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) ||
          e.target.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.current?.focus();
        return;
      }
      if (editing || settingsOpen || importAsset || e.defaultPrevented) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        travel(e.shiftKey ? 'redo' : 'undo');
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        run('duplicate selected');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        run('delete selected');
      } else if (e.key.toLowerCase() === 'v' || e.code === 'Space') {
        e.preventDefault();
        setTool('select');
      } else if (['g', 'm'].includes(e.key.toLowerCase())) setTool('translate');
      else if (e.key.toLowerCase() === 'q') setTool('rotate');
      else if (e.key.toLowerCase() === 'r') activateTool('draw_rectangle');
      else if (e.key.toLowerCase() === 'c') activateTool('draw_circle');
      else if (e.key.toLowerCase() === 'l') activateTool('draw_outline');
      else if (e.key.toLowerCase() === 'p') setTool('reshape');
      else if (e.key.toLowerCase() === 'f')
        setView((v) => ({ ...v, revision: v.revision + 1 }));
      else if (e.key === 'Escape') {
        if (presentation) setPresentation(false);
        else if (panels.active) panels.setters[panels.active](false);
        else select(null);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [
    run,
    select,
    travel,
    settingsOpen,
    importAsset,
    presentation,
    panels.active,
    panels.setters,
  ]);
  function exportProject() {
    downloadProject(
      projectFile(
        {
          session: serializeSession(snapshot()),
          messages,
          moodboard,
          panoramas,
        },
        projectName ?? 'Untitled study',
      ),
    );
    setNotice({
      text: 'Project copy downloaded. Open it on another device from Projects → Open project copy.',
      error: false,
    });
  }
  useEffect(() => {
    let active = true;
    setMeasuredVolume(null);
    if (selected && inspectorOpen) {
      if (isProfile(selected) || isReference(selected)) setMeasuredVolume(0);
      else
        void solidStats(selected)
          .then((s) => {
            if (active) setMeasuredVolume(s.volume);
          })
          .catch((e) => {
            if (active) reportError(e);
          });
    }
    return () => {
      active = false;
    };
  }, [
    selected?.id,
    selected?.geometry,
    selected?.dimensions.width,
    selected?.dimensions.height,
    selected?.dimensions.depth,
    inspectorOpen,
  ]);

  const attachReference = async (file: File) => {
    if (referenceImages.length >= 2) {
      reportError(
        new Error(
          'Attach up to two references per message. Remove one to add another.',
        ),
      );
      return;
    }
    setImageLoading(true);
    setChatDocked(false);
    setChatExpanded(true);
    if (panels.active) panels.setters[panels.active](false);
    try {
      const image = await referenceImage(file);
      setReferenceImages((old) => [...old, image].slice(0, 2));
    } catch (error) {
      reportError(error);
    } finally {
      setImageLoading(false);
    }
  };
  const importFile = async (f: File) => {
    try {
      if (f.size > MAX_IMPORT_BYTES)
        throw new Error('Import files must be 512 MB or smaller.');
      if (!f.name.toLowerCase().endsWith('.json')) {
        setImportAsset(f);
        setNotice({ text: '', error: false });
        return;
      }
      const text = await f.text();
      const raw = JSON.parse(text);
      if (raw.project && raw.past) {
        const imported = parseSession(text);
        const importedPanoramas =
          raw.panoramas === undefined
            ? undefined
            : parsePanoramas(raw.panoramas);
        const importedBoard =
          raw.moodboard === undefined ? undefined : parseBoard(raw.moodboard);
        // Preserve the receiving session and the imported timeline. The
        // latest snapshot remains undo-import; older snapshots are the
        // imported history, within the documented 50-step limit.
        const importedPast = [...imported.past.slice(-49), current.current];
        await onSnapshot?.(
          {
            session: serializeSession({ ...imported, past: importedPast }),
            messages,
            moodboard: importedBoard ?? moodboard,
            panoramas: importedPanoramas ?? panoramas,
          },
          boot.storageSafe,
        );
        try {
          localStorage.setItem(
            'atelier.session.v2.before-import',
            serializeSession(snapshot()),
          );
        } catch {
          /* The receiving geometry is retained in the durable undo history above. */
        }
        undo.current = importedPast;
        redo.current = imported.future;
        conversation.current = imported.context;
        markCreation(current.current, imported.project, false);
        current.current = imported.project;
        setProject(imported.project);
        if (importedBoard) setMoodboard(importedBoard);
        if (importedPanoramas) setPanoramas(importedPanoramas);
        setHistoryVersion((v) => v + 1);
      } else commit(parseProject(text), false);
      setNotice({
        text: 'Project imported. Geometry undo is available; the imported moodboard is saved separately.',
        error: false,
      });
    } catch (err) {
      reportError(err);
    }
  };
  const addImported = async (asset: PreparedImport) => {
    try {
      const candidate = importedSession(snapshot(), asset);
      // Commit durable storage before installing a large import in the workspace.
      await onSnapshot?.(
        {
          session: serializeSession(candidate),
          messages,
          moodboard,
          panoramas,
        },
        boot.storageSafe,
      );
      commit(candidate.project);
      conversation.current = candidate.context;
      setPending(null);
      setImportAsset(null);
      const first = asset.volumes[0];
      const text =
        asset.volumes.length > 1
          ? `${asset.name}: ${asset.volumes.length} elements imported as a group, with their relative positions and basic colors. Select any element to edit it individually.`
          : `${first.name} imported as ${isReference(first) ? 'a reference surface' : 'a closed solid'}. ${first.dimensions.width.toFixed(2)} × ${first.dimensions.depth.toFixed(2)} × ${first.dimensions.height.toFixed(2)} m.`;
      remember('assistant', text);
      setNotice({ text, error: false });
    } catch (e) {
      reportError(e);
    }
  };
  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDraggingFile(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setDraggingFile(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDraggingFile(false);
        const files = e.dataTransfer.files;
        if (files.length === 1) {
          if (/^image\/(jpeg|png|webp)$/.test(files[0].type))
            void attachReference(files[0]);
          else void importFile(files[0]);
        } else reportError(new Error('Import one file at a time.'));
      }}
      className={`app-shell phase-two immersive ${panels.active ? 'tool-panel-open' : ''} ${chatDocked ? 'chat-docked' : ''} ${exploration.mode !== 'assembled' ? 'exploration-mode' : ''} ${phoneActions ? 'phone-actions-open' : ''} ${busy || modelingBusy > 0 ? 'is-processing' : ''} ${presentation ? 'presentation-mode' : ''} theme-${appearance.theme} ${inspectorOpen ? '' : 'inspector-collapsed'} ${objectsOpen ? 'objects-open' : ''}`}
    >
      {panoramaOpen && (
        <Suspense
          fallback={<div className="workspace-loading">Opening panoramas…</div>}
        >
          <PanoramaViewer
            collection={panoramas}
            onChange={savePanoramas}
            onClose={() => setPanoramaOpen(false)}
          />
        </Suspense>
      )}
      {moodboardOpen && (
        <Suspense
          fallback={<div className="workspace-loading">Opening moodboard…</div>}
        >
          <Moodboard
            board={moodboard}
            onChange={(value) => {
              setBoardSaved(false);
              setMoodboard(value);
            }}
            project={project}
            onClose={() => setMoodboardOpen(false)}
            day={appearance.theme === 'day'}
            saved={boardSaved}
            saveError={boardSaveError}
          />
        </Suspense>
      )}
      {importAsset && (
        <MeshImportDialog
          file={importAsset}
          errorText={notice.error ? notice.text : undefined}
          onAdd={addImported}
          onClose={() => setImportAsset(null)}
        />
      )}
      {draggingFile && (
        <div className="file-drop-overlay">
          <ArrowUpFromLine size={32} />
          <strong>Bring it into your space</strong>
          <span>FBX · OBJ · STL · GLB · ATELIER project</span>
        </div>
      )}
      <header className="app-header">
        <a className="brand" href="./" aria-label="ATELIER home">
          <span className="brand-mark">A</span>{' '}
          <span className="brand-name">Atelier</span>
        </a>
        {projectMenu?.(
          busy ||
            modelingBusy > 0 ||
            !!pending ||
            voiceActive ||
            !!importAsset ||
            panoramaOpen,
        )}
        <div className="project-title">
          <span>Workspace</span>
          <ChevronRight size={13} />
          <strong>Untitled study</strong>
          <span className="project-dot" />
        </div>
        <button
          className="subtle-button scene-toggle"
          aria-label={objectsOpen ? 'Hide objects' : 'Show objects'}
          aria-pressed={objectsOpen}
          onClick={() => {
            setObjectsOpen(!objectsOpen);
            if (!objectsOpen && innerWidth <= 800 && panels.active)
              panels.setters[panels.active](false);
          }}
        >
          <Layers size={16} />
          <span>Objects</span>
        </button>
        <button
          className="primary-create"
          aria-label="Create a 3D shape"
          aria-pressed={panels.active === 'model'}
          onClick={() => {
            setModelAction('solid');
            panels.setters.model(true);
          }}
        >
          <Plus size={17} />
          <span>Create</span>
        </button>
        <button
          className="subtle-button explore-launcher"
          aria-label="Explore design"
          aria-pressed={panels.active === 'explore'}
          onClick={() => panels.setters.explore((v) => !v)}
        >
          <Sparkles size={16} />
          <span>Explore</span>
        </button>
        <button
          className="subtle-button compact-tools-toggle"
          aria-label="Design tools"
          aria-expanded={toolsOpen}
          onClick={() => setToolsOpen((v) => !v)}
        >
          <Settings2 size={16} />
          <span>Tools</span>
        </button>
        <div
          role="region"
          aria-label="Design tools menu"
          className={`header-actions ${toolsOpen ? 'phone-tools-open' : ''}`}
          onClick={(e) => {
            const button = (e.target as HTMLElement).closest('button');
            if (
              button &&
              button.getAttribute('aria-label') !== 'More export formats' &&
              !button.closest('.tools-menu-heading')
            )
              setToolsOpen(false);
          }}
        >
          <div className="tools-menu-heading">
            <strong>Your workspace</strong>
            <div>
              <button
                className="theme-switch"
                aria-label={
                  appearance.theme === 'day'
                    ? 'Night appearance'
                    : 'Day appearance'
                }
                title={
                  appearance.theme === 'day'
                    ? 'Switch to Night'
                    : 'Switch to Day'
                }
                onClick={() =>
                  setAppearance((a) => ({
                    ...a,
                    theme: a.theme === 'day' ? 'night' : 'day',
                  }))
                }
              >
                {appearance.theme === 'day' ? (
                  <Moon size={17} />
                ) : (
                  <Sun size={17} />
                )}
              </button>
              <button
                aria-label="Close tools"
                onClick={() => setToolsOpen(false)}
              >
                <X size={17} />
              </button>
            </div>
          </div>
          <div className="tools-section-label">Inspiration</div>
          <button
            className="subtle-button"
            aria-label="Model from a reference"
            onClick={() => imageInput.current?.click()}
          >
            <ImagePlus size={16} />
            <span>Model from reference</span>
          </button>
          <button
            className="subtle-button panorama-button"
            aria-label="Open panoramas"
            onClick={() => {
              voice.current?.stop();
              voice.current = null;
              setPanoramaOpen(true);
            }}
          >
            <ImagePlus size={16} />
            <span>Panoramas</span>
          </button>
          <button
            className="subtle-button moodboard-toggle"
            aria-label="Pull up moodboard"
            title="Moodboard · images, models and references"
            onClick={() => setMoodboardOpen(true)}
          >
            <ImagePlus size={16} />
            <span>Moodboard</span>
          </button>
          <div className="tools-section-label">View & environment</div>
          <button
            className="subtle-button map-toggle"
            aria-label="Toggle site map"
            aria-pressed={mapVisible}
            title={mapVisible ? 'Hide map' : 'Show map'}
            onClick={() => {
              if (project.site) setMapVisible((v) => !v);
              else {
                setStudioTab('site');
                setStudioOpen(true);
                if (innerWidth <= 800) setInspectorOpen(false);
              }
            }}
          >
            <MapPin size={16} />
            <span>Map</span>
          </button>
          <button
            className="subtle-button map-settings-button"
            aria-label="Change map location"
            title="Location, satellite and map rotation"
            onClick={() => {
              setStudioTab('site');
              setStudioOpen(true);
              if (innerWidth <= 800) setInspectorOpen(false);
            }}
          >
            <ChevronDown size={14} />
            <span>Location</span>
          </button>
          <div
            className={`studio-tool-group ${toolsOpen ? 'tools-open' : ''}`}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('button'))
                setToolsOpen(false);
            }}
          >
            <button
              className="subtle-button section-toggle"
              aria-label="Section view"
              aria-pressed={section.enabled}
              onClick={() => {
                if (!sectionInitialized.current) {
                  sectionInitialized.current = true;
                  const r = sectionRange(project, section.axis);
                  setSection({
                    ...section,
                    enabled: true,
                    planeVisible: true,
                    position: (r.min + r.max) / 2,
                  });
                }
                setSectionOpen((v) => !v);
                setInspectorOpen(false);
                setStudioOpen(false);
                setSolarOpen(false);
                setCameraOpen(false);
              }}
            >
              <Scissors size={16} />
              <span>Section</span>
            </button>
            <button
              className="subtle-button presentation-toggle"
              aria-label={
                presentation ? 'Exit presentation' : 'Presentation mode'
              }
              aria-pressed={presentation}
              onClick={() => setPresentation(!presentation)}
            >
              <Presentation size={16} />
              <span>{presentation ? 'Edit' : 'Present'}</span>
            </button>
            <button
              className="subtle-button layers-toggle"
              aria-label="Layers and groups"
              onClick={() => setLayersOpen((v) => !v)}
            >
              <Layers size={16} />
              <span>Groups</span>
            </button>
            <button
              className="subtle-button study-toggle"
              aria-label="Solar study"
              onClick={() => {
                setSolarOpen((v) => !v);
                setInspectorOpen(false);
                setStudioOpen(false);
                setCameraOpen(false);
                setSectionOpen(false);
              }}
            >
              <Sun size={16} />
              <span>Sun</span>
            </button>
            <button
              className="subtle-button camera-toggle"
              aria-label="Camera settings"
              onClick={() => {
                setCameraOpen((v) => !v);
                setInspectorOpen(false);
                setStudioOpen(false);
                setSolarOpen(false);
                setSectionOpen(false);
              }}
            >
              <Camera size={16} />
              <span>Camera</span>
            </button>
          </div>
          <div className="tools-section-label">Project & settings</div>
          <button
            className="connection-button"
            onClick={() => setSettingsOpen(true)}
          >
            <span
              className={`status-dot ${connectionState.configured ? '' : 'offline'}`}
            />
            {connectionState.configured
              ? connectionState.authenticated
                ? 'AI settings'
                : 'Unlock AI'
              : 'Connect AI'}
          </button>
          <button
            className="icon-button"
            aria-label={
              inspectorOpen ? 'Collapse inspector' : 'Expand inspector'
            }
            onClick={() => {
              setInspectorOpen(!inspectorOpen);
              if (!inspectorOpen && innerWidth <= 800) setStudioOpen(false);
            }}
          >
            {inspectorOpen ? (
              <PanelRightClose size={17} />
            ) : (
              <PanelRightOpen size={17} />
            )}
          </button>
          <span className={`save-state ${!saved && !saving ? 'warning' : ''}`}>
            <span className="status-dot" />
            {saving
              ? 'Saving…'
              : saved
                ? 'Saved on this browser'
                : 'Storage unavailable — export to save'}
          </span>
          <button
            className="subtle-button import-button"
            onClick={() => file.current?.click()}
          >
            <ArrowUpFromLine size={14} />
            Import
          </button>
          <button className="export-button" onClick={exportProject}>
            <ArrowDownToLine size={14} />
            Export project
          </button>
          <div className="export-options">
            <button
              className="subtle-button"
              aria-label="More export formats"
              aria-expanded={exportOpen}
              onClick={() => setExportOpen((v) => !v)}
            >
              <ChevronDown size={14} />
            </button>
            {exportOpen && (
              <div className="export-menu">
                <button
                  disabled={exporting}
                  onClick={async () => {
                    setExporting(true);
                    try {
                      const text = await exportObj(current.current);
                      const url = URL.createObjectURL(
                        new Blob([text], { type: 'text/plain' }),
                      );
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'atelier-model.obj';
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                      setExportOpen(false);
                      setNotice({
                        text: 'OBJ exported in meters. Visible objects included; editable history stays in the ATELIER project backup.',
                        error: false,
                      });
                    } catch (e) {
                      reportError(e);
                    } finally {
                      setExporting(false);
                    }
                  }}
                >
                  {exporting ? 'Preparing geometry…' : 'Export OBJ'}
                </button>
                <small>Visible geometry · meters · Y up</small>
                <button
                  onClick={() => {
                    exportProject();
                    setExportOpen(false);
                  }}
                >
                  ATELIER project backup
                </button>
              </div>
            )}
          </div>
        </div>
        <input
          ref={file}
          type="file"
          accept=".json,.fbx,.obj,.stl,.glb,application/json"
          aria-label="Import project file"
          hidden
          onChange={async (e) => {
            const element = e.currentTarget,
              f = element.files?.[0];
            if (f) await importFile(f);
            element.value = '';
          }}
        />
      </header>
      <main className="workspace">
        <aside className="objects-panel" hidden={!objectsOpen}>
          <div className="panel-caption">
            <span>PROJECT</span>
            <Layers size={14} />
          </div>
          <div className="study">
            <div className="study-icon">
              <Box size={21} strokeWidth={1.4} />
            </div>
            <div>
              <strong>Concept study</strong>
              <span>Architectural massing</span>
            </div>
          </div>
          <div className="section-heading">
            <h2>
              Scene objects <span>{project.volumes.length}</span>
            </h2>
            <button
              className="icon-button"
              aria-label="Add volume"
              title="Add volume"
              onClick={() => run(COMMAND_EXAMPLES[0])}
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="object-selection-tools">
            <button
              aria-pressed={multiSelect}
              onClick={() => setMultiSelect((v) => !v)}
            >
              Select several
            </button>
            <button
              aria-label="Close objects"
              onClick={() => setObjectsOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="object-visibility-tools">
            <button
              disabled={!project.selectedId && !project.selectedIds?.length}
              onClick={() =>
                void propose(
                  directPlan({
                    type: 'visibility',
                    targets: ['$selected'],
                    visible: false,
                  }),
                )
              }
            >
              <EyeOff size={14} /> Hide selected
            </button>
            <button
              disabled={!project.volumes.some((v) => !isVisible(v, project))}
              onClick={() => void propose(directPlan({ type: 'show_all' }))}
            >
              <Eye size={14} /> Show all
            </button>
          </div>
          {project.volumes.some((v) => !isVisible(v, project)) && (
            <p className="hidden-object-count" role="status">
              {project.volumes.filter((v) => !isVisible(v, project)).length}{' '}
              hidden · still saved in your project
            </p>
          )}
          <label className="object-search">
            <input
              type="search"
              aria-label="Find objects"
              placeholder="Find a window, column…"
              value={objectSearch}
              onChange={(e) => setObjectSearch(e.target.value)}
            />
          </label>
          <div className="object-list">
            {project.volumes
              .map((v, i) => ({ v, i }))
              .filter(({ v }) =>
                `${v.name} ${project.groups?.find((g) => g.id === v.groupId)?.name ?? ''}`
                  .toLowerCase()
                  .includes(objectSearch.trim().toLowerCase()),
              )
              .map(({ v, i }) => (
                <div
                  className={`object-list-item ${isVisible(v, project) ? '' : 'is-hidden'}`}
                  key={v.id}
                >
                  <button
                    className={`object-row ${project.selectedIds?.includes(v.id) || selected?.id === v.id ? 'selected' : ''}`}
                    onClick={(e) =>
                      select(
                        v.id,
                        multiSelect || e.shiftKey || e.ctrlKey || e.metaKey,
                      )
                    }
                    aria-pressed={
                      project.selectedIds?.includes(v.id) ||
                      selected?.id === v.id
                    }
                  >
                    <Box size={16} style={{ color: v.color ?? undefined }} />
                    <span>
                      {v.name}
                      <small>
                        {v.dimensions.width} × {v.dimensions.depth} ×{' '}
                        {v.dimensions.height} m
                        {!isVisible(v, project) && ' · Hidden'}
                      </small>
                    </span>
                    <span className="object-index">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </button>
                  <button
                    className="object-visibility-button"
                    aria-label={`${isVisible(v, project) ? 'Hide' : 'Show'} object ${v.name}`}
                    title={
                      isVisible(v, project) ? 'Hide object' : 'Show object'
                    }
                    onClick={() =>
                      void propose(
                        directPlan({
                          type: 'visibility',
                          targets: [v.id],
                          visible: !isVisible(v, project),
                        }),
                      )
                    }
                  >
                    {isVisible(v, project) ? (
                      <Eye size={16} />
                    ) : (
                      <EyeOff size={16} />
                    )}
                  </button>
                </div>
              ))}
            {!project.volumes.length && (
              <p className="empty-list">
                A blank canvas.
                <br />
                Describe what you would like to build.
              </p>
            )}
          </div>
          {(project.selectedIds?.length ?? 0) > 1 && (
            <button className="add-volume" onClick={() => setLayersOpen(true)}>
              <Layers size={15} />
              Group selection
            </button>
          )}
          <details className="manual-tools">
            <summary>Manual tools</summary>
            <button
              className="add-volume"
              aria-label="Create volume"
              onClick={() => run(COMMAND_EXAMPLES[0])}
            >
              <Plus size={15} />
              Create volume<span>+</span>
            </button>
            <div className="primitive-tools">
              <label>
                Primitive
                <select
                  aria-label="Primitive shape"
                  value={primitive}
                  onChange={(e) =>
                    setPrimitive(e.target.value as typeof primitive)
                  }
                >
                  {['box', 'cylinder', 'sphere', 'rectangle', 'circle'].map(
                    (shape) => (
                      <option key={shape} value={shape}>
                        {shape}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <button
                onClick={() =>
                  void propose(
                    directPlan({
                      type: 'create',
                      shape: primitive,
                      width: 8,
                      depth: ['circle', 'cylinder', 'sphere'].includes(
                        primitive,
                      )
                        ? 8
                        : 6,
                      height: primitive === 'sphere' ? 8 : 4,
                      count: 1,
                    }),
                  )
                }
              >
                <Plus size={14} />
                Add shape
              </button>
            </div>
            {(project.selectedIds?.length ?? 0) === 2 && (
              <div className="boolean-tools">
                {(['union', 'subtract', 'intersect'] as const).map(
                  (operation) => (
                    <button
                      key={operation}
                      onClick={() =>
                        void propose({
                          intent: 'apply',
                          message: `${operation} the two selected objects in selection order.`,
                          operations: [
                            {
                              type: 'boolean',
                              operation,
                              targets: project.selectedIds!,
                            },
                          ],
                        })
                      }
                    >
                      {operation}
                    </button>
                  ),
                )}
              </div>
            )}
          </details>
          <p className="selection-note">
            Shift-click or drag a box to select several. Move them together with
            the arrows.
          </p>
        </aside>
        <section className="modeling-area" aria-label="Modeling workspace">
          <div className="viewport-bar">
            <div className="viewport-title">
              <span className="live-dot" />
              <strong>3D workspace</strong>
              <span>/</span>
              <span>Concept model</span>
            </div>
            <select
              className="view-button"
              aria-label="Camera view"
              value={view.mode}
              onChange={(e) => {
                setSavedViewRequest(null);
                setCameraSettings((v) => ({ ...v, walk: false }));
                setView((v) => ({
                  mode: e.target.value as typeof view.mode,
                  revision: v.revision + 1,
                }));
              }}
            >
              <option value="perspective">Perspective</option>
              <option value="orthographic">Orthographic</option>
              <option value="top">Top view</option>
            </select>
          </div>
          <div className="viewport-stage">
            <button
              className="quick-theme"
              aria-label={
                appearance.theme === 'day' ? 'Switch to Night' : 'Switch to Day'
              }
              title={
                appearance.theme === 'day' ? 'Switch to Night' : 'Switch to Day'
              }
              onClick={() =>
                setAppearance((a) => ({
                  ...a,
                  theme: a.theme === 'day' ? 'night' : 'day',
                }))
              }
            >
              {appearance.theme === 'day' ? (
                <Moon size={17} />
              ) : (
                <Sun size={17} />
              )}
            </button>
            <button
              className="studio-launcher"
              aria-label="Studio appearance and location"
              aria-expanded={studioOpen}
              onClick={() => {
                setStudioOpen(!studioOpen);
                setStudioTab('appearance');
                if (!studioOpen && innerWidth <= 800) setInspectorOpen(false);
              }}
            >
              <Settings2 size={17} />
              <span>Studio</span>
            </button>
            {studioOpen && (
              <StudioPanel
                key={studioTab}
                initialTab={studioTab}
                appearance={appearance}
                onAppearance={setAppearance}
                site={project.site}
                onSite={(site) => commit({ ...current.current, site }, false)}
                alignMap={alignMap}
                onAlignMap={(value) => {
                  setAlignMap(value);
                  if (value) {
                    setMapVisible(true);
                    setView((v) => ({ mode: 'top', revision: v.revision + 1 }));
                  }
                }}
                mapVisible={mapVisible}
                onMap={setMapVisible}
                onFrameMap={() => {
                  setMapVisible(true);
                  setAlignMap(false);
                  setPlacingCamera(false);
                  setCameraSettings((v) => ({ ...v, walk: false }));
                  setView((v) => ({ mode: 'top', revision: v.revision + 1 }));
                  setMapFrame((v) => v + 1);
                }}
                onClose={() => setStudioOpen(false)}
                addPerson={() => {
                  void propose(
                    directPlan({
                      type: 'person',
                      height: 2.26,
                      position: null,
                    }),
                  );
                  setStudioOpen(false);
                }}
              />
            )}
            {addingVolume && selected && (
              <AddVolumePanel
                key={selected.id}
                volume={selected}
                onClose={() => {
                  setAddingVolume(false);
                  setInspectorOpen(true);
                }}
                onAdd={(op) => {
                  setAddingVolume(false);
                  setInspectorOpen(true);
                  void propose(directPlan(op));
                }}
              />
            )}
            {panels.active === 'explore' && (
              <ExplorePanel
                project={project}
                value={exploration}
                guides={explorationGuides}
                onGuides={setExplorationGuides}
                onAxonometric={() => {
                  const offsets = explosionOffsets(project, exploration);
                  const parts = project.volumes
                    .filter(
                      (v) =>
                        isVisible(v, project) &&
                        !['tree', 'person'].includes(v.geometry?.kind ?? ''),
                    )
                    .map((v) => ({
                      ...v,
                      ...explorationTransform(
                        v,
                        project,
                        exploration,
                        new Set(),
                        offsets,
                      ),
                    }));
                  if (!parts.length) return;
                  const b = groupBounds(parts),
                    center = {
                      x: (b.min.x + b.max.x) / 2,
                      y: (b.min.y + b.max.y) / 2,
                      z: (b.min.z + b.max.z) / 2,
                    };
                  const size = Math.max(
                    b.max.x - b.min.x,
                    b.max.y - b.min.y,
                    b.max.z - b.min.z,
                    1,
                  );
                  if (!phoneLayout) {
                    center.x += size * 0.2;
                    center.z -= size * 0.2;
                  }
                  setView((v) => ({ ...v, mode: 'orthographic' }));
                  setCameraSettings((v) => ({ ...v, walk: false }));
                  setSavedViewRequest({
                    view: {
                      name: 'Axonometric',
                      targets: [],
                      section: null,
                      pose: {
                        position: {
                          x: center.x + size,
                          y: center.y + size,
                          z: center.z + size,
                        },
                        target: center,
                        projection: 'orthographic',
                        zoom: 1,
                        fov: 50,
                        orthoHeight: size * (phoneLayout ? 2.5 : 1.65),
                      },
                    },
                    revision: Date.now(),
                  });
                }}
                preview={alternativePreview}
                onExplore={(value) => {
                  setTool('select');
                  setExploration(value);
                }}
                onOperation={(op) => void propose(directPlan(op))}
                onClose={() => {
                  panels.setters.explore(false);
                  setAlternativePreview(null);
                }}
                onView={(name) =>
                  void propose(directPlan({ type: 'show_view', name }))
                }
                onPreview={(name) => {
                  setAlternativePreview(name);
                  setExploration(assembled);
                  setTool('select');
                }}
                onKeep={() => {
                  if (alternativePreview)
                    void execute(
                      directPlan({
                        type: 'alternative',
                        action: 'restore',
                        name: alternativePreview,
                      }),
                      true,
                    ).catch(reportError);
                }}
              />
            )}
            {(exploration.mode !== 'assembled' ||
              alternativePreview ||
              savedViewRequest) && (
              <div className="explore-return">
                <span>
                  {alternativePreview
                    ? `Preview · ${alternativePreview}`
                    : savedViewRequest
                      ? `View · ${savedViewRequest.view.name}`
                      : 'Exploring · model unchanged'}
                </span>
                <button
                  onClick={() => {
                    setExploration(assembled);
                    setAlternativePreview(null);
                    setSavedViewRequest(null);
                    setSection({ ...defaultSection, enabled: false });
                  }}
                >
                  Return to model
                </button>
              </div>
            )}
            {panels.active === 'ar' && (
              <ARPanel
                onFloorPreview={setARFloorPreview}
                onPreparing={setARPreparing}
                onReload={async () => {
                  if (!onSnapshot || !boot.storageSafe)
                    throw new Error(
                      'Cannot verify your project backup. Export your project before refreshing.',
                    );
                  const session = serializeSession(snapshot());
                  await onSnapshot(
                    { session, messages, moodboard, panoramas },
                    boot.storageSafe,
                  );
                  if (serializeSession(snapshot()) !== session)
                    throw new Error(
                      'Your model changed while saving. Please try Save project and refresh again.',
                    );
                  voice.current?.stop();
                  window.location.reload();
                }}
                project={project}
                onActive={setARSessionActive}
                onConversationHost={setARConversationHost}
                onCamera={(c) => {
                  camera.current = c;
                }}
                onNativeOpen={() => {
                  voice.current?.stop();
                  voice.current = null;
                }}
                onClose={() => panels.setters.ar(false)}
              />
            )}
            {panels.active === 'model' && (
              <ModelPanel
                project={project}
                initialAction={modelAction}
                onOperation={(op) => void propose(directPlan(op))}
                onDraw={(mode) => activateTool(`draw_${mode}`)}
                onTool={(t) => {
                  setTool(t);
                  panels.setters.model(false);
                }}
                onGroups={() => setLayersOpen(true)}
                onClose={() => panels.setters.model(false)}
              />
            )}
            {layersOpen && (
              <LayersPanel
                project={project}
                onChange={(p) => commit(p, false)}
                onSelect={(ids) => {
                  const next = {
                    ...current.current,
                    selectedIds: ids,
                    selectedId: ids.at(-1) ?? null,
                  };
                  current.current = next;
                  setProject(next);
                  setTool('translate');
                  conversation.current.focusIds = ids;
                }}
                onClose={() => setLayersOpen(false)}
              />
            )}
            {solarOpen && (
              <SolarPanel
                site={project.site}
                value={solar}
                onChange={setSolar}
                onClose={() => setSolarOpen(false)}
                onLocation={() => {
                  setSolarOpen(false);
                  setStudioTab('site');
                  setStudioOpen(true);
                }}
              />
            )}
            {cameraOpen && (
              <CameraPanel
                onAR={() => panels.setters.ar(true)}
                onPlace={() => {
                  setCameraSettings((v) => ({ ...v, walk: false }));
                  setAlignMap(false);
                  setTool('select');
                  setSectionOpen(false);
                  setPlacingCamera(true);
                  setCameraOpen(false);
                  setView((v) => ({
                    ...v,
                    mode: 'top',
                    revision: v.revision + 1,
                  }));
                }}
                value={cameraSettings}
                onClose={() => setCameraOpen(false)}
                onChange={(v) => {
                  setCameraSettings(v);
                  if (v.walk)
                    setView((old) => ({ ...old, mode: 'perspective' }));
                }}
              />
            )}
            {sectionOpen && (
              <SectionPanel
                project={project}
                value={section}
                onChange={setSection}
                onClose={() => setSectionOpen(false)}
              />
            )}
            {presentation && (
              <div className="presentation-label">
                <span className="project-dot" /> Design in space{' '}
                <button
                  onClick={() => setTurntable((v) => !v)}
                  aria-pressed={turntable}
                >
                  {turntable ? 'Pause orbit' : 'Orbit model'}
                </button>
                <button onClick={() => setPresentation(false)}>
                  Back to editing
                </button>
              </div>
            )}
            {mapVisible && project.site && (
              <div className="map-attribution">
                <a
                  href={mapSources[project.site.style ?? 'street'].link}
                  target="_blank"
                  rel="noreferrer"
                >
                  {mapSources[project.site.style ?? 'street'].credit}
                </a>
                <button
                  onClick={() => {
                    setStudioTab('site');
                    setStudioOpen(true);
                  }}
                >
                  Change location
                </button>
                <button
                  onClick={() =>
                    commit(
                      {
                        ...project,
                        site: {
                          ...project.site!,
                          style:
                            project.site?.style === 'satellite'
                              ? 'street'
                              : 'satellite',
                        },
                      },
                      false,
                    )
                  }
                >
                  {project.site.style === 'satellite' ? 'Street' : 'Satellite'}
                </button>
                <button onClick={() => setMapVisible(false)}>Hide</button>
              </div>
            )}
            <div className="north-compass" aria-label="Project north">
              <span style={{ transform: `rotate(${northAngle}deg)` }}>↑</span>
              <small>Project N</small>
              {mapVisible && project.site && (
                <i
                  className="true-north-mark"
                  title="True north"
                  style={{
                    transform: `rotate(${(Math.atan2(trueNorth(project.site.bearing).x * camera.current.right.x + trueNorth(project.site.bearing).z * camera.current.right.z, trueNorth(project.site.bearing).x * camera.current.forward.x + trueNorth(project.site.bearing).z * camera.current.forward.z) * 180) / Math.PI}deg)`,
                  }}
                >
                  ↑<b>True N</b>
                </i>
              )}
            </div>
            <Viewport
              project={viewportProject}
              exploration={exploration}
              explorationGuides={explorationGuides}
              savedViewRequest={savedViewRequest}
              previewing={!!alternativePreview}
              phonePanel={
                phoneLayout && !!panels.active && panels.active !== 'ar'
              }
              onTool={activateTool}
              onDraw={async (op) => {
                if (busyRef.current)
                  throw new Error(
                    'Wait for the current edit to finish, then finish your drawing.',
                  );
                setModelingBusy((n) => n + 1);
                try {
                  const message = await execute(directPlan(op));
                  remember('assistant', message);
                  setTool('reshape');
                } finally {
                  setModelingBusy((n) => n - 1);
                }
              }}
              touchNavigation={phoneLayout ? touchNavigation : null}
              tool={presentation || alignMap ? 'select' : tool}
              presenting={presentation}
              suspended={
                arActive || arPreparing || moodboardOpen || panoramaOpen
              }
              releaseGPU={arPreparing}
              cameraSettings={cameraSettings}
              solar={solar}
              onSelectMany={(ids, additive) => {
                const p = current.current,
                  nextIds = [
                    ...new Set([
                      ...(additive
                        ? (p.selectedIds ??
                          (p.selectedId ? [p.selectedId] : []))
                        : []),
                      ...ids,
                    ]),
                  ];
                const next = {
                  ...p,
                  selectedId: nextIds.at(-1) ?? null,
                  selectedIds: nextIds,
                };
                current.current = next;
                setProject(next);
                conversation.current.focusIds = nextIds;
              }}
              turntable={presentation && turntable}
              snap={snap}
              angleSnap={angleSnap}
              motion={motion}
              renderMode={renderMode}
              appearance={appearance}
              mapVisible={mapVisible}
              mapFrame={mapFrame}
              alignMap={alignMap}
              placingCamera={placingCamera}
              onPlaceCamera={(placement) => {
                setPlacingCamera(false);
                if (!placement) return;
                setCameraSettings((v) => ({
                  ...v,
                  walk: true,
                  fov: 65,
                  level: placement.position.y,
                  placement: {
                    ...placement,
                    revision: (v.placement?.revision ?? 0) + 1,
                  },
                }));
                setView((v) => ({ ...v, mode: 'perspective' }));
              }}
              onMapSite={(site) => commit({ ...current.current, site }, false)}
              section={viewportSection}
              sectionPreviewOnly={arFloorPreview !== null}
              sectionEditing={sectionOpen && !!section.planeVisible}
              onSectionChange={setSection}
              view={view}
              onSelect={(id, additive) => {
                setPhoneActions(false);
                select(id, additive || multiSelect);
                if (id && exploration.mode === 'open') {
                  const v = current.current.volumes.find((v) => v.id === id);
                  if (v && componentInfo(v).motion !== 'none') {
                    const movable = current.current.volumes
                      .filter((v) => componentInfo(v).motion !== 'none')
                      .map((v) => v.id);
                    const active = new Set(
                      exploration.amount
                        ? exploration.targets.length
                          ? exploration.targets
                          : movable
                        : [],
                    );
                    if (active.has(id)) active.delete(id);
                    else active.add(id);
                    setExploration(
                      active.size
                        ? { ...exploration, amount: 1, targets: [...active] }
                        : { ...exploration, amount: 0, targets: [] },
                    );
                  }
                }
              }}
              onTouchAction={(id, kind) => {
                if (!id) {
                  if (kind === 'double') {
                    setSavedViewRequest(null);
                    setView((v) => ({ ...v, revision: v.revision + 1 }));
                  }
                  return;
                }
                const existing = current.current.selectedIds ?? [];
                if (!existing.includes(id)) select(id, multiSelect);
                if (kind === 'hold') {
                  if (panels.active) panels.setters[panels.active](false);
                  setObjectsOpen(false);
                  setPhoneActions(true);
                } else {
                  setPhoneActions(false);
                  const target = current.current.volumes.find(
                    (v) => v.id === id,
                  )!;
                  const b = groupBounds([target]);
                  const center = {
                    x: (b.min.x + b.max.x) / 2,
                    y: (b.min.y + b.max.y) / 2,
                    z: (b.min.z + b.max.z) / 2,
                  };
                  const size = Math.max(
                    b.max.x - b.min.x,
                    b.max.y - b.min.y,
                    b.max.z - b.min.z,
                    1,
                  );
                  setView((v) => ({ ...v, mode: 'perspective' }));
                  setSavedViewRequest({
                    view: {
                      name: target.name,
                      targets: [],
                      section: null,
                      pose: {
                        position: {
                          x: center.x + size * 1.5,
                          y: center.y + size,
                          z: center.z + size * 1.5,
                        },
                        target: center,
                        projection: 'perspective',
                        zoom: 1,
                        fov: 50,
                      },
                    },
                    revision: Date.now(),
                  });
                }
              }}
              onChange={change}
              onTransform={(id, patch) => {
                try {
                  const next = transformSelection(current.current, id, patch);
                  if (!equalData(next.volumes, current.current.volumes))
                    commit(next, false);
                } catch (error) {
                  reportError(error);
                }
              }}
              onCamera={(c) => {
                if (arActive) return;
                camera.current = c;
                setNorthAngle(
                  (Math.atan2(-c.right.z, c.right.x) * 180) / Math.PI,
                );
              }}
            />
            {selected && (
              <div className="selection-chip">
                <label className="selection-color" title="Object color">
                  <input
                    type="color"
                    aria-label="Selected object color"
                    value={selected.color ?? '#e2e7e6'}
                    onChange={(e) =>
                      change(selected.id, { color: e.target.value })
                    }
                  />
                </label>
                <button
                  className="selection-summary"
                  onClick={() => {
                    setInspectorOpen(!inspectorOpen);
                    if (!inspectorOpen && innerWidth <= 800)
                      setStudioOpen(false);
                  }}
                  aria-label="Edit selected dimensions"
                >
                  <span>
                    {(project.selectedIds?.length ?? 0) > 1
                      ? `${project.selectedIds!.length} objects selected`
                      : selected.name}
                  </span>
                  <strong>
                    {selected.dimensions.width} × {selected.dimensions.depth} ×{' '}
                    {selected.dimensions.height} <small>m</small>
                  </strong>
                  {selected.position.y > 0 && (
                    <small>Raised {selected.position.y} m</small>
                  )}
                </button>
                {phoneLayout && (
                  <button
                    className="selection-more"
                    aria-label="Selected object actions"
                    aria-expanded={phoneActions}
                    onClick={() => {
                      if (panels.active) panels.setters[panels.active](false);
                      setObjectsOpen(false);
                      setPhoneActions((v) => !v);
                    }}
                  >
                    <MoreHorizontal size={20} />
                  </button>
                )}
              </div>
            )}
            {selected &&
              (!phoneLayout || touchNavigation === 'edit') &&
              isVisible(selected, project) &&
              !isLocked(selected, project) &&
              !tool.startsWith('draw_') &&
              !cameraSettings.walk &&
              !placingCamera && (
                <div
                  className="spatial-actions"
                  ref={trackToolbar}
                  role="toolbar"
                  aria-label="Shape selected objects"
                >
                  <button
                    aria-label="Pull selected face"
                    aria-pressed={tool === 'reshape'}
                    onClick={() => activateTool('reshape')}
                  >
                    <Maximize size={15} />
                    Push / pull
                  </button>
                  <button
                    aria-label="Hide selected objects"
                    onClick={() =>
                      void propose(
                        directPlan({
                          type: 'visibility',
                          targets: ['$selected'],
                          visible: false,
                        }),
                      )
                    }
                  >
                    <EyeOff size={15} />
                    Hide
                  </button>
                  <button
                    aria-label="Delete selected objects"
                    title="Delete selection · Delete / Backspace"
                    onClick={() => run('delete selected')}
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                  {selected.component &&
                    selected.component.motion !== 'none' && (
                      <button
                        onClick={() => {
                          setTool('select');
                          setExploration({
                            mode: 'open',
                            amount:
                              exploration.mode === 'open' && exploration.amount
                                ? 0
                                : 1,
                            targets: project.selectedIds?.length
                              ? project.selectedIds
                              : [selected.id],
                          });
                        }}
                      >
                        {exploration.mode === 'open' && exploration.amount
                          ? 'Close'
                          : 'Open'}
                      </button>
                    )}
                  <button onClick={() => panels.setters.explore(true)}>
                    Explore
                  </button>
                  {['Scale', 'Stretch'].map((label) => (
                    <button
                      key={label}
                      onClick={() => {
                        setModelAction(label.toLowerCase());
                        panels.setters.model(true);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            <div
              className="tool-palette"
              role="toolbar"
              aria-label="Modeling tools"
            >
              {phoneLayout &&
                !placingCamera &&
                !alignMap &&
                !cameraSettings.walk && (
                  <div
                    className="touch-navigation"
                    role="toolbar"
                    aria-label="Touch navigation"
                  >
                    {(['orbit', 'pan', 'edit'] as const).map((mode) => (
                      <button
                        key={mode}
                        aria-label={`Touch ${mode}`}
                        aria-pressed={touchNavigation === mode}
                        onClick={() => {
                          setTouchNavigation(mode);
                          setTool(mode === 'edit' ? 'translate' : 'select');
                        }}
                      >
                        {mode === 'orbit' ? (
                          <RotateCw size={19} />
                        ) : mode === 'pan' ? (
                          <Move3D size={19} />
                        ) : (
                          <MousePointer2 size={19} />
                        )}
                        <span>
                          {mode === 'edit'
                            ? 'Edit'
                            : mode === 'pan'
                              ? 'Pan'
                              : 'Orbit'}
                        </span>
                      </button>
                    ))}
                    <span className="touch-gesture-hint">
                      {touchNavigation === 'edit'
                        ? 'Drag handles'
                        : '2 fingers: pan · pinch · twist'}
                    </span>
                  </div>
                )}
              {(!phoneLayout || touchNavigation === 'edit') &&
                (
                  [
                    {
                      id: 'select',
                      label: 'Select',
                      key: 'V',
                      Icon: MousePointer2,
                    },
                    {
                      id: 'translate',
                      label: 'Move',
                      key: 'M / G',
                      Icon: Move3D,
                    },
                    { id: 'rotate', label: 'Rotate', key: 'Q', Icon: RotateCw },
                    {
                      id: 'reshape',
                      label: 'Push / pull',
                      key: 'P',
                      Icon: Maximize,
                    },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    title={`${t.label} (${t.key})`}
                    aria-label={t.label}
                    aria-pressed={tool === t.id}
                    className={tool === t.id ? 'active' : ''}
                    onClick={() => activateTool(t.id)}
                  >
                    <t.Icon size={18} strokeWidth={1.5} />
                  </button>
                ))}
              <div className="tool-divider" />
              <button
                className="create-tools-button"
                aria-label="Draw 2D"
                title="Draw a face (R rectangle · C circle · L outline)"
                aria-pressed={tool.startsWith('draw_')}
                onClick={() => activateTool('draw_rectangle')}
              >
                <PenLine size={18} />
                <span>Draw</span>
              </button>
              <button
                className="create-tools-button"
                aria-label="Create and transform"
                title="2D shapes, extrude, scale and stretch"
                aria-pressed={panels.active === 'model'}
                onClick={() => {
                  setModelAction(null);
                  panels.setters.model((v) => !v);
                }}
              >
                <Plus size={18} />
                <span>Create</span>
              </button>
              <button
                title="Frame all (F)"
                aria-label="Frame all"
                onClick={() =>
                  setView((v) => ({ ...v, revision: v.revision + 1 }))
                }
              >
                <Focus size={18} />
              </button>
            </div>
            <div className="viewport-top-right">
              <span>METERS</span>
              <span>1 : 1</span>
            </div>
            <div className="viewport-bottom-left">
              <button
                aria-pressed={snap}
                className={snap ? 'snap active' : 'snap'}
                onClick={() => setSnap(!snap)}
              >
                <Grid2X2 size={12} />
                Snap {snap ? `0.5 m / ${angleSnap}°` : 'off'}
              </button>
              <select
                aria-label="Rotation snap angle"
                value={angleSnap}
                onChange={(e) => setAngleSnap(Number(e.target.value))}
              >
                <option value={15}>15°</option>
                <option value={45}>45°</option>
                <option value={90}>90°</option>
              </select>
            </div>
            <div
              className="axis-indicator"
              aria-label="Y up, X and Z ground plane"
            >
              <span className="axis-y">Y</span>
              <span className="axis-z">Z</span>
              <span className="axis-x">X</span>
              <i />
            </div>
            <div className="navigation-hint">
              {cameraSettings.walk
                ? 'WASD to walk · drag to look'
                : tool.startsWith('draw_')
                  ? 'Click to draw · Middle-drag to orbit · Scroll to zoom'
                  : tool === 'select'
                    ? 'Drag a selection box · Alt-drag to orbit'
                    : 'Drag to orbit · Shift-drag to select · Scroll to zoom'}
            </div>
          </div>
          {phoneLayout && phoneActions && selected && (
            <section
              className="phone-object-actions"
              role="dialog"
              aria-label="Selected object actions"
            >
              <header>
                <div>
                  <strong>
                    {(project.selectedIds?.length ?? 0) > 1
                      ? `${project.selectedIds!.length} selected`
                      : selected.name}
                  </strong>
                  <span>Changes can be undone</span>
                </div>
                <button
                  aria-label="Close object actions"
                  onClick={() => setPhoneActions(false)}
                >
                  <X size={20} />
                </button>
              </header>
              <div className="phone-action-grid">
                <button
                  onClick={() => {
                    setTouchNavigation('edit');
                    setTool('translate');
                    setPhoneActions(false);
                  }}
                >
                  <Move3D size={21} />
                  Move
                </button>
                <button
                  onClick={() => {
                    setModelAction('scale');
                    panels.setters.model(true);
                    setPhoneActions(false);
                  }}
                >
                  <Maximize size={21} />
                  Modify
                </button>
                <button
                  onClick={() => {
                    void propose(
                      directPlan({
                        type: 'duplicate',
                        targets: ['$selected'],
                        count: 1,
                        direction: 'east',
                        distance: 2,
                      }),
                    );
                    setPhoneActions(false);
                  }}
                >
                  <Copy size={21} />
                  Duplicate
                </button>
                <button
                  onClick={() => {
                    void propose(
                      directPlan({
                        type: 'visibility',
                        targets: ['$selected'],
                        visible: false,
                      }),
                    );
                    setPhoneActions(false);
                  }}
                >
                  <EyeOff size={21} />
                  Hide
                </button>
                <button
                  aria-pressed={multiSelect}
                  onClick={() => {
                    setMultiSelect((v) => !v);
                    setPhoneActions(false);
                  }}
                >
                  <Layers size={21} />
                  {multiSelect ? 'Finish selecting' : 'Select several'}
                </button>
                <button
                  className="destructive-action"
                  aria-label="Delete selection"
                  onClick={() => {
                    run('delete selected');
                    setPhoneActions(false);
                  }}
                >
                  <Trash2 size={21} />
                  Delete
                </button>
              </div>
              <p>Tap to select · Hold for actions · Double-tap to focus</p>
            </section>
          )}
          <ConversationSurface target={arActive ? arConversationHost : null}>
            {chatDocked && (
              <button
                className="conversation-launcher"
                aria-label="Open conversation"
                onClick={revealConversation}
              >
                <MessageCircle size={22} />
                <span>
                  {busy
                    ? 'Thinking…'
                    : voiceActive
                      ? 'Voice is on'
                      : 'Ask Atelier'}
                </span>
                {(busy || voiceActive) && (
                  <i className="conversation-activity" />
                )}
              </button>
            )}

            <div
              className={`conversation-area ${chatExpanded ? 'conversation-open' : 'conversation-compact'} ${chatDocked ? 'is-docked' : ''}`}
            >
              <div className="conversation-heading">
                <button
                  aria-expanded={chatExpanded}
                  aria-label={`Atelier ${busy ? 'Thinking…' : chatExpanded ? 'Close conversation' : 'Conversation'}`}
                  onClick={() => setChatExpanded(!chatExpanded)}
                >
                  <MessageCircle size={16} />
                  <span>{busy ? 'Thinking…' : 'Conversation'}</span>
                  <ChevronDown
                    size={14}
                    className={
                      chatExpanded
                        ? 'conversation-chevron expanded'
                        : 'conversation-chevron'
                    }
                  />
                </button>
                <button
                  className="minimize-conversation"
                  aria-label="Minimize conversation"
                  title="Minimize conversation"
                  onClick={() => setChatDocked(true)}
                >
                  <Minus size={18} />
                </button>
                <span className="voice-status">
                  {voiceStatus !== 'Off' ? voiceStatus : ''}
                </span>
              </div>
              {!chatExpanded &&
                messages.at(-1)?.role === 'assistant' &&
                !pending && (
                  <div className="conversation-latest">
                    <ConversationReply message={messages.at(-1)!} />
                  </div>
                )}
              {messages.length === 0 && !tool.startsWith('draw_') && (
                <div className="conversation-welcome">
                  <strong>What would you like to create?</strong>
                  <p>A space, a shape, a new way of seeing it.</p>
                  {onOpenSample && (
                    <button
                      className="sample-start"
                      disabled={
                        sampleBusy ||
                        busy ||
                        modelingBusy > 0 ||
                        voiceActive ||
                        !!pending
                      }
                      onClick={onOpenSample}
                    >
                      Explore an editable sample house{' '}
                      <ArrowUpRight size={14} />
                    </button>
                  )}
                </div>
              )}
              {chatExpanded && messages.length > 0 && (
                <div
                  ref={log}
                  className="conversation-log"
                  role="log"
                  aria-label="Design conversation"
                >
                  {messages.map((m, i) => (
                    <div className={`chat-message ${m.role}`} key={i}>
                      <span>{m.role === 'user' ? 'You' : 'Atelier'}</span>
                      {m.images?.length ? (
                        <div className="reference-thumbnails">
                          {m.images.map((src, i) => (
                            <img
                              key={i}
                              src={src}
                              alt={`Design reference ${i + 1}`}
                            />
                          ))}
                        </div>
                      ) : null}
                      <ConversationReply message={m} />
                    </div>
                  ))}
                </div>
              )}
              {(busy || modelingBusy > 0) && (
                <div className="conversation-working" role="status">
                  <span className="process-orb" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span
                    key={busy ? workStage : 'geometry'}
                    className="process-stage"
                  >
                    {busy ? workStage : 'Preparing geometry…'}
                    <small>
                      {busy
                        ? 'Working with your current design'
                        : 'Checking the solid before applying it'}
                    </small>
                  </span>
                </div>
              )}
              {pending && (
                <div
                  className="operation-review"
                  role="region"
                  aria-label="Review geometry change"
                >
                  <strong>Shall I make this change?</strong>
                  <p>{pending.plan.message}</p>
                  <p>
                    {pending.plan.operations
                      .flatMap(reviewDescription)
                      .join(' ')}
                  </p>
                  <details className="conversation-measurements">
                    <summary>Checked result · not applied yet</summary>
                    <p>{pending.prepared.message}</p>
                  </details>
                  <p className="review-answer-hint">
                    Reply naturally to approve, cancel, or adjust it.
                  </p>
                  <div>
                    <button
                      disabled={busy}
                      onClick={async () => {
                        const item = pending;
                        if (item.fingerprint !== fingerprint()) {
                          setPending(null);
                          setNotice({
                            text: 'Selection or geometry changed. Request this operation again.',
                            error: true,
                          });
                          return;
                        }
                        setPending(null);
                        try {
                          const result = acceptReview(item);
                          remember(
                            'assistant',
                            result,
                            displaySummary(item.plan),
                          );
                        } catch (e) {
                          reportError(e);
                        }
                      }}
                    >
                      Apply change
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setPending(null);
                        remember(
                          'assistant',
                          'Change cancelled. Geometry was preserved.',
                        );
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {referenceImages.length > 0 && (
                <div className="reference-thumbnails pending-references">
                  {referenceImages.map((src, i) => (
                    <div key={i}>
                      <img
                        src={src}
                        alt={`Attached design reference ${i + 1}`}
                      />
                      <button
                        aria-label={`Remove reference ${i + 1}`}
                        onClick={() =>
                          setReferenceImages((old) =>
                            old.filter((_, j) => j !== i),
                          )
                        }
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <div className="reference-brief">
                    <strong>Build from inspiration</strong>
                    <small>
                      Editable massing inspired by your image. A photo alone
                      cannot establish exact dimensions.
                    </small>
                    <label>
                      Known building width · m{' '}
                      <input
                        aria-label="Reference building width"
                        type="number"
                        min="0.1"
                        max="500"
                        step="any"
                        value={referenceWidth}
                        placeholder="Optional"
                        onChange={(e) => setReferenceWidth(e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={
                        busy ||
                        imageLoading ||
                        (referenceWidth !== '' &&
                          (!Number.isFinite(Number(referenceWidth)) ||
                            Number(referenceWidth) < 0.1 ||
                            Number(referenceWidth) > 500))
                      }
                      onClick={() => {
                        const text = `Create an editable volumetric architectural study inspired by the attached building reference. ${referenceWidth ? `Use a building width of ${Number(referenceWidth)} meters. Estimate other proportions and explain your assumptions.` : 'Ask me for a real dimension and the main qualities I want to keep before creating the model.'} Use actual supported geometry operations, keep components editable, and explain any important limitation.`;
                        setReferenceWidth('');
                        void sendConversation(text);
                      }}
                    >
                      Create similar massing
                    </button>
                  </div>
                </div>
              )}
              <input
                ref={imageInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                aria-label="Attach reference image file"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  await attachReference(file);
                }}
              />
              <form
                className="conversation-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  const text =
                    command.trim() ||
                    (referenceImages.length
                      ? 'Help me develop a design from this reference. Ask me about scale and intent.'
                      : '');
                  if (text && !busyRef.current) {
                    setCommand('');
                    void sendConversation(text);
                  }
                }}
              >
                <textarea
                  ref={input}
                  rows={2}
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  aria-label="Message Atelier"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="Ask Atelier to create or change anything…"
                  autoComplete="off"
                  maxLength={4000}
                />
                <div className="composer-actions">
                  <button
                    type="button"
                    className="attach-reference"
                    aria-label="Attach a reference photo"
                    disabled={imageLoading || referenceImages.length >= 2}
                    onClick={() => imageInput.current?.click()}
                  >
                    <Plus size={21} />
                    <span>Add reference</span>
                  </button>
                  <span className="composer-context">Design with Atelier</span>
                  <button
                    type="button"
                    className={
                      voiceActive ? 'voice-button mic-active' : 'voice-button'
                    }
                    aria-label={
                      !voiceActive
                        ? 'Start voice conversation'
                        : 'Stop voice conversation'
                    }
                    disabled={
                      !connectionState.voiceConfigured ||
                      !connectionState.authenticated
                    }
                    title={
                      connectionState.voiceConfigured
                        ? 'Continuous voice conversation'
                        : 'Configure the AI backend to enable voice'
                    }
                    onClick={async () => {
                      if (voice.current) {
                        voice.current.stop();
                        voice.current = null;
                        return;
                      }
                      const v = new VoiceConnection(
                        (text) => sendRef.current(text),
                        (status) => {
                          setVoiceStatus(status);
                          setVoiceActive(v.active);
                          if (!v.active && voice.current === v)
                            voice.current = null;
                        },
                      );
                      voice.current = v;
                      try {
                        await v.start();
                      } catch (e) {
                        voice.current = null;
                        reportError(e);
                      }
                    }}
                  >
                    {!voiceActive ? <Mic size={18} /> : <MicOff size={18} />}
                  </button>
                  <button
                    type="submit"
                    aria-label="Send message"
                    disabled={
                      (!command.trim() && !referenceImages.length) ||
                      busy ||
                      imageLoading
                    }
                  >
                    <ArrowUp size={20} />
                  </button>
                </div>
              </form>
              <div
                className={`command-feedback ${notice.error ? 'error' : ''}`}
                role={notice.error ? 'alert' : 'status'}
              >
                <span>{notice.text}</span>
              </div>
            </div>
          </ConversationSurface>
        </section>
        <aside
          ref={inspectorPanel.ref}
          style={inspectorPanel.style}
          onPointerDownCapture={inspectorPanel.raise}
          className="inspector-panel"
          aria-label="Object inspector"
          hidden={!inspectorOpen}
        >
          <div
            className="panel-caption panel-drag-handle"
            {...inspectorPanel.handle}
            role="button"
            tabIndex={0}
            aria-label="Move Inspector panel"
          >
            <span>INSPECTOR</span>
            <button
              className="icon-button"
              aria-label="Close inspector"
              onClick={() => setInspectorOpen(false)}
            >
              <X size={14} />
            </button>
          </div>
          {selected ? (
            <>
              <div className="selection-heading">
                <div className="selection-icon">
                  <Box size={22} strokeWidth={1.3} />
                </div>
                <div>
                  <span className="small-label">
                    {selected.geometry?.kind ?? 'box'}
                  </span>
                  <label className="volume-name-label">
                    Name
                    <input
                      key={selected.id + selected.name}
                      aria-label="Object name"
                      defaultValue={selected.name}
                      maxLength={80}
                      onBlur={(e) => {
                        const name = e.target.value.trim();
                        if (name && name !== selected.name)
                          change(selected.id, { name });
                        else e.target.value = selected.name;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'Escape') {
                          e.currentTarget.value = selected.name;
                          e.currentTarget.blur();
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
              <button
                className="text-action clear-selection"
                onClick={() => select(null)}
              >
                Clear selection
              </button>
              <div className="object-palette" aria-label="Object colors">
                {palette.map((color) => (
                  <button
                    key={color}
                    title={color}
                    aria-label={`Set object color ${color}`}
                    aria-pressed={selected.color === color}
                    style={{ background: color }}
                    onClick={() => change(selected.id, { color })}
                  />
                ))}
              </div>
              <div className="inspector-section">
                <div className="section-heading">
                  <h2>Dimensions</h2>
                  <span className="unit-tag">m</span>
                </div>
                <div className="fields-stack">
                  {(['width', 'depth', 'height'] as const).map((k) => (
                    <NumericField
                      key={selected.id + k}
                      label={k[0].toUpperCase() + k.slice(1)}
                      value={selected.dimensions[k]}
                      min={selected.geometry?.kind === 'mesh' ? 0.001 : 0.1}
                      max={500}
                      onChange={(n) =>
                        change(selected.id, {
                          dimensions: { ...selected.dimensions, [k]: n },
                        })
                      }
                    />
                  ))}
                </div>
                <div className="volume-stat">
                  <span>Volume</span>
                  <strong data-testid="volume-stat">
                    {isReference(selected)
                      ? 'Reference'
                      : measuredVolume === null
                        ? '…'
                        : round(measuredVolume).toLocaleString()}{' '}
                    {!isReference(selected) && <small>m³</small>}
                  </strong>
                </div>
              </div>
              <div className="inspector-section">
                <div className="section-heading">
                  <h2>Position</h2>
                  <Move3D size={13} />
                </div>
                <p className="field-note">Base center · Y is elevation</p>
                <div className="fields-stack">
                  {(['x', 'y', 'z'] as const).map((k) => (
                    <NumericField
                      key={selected.id + k}
                      label={k.toUpperCase()}
                      value={selected.position[k]}
                      min={k === 'y' ? 0 : -1000}
                      max={1000}
                      onChange={(n) =>
                        change(selected.id, {
                          position: { ...selected.position, [k]: n },
                        })
                      }
                    />
                  ))}
                </div>
              </div>
              <div className="inspector-section">
                <div className="section-heading">
                  <h2>Rotation</h2>
                  <RotateCcw size={13} />
                </div>
                <NumericField
                  key={selected.id}
                  label="Yaw"
                  value={selected.rotation}
                  unit="°"
                  onChange={(n) =>
                    change(selected.id, {
                      rotation: round(((n % 360) + 360) % 360),
                    })
                  }
                />
              </div>
              <button
                className="architecture-action"
                onClick={() => {
                  setAddingVolume(true);
                  setInspectorOpen(false);
                  setStudioOpen(false);
                }}
              >
                <Plus size={17} />
                <span>Add volume to this</span>
              </button>
              <button
                className="architecture-action"
                onClick={() =>
                  void propose({
                    intent: 'apply',
                    message: 'Add volumetric trees around this volume.',
                    operations: [
                      {
                        type: 'trees',
                        target: selected.id,
                        count: null,
                        height: 4.5,
                        crown: 3,
                        clearance: 2,
                        position: null,
                      },
                    ],
                  })
                }
              >
                <Plus size={17} />
                <span>Trees around this</span>
              </button>
              {!isProfile(selected) && !isReference(selected) && (
                <button
                  className="architecture-action"
                  aria-label="Create floors and curtain wall"
                  title="Floors and glazing"
                  onClick={() =>
                    void propose({
                      intent: 'apply',
                      message: `${selected.geometry?.kind === 'building' ? 'Update the existing floors and curtain wall' : 'Create two floor slabs and a roof with a curtain wall'} inside ${selected.name}, preserving its height and elevation.`,
                      operations: [buildingEdit(selected)],
                    })
                  }
                >
                  <Layers size={17} />
                  <span>Floors & glass</span>
                </button>
              )}
              {selected.geometry?.kind === 'building' && (
                <div className="inspector-section architecture-fields">
                  <div className="section-heading">
                    <h2>Floors & glass</h2>
                  </div>
                  <div
                    className="building-display"
                    aria-label="Building representation"
                  >
                    <div className="theme-options">
                      {(['volume', 'architecture'] as const).map((mode) => (
                        <button
                          key={mode}
                          aria-pressed={
                            (selected.display?.mode ?? 'architecture') === mode
                          }
                          onClick={() =>
                            change(selected.id, {
                              display: {
                                floors: true,
                                glass: true,
                                ...selected.display,
                                mode,
                              },
                            })
                          }
                        >
                          {mode === 'volume' ? 'Volume' : 'Floors & glass'}
                        </button>
                      ))}
                    </div>
                    <label>
                      <input
                        type="checkbox"
                        aria-label="Show floor slabs"
                        checked={selected.display?.floors !== false}
                        onChange={(e) =>
                          change(selected.id, {
                            display: {
                              mode: 'architecture',
                              floors: e.target.checked,
                              glass: selected.display?.glass ?? true,
                            },
                          })
                        }
                      />{' '}
                      Floors
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        aria-label="Show glass and frames"
                        checked={selected.display?.glass !== false}
                        onChange={(e) =>
                          change(selected.id, {
                            display: {
                              mode: 'architecture',
                              floors: selected.display?.floors ?? true,
                              glass: e.target.checked,
                            },
                          })
                        }
                      />{' '}
                      Glass & frames
                    </label>
                  </div>
                  <NumericField
                    label="Floors"
                    value={selected.geometry.floors}
                    min={1}
                    max={30}
                    unit=""
                    onChange={(floors) =>
                      void propose(
                        directPlan(buildingEdit(selected, { floors })),
                      )
                    }
                  />
                  <NumericField
                    label="Slab thickness"
                    value={buildingSettings(selected)!.slabThickness}
                    min={0.1}
                    max={1}
                    onChange={(slabThickness) =>
                      void propose(
                        directPlan(buildingEdit(selected, { slabThickness })),
                      )
                    }
                  />
                  <NumericField
                    label="Panel width"
                    value={buildingSettings(selected)!.panelWidth}
                    min={0.5}
                    max={10}
                    onChange={(panelWidth) =>
                      void propose(
                        directPlan(buildingEdit(selected, { panelWidth })),
                      )
                    }
                  />
                  <label className="window-lock">
                    <input
                      type="checkbox"
                      aria-label="Keep window width fixed"
                      checked={selected.geometry.fixedWindowWidth !== undefined}
                      onChange={(e) =>
                        void propose(
                          directPlan({
                            type: 'window_module',
                            target: selected.id,
                            width: e.target.checked ? 1.2 : null,
                          }),
                        )
                      }
                    />{' '}
                    Keep window width fixed
                  </label>
                  {selected.geometry.fixedWindowWidth !== undefined && (
                    <NumericField
                      label="Clear window width"
                      value={selected.geometry.fixedWindowWidth}
                      min={0.3}
                      max={10}
                      onChange={(width) =>
                        void propose(
                          directPlan({
                            type: 'window_module',
                            target: selected.id,
                            width,
                          }),
                        )
                      }
                    />
                  )}
                  <p className="field-note">
                    Floor slabs plus a roof. The original envelope stays
                    editable.
                  </p>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      void propose(
                        directPlan({ type: 'components', target: selected.id }),
                      )
                    }
                  >
                    Edit individual components
                  </button>
                  <p className="field-note">
                    Separate windows, slabs and frames for direct editing. Undo
                    restores the building controls.
                  </p>
                </div>
              )}
              {isProfile(selected) && (
                <div className="selection-actions">
                  <button
                    onClick={() =>
                      void propose(
                        directPlan({
                          type: 'extrude',
                          target: selected.id,
                          height: 3,
                        }),
                      )
                    }
                  >
                    Extrude 3 m
                  </button>
                </div>
              )}
              {selected.geometry?.kind === 'boolean' &&
              selected.geometry.opening ? (
                <div className="inspector-section">
                  <div className="section-heading">
                    <h2>Opening</h2>
                  </div>
                  <div className="fields-stack">
                    <NumericField
                      label="Opening width"
                      value={round(
                        selected.geometry.operands[1].dimensions.width *
                          openingScale(selected).width,
                      )}
                      onChange={(width) =>
                        void propose(
                          directPlan({
                            type: 'edit_opening',
                            target: selected.id,
                            width,
                            height: null,
                          }),
                        )
                      }
                    />
                    <NumericField
                      label="Opening height"
                      value={round(
                        selected.geometry.operands[1].dimensions.height *
                          openingScale(selected).height,
                      )}
                      onChange={(height) =>
                        void propose(
                          directPlan({
                            type: 'edit_opening',
                            target: selected.id,
                            width: null,
                            height,
                          }),
                        )
                      }
                    />
                  </div>
                </div>
              ) : (
                !isProfile(selected) &&
                !isReference(selected) && (
                  <div className="selection-actions">
                    <button
                      disabled={
                        selected.dimensions.width < 0.3 ||
                        selected.dimensions.height < 0.2
                      }
                      onClick={() => {
                        const width = round(
                            Math.min(1.2, selected.dimensions.width * 0.3),
                          ),
                          height = round(
                            Math.min(2.1, selected.dimensions.height * 0.7),
                          );
                        void propose({
                          intent: 'apply',
                          message: `Cut a centered ${width} × ${height} m opening through ${selected.name}, along its local depth.`,
                          operations: [
                            {
                              type: 'opening',
                              target: selected.id,
                              width,
                              height,
                              sill: 0,
                              offset: 0,
                            },
                          ],
                        });
                      }}
                    >
                      Cut opening
                    </button>
                  </div>
                )
              )}
              {selected.geometry?.kind === 'boolean' && (
                <div className="recipe-summary">
                  <span>Operation history</span>
                  <strong>{selected.geometry.operation}</strong>
                  {selected.geometry.operands.map((v) => (
                    <p key={v.id}>{v.name}</p>
                  ))}
                </div>
              )}
              <div className="selection-actions">
                <button onClick={() => run('duplicate selected')}>
                  <Copy size={14} />
                  Duplicate
                </button>
                <button
                  aria-label={
                    (project.selectedIds?.length ?? 0) > 1
                      ? 'Delete selected volumes'
                      : 'Delete volume'
                  }
                  title="Delete selection"
                  onClick={() => run('delete selected')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </>
          ) : (
            <div className="nothing-selected">
              <MousePointer2 size={28} strokeWidth={1} />
              <h3>Make a selection</h3>
              <p>
                Click a volume in the viewport or scene list to edit its
                geometry.
              </p>
            </div>
          )}
          <div className="precision-note">
            <span className="status-dot" />
            Exact geometry<span>0.001 m precision</span>
          </div>
        </aside>
      </main>
      <footer className="status-bar">
        <span>
          <span className="status-dot" />
          {project.volumes.length} volumes{' '}
          <span className="footer-divider">|</span>
          {selected
            ? `${project.selectedIds?.length || 1} selected`
            : 'No selection'}
        </span>
        <div className="history-actions" data-version={historyVersion}>
          <button
            aria-label="Undo"
            title="Undo (Ctrl/⌘ Z)"
            disabled={!undo.current.length}
            onClick={() => travel('undo')}
          >
            <Undo2 size={14} />
          </button>
          <button
            aria-label="Redo"
            title="Redo (Ctrl/⌘ Shift Z)"
            disabled={!redo.current.length}
            onClick={() => travel('redo')}
          >
            <Redo2 size={14} />
          </button>
          <span className="footer-divider">|</span>
        </div>
      </footer>
      {settingsOpen && (
        <ConnectionDialog
          state={connectionState}
          onClose={() => setSettingsOpen(false)}
          onRefresh={async () => setConnectionState(await connection())}
        />
      )}
    </div>
  );
}
function ConnectionDialog({
  state,
  onClose,
  onRefresh,
}: {
  state: Connection;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog ref={dialog} className="connection-dialog" onCancel={onClose}>
      <div className="dialog-heading">
        <h2>Connect your workspace</h2>
        <button aria-label="Close connection settings" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <p>
        {state.configured
          ? 'The model service is configured on this application server.'
          : 'Natural conversation and voice require the ATELIER application server with an API credential. Direct modeling, project import/export and saved geometry remain available.'}
      </p>
      {!state.configured && (
        <p>
          Configure <code>ATELIER_OPENAI_API_KEY</code> securely on the server,
          then restart it. Never add a provider key to this browser or the
          GitHub Pages build. See the repository setup instructions.
        </p>
      )}
      {!state.authenticated && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await fetch('/api/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password }),
            });
            setPassword('');
            if (r.ok) {
              await onRefresh();
              onClose();
            } else setError('The workspace password was not accepted.');
          }}
        >
          <label>
            Workspace password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit">Unlock workspace</button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      <button onClick={() => void onRefresh()}>Check connection</button>
      <p className="field-note">
        Text requests share your instruction and scene metadata with the
        configured model. Voice also sends microphone audio while enabled. Stop
        the microphone to end the session.
      </p>
    </dialog>
  );
}
