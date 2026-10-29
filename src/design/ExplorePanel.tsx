import { useState } from 'react';
import { X, Layers3, DoorOpen, Camera, GitBranch, ArrowUp } from 'lucide-react';
import type { Project } from '../model';
import type { Operation } from '../intelligence/plan';
import { componentRoles, assembled, type Exploration } from './schema';
import { componentInfo } from './model';
import { useFloatingPanel } from '../studio/useFloatingPanel';
export default function ExplorePanel({
  project,
  value,
  onExplore,
  onOperation,
  onClose,
  onView,
  onPreview,
  preview,
  onKeep,
  onAxonometric,
  guides,
  onGuides,
}: {
  project: Project;
  value: Exploration;
  onExplore: (v: Exploration) => void;
  onOperation: (op: Operation) => void;
  onClose: () => void;
  onView: (name: string) => void;
  onPreview: (name: string | null) => void;
  preview: string | null;
  onKeep: () => void;
  onAxonometric: () => void;
  guides: boolean;
  onGuides: (value: boolean) => void;
}) {
  const floating = useFloatingPanel();
  const [tab, setTab] = useState<
    'explore' | 'components' | 'views' | 'options'
  >('explore');
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'all' | 'selection'>('all');
  const movable = project.volumes.filter(
    (v) => componentInfo(v).motion !== 'none',
  );
  const selected = project.volumes.find((v) => v.id === project.selectedId),
    info = selected ? componentInfo(selected) : null;
  const targets = project.selectedIds?.length
    ? project.selectedIds
    : selected
      ? [selected.id]
      : [];
  const update = (patch: Partial<NonNullable<typeof info>>) => {
    if (info)
      onOperation({
        type: 'component',
        targets,
        settings: { ...info, ...patch },
      });
  };
  return (
    <section
      className="section-panel explore-panel"
      aria-label="Explore design"
      ref={floating.ref}
      style={floating.style}
      onPointerDownCapture={floating.raise}
    >
      <div
        className="studio-panel-heading panel-drag-handle"
        {...floating.handle}
      >
        <strong>Explore your design</strong>
        <button aria-label="Close explore" onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      <nav className="explore-tabs" aria-label="Explore sections">
        {(['explore', 'components', 'views', 'options'] as const).map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t === 'options' ? 'Alternatives' : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>
      {tab === 'explore' && (
        <>
          <div className="explore-intro">
            <strong>See how it comes together.</strong>
            <p>Separate the assembly, look inside, then put it back.</p>
          </div>
          <div className="explore-modes">
            {(
              [
                { mode: 'exploded', label: 'Separate parts', Icon: Layers3 },
                { mode: 'roof', label: 'Lift roof', Icon: ArrowUp },
                { mode: 'open', label: 'Open components', Icon: DoorOpen },
              ] as const
            ).map(({ mode, label, Icon }) => (
              <button
                key={mode}
                aria-pressed={value.mode === mode}
                disabled={
                  mode === 'open'
                    ? movable.length === 0
                    : mode === 'roof'
                      ? !project.volumes.some(
                          (v) => componentInfo(v).role === 'roof',
                        )
                      : false
                }
                onClick={() =>
                  onExplore({
                    mode,
                    amount: 1,
                    targets: scope === 'selection' ? targets : [],
                  })
                }
              >
                <Icon size={22} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="explore-view-actions">
            <button onClick={onAxonometric}>
              <Layers3 size={16} />
              Axonometric view
            </button>
            <select
              aria-label="Explore scope"
              value={scope}
              onChange={(e) => {
                const next = e.target.value as 'all' | 'selection';
                setScope(next);
                onExplore({
                  ...value,
                  targets: next === 'selection' ? targets : [],
                });
              }}
            >
              <option value="all">Whole model</option>
              <option value="selection" disabled={!targets.length}>
                Selection
              </option>
            </select>
          </div>
          {value.mode === 'exploded' && (
            <label className="explore-guides">
              <input
                type="checkbox"
                checked={guides}
                onChange={(e) => onGuides(e.target.checked)}
              />
              Assembly guides
            </label>
          )}
          <label>
            Explore amount <output>{Math.round(value.amount * 100)}%</output>
            <input
              aria-label="Explore amount"
              type="range"
              min="0"
              max="1"
              step=".01"
              value={value.amount}
              onChange={(e) =>
                onExplore({ ...value, amount: Number(e.target.value) })
              }
            />
          </label>
          <button
            className="primary-studio-action"
            onClick={() => onExplore(assembled)}
          >
            Reassemble
          </button>
          <p className="studio-caption">
            {value.mode === 'open'
              ? 'Tap a movable part in the model to open or close it.'
              : 'Floors stay aligned, facades separate outward, and attached parts stay together.'}{' '}
            Your original model stays unchanged.
          </p>
          {movable.length > 0 && (
            <details className="interactive-components">
              <summary>
                Doors & movable parts <span>{movable.length}</span>
              </summary>
              <div>
                {movable.map((v) => {
                  const open =
                    value.mode === 'open' &&
                    value.amount > 0 &&
                    (!value.targets.length || value.targets.includes(v.id));
                  return (
                    <button
                      key={v.id}
                      aria-label={`${open ? 'Close' : 'Open'} ${v.name}`}
                      aria-pressed={open}
                      onClick={() => {
                        const active = new Set(
                          value.mode === 'open' && value.amount
                            ? value.targets.length
                              ? value.targets
                              : movable.map((v) => v.id)
                            : [],
                        );
                        if (open) active.delete(v.id);
                        else active.add(v.id);
                        onExplore(
                          active.size
                            ? { mode: 'open', amount: 1, targets: [...active] }
                            : assembled,
                        );
                      }}
                    >
                      <DoorOpen size={17} />
                      <span>{v.name}</span>
                      <small>{open ? 'Close' : 'Open'}</small>
                    </button>
                  );
                })}
              </div>
            </details>
          )}
          {!movable.length && (
            <p className="studio-caption">
              Assign a hinge or slide in Components to make a part interactive.
            </p>
          )}
          {selected && (
            <button
              onClick={() => {
                setTab('components');
              }}
            >
              Configure {selected.name}
            </button>
          )}
        </>
      )}
      {tab === 'components' &&
        (!selected || !info ? (
          <p>Select an element to describe how it belongs and moves.</p>
        ) : (
          <>
            <p className="explore-selection">
              {targets.length > 1
                ? `${targets.length} selected components`
                : selected.name}
            </p>
            <label>
              Element role
              <select
                aria-label="Element role"
                value={info.role}
                onChange={(e) =>
                  update({ role: e.target.value as typeof info.role })
                }
              >
                {componentRoles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Belongs to
              <select
                aria-label="Component host"
                value={info.hostId ?? ''}
                onChange={(e) => update({ hostId: e.target.value || null })}
              >
                <option value="">Independent</option>
                {project.volumes
                  .filter((v) => !targets.includes(v.id))
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Level
              <input
                aria-label="Component level"
                key={selected.id + 'level' + info.level}
                defaultValue={info.level ?? ''}
                placeholder="Ground floor"
                maxLength={80}
                onBlur={(e) => {
                  if (e.target.value !== (info.level ?? ''))
                    update({ level: e.target.value || null });
                }}
              />
            </label>
            <label>
              Movement
              <select
                aria-label="Component movement"
                value={info.motion}
                onChange={(e) =>
                  update({ motion: e.target.value as typeof info.motion })
                }
              >
                <option value="none">Fixed</option>
                <option value="hinge-left">Left hinge</option>
                <option value="hinge-right">Right hinge</option>
                <option value="slide-x">Slide sideways</option>
                <option value="slide-z">Slide forward</option>
              </select>
            </label>
            {info.motion.startsWith('slide') && (
              <label>
                Travel · m
                <input
                  aria-label="Slide travel"
                  type="number"
                  min="0"
                  max="20"
                  step=".1"
                  value={info.travel}
                  onChange={(e) => update({ travel: Number(e.target.value) })}
                />
              </label>
            )}
            {info.motion !== 'none' && (
              <button
                className="primary-studio-action"
                onClick={() =>
                  onExplore({
                    mode: 'open',
                    amount: value.mode === 'open' && value.amount ? 0 : 1,
                    targets,
                  })
                }
              >
                {value.mode === 'open' && value.amount ? 'Close' : 'Open'}{' '}
                selected
              </button>
            )}
            {selected.geometry?.kind === 'building' && (
              <button
                onClick={() =>
                  onOperation({ type: 'components', target: selected.id })
                }
              >
                Make building parts editable
              </button>
            )}
            {info.role === 'room' && (
              <>
                <p className="studio-caption">
                  This element describes the room envelope. Furniture layouts
                  check its rectangular bounds and existing objects.
                </p>
                {(['meeting', 'classroom', 'lounge'] as const).map((layout) => (
                  <button
                    key={layout}
                    onClick={() =>
                      onOperation({
                        type: 'furnish',
                        room: selected.id,
                        layout,
                        clearance: 0.8,
                      })
                    }
                  >
                    Try {layout} layout
                  </button>
                ))}
              </>
            )}
          </>
        ))}
      {tab === 'views' && (
        <>
          <p className="studio-caption">
            Return to a viewpoint or inspect a room cutaway. Ask “show each
            room” after identifying room envelopes.
          </p>
          <label>
            View name
            <input
              aria-label="View name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button
            disabled={!name.trim()}
            onClick={() => {
              onOperation({
                type: 'save_view',
                name: name.trim(),
                targets: [],
                cutaway: false,
              });
              setName('');
            }}
          >
            <Camera size={15} /> Save this viewpoint
          </button>
          <button
            disabled={!selected}
            onClick={() =>
              onOperation({
                type: 'save_view',
                name: name.trim() || selected!.name,
                targets,
                cutaway: true,
              })
            }
          >
            Save selected cutaway
          </button>
          <button
            disabled={
              !project.volumes.some((v) => v.component?.role === 'room')
            }
            onClick={() => onOperation({ type: 'room_views' })}
          >
            Create room views
          </button>
          <div className="explore-cards">
            {project.design?.views.map((v) => (
              <button key={v.name} onClick={() => onView(v.name)}>
                <Camera size={16} />
                {v.name}
                <small>{v.section ? 'Cutaway' : 'Viewpoint'}</small>
              </button>
            ))}
          </div>
        </>
      )}
      {tab === 'options' && (
        <>
          <p className="studio-caption">
            Save versions of your design, compare them from the same camera,
            then keep your choice. Ask the assistant to create alternatives.
          </p>
          <label>
            Alternative name
            <input
              aria-label="Alternative name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button
            disabled={!name.trim() || !!preview}
            onClick={() => {
              onOperation({
                type: 'alternative',
                action: 'save',
                name: name.trim(),
              });
              setName('');
            }}
          >
            <GitBranch size={15} /> Save current design
          </button>
          <div className="explore-cards">
            {project.design?.options.map((o) => (
              <div key={o.name}>
                <button
                  aria-pressed={preview === o.name}
                  onClick={() => onPreview(o.name)}
                >
                  <GitBranch size={16} />
                  {o.name}
                  <small>{o.volumes.length} elements</small>
                </button>
                <button
                  aria-label={`Delete alternative ${o.name}`}
                  onClick={() => {
                    if (preview === o.name) onPreview(null);
                    onOperation({
                      type: 'alternative',
                      action: 'delete',
                      name: o.name,
                    });
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          {preview && (
            <div className="explore-choice">
              <strong>Previewing {preview}</strong>
              <button className="primary-studio-action" onClick={onKeep}>
                Keep this alternative
              </button>
              <button onClick={() => onPreview(null)}>
                Back to current design
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
