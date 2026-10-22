import { isModuleLoadError } from './loading';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Smartphone } from 'lucide-react';
import { Box3, Vector3, type Group } from 'three';
import type { PreparationWorker } from './PreparationWorker';
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
  onFloorPreview,
  onPreparing,
}: {
  project: Project;
  onClose: () => void;
  onActive: (value: boolean) => void;
  onConversationHost: (node: HTMLDivElement | null) => void;
  onNativeOpen: () => void;
  onCamera: (camera: CameraContext) => void;
  onReload: () => Promise<void>;
  onFloorPreview: (level: number | null) => void;
  onPreparing: (busy: boolean) => void;
}) {
  const floating = useFloatingPanel(),
    [xr, setXR] = useState(false),
    [quickLook, setQuickLook] = useState(false),
    [checking, setChecking] = useState(true);
  const [scale, setScale] = useState(0.01),
    [rotation, setRotation] = useState(0),
    [heightInput, setHeightInput] = useState('0'),
    [floorEnabled, setFloorEnabled] = useState(false),
    [floorPreview, setFloorPreview] = useState(true),
    [inspectFloor, setInspectFloor] = useState(false),
    [selectedOnly, setSelectedOnly] = useState(false),
    [preparationStatus, setPreparationStatus] = useState(''),
    [preparationReport, setPreparationReport] = useState(''),
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
    [chatOpen, setChatOpen] = useState(false),
    [handoff, setHandoff] = useState<'preview' | 'life-size' | null>(null);
  const modelModule = useRef<typeof import('./model') | null>(null);
  const heightOffset = Number(heightInput);
  const heightValid =
    !floorEnabled ||
    (heightInput.trim() !== '' &&
      Number.isFinite(heightOffset) &&
      Math.abs(heightOffset) <= 2000);
  const floorLevel = floorEnabled && heightValid ? heightOffset : undefined;
  const selectionKey = selectedOnly
    ? (project.selectedIds?.length
        ? project.selectedIds
        : [project.selectedId]
      ).join(',')
    : '';
  const signature = useMemo(
    () => ({
      volumes: project.volumes,
      groups: project.groups,
      floorLevel,
      selectedOnly,
      selectionKey,
    }),
    [project.volumes, project.groups, floorLevel, selectedOnly, selectionKey],
  );
  const preparedSignature = useRef<typeof signature | null>(null);
  const abort = useRef<AbortController | null>(null);
  const preparationAbort = useRef<AbortController | null>(null);
  const prepared = useRef<Group | null>(null),
    session = useRef<ARSessionControl | null>(null),
    overlay = useRef<HTMLDivElement>(null),
    alive = useRef(true),
    blobURL = useRef('');
  const module = useRef<typeof import('./webxr') | null>(null),
    generation = useRef(0);
  useEffect(() => {
    onFloorPreview(
      floorPreview && floorEnabled && heightValid && !active
        ? heightOffset
        : null,
    );
    return () => onFloorPreview(null);
  }, [
    floorPreview,
    floorEnabled,
    heightValid,
    heightOffset,
    active,
    onFloorPreview,
  ]);
  useEffect(() => {
    onPreparing(busy);
    return () => onPreparing(false);
  }, [busy, onPreparing]);
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
      preparationAbort.current?.abort();
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
  const prepare = async (exportScale = scale) => {
    if (!heightValid) {
      setError('Choose a valid AR floor level.');
      return;
    }
    preparationAbort.current?.abort();
    const controller = new AbortController();
    preparationAbort.current = controller;
    const revision = ++generation.current;
    setBusy(true);
    setError('');
    setLoadFailed(false);
    setPreparationReport('');
    setPreparationStatus('Making a lighter AR copy…');
    setURL('');
    if (blobURL.current) {
      URL.revokeObjectURL(blobURL.current);
      blobURL.current = '';
    }
    if (prepared.current) {
      modelModule.current?.disposeARModel(prepared.current);
      prepared.current = null;
    }
    preparedSignature.current = null;
    let worker: PreparationWorker | undefined;
    let model: Group | undefined;
    try {
      const m = await import('./model');
      modelModule.current = m;
      controller.signal.throwIfAborted();
      const { PreparationWorker } = await import('./PreparationWorker');
      worker = new PreparationWorker(controller.signal);
      module.current = xr && !quickLook ? await import('./webxr') : null;
      model = await m.createARModel(project, undefined, {
        floorLevel,
        selectedOnly,
        signal: controller.signal,
        processPart: (part) => worker!.part(part),
        progress: (message) => {
          if (alive.current) setPreparationStatus(message);
        },
      });
      controller.signal.throwIfAborted();
      setPreparationStatus('Finishing the AR copy…');
      const data = await worker.export(
        model,
        exportScale,
        rotation,
        transparent,
        0,
      );
      controller.signal.throwIfAborted();
      if (!alive.current || revision !== generation.current) return;
      prepared.current = model;
      preparedSignature.current = signature;
      setWidth(new Box3().setFromObject(model).getSize(new Vector3()).x);
      const report = model.userData.arPreparation;
      setPreparationReport(
        `${report.outputTriangles.toLocaleString()} triangles in the AR copy${report.outputTriangles < report.sourceTriangles ? ` · reduced from ${report.sourceTriangles.toLocaleString()}` : ''}.${floorLevel === undefined ? '' : ` Starts at project level ${floorLevel} m.${report.lowestPoint > 0.001 ? ' This level is in empty space; Apple may place the lowest remaining surface on the ground.' : ''}`} Original project unchanged.`,
      );
      model = undefined; // Ownership passes to the panel only after successful export.
      blobURL.current = URL.createObjectURL(
        new Blob([data as BlobPart], { type: 'model/vnd.usdz+zip' }),
      );
      setURL(blobURL.current);
    } catch (e) {
      if (alive.current && !controller.signal.aborted) {
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
      worker?.dispose();
      if (model) modelModule.current?.disposeARModel(model);
      if (alive.current && preparationAbort.current === controller) {
        setBusy(false);
        setPreparationStatus('');
      }
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
    setHandoff(null);
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
  const continueInAR = async () => {
    if (busy || !sessionReady) return;
    // Camera-preview coordinates have no tracked-world reference. Never bake
    // its translation into a USDZ and pretend it is a physical anchor.
    setHandoff('preview');
    if (scale === 1 && quickLook) setLockScale(false);
    await session.current?.end();
    await prepare();
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
  const chooseHeight = (value: string) => {
    setHeightInput(value);
    setError('');
    invalidateExport();
  };
  const selectedPart = project.volumes.find((v) => v.id === project.selectedId);
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
          ? 'Viewing scale confirmed'
          : 'Check the size, then confirm the viewing ratio.'}
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
    const controller = new AbortController();
    let updateWorker: PreparationWorker | undefined;
    setStatus('Updating the model in your space…');
    void import('./model')
      .then(async (m) => {
        const { PreparationWorker } = await import('./PreparationWorker');
        updateWorker = new PreparationWorker(controller.signal);
        const model = await m.createARModel(
          project,
          prepared.current?.userData.origin,
          {
            floorLevel,
            selectedOnly,
            signal: controller.signal,
            processPart: (part) => updateWorker!.part(part),
          },
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
      })
      .finally(() => updateWorker?.dispose());
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [signature, sessionReady]);
  useEffect(() => {
    if (handoff && !active) floating.ref.current?.scrollTo({ top: 0 });
  }, [handoff, active]);
  const openTrackedAR = () =>
    quickLook ? (
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
        Open real AR
      </a>
    ) : xr ? (
      <button
        className="primary-studio-action"
        disabled={!scaleConfirmed}
        onClick={() => launch()}
      >
        Open real AR
      </button>
    ) : null;
  return (
    <>
      <section
        className="section-panel ar-panel"
        aria-label="View in your space"
        ref={floating.ref}
        data-ar-triangles={
          prepared.current?.userData.arPreparation?.outputTriangles
        }
        data-floor-preview={inspectFloor}
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
        {inspectFloor && (
          <div className="ar-floor-preview-toolbar">
            <label>
              AR starts at {heightValid ? heightOffset.toFixed(2) : '—'} m
              <input
                aria-label="Preview AR floor level"
                type="range"
                min="0"
                max={Math.max(
                  1,
                  ...project.volumes.map(
                    (v) => v.position.y + v.dimensions.height,
                  ),
                )}
                step="0.05"
                value={heightValid ? heightOffset : 0}
                onChange={(e) => {
                  setFloorEnabled(true);
                  chooseHeight(e.target.value);
                }}
              />
            </label>
            <div className="ar-button-row">
              <button onClick={() => setFloorPreview(!floorPreview)}>
                {floorPreview ? 'Show whole model' : 'Show floor cut'}
              </button>
              <button onClick={() => setInspectFloor(false)}>
                Back to AR setup
              </button>
            </div>
          </div>
        )}
        <p className="studio-caption">
          Real AR anchors the model in your surroundings. Camera preview only
          overlays an image and cannot be placed in the room. Your saved project
          stays unchanged.
        </p>
        <fieldset className="ar-height-fields" disabled={busy}>
          <legend>Walk on a different floor</legend>
          <label className="ar-scale-lock">
            <input
              type="checkbox"
              checked={floorEnabled}
              onChange={(e) => {
                setFloorEnabled(e.target.checked);
                invalidateExport();
              }}
            />
            Use a floor cut for AR
          </label>
          <p className="studio-caption">
            Choose the level to stand on. Only the AR copy loses everything
            below it; your project stays intact.
          </p>
          {floorEnabled && (
            <>
              <label>
                Floor level · project meters
                <input
                  aria-label="AR floor level"
                  type="number"
                  min="-2000"
                  max="2000"
                  step="any"
                  value={heightInput}
                  aria-invalid={!heightValid}
                  onChange={(e) => chooseHeight(e.target.value)}
                />
              </label>
              <div className="ar-button-row">
                <button
                  disabled={!heightValid || heightOffset < -1999.75}
                  onClick={() =>
                    chooseHeight(
                      String(Number((heightOffset - 0.25).toFixed(3))),
                    )
                  }
                >
                  Floor down 25 cm
                </button>
                <button
                  disabled={!heightValid || heightOffset > 1999.75}
                  onClick={() =>
                    chooseHeight(
                      String(Number((heightOffset + 0.25).toFixed(3))),
                    )
                  }
                >
                  Floor up 25 cm
                </button>
              </div>
              {selectedPart && (
                <button
                  className="text-action"
                  onClick={() =>
                    chooseHeight(
                      String(
                        Number(
                          (
                            selectedPart.position.y +
                            selectedPart.dimensions.height
                          ).toFixed(3),
                        ),
                      ),
                    )
                  }
                >
                  Use selected floor’s top
                </button>
              )}
              <label className="ar-scale-lock">
                <input
                  type="checkbox"
                  checked={floorPreview}
                  onChange={(e) => setFloorPreview(e.target.checked)}
                />
                Preview floor cut in workspace
              </label>
              <button
                disabled={!heightValid}
                onClick={() => {
                  setFloorPreview(true);
                  setInspectFloor(true);
                }}
              >
                Inspect floor cut
              </button>
              {!heightValid && (
                <p role="alert">
                  Enter a floor level between −2000 and 2000 m.
                </p>
              )}
              <small>
                Preview changes immediately. Opening Apple AR still prepares its
                viewing copy automatically; no manual file export is needed.
                Close Apple AR to choose another floor.
              </small>
            </>
          )}
        </fieldset>
        <label className="ar-scale-lock">
          <input
            type="checkbox"
            disabled={busy}
            checked={selectedOnly}
            onChange={(e) => {
              setSelectedOnly(e.target.checked);
              invalidateExport();
            }}
          />
          Only selected objects
        </label>
        <p className="studio-caption">
          Phone AR uses a lighter copy, up to 100,000 triangles. Fine details
          may be simplified; project dimensions and your full-detail original
          are kept.
        </p>
        {busy && (
          <div className="ar-preparation-progress" role="status">
            <p>{preparationStatus}</p>
            <button
              onClick={() => {
                preparationAbort.current?.abort();
                setPreparationStatus('Cancelling…');
              }}
            >
              Cancel preparation
            </button>
          </div>
        )}
        {preparationReport &&
          url &&
          preparedSignature.current === signature && (
            <p className="studio-caption" role="status">
              {preparationReport}
            </p>
          )}
        {handoff ? (
          <section
            className="ar-tracked-guide"
            aria-label="Continue in real AR"
          >
            <strong>Place it in your space</strong>
            <p>
              {handoff === 'preview'
                ? `Size and rotation are kept. Position starts fresh in ${quickLook ? 'Apple AR' : 'tracked AR'}; the camera preview cannot transfer a room anchor.`
                : lockScale
                  ? 'This exports at 1:1 with resizing locked. Drag to position it in Apple AR.'
                  : 'This exports at 1:1 with resizing allowed in Apple AR, so you can position a smaller model before enlarging it.'}
            </p>
            {busy ? (
              <p role="status">Preparing tracked AR…</p>
            ) : !scaleConfirmed ? (
              <p>Confirm the viewing scale below, then open real AR.</p>
            ) : url && preparedSignature.current === signature ? (
              openTrackedAR()
            ) : (
              <button
                disabled={busy || !heightValid}
                onClick={() => void prepare()}
              >
                Prepare tracked AR
              </button>
            )}
            <p>
              {quickLook
                ? 'In Apple’s viewer, choose AR if needed. Aim at the floor and move your phone slowly until the model appears. Drag the model to position it; use two fingers to turn.'
                : 'Aim at the floor, find the placement ring and tap to anchor the model.'}
            </p>
            {quickLook && scale === 1 && !lockScale && (
              <p>
                Resizing is allowed for placement. Pinch smaller if the building
                surrounds you, move it, then return to 100% for the exported
                life size.
              </p>
            )}
            {quickLook && (
              <small>
                Apple controls placement. ATELIER chat and movement arrows stay
                in the browser.
              </small>
            )}
            {error && <p role="alert">{error}</p>}
          </section>
        ) : (
          quickLook && (
            <section
              className="ar-tracked-guide"
              aria-label="Life-size placement"
            >
              <strong>Building too large to position?</strong>
              <p>
                Prepare at 1:1 with resizing allowed in Apple AR. Pinch smaller
                to position it, then return to 100% for life size.
              </p>
              <button
                disabled={busy || checking || !heightValid}
                onClick={() => {
                  chooseScale(1);
                  setLockScale(false);
                  setScaleConfirmed(true);
                  setHandoff('life-size');
                  void prepare(1);
                }}
              >
                Prepare life-size AR
              </button>
            </section>
          )
        )}
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
        {quickLook && (
          <label className="ar-scale-lock">
            <input
              type="checkbox"
              checked={lockScale}
              onChange={(e) => setLockScale(e.target.checked)}
            />
            Keep the chosen scale in iPhone AR
          </label>
        )}
        {quickLook && (
          <p className="studio-caption">
            Turn this off to pinch to resize in Apple AR. For a 1:1 export, 100%
            in Apple’s viewer is life size. Drag to move; use two fingers to
            turn.
          </p>
        )}
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
            1:1, one project meter equals one real meter. Confirmation keeps
            your chosen ratio in ATELIER; it does not calibrate device tracking.
          </p>
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
            disabled={busy || checking || !heightValid}
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
              {!handoff && (quickLook ? scaleConfirmed : xr) && openTrackedAR()}
              <button
                className="text-action"
                disabled={!scaleConfirmed}
                onClick={() => launch(true)}
              >
                Open camera preview (untracked)
              </button>
              <p className="studio-caption">
                Stay in ATELIER to adjust distance, height, rotation and
                transparency, and use chat. This camera overlay is manually
                aligned: it does not track walking, detect obstacles or verify
                real-world 1:1 scale. Use real AR above for tracked placement
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
        {error && !handoff && <p role="alert">{error}</p>}
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
              {manualCamera && (
                <div className="ar-preview-mode">
                  <span>Camera preview · not anchored</span>
                  {(quickLook || xr) && (
                    <button
                      disabled={!sessionReady || busy}
                      onClick={() => void continueInAR()}
                    >
                      Continue in real AR
                    </button>
                  )}
                </div>
              )}
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
