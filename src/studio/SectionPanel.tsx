import { X, FlipVertical2 } from 'lucide-react';
import type { Project } from '../model';
import { useFloatingPanel } from './useFloatingPanel';
import { sectionRange, type SectionView } from './section';
export default function SectionPanel({
  project,
  value,
  onChange,
  onClose,
}: {
  project: Project;
  value: SectionView;
  onChange: (v: SectionView) => void;
  onClose: () => void;
}) {
  const floating = useFloatingPanel(),
    range = sectionRange(project, value.axis);
  return (
    <section
      className="section-panel"
      aria-label="Section controls"
      ref={floating.ref}
      style={floating.style}
      onPointerDownCapture={floating.raise}
    >
      <div
        className="studio-panel-heading panel-drag-handle"
        {...floating.handle}
        role="button"
        tabIndex={0}
        aria-label="Move section panel"
      >
        <strong>Look inside</strong>
        <button aria-label="Close section controls" onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      <div className="section-switches">
        <label>
          <input
            type="checkbox"
            aria-label="Section cut"
            checked={value.enabled}
            onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
          />
          Section on
        </label>
        <label>
          <input
            type="checkbox"
            aria-label="Show section plane"
            checked={!!value.planeVisible}
            onChange={(e) =>
              onChange({ ...value, planeVisible: e.target.checked })
            }
          />
          Show section plane
        </label>
      </div>
      <div className="theme-options">
        {(['x', 'y', 'z'] as const).map((axis) => (
          <button
            key={axis}
            aria-pressed={value.axis === axis}
            onClick={() => {
              const r = sectionRange(project, axis);
              onChange({
                ...value,
                axis,
                position: (r.min + r.max) / 2,
              });
            }}
          >
            {axis === 'y'
              ? 'Horizontal'
              : axis === 'x'
                ? 'Across X'
                : 'Across Z'}
          </button>
        ))}
      </div>
      <label>
        Cut position <output>{value.position.toFixed(2)} m</output>
        <input
          aria-label="Section position"
          type="range"
          min={range.min}
          max={range.max}
          step="0.01"
          value={value.position}
          onChange={(e) =>
            onChange({ ...value, position: Number(e.target.value) })
          }
        />
      </label>
      <label className="section-exact">
        Exact position · m
        <input
          aria-label="Exact section position"
          type="number"
          step="0.1"
          min="-1000"
          max="1000"
          value={value.position}
          onChange={(e) => {
            const position = Number(e.target.value);
            if (Number.isFinite(position) && Math.abs(position) <= 1000)
              onChange({ ...value, position });
          }}
        />
      </label>
      <div className="section-actions">
        <button
          aria-pressed={value.flip}
          onClick={() => onChange({ ...value, flip: !value.flip })}
        >
          <FlipVertical2 size={14} />
          Flip side
        </button>
        <button
          aria-pressed={value.enabled}
          onClick={() => onChange({ ...value, enabled: !value.enabled })}
        >
          {value.enabled ? 'Show whole model' : 'Enable section'}
        </button>
      </div>
      <p className="studio-caption">
        Drag the amber plane edge or handle to move the cut. Hide the plane for
        a clean view; turn Section off to see the whole model. Position and
        direction are kept.
      </p>
    </section>
  );
}
