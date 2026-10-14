import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  Box,
  Check,
  ChevronRight,
  Copy,
  Focus,
  Grid2X2,
  Layers,
  Maximize,
  MousePointer2,
  Move3D,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Mic,
  MicOff,
  PanelRightClose,
  PanelRightOpen,
  Settings2,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
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
const SESSION_KEY = 'atelier.session.v2';
const CHAT_KEY = 'atelier.conversation.v2';

import {
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
      : [];
  } catch {
    return [];
  }
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
export default function App() {
  const [boot] = useState(load);
  const [project, setProject] = useState(boot.session.project);
  const current = useRef(project);
  current.current = project;
  const undo = useRef<Project[]>(boot.session.past);
  const redo = useRef<Project[]>(boot.session.future);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [tool, setTool] = useState<Tool>('select');
  const [snap, setSnap] = useState(true);
  const [view, setView] = useState<{
    mode: 'perspective' | 'top';
    revision: number;
  }>({ mode: 'perspective', revision: 0 });
  const [command, setCommand] = useState('');
  const [notice, setNotice] = useState({ text: boot.message, error: false });
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(true);
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const conversation = useRef(boot.session.context);
  const camera = useRef<CameraContext>(defaultCamera);
  const [connectionState, setConnectionState] = useState<Connection>({
    configured: false,
    authenticated: true,
    voiceConfigured: false,
  });
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [pending, setPending] = useState<{
    plan: Plan;
    fingerprint: string;
    camera: CameraContext;
  } | null>(null);
  const [voiceStatus, setVoiceStatus] = useState('Off');
  const voice = useRef<VoiceConnection | null>(null);
  const [primitive, setPrimitive] = useState<
    'box' | 'cylinder' | 'sphere' | 'rectangle' | 'circle'
  >('box');
  const [measuredVolume, setMeasuredVolume] = useState<number | null>(null);
  const snapshot = (): Session => ({
    project: current.current,
    past: undo.current,
    future: redo.current,
    context: conversation.current,
  });
  const remember = (role: Message['role'], content: string) =>
    setMessages((m) => [...m.slice(-79), { role, content }]);
  const install = (session: Session) => {
    current.current = session.project;
    undo.current = session.past;
    redo.current = session.future;
    conversation.current = session.context;
    setProject(session.project);
    setHistoryVersion((v) => v + 1);
  };
  const fingerprint = () => serializeProject(current.current);
  const reviewName = (ref: string): string => {
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
  const execute = async (
    plan: Plan,
    confirmed = false,
    frame = camera.current,
  ) => {
    const before = fingerprint();
    const result = await applyPlan(snapshot(), plan, frame, confirmed);
    if (before !== fingerprint())
      throw new Error(
        'The scene changed while this edit was being prepared. Please try again.',
      );
    install(result.session);
    setNotice({ text: result.message, error: false });
    return result.message;
  };
  const propose = async (plan: Plan) => {
    try {
      if (needsConfirmation(plan)) {
        setPending({
          plan,
          fingerprint: fingerprint(),
          camera: structuredClone(camera.current),
        });
        return;
      }
      const message = await execute(plan);
      remember('assistant', message);
    } catch (e) {
      reportError(e);
    }
  };
  const sendConversation = async (text: string): Promise<string> => {
    if (busyRef.current) return 'Please wait for the current edit to finish.';
    busyRef.current = true;
    setBusy(true);
    setPending(null);
    const before = fingerprint();
    const frame = structuredClone(camera.current);
    const history = [...messagesRef.current];
    remember('user', text);
    try {
      const plan = await requestPlan(
        text,
        snapshot(),
        frame,
        history,
        AbortSignal.timeout(60_000),
      );
      if (before !== fingerprint())
        throw new Error(
          'The scene changed while I was considering this request. Please send it again.',
        );
      if (plan.intent === 'clarify') {
        remember('assistant', plan.message);
        return plan.message;
      }
      if (needsConfirmation(plan)) {
        setPending({ plan, fingerprint: before, camera: frame });
        const message =
          plan.message +
          ' Review the identified objects below before applying.';
        remember('assistant', message);
        return message;
      }
      const result = await execute(plan, false, frame);
      remember('assistant', result);
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
  const input = useRef<HTMLInputElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const selected = project.volumes.find((v) => v.id === project.selectedId);
  const commit = useCallback((next: Project) => {
    if (JSON.stringify(next) === JSON.stringify(current.current)) return;
    undo.current = [...undo.current.slice(-49), current.current];
    redo.current = [];
    current.current = next;
    setProject(next);
    setHistoryVersion((v) => v + 1);
  }, []);
  const reportError = (e: unknown) =>
    setNotice({
      text:
        e instanceof Error
          ? e.message
          : 'The operation could not be completed.',
      error: true,
    });
  const change = useCallback(
    (id: string, patch: Partial<Volume>) => {
      try {
        commit(updateVolume(current.current, id, patch));
        setNotice({ text: 'Geometry updated.', error: false });
      } catch (e) {
        reportError(e);
      }
    },
    [commit],
  );
  const select = useCallback((id: string | null, additive = false) => {
    const p = current.current;
    const ids = id
      ? additive
        ? [
            ...new Set([
              ...(p.selectedIds ?? (p.selectedId ? [p.selectedId] : [])),
              id,
            ]),
          ]
        : [id]
      : [];
    const next = { ...p, selectedId: id, selectedIds: ids };
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
    destination.push(current.current);
    current.current = next;
    setProject(next);
    setHistoryVersion((v) => v + 1);
    setNotice({
      text: direction === 'undo' ? 'Change undone.' : 'Change restored.',
      error: false,
    });
  }, []);
  useEffect(() => {
    try {
      if (!boot.storageSafe) {
        setSaved(false);
        return;
      }
      localStorage.setItem(
        SESSION_KEY,
        serializeSession({
          project,
          past: undo.current,
          future: redo.current,
          context: conversation.current,
        }),
      );
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [project, historyVersion, boot.storageSafe]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const editing =
        e.target instanceof HTMLElement &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) ||
          e.target.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.current?.focus();
        return;
      }
      if (editing || settingsOpen) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        travel(e.shiftKey ? 'redo' : 'undo');
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        run('duplicate selected');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        run('delete selected');
      } else if (e.key.toLowerCase() === 'v') setTool('select');
      else if (e.key.toLowerCase() === 'g') setTool('translate');
      else if (e.key.toLowerCase() === 'r') setTool('rotate');
      else if (e.key.toLowerCase() === 'f')
        setView((v) => ({ ...v, revision: v.revision + 1 }));
      else if (e.key === 'Escape') select(null);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [run, select, travel, settingsOpen]);
  function exportProject() {
    const url = URL.createObjectURL(
      new Blob([serializeSession(snapshot())], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'atelier-project.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice({ text: 'Project exported as JSON.', error: false });
  }
  useEffect(() => {
    let active = true;
    setMeasuredVolume(null);
    if (selected) {
      if (isProfile(selected)) setMeasuredVolume(0);
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
  }, [selected]);

  return (
    <div
      className={`app-shell phase-two ${inspectorOpen ? '' : 'inspector-collapsed'}`}
    >
      <header className="app-header">
        <a className="brand" href="./" aria-label="ATELIER home">
          <span className="brand-mark">A</span> ATELIER
        </a>
        <div className="project-title">
          <span>Workspace</span>
          <ChevronRight size={13} />
          <strong>Untitled study</strong>
          <span className="project-dot" />
        </div>
        <div className="header-actions">
          <button
            className="connection-button"
            onClick={() => setSettingsOpen(true)}
          >
            <span
              className={`status-dot ${connectionState.configured ? '' : 'offline'}`}
            />
            {connectionState.configured
              ? connectionState.authenticated
                ? 'AI configured'
                : 'Unlock AI'
              : 'Connect AI'}
          </button>
          <button
            className="icon-button"
            aria-label={
              inspectorOpen ? 'Collapse inspector' : 'Expand inspector'
            }
            onClick={() => setInspectorOpen(!inspectorOpen)}
          >
            {inspectorOpen ? (
              <PanelRightClose size={17} />
            ) : (
              <PanelRightOpen size={17} />
            )}
          </button>
          <span className={`save-state ${!saved ? 'warning' : ''}`}>
            <span className="status-dot" />
            {saved
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
        </div>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          aria-label="Import project file"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              if (f.size > 10_000_000)
                throw new Error('Project file is too large.');
              const text = await f.text();
              const raw = JSON.parse(text);
              if (raw.project && raw.past) {
                const imported = parseSession(text);
                // Preserve the receiving session and the imported timeline. The
                // latest snapshot remains undo-import; older snapshots are the
                // imported history, within the documented 50-step limit.
                localStorage.setItem(
                  'atelier.session.v2.before-import',
                  serializeSession(snapshot()),
                );
                undo.current = [...imported.past.slice(-49), current.current];
                redo.current = imported.future;
                conversation.current = imported.context;
                current.current = imported.project;
                setProject(imported.project);
                setHistoryVersion((v) => v + 1);
              } else commit(parseProject(text));
              setNotice({
                text: 'Project imported. Undo is available.',
                error: false,
              });
            } catch (err) {
              reportError(err);
            }
            e.target.value = '';
          }}
        />
      </header>
      <main className="workspace">
        <aside className="objects-panel">
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
          <div className="object-list">
            {project.volumes.map((v, i) => (
              <button
                className={`object-row ${project.selectedIds?.includes(v.id) || selected?.id === v.id ? 'selected' : ''}`}
                key={v.id}
                onClick={(e) =>
                  select(v.id, e.shiftKey || e.ctrlKey || e.metaKey)
                }
                aria-pressed={
                  project.selectedIds?.includes(v.id) || selected?.id === v.id
                }
              >
                <Box size={16} />
                <span>
                  {v.name}
                  <small>
                    {v.dimensions.width} × {v.dimensions.depth} ×{' '}
                    {v.dimensions.height} m
                  </small>
                </span>
                <span className="object-index">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </button>
            ))}
            {!project.volumes.length && (
              <p className="empty-list">
                A blank canvas.
                <br />
                Add your first volume below.
              </p>
            )}
          </div>
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
                    depth: ['circle', 'cylinder', 'sphere'].includes(primitive)
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
          <p className="selection-note">
            Shift-click to select multiple objects.
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
            <button
              className={`view-button ${view.mode === 'top' ? 'active' : ''}`}
              onClick={() =>
                setView((v) => ({
                  mode: v.mode === 'top' ? 'perspective' : 'top',
                  revision: v.revision + 1,
                }))
              }
            >
              <Grid2X2 size={13} />
              {view.mode === 'top' ? 'Top view' : 'Perspective'}
            </button>
          </div>
          <div className="viewport-stage">
            <Viewport
              project={project}
              tool={tool}
              snap={snap}
              view={view}
              onSelect={select}
              onChange={change}
              onCamera={(c) => {
                camera.current = c;
              }}
            />
            <div
              className="tool-palette"
              role="toolbar"
              aria-label="Modeling tools"
            >
              {(
                [
                  {
                    id: 'select',
                    label: 'Select',
                    key: 'V',
                    Icon: MousePointer2,
                  },
                  { id: 'translate', label: 'Move', key: 'G', Icon: Move3D },
                  { id: 'rotate', label: 'Rotate', key: 'R', Icon: RotateCw },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  title={`${t.label} (${t.key})`}
                  aria-label={t.label}
                  aria-pressed={tool === t.id}
                  className={tool === t.id ? 'active' : ''}
                  onClick={() => setTool(t.id)}
                >
                  <t.Icon size={18} strokeWidth={1.5} />
                </button>
              ))}
              <div className="tool-divider" />
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
                Snap {snap ? '0.5 m / 15°' : 'off'}
              </button>
              <span>Grid · 1 m</span>
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
              Drag to orbit <span>·</span> Right-drag to pan <span>·</span>{' '}
              Scroll to zoom
            </div>
          </div>
          <div className="conversation-area">
            <div className="conversation-heading">
              <button
                aria-expanded={chatExpanded}
                onClick={() => setChatExpanded(!chatExpanded)}
              >
                <Sparkles size={14} />
                Atelier<span>{busy ? 'Thinking…' : 'Conversation'}</span>
              </button>
              <span className="voice-status">
                {voiceStatus !== 'Off' ? voiceStatus : ''}
              </span>
            </div>
            {chatExpanded && messages.length > 0 && (
              <div
                ref={log}
                className="conversation-log"
                role="log"
                aria-label="Design conversation"
              >
                {messages.slice(-8).map((m, i) => (
                  <div className={`chat-message ${m.role}`} key={i}>
                    <span>{m.role === 'user' ? 'You' : 'Atelier'}</span>
                    <p>{m.content}</p>
                  </div>
                ))}
              </div>
            )}
            {pending && (
              <div
                className="operation-review"
                role="region"
                aria-label="Review geometry change"
              >
                <strong>Review change</strong>
                <p>{pending.plan.message}</p>
                <p>
                  {pending.plan.operations
                    .map((op) =>
                      op.type === 'boolean'
                        ? `${op.operation}: ${op.targets.map((id) => reviewName(id)).join(' → ')}`
                        : op.type,
                    )
                    .join('; ')}
                </p>
                <span>Original operands and undo history are preserved.</span>
                <div>
                  <button
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
                        const result = await execute(
                          item.plan,
                          true,
                          item.camera,
                        );
                        remember('assistant', result);
                      } catch (e) {
                        reportError(e);
                      }
                    }}
                  >
                    Apply change
                  </button>
                  <button
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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const text = command.trim();
                if (text) {
                  setCommand('');
                  void sendConversation(text);
                }
              }}
            >
              <input
                ref={input}
                aria-label="Message Atelier"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Describe what you want to create or change…"
                autoComplete="off"
                maxLength={4000}
              />
              <button
                type="button"
                className={voiceStatus !== 'Off' ? 'mic-active' : ''}
                aria-label={
                  voiceStatus === 'Off'
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
                    setVoiceStatus,
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
                {voiceStatus === 'Off' ? (
                  <Mic size={18} />
                ) : (
                  <MicOff size={18} />
                )}
              </button>
              <button
                type="submit"
                aria-label="Send message"
                disabled={!command.trim() || busy}
              >
                <ArrowUpRight size={19} />
              </button>
            </form>
            <div
              className={`command-feedback ${notice.error ? 'error' : ''}`}
              role={notice.error ? 'alert' : 'status'}
            >
              <span>{notice.text}</span>
            </div>
          </div>
        </section>
        <aside className="inspector-panel" hidden={!inspectorOpen}>
          <div className="panel-caption">
            <span>INSPECTOR</span>
            <button
              className="icon-button"
              aria-label="Clear selection"
              disabled={!selected}
              onClick={() => select(null)}
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
                  <input
                    key={selected.id + selected.name}
                    aria-label="Object name"
                    defaultValue={selected.name}
                    maxLength={80}
                    onBlur={(e) =>
                      change(selected.id, { name: e.target.value.trim() })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                  />
                </div>
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
                      min={0.1}
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
                    {measuredVolume === null
                      ? '…'
                      : round(measuredVolume).toLocaleString()}{' '}
                    <small>m³</small>
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
                !isProfile(selected) && (
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
                  aria-label="Delete volume"
                  title="Delete volume"
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
          <span>Y UP</span>
          <span>WEBGL</span>
          <Maximize size={12} />
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
