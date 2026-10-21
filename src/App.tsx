import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  Box,
  Check,
  ChevronRight,
  Command,
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
  Terminal,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import Viewport, { type Tool } from './Viewport';
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
function load(): { project: Project; message: string } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return {
      project: saved ? parseProject(saved) : initialProject(),
      message: saved
        ? 'Saved workspace restored.'
        : 'Your workspace is ready. Start with a volume or a command.',
    };
  } catch {
    return {
      project: initialProject(),
      message: 'Saved data could not be restored. A sample workspace is open.',
    };
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
  const [project, setProject] = useState(boot.project);
  const current = useRef(project);
  current.current = project;
  const undo = useRef<Project[]>([]);
  const redo = useRef<Project[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [tool, setTool] = useState<Tool>('select');
  const [snap, setSnap] = useState(true);
  const [view, setView] = useState<{
    mode: 'perspective' | 'top';
    revision: number;
  }>({ mode: 'perspective', revision: 0 });
  const [command, setCommand] = useState('');
  const [notice, setNotice] = useState({ text: boot.message, error: false });
  const [guide, setGuide] = useState(false);
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
  const select = useCallback(
    (id: string | null) => setProject((p) => ({ ...p, selectedId: id })),
    [],
  );
  const run = useCallback(
    (text: string) => {
      try {
        const result = executeCommand(current.current, text);
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
      localStorage.setItem(STORAGE_KEY, serializeProject(project));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [project]);
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
      if (editing || guide) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        travel(e.shiftKey ? 'redo' : 'undo');
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        run('duplicate selected');
      } else if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
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
  }, [run, select, travel, guide]);
  function exportProject() {
    const url = URL.createObjectURL(
      new Blob([serializeProject(project)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'atelier-project.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice({ text: 'Project exported as JSON.', error: false });
  }
  const area = round(
    project.volumes.reduce(
      (sum, v) => sum + v.dimensions.width * v.dimensions.depth,
      0,
    ),
  );
  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="./" aria-label="ATELIER home">
          <span className="brand-mark">A</span> ATELIER
          <span className="beta">LAB</span>
        </a>
        <div className="project-title">
          <span>Workspace</span>
          <ChevronRight size={13} />
          <strong>Untitled study</strong>
          <span className="project-dot" />
        </div>
        <div className="header-actions">
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
              if (f.size > 1_000_000)
                throw new Error('Project file is too large.');
              commit(parseProject(await f.text()));
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
                className={`object-row ${selected?.id === v.id ? 'selected' : ''}`}
                key={v.id}
                onClick={() => select(v.id)}
                aria-pressed={selected?.id === v.id}
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
            onClick={() => run(COMMAND_EXAMPLES[0])}
          >
            <Plus size={15} />
            Create volume<span>+</span>
          </button>
          <div className="project-summary">
            <div>
              <span>VOLUMES</span>
              <strong>{String(project.volumes.length).padStart(2, '0')}</strong>
            </div>
            <div>
              <span>GROSS FOOTPRINT</span>
              <strong>
                {area.toLocaleString()}
                <small> m²</small>
              </strong>
            </div>
          </div>
          <div className="sidebar-note">
            <span className="small-label">FROM THOUGHT TO FORM</span>
            <p>
              Space to explore.
              <br />
              Precision to build.
            </p>
            <span className="version">ATELIER / EARLY ACCESS 0.1</span>
          </div>
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
            />
            <div className="viewport-heading">
              <span className="small-label">SPATIAL STUDY / 001</span>
              <h1>Shape your next idea.</h1>
              <p>Every great space starts with a simple form.</p>
            </div>
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
          <div className="command-area">
            <div className="command-topline">
              <span>
                <Terminal size={13} /> COMMAND STUDIO{' '}
                <span className="local-badge">LOCAL</span>
              </span>
              <button onClick={() => setGuide(true)}>
                Command guide
                <ArrowUpRight size={13} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (run(command)) setCommand('');
              }}
            >
              <span className="command-prompt">›</span>
              <input
                ref={input}
                aria-label="Geometry command"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="create volume width 12 depth 8 height 6"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd>⌘ / Ctrl K</kbd>
              <button
                type="submit"
                aria-label="Run command"
                disabled={!command.trim()}
              >
                <ArrowUpRight size={19} />
              </button>
            </form>
            <div
              className={`command-feedback ${notice.error ? 'error' : ''}`}
              role={notice.error ? 'alert' : 'status'}
            >
              {notice.error ? <X size={12} /> : <Check size={12} />}
              <span>{notice.text}</span>
            </div>
          </div>
        </section>
        <aside className="inspector-panel">
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
                  <span className="small-label">RECTANGULAR VOLUME</span>
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
                    {round(
                      selected.dimensions.width *
                        selected.dimensions.depth *
                        selected.dimensions.height,
                    ).toLocaleString()}{' '}
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
          {selected ? '1 selected' : 'No selection'}
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
      {guide && (
        <CommandGuide
          onClose={() => setGuide(false)}
          onChoose={(text) => {
            setCommand(text);
            setGuide(false);
            setTimeout(() => input.current?.focus(), 0);
          }}
        />
      )}
    </div>
  );
}
function CommandGuide({
  onClose,
  onChoose,
}: {
  onClose: () => void;
  onChoose: (text: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="command-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-heading">
        <div>
          <Command size={20} />
          <h2>From words to volumes.</h2>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close command guide"
        >
          <X size={18} />
        </button>
      </div>
      <p>
        Use these exact commands to shape your model. This first version uses a
        local command parser, not a connected AI model.
      </p>
      <div className="command-examples">
        {COMMAND_EXAMPLES.map((text) => (
          <button key={text} onClick={() => onChoose(text)}>
            <code>{text}</code>
            <ArrowUpRight size={15} />
          </button>
        ))}
      </div>
      <p className="guide-note">
        Dimensions are width × depth × height in meters. Move sets the absolute
        base-center position. Rotate sets yaw in degrees around Y. Dimensions:
        0.1–500 m. Coordinates: ±1,000 m; Y ≥ 0. Changes support undo.
      </p>
    </dialog>
  );
}
