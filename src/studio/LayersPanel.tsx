import { useState } from 'react';
import { X, Plus, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import type { Project } from '../model';
import { useFloatingPanel } from './useFloatingPanel';
export default function LayersPanel({
  project,
  onChange,
  onClose,
}: {
  project: Project;
  onChange: (p: Project) => void;
  onClose: () => void;
}) {
  const floating = useFloatingPanel(),
    [name, setName] = useState('');
  return (
    <section
      className="section-panel layers-panel"
      aria-label="Layers and groups"
      ref={floating.ref}
      style={floating.style}
      onPointerDownCapture={floating.raise}
    >
      <div
        className="studio-panel-heading panel-drag-handle"
        {...floating.handle}
        role="button"
        tabIndex={0}
        aria-label="Move layers panel"
      >
        <strong>Organize your space</strong>
        <button aria-label="Close layers" onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      <form
        className="layer-create"
        onSubmit={(e) => {
          e.preventDefault();
          const ids =
            project.selectedIds ??
            (project.selectedId ? [project.selectedId] : []);
          const id = crypto.randomUUID();
          onChange({
            ...project,
            groups: [
              ...(project.groups ?? []),
              {
                id,
                name:
                  name.trim() || `Group ${(project.groups?.length ?? 0) + 1}`,
                visible: true,
                locked: false,
              },
            ],
            volumes: project.volumes.map((v) =>
              ids.includes(v.id) &&
              !project.groups?.find((g) => g.id === v.groupId)?.locked
                ? { ...v, groupId: id }
                : v,
            ),
          });
          setName('');
        }}
      >
        <input
          aria-label="New group name"
          placeholder="Name a group…"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          aria-label="Group selected objects"
          type="submit"
          disabled={(project.groups?.length ?? 0) >= 50}
        >
          <Plus size={17} />
        </button>
      </form>
      <p className="studio-caption">
        Create a group from the selection, or start an empty layer.
      </p>
      {(project.groups ?? []).map((g) => (
        <div className="layer-row" key={g.id}>
          <button
            aria-label={`${g.visible ? 'Hide' : 'Show'} group ${g.name}`}
            onClick={() =>
              onChange({
                ...project,
                groups: project.groups!.map((o) =>
                  o.id === g.id ? { ...o, visible: !g.visible } : o,
                ),
              })
            }
          >
            {g.visible ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <input
            aria-label={`Group name ${g.name}`}
            defaultValue={g.name}
            key={g.name}
            maxLength={80}
            onBlur={(e) => {
              if (e.target.value.trim())
                onChange({
                  ...project,
                  groups: project.groups!.map((o) =>
                    o.id === g.id ? { ...o, name: e.target.value.trim() } : o,
                  ),
                });
            }}
          />
          <small>
            {project.volumes.filter((v) => v.groupId === g.id).length}
          </small>
          <button
            aria-label={`${g.locked ? 'Unlock' : 'Lock'} group ${g.name}`}
            onClick={() =>
              onChange({
                ...project,
                groups: project.groups!.map((o) =>
                  o.id === g.id ? { ...o, locked: !g.locked } : o,
                ),
              })
            }
          >
            {g.locked ? <Lock size={15} /> : <Unlock size={15} />}
          </button>
        </div>
      ))}
      <label className="assign-layer">
        Move selection to
        <select
          aria-label="Assign selection to group"
          defaultValue=""
          onChange={(e) => {
            const ids =
              project.selectedIds ??
              (project.selectedId ? [project.selectedId] : []);
            onChange({
              ...project,
              volumes: project.volumes.map((v) =>
                ids.includes(v.id) &&
                !project.groups?.find((g) => g.id === v.groupId)?.locked
                  ? { ...v, groupId: e.target.value || undefined }
                  : v,
              ),
            });
          }}
        >
          <option value="">Ungrouped</option>
          {project.groups?.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <p className="studio-caption">
        Hidden groups stay saved. Locked groups are protected from edits. Groups
        organize objects; they do not fuse solids.
      </p>
    </section>
  );
}
