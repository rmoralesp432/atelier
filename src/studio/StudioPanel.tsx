import { useState } from 'react';
import { X, UserRound, MapPin, SlidersHorizontal } from 'lucide-react';
import type { Appearance } from './appearance';
import type { Site } from './site';
import { googleMapsUrl, validateSite } from './site';
export default function StudioPanel({
  appearance,
  onAppearance,
  site,
  onSite,
  mapVisible,
  onMap,
  addPerson,
  onClose,
}: {
  appearance: Appearance;
  onAppearance: (a: Appearance) => void;
  site?: Site;
  onSite: (s: Site) => void;
  mapVisible: boolean;
  onMap: (v: boolean) => void;
  addPerson: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'appearance' | 'site'>('appearance');
  const [error, setError] = useState('');
  return (
    <section className="studio-panel" aria-label="Studio settings">
      <div className="studio-panel-heading">
        <strong>Your studio</strong>
        <button aria-label="Close studio settings" onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      <div className="studio-tabs">
        <button
          aria-pressed={tab === 'appearance'}
          onClick={() => setTab('appearance')}
        >
          <SlidersHorizontal size={14} />
          Appearance
        </button>
        <button aria-pressed={tab === 'site'} onClick={() => setTab('site')}>
          <MapPin size={14} />
          Location
        </button>
      </div>
      {tab === 'appearance' ? (
        <>
          <label className="studio-label">View style</label>
          <div className="mode-options">
            {(['studio', 'wireframe', 'hidden-line'] as const).map((mode) => (
              <button
                key={mode}
                aria-pressed={appearance.mode === mode}
                onClick={() => onAppearance({ ...appearance, mode })}
              >
                <span aria-hidden="true" className={`mode-cube ${mode}`}>
                  ◇
                </span>
                {mode === 'studio'
                  ? 'Solid'
                  : mode === 'wireframe'
                    ? 'Wireframe'
                    : 'Hidden line'}
              </button>
            ))}
          </div>
          {appearance.mode !== 'studio' && (
            <label className="color-field">
              Line color
              <input
                aria-label="Line color"
                type="color"
                value={appearance.lineColor}
                onChange={(e) =>
                  onAppearance({ ...appearance, lineColor: e.target.value })
                }
              />
            </label>
          )}
          {appearance.mode === 'hidden-line' && (
            <label className="color-field">
              Surface color
              <input
                aria-label="Surface color"
                type="color"
                value={appearance.surfaceColor}
                onChange={(e) =>
                  onAppearance({ ...appearance, surfaceColor: e.target.value })
                }
              />
            </label>
          )}
          <div className="studio-divider" />
          <button className="scale-person-action" onClick={addPerson}>
            <UserRound size={20} />
            <span>
              Add a person<small>1.75 m · for a sense of scale</small>
            </span>
            <span>+</span>
          </button>
          <p className="studio-caption">
            You can also ask Atelier to add people or change object colors.
          </p>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            try {
              const next = {
                latitude: Number(form.get('latitude')),
                longitude: Number(form.get('longitude')),
                bearing: Number(form.get('bearing')),
              };
              validateSite(next);
              onSite(next);
              onMap(true);
              setError('');
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <p className="studio-caption">
            Place your model on a map. The location marks your workspace origin;
            dimensions stay in meters.
          </p>
          <label>
            Latitude
            <input
              name="latitude"
              type="number"
              step="any"
              min="-85"
              max="85"
              required
              defaultValue={site?.latitude}
              placeholder="e.g. 20.9674"
            />
          </label>
          <label>
            Longitude
            <input
              name="longitude"
              type="number"
              step="any"
              min="-180"
              max="180"
              required
              defaultValue={site?.longitude}
              placeholder="e.g. −89.5926"
            />
          </label>
          <label>
            Orientation · clockwise from north
            <input
              name="bearing"
              type="number"
              step="any"
              min="-360"
              max="360"
              required
              defaultValue={site?.bearing ?? 0}
            />
          </label>
          <button className="primary-studio-action" type="submit">
            Show model on map
          </button>
          {site && (
            <>
              <button
                type="button"
                className="text-action"
                onClick={() => onMap(!mapVisible)}
              >
                {mapVisible ? 'Hide map' : 'Show map'}
              </button>
              <a href={googleMapsUrl(site)} target="_blank" rel="noreferrer">
                Find this location in Google Maps ↗
              </a>
            </>
          )}
          <p className="studio-caption">
            OpenStreetMap · flat map under your 3D geometry, not terrain or
            satellite imagery. Location is sent to the map tile service when
            shown.
          </p>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
    </section>
  );
}
