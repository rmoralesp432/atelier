import { useState } from 'react';
import { X } from 'lucide-react';
import type { Volume } from '../model';
import type { Operation } from '../intelligence/plan';
import { useFloatingPanel } from './useFloatingPanel';
type Attach = Extract<Operation, { type: 'attach' }>;
export default function AddVolumePanel({
  volume,
  onAdd,
  onClose,
}: {
  volume: Volume;
  onAdd: (op: Attach) => void;
  onClose: () => void;
}) {
  const floating = useFloatingPanel();
  const [side, setSide] = useState<Attach['side']>('above');
  return (
    <section
      className="section-panel add-volume-panel"
      aria-label="Add adjoining volume"
      ref={floating.ref}
      style={floating.style}
      onPointerDownCapture={floating.raise}
    >
      <div
        className="studio-panel-heading panel-drag-handle"
        {...floating.handle}
        role="button"
        tabIndex={0}
        aria-label="Move add volume panel"
      >
        <strong>Build onto {volume.name}</strong>
        <button aria-label="Close add volume" onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onAdd({
            type: 'attach',
            target: volume.id,
            name: String(f.get('name')),
            side,
            width: Number(f.get('width')),
            depth: Number(f.get('depth')),
            height: Number(f.get('height')),
            gap: Number(f.get('gap')),
            offsetX: 0,
            offsetZ: 0,
            liftExisting: f.get('lift') === 'on',
          });
        }}
      >
        <label>
          Name
          <input
            name="name"
            required
            maxLength={80}
            defaultValue={`Addition ${volume.name}`.slice(0, 80)}
          />
        </label>
        <label>
          Place
          <select
            aria-label="Addition placement"
            value={side}
            onChange={(e) => setSide(e.target.value as Attach['side'])}
          >
            {(
              ['above', 'below', 'left', 'right', 'front', 'back'] as const
            ).map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <div className="addition-dimensions">
          {(['width', 'depth', 'height'] as const).map((k) => (
            <label key={k}>
              {k[0].toUpperCase() + k.slice(1)} · m
              <input
                aria-label={`Addition ${k}`}
                name={k}
                type="number"
                min="0.1"
                max="500"
                step="any"
                required
                defaultValue={k === 'height' ? 3 : volume.dimensions[k]}
              />
            </label>
          ))}
        </div>
        <label>
          Gap · m
          <input
            name="gap"
            type="number"
            min="0"
            max="500"
            step="any"
            defaultValue={0}
            required
          />
        </label>
        {side === 'below' && (
          <label className="addition-lift">
            <input name="lift" type="checkbox" /> Allow lifting the existing
            volume if needed
          </label>
        )}
        <p className="studio-caption">
          Centered and aligned to this volume. Each part stays editable; join
          them later if you want one solid.
        </p>
        <button className="primary-studio-action" type="submit">
          Add volume
        </button>
      </form>
    </section>
  );
}
