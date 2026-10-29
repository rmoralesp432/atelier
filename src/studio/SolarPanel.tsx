import { useEffect, useState } from 'react';
import { X, Play, Pause } from 'lucide-react';
import { useFloatingPanel } from './useFloatingPanel';
import { solarPosition, type SolarStudy } from './solar';
import type { Site } from './site';
export default function SolarPanel({
  site,
  value,
  onChange,
  onLocation,
  onClose,
}: {
  site?: Site;
  value: SolarStudy;
  onChange: (v: SolarStudy) => void;
  onLocation: () => void;
  onClose: () => void;
}) {
  const floating = useFloatingPanel(),
    [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(
      () =>
        onChange({
          ...value,
          minutes: (value.minutes + 15) % 1440,
          enabled: true,
        }),
      350,
    );
    return () => clearTimeout(t);
  }, [playing, value, onChange]);
  const sun = site ? solarPosition(site, value) : null;
  return (
    <section
      className="section-panel solar-panel"
      aria-label="Solar study controls"
      ref={floating.ref}
      style={floating.style}
      onPointerDownCapture={floating.raise}
    >
      <div
        className="studio-panel-heading panel-drag-handle"
        {...floating.handle}
        role="button"
        tabIndex={0}
        aria-label="Move solar study"
      >
        <strong>Follow the sun</strong>
        <button aria-label="Close solar study" onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      {!site ? (
        <>
          <p className="studio-caption">
            Choose the site location to calculate the sun accurately.
          </p>
          <button className="primary-studio-action" onClick={onLocation}>
            Set site location
          </button>
        </>
      ) : (
        <>
          <label className="solar-enable">
            <input
              type="checkbox"
              checked={value.enabled}
              onChange={(e) => {
                setPlaying(false);
                onChange({ ...value, enabled: e.target.checked });
              }}
            />{' '}
            Solar lighting
          </label>
          <label>
            Date
            <input
              aria-label="Solar date"
              type="date"
              value={value.date}
              onChange={(e) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))
                  onChange({ ...value, date: e.target.value });
              }}
            />
          </label>
          <div className="solar-time">
            <strong>
              {`${Math.floor(value.minutes / 60)}`.padStart(2, '0')}:
              {`${value.minutes % 60}`.padStart(2, '0')}
            </strong>
            <button
              aria-label={
                playing ? 'Pause solar animation' : 'Play solar animation'
              }
              onClick={() => setPlaying((v) => !v)}
            >
              {playing ? <Pause size={17} /> : <Play size={17} />}
            </button>
          </div>
          <input
            aria-label="Solar time"
            type="range"
            min="0"
            max="1439"
            step="1"
            value={value.minutes}
            onChange={(e) => {
              setPlaying(false);
              onChange({
                ...value,
                minutes: Number(e.target.value),
                enabled: true,
              });
            }}
          />
          <label>
            UTC offset at the site
            <input
              aria-label="Solar UTC offset"
              type="number"
              min="-12"
              max="14"
              step=".25"
              value={value.utcOffset}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= -12 && n <= 14)
                  onChange({ ...value, utcOffset: n });
              }}
            />
          </label>
          <p className="studio-caption">
            UTC{value.utcOffset >= 0 ? '+' : ''}
            {value.utcOffset} · initially your browser’s timezone. Set the
            site’s offset, including daylight saving time.
          </p>
          <label className="solar-enable">
            <input
              type="checkbox"
              checked={value.path}
              onChange={(e) => onChange({ ...value, path: e.target.checked })}
            />{' '}
            Show sun path
          </label>
          <div className="solar-readout">
            <span>
              Altitude <b>{sun?.altitude.toFixed(1)}°</b>
            </span>
            <span>
              Azimuth <b>{sun?.azimuth.toFixed(1)}°</b>
            </span>
          </div>
          <p className="studio-caption">
            {sun && sun.altitude < 0
              ? 'Sun below the horizon. '
              : 'True-north solar position. '}
            Concept shadow study; no terrain, weather or energy analysis.
          </p>
        </>
      )}
    </section>
  );
}
