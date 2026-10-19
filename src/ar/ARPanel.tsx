import { useEffect, useRef, useState } from 'react';
import { X, Smartphone } from 'lucide-react';
import type { Group } from 'three';
import type { Project } from '../model';
import type { ARSessionControl } from './webxr';
import { useFloatingPanel } from '../studio/useFloatingPanel';
export default function ARPanel({
  project,
  onClose,
  onActive,
}: {
  project: Project;
  onClose: () => void;
  onActive: (value: boolean) => void;
}) {
  const floating = useFloatingPanel(),
    [xr, setXR] = useState(false),
    [quickLook, setQuickLook] = useState(false),
    [checking, setChecking] = useState(true);
  const [scale, setScale] = useState(0.01),
    [rotation, setRotation] = useState(0),
    [busy, setBusy] = useState(false),
    [url, setURL] = useState(''),
    [error, setError] = useState(''),
    [active, setActive] = useState(false),
    [status, setStatus] = useState('');
  const abort = useRef<AbortController | null>(null);
  const prepared = useRef<Group | null>(null),
    session = useRef<ARSessionControl | null>(null),
    overlay = useRef<HTMLDivElement>(null),
    alive = useRef(true),
    blobURL = useRef('');
  const module = useRef<typeof import('./webxr') | null>(null),
    generation = useRef(0);
  useEffect(() => {
    alive.current = true;
    const link = document.createElement('a');
    setQuickLook(link.relList.supports?.('ar') ?? false);
    void (
      navigator.xr?.isSessionSupported('immersive-ar') ?? Promise.resolve(false)
    )
      .then((v) => {
        if (alive.current) setXR(v);
      })
      .catch(() => {})
      .finally(() => {
        if (alive.current) setChecking(false);
      });
    return () => {
      alive.current = false;
      abort.current?.abort();
      generation.current++;
      void session.current?.end();
      if (blobURL.current) URL.revokeObjectURL(blobURL.current);
      if (prepared.current) {
        const model = prepared.current;
        void import('./model').then((m) => m.disposeARModel(model));
      }
    };
  }, []);
  useEffect(() => {
    onActive(active);
    return () => onActive(false);
  }, [active, onActive]);
  const prepare = async () => {
    const revision = ++generation.current;
    setBusy(true);
    setError('');
    try {
      const m = await import('./model');
      module.current = await import('./webxr');
      const model = await m.createARModel(project);
      if (!alive.current || revision !== generation.current) {
        m.disposeARModel(model);
        return;
      }
      if (prepared.current) m.disposeARModel(prepared.current);
      prepared.current = model;
      const data = await m.exportARModel(model, scale);
      if (!alive.current || revision !== generation.current) return;
      if (blobURL.current) URL.revokeObjectURL(blobURL.current);
      blobURL.current = URL.createObjectURL(
        new Blob([data as BlobPart], { type: 'model/vnd.usdz+zip' }),
      );
      setURL(blobURL.current);
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : 'Could not prepare AR.');
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const launch = () => {
    if (!prepared.current || !module.current || !overlay.current) return;
    abort.current = new AbortController();
    setActive(true);
    setRotation(0);
    setError('');
    void module.current
      .startAR(
        prepared.current,
        overlay.current,
        scale,
        setStatus,
        () => {
          if (alive.current) {
            setActive(false);
            session.current = null;
          }
        },
        abort.current.signal,
      )
      .then((control) => {
        if (!alive.current) {
          void control.end();
          return;
        }
        session.current = control;
      })
      .catch((e) => {
        if (alive.current) {
          setActive(false);
          setError(
            e instanceof Error ? e.message : 'Camera access was unavailable.',
          );
        }
      });
  };
  const chooseScale = (value: number) => {
    setScale(value);
    session.current?.scale(value);
    generation.current++;
    setURL('');
    if (blobURL.current) {
      URL.revokeObjectURL(blobURL.current);
      blobURL.current = '';
    }
  };
  return (
    <>
      <section
        className="section-panel ar-panel"
        aria-label="View in your space"
        ref={floating.ref}
        style={floating.style}
        onPointerDownCapture={floating.raise}
      >
        <div
          className="studio-panel-heading panel-drag-handle"
          {...floating.handle}
          role="button"
          tabIndex={0}
          aria-label="Move AR panel"
        >
          <strong>
            <Smartphone size={17} /> View in your space
          </strong>
          <button aria-label="Close AR" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <p className="studio-caption">
          Place a copy of your visible model through your phone's camera. Your
          project stays unchanged.
        </p>
        <label>
          Viewing scale
          <select
            aria-label="AR viewing scale"
            value={scale}
            onChange={(e) => chooseScale(Number(e.target.value))}
          >
            <option value={1}>1:1 · life size</option>
            <option value={0.1}>1:10</option>
            <option value={0.01}>1:100 · tabletop</option>
            <option value={0.001}>1:1000 · site model</option>
          </select>
        </label>
        <p className="studio-caption">
          {checking
            ? 'Checking device support…'
            : quickLook
              ? 'iPhone / iPad: opens Apple AR Quick Look. Move your phone to find a surface; pinch to adjust size.'
              : xr
                ? 'This device supports WebXR camera AR. Find a surface, tap to place, then walk around your model.'
                : 'Camera AR is unavailable in this browser. Open ATELIER in Safari on an AR-capable iPhone/iPad, or an Android browser with WebXR AR support. You can still download the model below.'}
        </p>
        <button
          className="primary-studio-action"
          disabled={busy}
          onClick={() => void prepare()}
        >
          {busy
            ? 'Preparing your model…'
            : url
              ? 'Refresh AR model'
              : 'Prepare AR model'}
        </button>
        {url && (
          <>
            {quickLook ? (
              <a
                className="primary-studio-action"
                rel="ar"
                href={url}
                download="atelier.usdz"
              >
                <img
                  alt=""
                  width="1"
                  height="1"
                  src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E"
                />
                Open camera AR
              </a>
            ) : xr ? (
              <button className="primary-studio-action" onClick={launch}>
                Open camera AR
              </button>
            ) : null}
            <a className="text-action" href={url} download="atelier.usdz">
              Download AR model (.usdz)
            </a>
          </>
        )}
        <p className="studio-caption">
          Camera access starts only when you open AR. The model is prepared on
          this device. Placement is visual, not a survey alignment.
        </p>
        {error && <p role="alert">{error}</p>}
      </section>
      <div
        ref={overlay}
        className={`ar-overlay ${active ? 'active' : ''}`}
        aria-hidden={!active}
      >
        {active && (
          <div className="ar-controls">
            <strong>{status || 'Opening camera…'}</strong>
            <label>
              Scale
              <select
                aria-label="Live AR scale"
                value={scale}
                onChange={(e) => chooseScale(Number(e.target.value))}
              >
                <option value={1}>1:1</option>
                <option value={0.1}>1:10</option>
                <option value={0.01}>1:100</option>
                <option value={0.001}>1:1000</option>
              </select>
            </label>
            <label>
              Fine scale · 1:{Math.round(1 / scale)}
              <input
                aria-label="Fine AR scale"
                type="range"
                min="-3"
                max="0"
                step="0.01"
                value={Math.log10(scale)}
                onChange={(e) => chooseScale(10 ** Number(e.target.value))}
              />
            </label>
            <label>
              Rotate
              <input
                aria-label="AR rotation"
                type="range"
                min="-180"
                max="180"
                value={rotation}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setRotation(v);
                  session.current?.rotate(v);
                }}
              />
            </label>
            <button onClick={() => session.current?.reposition()}>
              Reposition
            </button>
            <button
              onClick={() => {
                if (session.current) void session.current.end();
                else onClose();
              }}
            >
              Exit AR
            </button>
          </div>
        )}
      </div>
    </>
  );
}
