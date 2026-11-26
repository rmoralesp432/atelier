import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Box, X } from 'lucide-react';
import type { ImportOptions, PreparedImport } from './mesh';
import type { ImportDetail } from './detail';
import type {
  ImportInfo,
  ImportPreview,
  ImportReply,
  ImportRequest,
} from './protocol';
export default function MeshImportDialog({
  file,
  onAdd,
  errorText,
  onClose,
}: {
  file: File;
  errorText?: string;
  onAdd: (v: PreparedImport) => void | Promise<void>;
  onClose: () => void;
}) {
  const format = file.name.split('.').at(-1)?.toLowerCase();
  const [options, setOptions] = useState<ImportOptions>({
    units: format === 'fbx' ? 'source' : 'm',
    up: format === 'stl' ? 'Z' : 'Y',
  });
  const [detail, setDetail] = useState<ImportDetail>('full');
  const [asset, setAsset] = useState<ImportInfo | null>(null);
  const [prepared, setPrepared] = useState<ImportPreview | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('Reading the file on this device…');
  const [separate, setSeparate] = useState(true);
  const [checkingSolids, setCheckingSolids] = useState(false);
  const [saving, setSaving] = useState(false);
  const worker = useRef<Worker | null>(null);
  const revision = useRef(0);
  const pending = useRef<{
    resolve: (v: PreparedImport) => void;
    reject: (e: Error) => void;
  } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const invalidate = () => {
    revision.current++;
    setPrepared(null);
  };
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    setAsset(null);
    setPrepared(null);
    setError('');
    setProgress('Reading the file on this device…');
    const w = new Worker(new URL('./import.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.current = w;
    w.onmessage = (event: MessageEvent<ImportReply>) => {
      const reply = event.data;
      if (reply.type === 'progress') setProgress(reply.text);
      else if (reply.type === 'loaded') {
        setAsset(reply.info);
        setSeparate((reply.info.parts ?? 1) <= 200);
        setCheckingSolids(detail === 'full' && reply.info.triangles <= 100000);
      } else if (
        reply.type === 'preview' &&
        reply.revision === revision.current
      ) {
        setPrepared(reply.preview);
      } else if (
        reply.type === 'result' &&
        reply.revision === revision.current
      ) {
        pending.current?.resolve(reply.prepared);
        pending.current = null;
      } else if (
        reply.type === 'error' &&
        (reply.revision === undefined || reply.revision === revision.current)
      ) {
        setError(reply.text);
        pending.current?.reject(new Error(reply.text));
        pending.current = null;
      }
    };
    w.onerror = () => {
      const text =
        'The import worker stopped. Try Phone detail or a smaller export if this device ran out of memory.';
      setError(text);
      setPrepared(null);
      pending.current?.reject(new Error(text));
      pending.current = null;
    };
    w.postMessage({ type: 'load', file, detail } satisfies ImportRequest);
    return () => {
      w.terminate();
      worker.current = null;
      pending.current?.reject(new Error('Import cancelled.'));
      pending.current = null;
    };
  }, [file, detail]);
  useEffect(() => {
    if (!asset) return;
    setPrepared(null);
    setError('');
    worker.current?.postMessage({
      type: 'prepare',
      revision: ++revision.current,
      options,
      separate,
      checkSolids: checkingSolids,
    } satisfies ImportRequest);
  }, [asset, options, separate, checkingSolids]);
  return (
    <dialog
      ref={dialog}
      className="asset-dialog"
      aria-label="Import 3D element"
      onCancel={(event) => {
        if (saving) event.preventDefault();
        else onClose();
      }}
    >
      <button
        className="asset-close"
        aria-label="Cancel import"
        disabled={saving}
        onClick={onClose}
      >
        <X size={18} />
      </button>
      <div className="asset-symbol">
        <Box size={32} strokeWidth={1} />
      </div>
      <p className="eyebrow">BRING YOUR WORLD IN</p>
      <h2>{asset?.name ?? file.name}</h2>
      <p className="asset-caption">
        {format?.toUpperCase()} ·{' '}
        {asset
          ? `${asset.triangles.toLocaleString()} triangles · ${asset.parts ? `${asset.parts} elements` : 'geometry only'}`
          : `${(file.size / 1_000_000).toFixed(1)} MB`}
      </p>
      <fieldset disabled={saving} className="asset-options-fieldset">
        <label className="asset-detail">
          Import detail
          <select
            aria-label="Import detail"
            value={detail}
            onChange={(e) => {
              invalidate();
              setDetail(e.target.value as ImportDetail);
            }}
          >
            <option value="full">
              Full detail · up to 5 million triangles
            </option>
            <option value="balanced">
              Balanced copy · target 500,000 triangles
            </option>
            <option value="light">Phone copy · target 100,000 triangles</option>
          </select>
        </label>
        {detail !== 'full' && (
          <p className="asset-note">
            Reduces a copy while keeping element boundaries and overall
            dimensions. Fine details may change. Targets are approximate; your
            source file stays unchanged.
          </p>
        )}
        {asset && detail !== 'full' && (
          <p className="asset-note">
            {asset.sourceTriangles.toLocaleString()} original →{' '}
            {asset.triangles.toLocaleString()} triangles in this copy.
          </p>
        )}
        <div className="asset-options">
          <label>
            File units
            <select
              aria-label="File units"
              value={options.units}
              onChange={(e) => {
                invalidate();
                setOptions({
                  ...options,
                  units: e.target.value as ImportOptions['units'],
                });
              }}
            >
              {format === 'fbx' && (
                <option value="source">From FBX file</option>
              )}
              <option value="m">Meters</option>
              <option value="cm">Centimeters</option>
              <option value="mm">Millimeters</option>
              <option value="ft">Feet</option>
            </select>
          </label>
          <label>
            Vertical axis
            <select
              aria-label="Vertical axis"
              value={options.up}
              onChange={(e) => {
                invalidate();
                setOptions({ ...options, up: e.target.value as 'Y' | 'Z' });
              }}
            >
              <option value="Y">Y up</option>
              <option value="Z">Z up</option>
            </select>
          </label>
        </div>
        {asset?.parts && (
          <label className="asset-separate">
            <input
              type="checkbox"
              checked={separate}
              onChange={(e) => {
                invalidate();
                setSeparate(e.target.checked);
              }}
            />
            Keep elements separate and grouped
          </label>
        )}
        {(asset?.parts ?? 0) > 200 && (
          <p className="asset-note">
            This file has more than 200 elements, so it opens combined. Export
            smaller views to edit every element separately.
          </p>
        )}
        <label className="asset-separate">
          <input
            type="checkbox"
            checked={checkingSolids}
            onChange={(e) => {
              invalidate();
              setCheckingSolids(e.target.checked);
            }}
          />
          Check closed-solid modeling eligibility
        </label>
        {!checkingSolids && (
          <p className="asset-note">
            Faster reference import for large models. Move, rotate, scale and
            view all surfaces. Enable the check above if you need Boolean
            modeling.
          </p>
        )}
      </fieldset>
      {prepared ? (
        <div className="asset-result">
          <strong>
            {Object.values({
              width: prepared.dimensions.width,
              depth: prepared.dimensions.depth,
              height: prepared.dimensions.height,
            })
              .map((n) => Number(n.toFixed(3)))
              .join(' × ')}{' '}
            m
          </strong>
          <span>
            {prepared.count > 1
              ? `${prepared.count} editable elements · ${prepared.solids} closed solids`
              : prepared.solids === 1
                ? 'Closed solid · ready for modeling'
                : 'Reference surface · move, rotate and scale'}
          </span>
        </div>
      ) : (
        <p role={error ? 'alert' : 'status'}>{error || progress}</p>
      )}
      {(errorText || (error && prepared)) && (
        <p role="alert" className="asset-error">
          {errorText || error}
        </p>
      )}
      {asset?.warnings.map((warning) => (
        <p className="asset-note" key={warning}>
          {warning}
        </p>
      ))}
      <p className="asset-note">
        Added beside your current model.{' '}
        {asset?.parts
          ? 'Relative positions are kept. Separate elements retain their names and basic colors; textures and Revit BIM properties are not imported. Check the dimensions before adding.'
          : 'Your existing objects stay in place. Materials and textures use ATELIER’s studio finish.'}
      </p>
      <button
        className="asset-submit"
        disabled={!prepared || saving}
        onClick={async () => {
          if (!prepared) return;
          setSaving(true);
          try {
            setError('');
            const result = await new Promise<PreparedImport>(
              (resolve, reject) => {
                pending.current = { resolve, reject };
                worker.current?.postMessage({
                  type: 'take',
                  revision: revision.current,
                } satisfies ImportRequest);
              },
            );
            await onAdd(result);
          } catch (e) {
            setError(
              e instanceof Error ? e.message : 'Could not add this model.',
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? 'Saving model…' : 'Add to workspace'}{' '}
        <ArrowUpRight size={17} />
      </button>
    </dialog>
  );
}
