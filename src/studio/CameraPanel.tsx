import { X } from 'lucide-react';
import { useFloatingPanel } from './useFloatingPanel';
import type { CameraSettings } from './camera';
export default function CameraPanel({
  value,
  onChange,
  onClose,
}: {
  value: CameraSettings;
  onChange: (v: CameraSettings) => void;
  onClose: () => void;
}) {
  const floating = useFloatingPanel();
  return (
    <section
      className="section-panel camera-panel"
      aria-label="Camera controls"
      ref={floating.ref}
      style={floating.style}
      onPointerDownCapture={floating.raise}
    >
      <div
        className="studio-panel-heading panel-drag-handle"
        {...floating.handle}
        role="button"
        tabIndex={0}
        aria-label="Move camera controls"
      >
        <strong>Feel the space</strong>
        <button aria-label="Close camera controls" onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      <div className="theme-options">
        {[false, true].map((walk) => (
          <button
            key={String(walk)}
            aria-pressed={value.walk === walk}
            onClick={() =>
              onChange({ ...value, walk, fov: walk ? 65 : value.fov })
            }
          >
            {walk ? 'Walk inside' : 'Orbit'}
          </button>
        ))}
      </div>
      <label>
        Field of view <output>{value.fov}°</output>
        <input
          aria-label="Field of view"
          type="range"
          min="20"
          max="100"
          value={value.fov}
          onChange={(e) => onChange({ ...value, fov: Number(e.target.value) })}
        />
      </label>
      {value.walk && (
        <>
          <label>
            Eye height · m
            <input
              aria-label="Eye height"
              type="number"
              min=".5"
              max="2.5"
              step=".05"
              value={value.eyeHeight}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (n >= 0.5 && n <= 2.5) onChange({ ...value, eyeHeight: n });
              }}
            />
          </label>
          <label>
            Floor elevation · m
            <input
              aria-label="Walk floor elevation"
              type="number"
              min="0"
              max="1000"
              step=".1"
              value={value.level}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (n >= 0 && n <= 1000) onChange({ ...value, level: n });
              }}
            />
          </label>
          <p className="studio-caption">
            Click the canvas, then W A S D or arrow keys to walk. Drag to look.
            Shift moves faster. This visual walkthrough has no collision
            detection.
          </p>
        </>
      )}
      <details>
        <summary>Lens focus</summary>
        <label>
          Depth blur
          <input
            aria-label="Depth blur"
            type="range"
            min="0"
            max="1"
            step=".05"
            value={value.blur}
            onChange={(e) =>
              onChange({ ...value, blur: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Focus distance · m
          <input
            aria-label="Focus distance"
            type="number"
            min="1"
            max="1000"
            value={value.focus}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n >= 1 && n <= 1000) onChange({ ...value, focus: n });
            }}
          />
        </label>
        <p className="studio-caption">
          Optional photographic effect. Perspective view only.
        </p>
      </details>
    </section>
  );
}
