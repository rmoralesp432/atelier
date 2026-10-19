import { useEffect, useRef, useState } from 'react';
import { X, Smartphone } from 'lucide-react';
import { Box3, Vector3, type Group } from 'three';
import type { Project } from '../model';
import type { CameraContext } from '../intelligence/context';
import type { ARSessionControl } from './webxr';
import { useFloatingPanel } from '../studio/useFloatingPanel';
export default function ARPanel({
  project,
  onClose,
  onActive,
  onConversationHost,
  onNativeOpen,
  onCamera,
}: {
  project: Project;
  onClose: () => void;
  onActive: (value: boolean) => void;
  onConversationHost: (node: HTMLDivElement | null) => void;
  onNativeOpen: () => void;
  onCamera: (camera: CameraContext) => void;
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
    [status, setStatus] = useState(''),
    [width, setWidth] = useState(0),
    [realWidth, setRealWidth] = useState('1'),
    [lockScale, setLockScale] = useState(true),
    [sessionReady, setSessionReady] = useState(false);
  const signature = JSON.stringify([project.volumes, project.groups]);
  const preparedSignature = useRef('');
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
  useEffect(() => () => onActive(false), [onActive]);
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
      preparedSignature.current = signature;
      setWidth(new Box3().setFromObject(model).getSize(new Vector3()).x);
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
    onActive(true);
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
            onActive(false);
            setSessionReady(false);
            session.current = null;
          }
        },
        abort.current.signal,
        (value, degrees) => {
          setScale(value);
          setRotation(degrees);
          setURL('');
        },
        onCamera,
      )
      .then((control) => {
        if (!alive.current) {
          void control.end();
          return;
        }
        session.current = control;
        setSessionReady(true);
      })
      .catch((e) => {
        if (alive.current) {
          setActive(false);
          onActive(false);
          setError(
            e instanceof Error ? e.message : 'Camera access was unavailable.',
          );
        }
      });
  };
  const chooseScale = (value: number) => {
    if (!Number.isFinite(value) || value < 0.001 || value > 1) {
      setError('Choose a viewing scale between 1:1000 and 1:1.');
      return;
    }
    setError('');
    setScale(value);
    session.current?.scale(value);
    generation.current++;
    setURL('');
    if (blobURL.current) {
      URL.revokeObjectURL(blobURL.current);
      blobURL.current = '';
    }
  };
  // Keep the tracked anchor and scale while the shared AI engine edits geometry.
  useEffect(() => {
    if (
      !sessionReady ||
      !session.current ||
      preparedSignature.current === signature
    )
      return;
    let cancelled = false;
    setStatus('Updating the model in your space…');
    void import('./model')
      .then(async (m) => {
        const model = await m.createARModel(
          project,
          prepared.current?.userData.origin,
        );
        if (cancelled || !session.current) {
          m.disposeARModel(model);
          return;
        }
        session.current.updateModel(model);
        if (prepared.current) m.disposeARModel(prepared.current);
        prepared.current = model;
        preparedSignature.current = signature;
        setWidth(new Box3().setFromObject(model).getSize(new Vector3()).x);
        setURL('');
        setStatus(
          'Model updated. Your position and viewing scale are preserved.',
        );
      })
      .catch((e) => {
        if (!cancelled)
          setStatus(
            `AR keeps the previous model: ${e instanceof Error ? e.message : 'update failed'}`,
          );
      });
    return () => {
      cancelled = true;
    };
  }, [signature, sessionReady]);
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
          1. Choose a viewing scale. 2. Prepare the model. 3. Place it on a real
          surface and walk around it. Viewing scale does not resize your
          project.
        </p>
        <label>
          Viewing scale
          <select
            aria-label="AR viewing scale"
            value={scale}
            onChange={(e) => chooseScale(Number(e.target.value))}
          >
            {![1, 0.1, 0.01, 0.001].includes(scale) && (
              <option value={scale}>
                Custom · 1:{Number((1 / scale).toFixed(1))}
              </option>
            )}
            <option value={1}>1:1 · life size</option>
            <option value={0.1}>1:10</option>
            <option value={0.01}>1:100 · tabletop</option>
            <option value={0.001}>1:1000 · site model</option>
          </select>
        </label>
        {width > 0 && (
          <div className="ar-size-card">
            <strong>{(width * scale).toFixed(2)} m wide in your space</strong>
            <span>
              Project width {width.toFixed(2)} m · viewing ratio 1:
              {Number((1 / scale).toFixed(1))}
            </span>
            <label>
              Fit to a real width · m
              <input
                aria-label="Real world model width"
                type="number"
                min={width * 0.001}
                max={width}
                step="any"
                value={realWidth}
                onChange={(e) => setRealWidth(e.target.value)}
              />
            </label>
            <button onClick={() => chooseScale(Number(realWidth) / width)}>
              Use this width
            </button>
          </div>
        )}
        {quickLook && (
          <label className="ar-scale-lock">
            <input
              type="checkbox"
              checked={lockScale}
              onChange={(e) => setLockScale(e.target.checked)}
            />{' '}
            Keep the chosen scale in iPhone AR
          </label>
        )}
        <p className="studio-caption">
          {checking
            ? 'Checking device support…'
            : quickLook
              ? 'iPhone / iPad: opens Apple AR Quick Look. Move your phone to find a surface. Unlock the chosen scale above if you want to pinch to resize.'
              : xr
                ? 'This device supports WebXR camera AR. Find a surface, tap to place, then walk around your model.'
                : 'Camera AR is unavailable in this browser. Open ATELIER in Safari on an AR-capable iPhone/iPad, or an Android browser with WebXR AR support. You can still download the model below.'}
        </p>
        {quickLook && (
          <p className="studio-caption">
            Apple’s AR viewer cannot show ATELIER chat. Close it to speak or
            type here, then prepare the updated model and reopen AR. Voice
            pauses when you enter Apple AR.
          </p>
        )}
        {xr && !quickLook && (
          <p className="studio-caption">
            In WebXR, ATELIER text and voice stay with you. Model edits update
            in place. Camera images are not sent to the AI.
          </p>
        )}
        {url && preparedSignature.current !== signature && (
          <p role="status">
            Your project changed. Refresh the AR model before opening it.
          </p>
        )}
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
        {url && preparedSignature.current === signature && (
          <>
            {quickLook ? (
              <a
                className="primary-studio-action"
                rel="ar"
                href={`${url}${lockScale ? '#allowsContentScaling=0' : ''}`}
                onClick={onNativeOpen}
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
            <details className="ar-adjustments">
              <summary>
                Size & placement · 1:{Number((1 / scale).toFixed(1))}
              </summary>
              <label>
                Scale
                <select
                  aria-label="Live AR scale"
                  value={scale}
                  onChange={(e) => chooseScale(Number(e.target.value))}
                >
                  {![1, 0.1, 0.01, 0.001].includes(scale) && (
                    <option value={scale}>
                      Custom · 1:{Number((1 / scale).toFixed(1))}
                    </option>
                  )}
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
              <button
                disabled={!sessionReady || !width}
                onClick={() => session.current?.fitWidth(width)}
              >
                Fit width between two points
              </button>
              <p>
                Tap two ends on the same floor or tabletop. The model fits
                between them. Device tracking is approximate, not a survey
                measurement.
              </p>
            </details>
            <button
              disabled={!sessionReady}
              onClick={() => session.current?.reposition()}
            >
              Place again
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
        <div ref={onConversationHost} className="ar-conversation-host" />
      </div>
    </>
  );
}
