import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Box, X } from 'lucide-react';
import {
  prepareImport,
  type MeshAsset,
  type ImportOptions,
  type PreparedImport,
} from './mesh';
export default function MeshImportDialog({
  asset,
  onAdd,
  errorText,
  onClose,
}: {
  asset: MeshAsset;
  errorText?: string;
  onAdd: (v: PreparedImport) => void | Promise<void>;
  onClose: () => void;
}) {
  const [options, setOptions] = useState<ImportOptions>({
    units: asset.format === 'fbx' ? 'source' : 'm',
    up: asset.format === 'stl' ? 'Z' : 'Y',
  });
  const [prepared, setPrepared] = useState<PreparedImport | null>(null),
    [error, setError] = useState('');
  const [separate, setSeparate] = useState((asset.parts?.length ?? 1) <= 200);
  const [checkingSolids, setCheckingSolids] = useState(
    asset.indices.length / 3 <= 100000,
  );
  const [saving, setSaving] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    let active = true;
    setPrepared(null);
    setError('');
    void prepareImport(asset, options, separate, checkingSolids)
      .then((v) => {
        if (active) setPrepared(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
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
      <h2>{asset.name}</h2>
      <p className="asset-caption">
        {asset.format.toUpperCase()} ·{' '}
        {(asset.indices.length / 3).toLocaleString()} triangles ·{' '}
        {asset.parts ? `${asset.parts.length} elements` : 'geometry only'}
      </p>
      <fieldset disabled={saving} className="asset-options-fieldset">
        <div className="asset-options">
          <label>
            File units
            <select
              aria-label="File units"
              value={options.units}
              onChange={(e) =>
                setOptions({
                  ...options,
                  units: e.target.value as ImportOptions['units'],
                })
              }
            >
              {asset.format === 'fbx' && (
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
              onChange={(e) =>
                setOptions({ ...options, up: e.target.value as 'Y' | 'Z' })
              }
            >
              <option value="Y">Y up</option>
              <option value="Z">Z up</option>
            </select>
          </label>
        </div>
        {asset.parts && (
          <label className="asset-separate">
            <input
              type="checkbox"
              checked={separate}
              onChange={(e) => setSeparate(e.target.checked)}
            />
            Keep elements separate and grouped
          </label>
        )}
        {(asset.parts?.length ?? 0) > 200 && (
          <p className="asset-note">
            This file has more than 200 elements, so it opens combined. Export
            smaller views to edit every element separately.
          </p>
        )}
        <label className="asset-separate">
          <input
            type="checkbox"
            checked={checkingSolids}
            onChange={(e) => setCheckingSolids(e.target.checked)}
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
            {prepared.volumes.length > 1
              ? `${prepared.volumes.length} editable elements · ${prepared.volumes.filter((v) => v.geometry?.kind === 'mesh' && v.geometry.solid).length} closed solids`
              : prepared.volumes[0].geometry?.kind === 'mesh' &&
                  prepared.volumes[0].geometry.solid
                ? 'Closed solid · ready for modeling'
                : 'Reference surface · move, rotate and scale'}
          </span>
        </div>
      ) : (
        <p role={error ? 'alert' : 'status'}>
          {error || 'Checking the geometry…'}
        </p>
      )}
      {errorText && (
        <p role="alert" className="asset-error">
          {errorText}
        </p>
      )}
      {asset.warnings?.map((warning) => (
        <p className="asset-note" key={warning}>
          {warning}
        </p>
      ))}
      <p className="asset-note">
        Added beside your current model.{' '}
        {asset.parts
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
            await onAdd(prepared);
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
