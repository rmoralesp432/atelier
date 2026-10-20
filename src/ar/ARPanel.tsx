import { isModuleLoadError } from './loading';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Smartphone } from 'lucide-react';
import { Box3, Vector3, type Group } from 'three';
import type { Project } from '../model';
import type { CameraContext } from '../intelligence/context';
import type { ARSessionControl } from './webxr';
import { AR_SCALES, normalizeRotation } from './controls';
import { useFloatingPanel } from '../studio/useFloatingPanel';
export default function ARPanel({
  project,
  onClose,
  onActive,
  onConversationHost,
  onNativeOpen,
  onCamera,
  onReload,
}: {
  project: Project;
  onClose: () => void;
  onActive: (value: boolean) => void;
  onConversationHost: (node: HTMLDivElement | null) => void;
  onNativeOpen: () => void;
  onCamera: (camera: CameraContext) => void;
  onReload: () => Promise<void>;
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
    [sessionReady, setSessionReady] = useState(false),
    [scaleConfirmed, setScaleConfirmed] = useState(false),
    [moveStep, setMoveStep] = useState(0.1),
    [loadFailed, setLoadFailed] = useState(false),
    [manualCamera, setManualCamera] = useState(false),
    [transparent, setTransparent] = useState(false),
    [placementOpen, setPlacementOpen] = useState(false),
    [chatOpen, setChatOpen] = useState(false);
  const modelModule = useRef<typeof import('./model') | null>(null);
  const signature = useMemo(
    () => JSON.stringify([project.volumes, project.groups]),
    [project.volumes, project.groups],
  );
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
        modelModule.current?.disposeARModel(model);
      }
    };
  }, []);
  useEffect(() => () => onActive(false), [onActive]);
  const prepare = async () => {
    const revision = ++generation.current;
    setBusy(true);
    setError('');
    setLoadFailed(false);
    try {
      const m = await import('./model');
      modelModule.current = m;
      // Native Quick Look and USDZ downloads do not need the WebXR runtime.
      module.current = xr && !quickLook ? await import('./webxr') : null;
      const model = await m.createARModel(project);
      if (!alive.current || revision !== generation.current) {
        m.disposeARModel(model);
        return;
      }
      if (prepared.current) m.disposeARModel(prepared.current);
      prepared.current = model;
      preparedSignature.current = signature;
      setWidth(new Box3().setFromObject(model).getSize(new Vector3()).x);
      const data = await m.exportARModel(model, scale, rotation, transparent);
      if (!alive.current || revision !== generation.current) return;
      if (blobURL.current) URL.revokeObjectURL(blobURL.current);
      blobURL.current = URL.createObjectURL(
        new Blob([data as BlobPart], { type: 'model/vnd.usdz+zip' }),
      );
      setURL(blobURL.current);
    } catch (e) {
      if (alive.current) {
        const failed = isModuleLoadError(e);
        setLoadFailed(failed);
        setError(
          failed
            ? 'The AR files could not load. This tab may be from an older update, or the connection may have interrupted the download. Save and refresh to load the current version.'
            : e instanceof Error
              ? e.message
              : 'Could not prepare AR.',
        );
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const launch = (manual = false) => {
    if (
      !scaleConfirmed ||
      !prepared.current ||
      (!manual && !module.current) ||
      !overlay.current
    )
      return;
    abort.current = new AbortController();
    onActive(true);
    setActive(true);
    setManualCamera(manual);
    setPlacementOpen(false);
    setChatOpen(false);
    setError('');
    const ended = () => {
      if (alive.current) {
        setActive(false);
        onActive(false);
        setSessionReady(false);
        session.current = null;
      }
    };
    const running = manual
      ? import('./cameraOverlay').then((m) =>
          m.startCameraOverlay(
            prepared.current!,
            overlay.current!,
            scale,
            setStatus,
            ended,
            abort.current!.signal,
            onCamera,
            rotation,
            (degrees) => {
              setRotation(degrees);
              setURL('');
            },
          ),
        )
      : module.current!.startAR(
          prepared.current,
          overlay.current,
          scale,
          setStatus,
          ended,
          abort.current.signal,
          (value, degrees) => {
            setScale(value);
            setScaleConfirmed(false);
            setRotation(degrees);
            setURL('');
          },
          onCamera,
          rotation,
        );
    void running
      .then((control) => {
        if (!alive.current) {
          void control.end();
          return;
        }
        session.current = control;
        control.transparency?.(transparent);
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
    setScaleConfirmed(false);
    session.current?.scale(value);
    invalidateExport();
  };
  const invalidateExport = () => {
    generation.current++;
    setURL('');
    if (blobURL.current) {
      URL.revokeObjectURL(blobURL.current);
      blobURL.current = '';
    }
  };
  const chooseRotation = (value: number) => {
    if (!Number.isFinite(value)) return;
    const angle = normalizeRotation(value);
    setRotation(angle);
    session.current?.rotate(angle);
    invalidateExport();
  };
  const chooseTransparency = (value: boolean) => {
    setTransparent(value);
    session.current?.transparency?.(value);
    invalidateExport();
  };
  const scaleOptions = () => (
    <>
      {!AR_SCALES.some((ratio) => scale === 1 / ratio) && (
        <option value={scale}>
          Custom · 1:{Number((1 / scale).toFixed(1))}
        </option>
      )}
      {AR_SCALES.map((ratio) => (
        <option key={ratio} value={1 / ratio}>
          1:{ratio}
          {ratio === 1 ? ' · life size' : ratio === 100 ? ' · tabletop' : ''}
        </option>
      ))}
    </>
  );
  const confirmation = () => (
    <div className="ar-confirm-scale">
      <span role="status">
        {scaleConfirmed
          ? 'Scale confirmed · size controls locked'
          : 'Check the size, then confirm to lock resizing.'}
      </span>
      <button
        disabled={busy || !width}
        onClick={() => setScaleConfirmed(!scaleConfirmed)}
      >
        {scaleConfirmed
          ? 'Change scale'
          : `Confirm scale · 1:${Number((1 / scale).toFixed(1))}`}
      </button>
    </div>
  );
  const rotationControls = (live: boolean) => (
    <div className="ar-rotation-controls">
      <label>
        Rotation · {rotation}°
        <input
          aria-label={live ? 'AR rotation' : 'Prepared AR rotation'}
          type="range"
          min="-180"
          max="180"
          step="1"
          value={rotation}
          disabled={busy}
          onChange={(e) => chooseRotation(Number(e.target.value))}
        />
      </label>
      <div className="ar-button-row">
        {[-90, -5, 5, 90].map((step) => (
          <button
            key={step}
            disabled={busy}
            aria-label={`Rotate AR ${step} degrees`}
            onClick={() => chooseRotation(rotation + step)}
          >
            {step > 0 ? '+' : '−'}
            {Math.abs(step)}°
          </button>
        ))}
      </div>
    </div>
  );
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
        style={{ ...floating.style, ...(active ? { display: 'none' } : {}) }}
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
          Prepare your model, check its size, then confirm the scale and open
          AR. Viewing controls never resize your saved project.
        </p>
        <fieldset className="ar-scale-fields" disabled={busy || scaleConfirmed}>
          <label>
            Viewing scale
            <select
              aria-label="AR viewing scale"
              value={scale}
              onChange={(e) => chooseScale(Number(e.target.value))}
            >
              {scaleOptions()}
            </select>
          </label>
          {width > 0 && (
            <div className="ar-size-card">
              <strong>{(width * scale).toFixed(2)} m wide in your space</strong>
              <span>
                Project width {width.toFixed(2)} m · viewing ratio 1:
                {Number((1 / scale).toFixed(1))}
              </span>
              <details>
                <summary>Fit a measured width</summary>
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
              </details>
            </div>
          )}
        </fieldset>
        {width > 0 && confirmation()}
        <label className="ar-scale-lock">
          <input
            type="checkbox"
            checked={transparent}
            disabled={busy}
            onChange={(e) => chooseTransparency(e.target.checked)}
          />
          See-through model
        </label>
        <p className="studio-caption">
          See through surfaces to compare with your surroundings. This does not
          detect collisions or hide geometry behind real objects.
        </p>
        <details>
          <summary>Orientation · {rotation}°</summary>
          {rotationControls(false)}
        </details>
        <details>
          <summary>Using AR on this device</summary>
          <p className="studio-caption">
            For a large building, start at 1:100 to find its orientation. At
            1:1, one project meter equals one real meter. Confirmation locks
            your chosen ratio; it does not calibrate device tracking.
          </p>
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
                ? 'iPhone / iPad: opens Apple AR Quick Look. Drag to move and use two fingers to rotate. Turn off the iPhone scale lock to pinch to resize. For a building at 1:1, use a clear outdoor space; return here to change the ratio or orientation and prepare again.'
                : xr
                  ? 'This device supports WebXR camera AR. Find a surface, tap to place, then walk around your model.'
                  : ''}
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
        </details>
        {!checking && !quickLook && !xr && (
          <p className="studio-caption">
            Camera AR is unavailable in this browser. Open ATELIER in Safari on
            an AR-capable iPhone/iPad, or an Android browser with WebXR AR
            support. You can still download the model below.
          </p>
        )}
        {url && preparedSignature.current !== signature && (
          <p role="status">
            Your project changed. Refresh the AR model before opening it.
          </p>
        )}
        <div className="ar-launch-actions">
          <button
            className={url ? 'text-action' : 'primary-studio-action'}
            disabled={busy || checking}
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
              {quickLook && scaleConfirmed ? (
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
              ) : xr && !quickLook ? (
                <button
                  className="primary-studio-action"
                  disabled={!scaleConfirmed}
                  onClick={() => launch()}
                >
                  Open camera AR
                </button>
              ) : null}
              <button
                className="primary-studio-action"
                disabled={!scaleConfirmed}
                onClick={() => launch(true)}
              >
                Open camera with manual controls
              </button>
              <p className="studio-caption">
                Stay in ATELIER to adjust distance, height, rotation and
                transparency, and use chat. This camera overlay is manually
                aligned: it does not track walking, detect obstacles or verify
                real-world 1:1 scale. Use camera AR above for tracked placement
                when available.
              </p>
              <a className="text-action" href={url} download="atelier.usdz">
                Download AR model (.usdz)
              </a>
            </>
          )}
        </div>
        <p className="studio-caption">
          Camera access starts only when you open AR. The model is prepared on
          this device. Placement is visual, not a survey alignment.
        </p>
        {error && <p role="alert">{error}</p>}
        {loadFailed && (
          <button
            className="primary-studio-action"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onReload();
              } catch (e) {
                if (alive.current)
                  setError(
                    e instanceof Error
                      ? e.message
                      : 'Could not save. Export a backup before refreshing.',
                  );
              } finally {
                if (alive.current) setBusy(false);
              }
            }}
          >
            {busy ? 'Saving your project…' : 'Save project and refresh'}
          </button>
        )}
      </section>
      {createPortal(
        <div
          ref={overlay}
          className={`ar-overlay ${active ? 'active' : ''}`}
          aria-hidden={!active}
        >
          {active && (
            <div className="ar-controls" data-expanded={placementOpen}>
              <div className="ar-compact-toolbar">
                <button
                  aria-expanded={placementOpen}
                  onClick={() => setPlacementOpen(!placementOpen)}
                >
                  Placement
                </button>
                <button
                  aria-pressed={chatOpen}
                  onClick={() => setChatOpen(!chatOpen)}
                >
                  Chat
                </button>
                {manualCamera && (
                  <button
                    disabled={!sessionReady}
                    onClick={() => session.current?.fitInView?.()}
                  >
                    Fit model
                  </button>
                )}
                <button
                  onClick={() => {
                    if (session.current) void session.current.end();
                    else {
                      abort.current?.abort();
                      onClose();
                    }
                  }}
                >
                  Exit AR
                </button>
              </div>
              {manualCamera && !placementOpen && (
                <small className="ar-gesture-hint">
                  Drag to move · pinch for distance · twist to turn
                </small>
              )}
              <div className="ar-placement-options" hidden={!placementOpen}>
                <strong>{status || 'Opening camera…'}</strong>
                <div className="ar-button-row ar-quick-actions">
                  {' '}
                  {manualCamera && (
                    <button
                      disabled={!sessionReady}
                      onClick={() => session.current?.fitInView?.()}
                    >
                      See whole model
                    </button>
                  )}
                  <button
                    disabled={!sessionReady}
                    onClick={() => session.current?.bringInFront()}
                  >
                    Bring in front of me
                  </button>
                  <button
                    disabled={!sessionReady}
                    onClick={() => session.current?.reposition()}
                  >
                    Place again
                  </button>
                </div>
                <label className="ar-scale-lock">
                  <input
                    type="checkbox"
                    checked={transparent}
                    disabled={!sessionReady}
                    onChange={(e) => chooseTransparency(e.target.checked)}
                  />
                  See-through model
                </label>
                {manualCamera && (
                  <p className="ar-mode-note">
                    Manual camera overlay · no walking or obstacle tracking. Use
                    the controls to align; 1:1 is a model ratio, not calibrated
                    camera scale.
                  </p>
                )}
                <label>
                  Move by
                  <select
                    aria-label="AR move increment"
                    value={moveStep}
                    onChange={(e) => setMoveStep(Number(e.target.value))}
                  >
                    <option value={0.01}>1 cm</option>
                    <option value={0.1}>10 cm</option>
                    <option value={0.5}>50 cm</option>
                    <option value={1}>1 m</option>
                    <option value={5}>5 m</option>
                    <option value={10}>10 m</option>
                  </select>
                </label>
                <div className="ar-button-row">
                  <button
                    disabled={!sessionReady}
                    onClick={() => session.current?.nudge(-moveStep, 0)}
                  >
                    Left
                  </button>
                  <button
                    disabled={!sessionReady}
                    onClick={() => session.current?.nudge(moveStep, 0)}
                  >
                    Right
                  </button>
                  <button
                    disabled={!sessionReady}
                    onClick={() => session.current?.nudge(0, -moveStep)}
                  >
                    Closer
                  </button>
                  <button
                    disabled={!sessionReady}
                    onClick={() => session.current?.nudge(0, moveStep)}
                  >
                    Farther
                  </button>
                  <button
                    disabled={!sessionReady}
                    onClick={() => session.current?.nudge(0, 0, moveStep)}
                  >
                    Raise
                  </button>
                  <button
                    disabled={!sessionReady}
                    onClick={() => session.current?.nudge(0, 0, -moveStep)}
                  >
                    Lower
                  </button>
                </div>

                <details className="ar-adjustments">
                  <summary>
                    Size & placement · 1:{Number((1 / scale).toFixed(1))}
                  </summary>
                  <div className="ar-adjustment-body">
                    <p>{(width * scale).toFixed(2)} m wide in your space</p>
                    <fieldset
                      className="ar-scale-fields"
                      disabled={!sessionReady || scaleConfirmed}
                    >
                      <label>
                        Scale
                        <select
                          aria-label="Live AR scale"
                          value={scale}
                          onChange={(e) => chooseScale(Number(e.target.value))}
                        >
                          {scaleOptions()}
                        </select>
                      </label>
                      <div className="ar-button-row">
                        <button onClick={() => chooseScale(0.01)}>
                          Tabletop · 1:100
                        </button>
                        <button onClick={() => chooseScale(1)}>
                          Life size · 1:1
                        </button>
                      </div>
                      <label>
                        Fine scale · 1:{Number((1 / scale).toFixed(1))}
                        <input
                          aria-label="Fine AR scale"
                          type="range"
                          min="-3"
                          max="0"
                          step="0.01"
                          value={Math.log10(scale)}
                          onChange={(e) =>
                            chooseScale(10 ** Number(e.target.value))
                          }
                        />
                      </label>
                      <div className="ar-button-row">
                        <button
                          onClick={() =>
                            chooseScale(Math.max(0.001, scale * 0.95))
                          }
                        >
                          Smaller −5%
                        </button>
                        <button
                          onClick={() => chooseScale(Math.min(1, scale * 1.05))}
                        >
                          Larger +5%
                        </button>
                      </div>
                    </fieldset>
                    {confirmation()}
                    {rotationControls(true)}
                    <p>
                      Moves the nearest edge one meter ahead. Ideal at 1:1. That
                      edge stays fixed when you turn or resize the model.
                    </p>
                    {!manualCamera && (
                      <>
                        <button
                          disabled={!sessionReady || !width || scaleConfirmed}
                          onClick={() => session.current?.fitWidth(width)}
                        >
                          Fit width between two points
                        </button>
                        <p>
                          Tap two ends on the same floor or tabletop. The model
                          fits between them. Device tracking is approximate, not
                          a survey measurement. Real objects do not block model
                          movement.
                        </p>
                      </>
                    )}
                  </div>
                </details>
              </div>
            </div>
          )}
          <div
            ref={onConversationHost}
            className="ar-conversation-host"
            hidden={!chatOpen}
          />
        </div>,
        document.querySelector('.app-shell') ?? document.body,
      )}
    </>
  );
}
