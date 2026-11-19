import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mapSources, type MapStyle } from './site';
type Point = { latitude: number; longitude: number };
export default function MapPicker({
  center,
  style = 'street',
  onPick,
}: {
  center: Point | null;
  style?: MapStyle;
  onPick: (p: Point) => void;
}) {
  const element = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    latest = useRef(onPick),
    userMovement = useRef(false);
  latest.current = onPick;
  const [error, setError] = useState(false);
  useEffect(() => {
    const m = L.map(element.current!, {
      worldCopyJump: true,
      zoomControl: true,
      scrollWheelZoom: false,
      maxBounds: [
        [-85, -540],
        [85, 540],
      ],
      maxBoundsViscosity: 1,
    }).setView(
      center ? [center.latitude, center.longitude] : [20, 0],
      center ? 16 : 2,
    );
    map.current = m;
    const pick = () => {
      const c = m.getCenter().wrap();
      latest.current({
        latitude: Math.max(-85, Math.min(85, c.lat)),
        longitude: c.lng,
      });
    };
    const markPointer = () => {
      userMovement.current = true;
    };
    const markKey = (e: KeyboardEvent) => {
      if (e.key.startsWith('Arrow')) userMovement.current = true;
    };
    const container = m.getContainer();
    container.addEventListener('pointerdown', markPointer, true);
    container.addEventListener('keydown', markKey, true);
    m.on('moveend', () => {
      if (userMovement.current) {
        userMovement.current = false;
        pick();
      }
    });
    m.on('click', (e: L.LeafletMouseEvent) => {
      m.panTo(e.latlng, { animate: false });
      pick();
    });
    const resize = new ResizeObserver(() => m.invalidateSize({ pan: false }));
    resize.observe(element.current!);
    return () => {
      resize.disconnect();
      container.removeEventListener('pointerdown', markPointer, true);
      container.removeEventListener('keydown', markKey, true);
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    setError(false);
    const source = mapSources[style];
    const layer = L.tileLayer(source.url, {
      attribution: `<a href="${source.link}" target="_blank" rel="noreferrer">${source.credit}</a>`,
      maxZoom: 19,
      minZoom: 2,
      keepBuffer: 0,
      updateWhenIdle: true,
    })
      .on('tileerror', () => setError(true))
      .addTo(m);
    return () => {
      layer.remove();
    };
  }, [style]);
  useEffect(() => {
    if (center && map.current) {
      const c = map.current.getCenter();
      if (
        Math.abs(c.lat - center.latitude) > 1e-6 ||
        Math.abs(c.lng - center.longitude) > 1e-6
      ) {
        userMovement.current = false;
        map.current.setView(
          [center.latitude, center.longitude],
          Math.max(16, map.current.getZoom()),
          { animate: false },
        );
      }
    }
  }, [center?.latitude, center?.longitude]);
  return (
    <div className="map-picker-shell">
      <div
        className="map-picker"
        ref={element}
        role="region"
        aria-label="Choose a site on the map"
      />
      <span className="map-center-pin" aria-hidden="true">
        +
      </span>
      <p>
        Drag or click the map. Zoom with + / −. The pin marks your model’s
        origin.
      </p>
      {error && (
        <p className="map-picker-error" role="alert">
          Map tiles could not load. You can still enter coordinates below.
        </p>
      )}
    </div>
  );
}
