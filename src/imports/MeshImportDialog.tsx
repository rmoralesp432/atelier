import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Box, X } from 'lucide-react';
import { prepareMesh, type MeshAsset, type ImportOptions } from './mesh';
import type { Volume } from '../model';
export default function MeshImportDialog({
  asset,
  onAdd,
  errorText,
  onClose,
}: {
  asset: MeshAsset;
  errorText?: string;
  onAdd: (v: Volume) => void;
  onClose: () => void;
}) {
  const [options, setOptions] = useState<ImportOptions>({
    units: 'm',
    up: asset.format === 'stl' ? 'Z' : 'Y',
  });
  const [prepared, setPrepared] = useState<Volume | null>(null),
    [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    let active = true;
    setPrepared(null);
    setError('');
    void prepareMesh(asset, options)
      .then((v) => {
        if (active) setPrepared(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [asset, options]);
  return (
    <dialog
      ref={dialog}
      className="asset-dialog"
      aria-label="Import 3D element"
      onCancel={onClose}
    >
      <button
        className="asset-close"
        aria-label="Cancel import"
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
        {(asset.indices.length / 3).toLocaleString()} triangles · geometry only
      </p>
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
            {prepared.geometry?.kind === 'mesh' && prepared.geometry.solid
              ? 'Closed solid · ready for modeling'
              : 'Reference surface · move, rotate and scale'}
          </span>
        </div>
      ) : (
        <p role="status">{error || 'Checking the geometry…'}</p>
      )}
      {errorText && (
        <p role="alert" className="asset-error">
          {errorText}
        </p>
      )}
      <p className="asset-note">
        Added beside your current model. Your existing objects stay in place.
        Materials and textures use ATELIER’s studio finish.
      </p>
      <button
        className="asset-submit"
        disabled={!prepared}
        onClick={() => prepared && onAdd(prepared)}
      >
        Add to workspace <ArrowUpRight size={17} />
      </button>
    </dialog>
  );
}
