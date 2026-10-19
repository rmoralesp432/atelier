import { useFloatingPanel } from './useFloatingPanel';
import { lazy, Suspense, useEffect, useState } from 'react';
const MapPicker = lazy(() => import('./MapPicker'));
import {
  X,
  UserRound,
  MapPin,
  SlidersHorizontal,
  Sun,
  Moon,
} from 'lucide-react';
import type { Appearance } from './appearance';
import type { Site, MapStyle } from './site';
import { googleMapsUrl, validateSite, shiftMap } from './site';
export default function StudioPanel({
  initialTab = 'appearance',
  appearance,
  onAppearance,
  site,
  onSite,
  mapVisible,
  alignMap,
  onAlignMap,
  onMap,
  onFrameMap,
  addPerson,
  onClose,
}: {
  initialTab?: 'appearance' | 'site';
  appearance: Appearance;
  onAppearance: (a: Appearance) => void;
  site?: Site;
  onSite: (s: Site) => void;
  mapVisible: boolean;
  alignMap: boolean;
  onAlignMap: (value: boolean) => void;
  onMap: (v: boolean) => void;
  onFrameMap: () => void;
  addPerson: () => void;
  onClose: () => void;
}) {
  const floating = useFloatingPanel();
  const [tab, setTab] = useState<'appearance' | 'site'>(initialTab);
  const [error, setError] = useState('');
  const [pickOpen, setPickOpen] = useState(initialTab === 'site');
  const [mapStyle, setMapStyle] = useState<MapStyle>(site?.style ?? 'street');
  const [coverage, setCoverage] = useState(site?.coverage);
  useEffect(() => setCoverage(site?.coverage), [site?.coverage]);
  const [bearing, setBearing] = useState(site?.bearing ?? 0);
  const [latitude, setLatitude] = useState(site ? String(site.latitude) : '');
  const [longitude, setLongitude] = useState(
    site ? String(site.longitude) : '',
  );
  const [pickerCenter, setPickerCenter] = useState<{
    latitude: number;
    longitude: number;
  } | null>(site ?? null);
  const locateCoordinates = () => {
    if (
      latitude !== '' &&
      longitude !== '' &&
      Number.isFinite(Number(latitude)) &&
      Number.isFinite(Number(longitude)) &&
      Math.abs(Number(latitude)) <= 85 &&
      Math.abs(Number(longitude)) <= 180
    )
      setPickerCenter({
        latitude: Number(latitude),
        longitude: Number(longitude),
      });
  };
  const [locating, setLocating] = useState(false);
  const [nudge, setNudge] = useState(1);
  useEffect(() => {
    if (site) {
      setLatitude(String(site.latitude));
      setLongitude(String(site.longitude));
      setPickerCenter(site);
    }
  }, [site?.latitude, site?.longitude]);
  useEffect(() => {
    if (site) setBearing(site.bearing);
  }, [site?.bearing]);

  return (
    <section
      ref={floating.ref}
      style={floating.style}
      className="studio-panel"
      aria-label="Studio settings"
      onPointerDownCapture={floating.raise}
    >
      <div
        className="studio-panel-heading panel-drag-handle"
        {...floating.handle}
        aria-label="Move Studio panel"
        role="button"
        tabIndex={0}
      >
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
          <label className="studio-label">Light</label>
          <div className="theme-options" aria-label="Workspace theme">
            <button
              aria-pressed={appearance.theme === 'day'}
              onClick={() => onAppearance({ ...appearance, theme: 'day' })}
            >
              <Sun size={16} />
              Day
            </button>
            <button
              aria-pressed={appearance.theme === 'night'}
              onClick={() => onAppearance({ ...appearance, theme: 'night' })}
            >
              <Moon size={16} />
              Night
            </button>
          </div>
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
                bearing,
                style: mapStyle,
                ...(coverage === undefined ? {} : { coverage }),
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
          <div className="theme-options" aria-label="Map imagery">
            {(['street', 'satellite'] as const).map((style) => (
              <button
                type="button"
                key={style}
                aria-pressed={mapStyle === style}
                onClick={() => {
                  setMapStyle(style);
                  if (site) onSite({ ...site, style });
                }}
              >
                {style === 'street' ? 'Street' : 'Satellite'}
              </button>
            ))}
          </div>
          <label className="map-coverage-field">
            Map area
            <select
              aria-label="Map area"
              value={coverage ?? 'original'}
              onChange={(e) => {
                const next =
                  e.target.value === 'original'
                    ? undefined
                    : Number(e.target.value);
                setCoverage(next);
                if (site) {
                  const updated = { ...site };
                  if (next === undefined) delete updated.coverage;
                  else updated.coverage = next;
                  onSite(updated);
                }
              }}
            >
              <option value="original">Original area</option>
              <option value="500">500 m × 500 m · Site</option>
              <option value="1000">1 km × 1 km · Neighborhood</option>
              <option value="2000">2 km × 2 km · District</option>
              <option value="5000">5 km × 5 km · Context</option>
            </select>
          </label>
          <p className="studio-caption">
            Larger coverage uses less detailed imagery. Buildings keep their
            exact dimensions.
          </p>
          {site && (
            <button
              type="button"
              className="primary-studio-action"
              onClick={onFrameMap}
            >
              See entire map
            </button>
          )}
          <div className="map-pick-actions">
            <button
              type="button"
              className="choose-map-button"
              aria-expanded={pickOpen}
              onClick={() => {
                locateCoordinates();
                setPickOpen((v) => !v);
              }}
            >
              {pickOpen ? 'Close map picker' : 'Choose on a map'}
            </button>
            <button
              type="button"
              className="text-action"
              disabled={locating}
              onClick={() => {
                if (!navigator.geolocation) {
                  setError(
                    'Device location is unavailable. Choose on the map or enter coordinates.',
                  );
                  return;
                }
                setLocating(true);
                setError('');
                navigator.geolocation.getCurrentPosition(
                  (p) => {
                    setLatitude(p.coords.latitude.toFixed(6));
                    setLongitude(p.coords.longitude.toFixed(6));
                    setPickerCenter({
                      latitude: p.coords.latitude,
                      longitude: p.coords.longitude,
                    });
                    setPickOpen(true);
                    setLocating(false);
                  },
                  () => {
                    setError(
                      'Location access was unavailable. Choose on the map or enter coordinates.',
                    );
                    setLocating(false);
                  },
                  { timeout: 10000, maximumAge: 60000 },
                );
              }}
            >
              {locating ? 'Finding location…' : 'Use my location'}
            </button>
          </div>
          {pickOpen && (
            <Suspense fallback={<p>Loading map picker…</p>}>
              <MapPicker
                center={pickerCenter}
                style={mapStyle}
                onPick={(p) => {
                  setLatitude(p.latitude.toFixed(6));
                  setLongitude(p.longitude.toFixed(6));
                }}
              />
            </Suspense>
          )}
          <p className="studio-caption">Or enter exact coordinates</p>
          <label>
            Latitude
            <input
              name="latitude"
              type="number"
              step="any"
              min="-85"
              max="85"
              required
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              onBlur={locateCoordinates}
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
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              onBlur={locateCoordinates}
              placeholder="e.g. −89.5926"
            />
          </label>
          {site && (
            <div className="map-alignment">
              <h3>Align your site</h3>
              <button
                type="button"
                className="primary-studio-action"
                aria-pressed={alignMap}
                onClick={() => onAlignMap(!alignMap)}
              >
                {alignMap ? 'Finish moving map' : 'Drag map under model'}
              </button>
              <p className="studio-caption">
                Drag the map in the 3D workspace. Buildings and the project grid
                stay fixed. Undo restores each adjustment.
              </p>
              <label>
                Alignment step · m
                <select
                  aria-label="Map alignment step"
                  value={nudge}
                  onChange={(e) => setNudge(Number(e.target.value))}
                >
                  <option value={0.1}>0.1</option>
                  <option value={1}>1</option>
                  <option value={10}>10</option>
                </select>
              </label>
              <div className="map-nudges">
                {[
                  { label: 'left', x: -1, z: 0, symbol: '←' },
                  { label: 'up', x: 0, z: -1, symbol: '↑' },
                  { label: 'down', x: 0, z: 1, symbol: '↓' },
                  { label: 'right', x: 1, z: 0, symbol: '→' },
                ].map((d) => (
                  <button
                    key={d.label}
                    type="button"
                    aria-label={`Move map ${d.label}`}
                    onClick={() => {
                      try {
                        onSite(shiftMap(site, d.x * nudge, d.z * nudge));
                        setError('');
                      } catch (err) {
                        setError((err as Error).message);
                      }
                    }}
                  >
                    {d.symbol}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label>
            Map rotation · {bearing}°
            <input
              name="bearing"
              aria-label="Map rotation"
              type="number"
              step="any"
              min="-360"
              max="360"
              required
              value={bearing}
              onChange={(e) => {
                const value = Number(e.target.value);
                setBearing(value);
                if (site && Number.isFinite(value) && Math.abs(value) <= 360)
                  onSite({ ...site, bearing: value });
              }}
            />
          </label>
          <input
            type="range"
            aria-label="Rotate map"
            min="-180"
            max="180"
            step="1"
            value={bearing}
            onChange={(e) => {
              const value = Number(e.target.value);
              setBearing(value);
              if (site) onSite({ ...site, bearing: value });
            }}
          />
          <div className="map-bearing-presets">
            {[0, 45, 90, -90].map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => {
                  setBearing(value);
                  if (site) onSite({ ...site, bearing: value });
                }}
              >
                {value === 0 ? 'North up' : `${value}°`}
              </button>
            ))}
          </div>
          <p className="studio-caption">
            Rotates the map only. Model axes and orthographic views stay fixed.
            True north follows the map; project north stays on your grid.
          </p>
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
            Street: OpenStreetMap. Satellite: Esri World Imagery. Both are flat
            reference layers; no terrain heights. Your location is sent to the
            selected imagery provider when shown.
          </p>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
    </section>
  );
}
