import type { DrawingMode } from '../drawing/profile';
import { useState } from 'react';
import {
  X,
  Square,
  Circle,
  Hexagon,
  Move3D,
  Maximize,
  Layers,
} from 'lucide-react';
import { isLocked, isVisible, type Project } from '../model';
import { isProfile } from '../geometry/kernel';
import type { Operation } from '../intelligence/plan';
import { useFloatingPanel } from './useFloatingPanel';
export default function ModelPanel({
  project,
  onOperation,
  onDraw,
  onTool,
  onGroups,
  onClose,
}: {
  project: Project;
  onOperation: (op: Operation) => void;
  onDraw: (mode: DrawingMode) => void;
  onTool: (t: 'translate' | 'reshape') => void;
  onGroups: () => void;
  onClose: () => void;
}) {
  const floating = useFloatingPanel();
  const [shape, setShape] = useState<'rectangle' | 'circle' | 'polygon'>(
    'rectangle',
  );
  const [width, setWidth] = useState(8),
    [depth, setDepth] = useState(6),
    [sides, setSides] = useState(6);
  const [height, setHeight] = useState(3),
    [factor, setFactor] = useState(1.2),
    [distance, setDistance] = useState(1);
  const [axis, setAxis] = useState<'width' | 'depth' | 'height'>('width');
  const [side, setSide] = useState<'min' | 'max'>('max');
  const ids = (
    project.selectedIds ?? (project.selectedId ? [project.selectedId] : [])
  ).filter((id) =>
    project.volumes.some(
      (v) => v.id === id && isVisible(v, project) && !isLocked(v, project),
    ),
  );
  const selected = project.volumes.find((v) => v.id === project.selectedId);
  return (
    <section
      className="section-panel model-panel"
      aria-label="Create and transform"
      ref={floating.ref}
      style={floating.style}
      onPointerDownCapture={floating.raise}
    >
      <div
        className="studio-panel-heading panel-drag-handle"
        {...floating.handle}
        role="button"
        tabIndex={0}
        aria-label="Move modeling panel"
      >
        <strong>Create & transform</strong>
        <button aria-label="Close modeling tools" onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      <h3>Draw a face, then pull it into space</h3>
      <div className="theme-options">
        <button onClick={() => onDraw('rectangle')}>Draw rectangle</button>
        <button onClick={() => onDraw('circle')}>Draw circle</button>
        <button onClick={() => onDraw('outline')}>Draw outline</button>
      </div>
      <p className="studio-caption">
        Click directly in the workspace. Or create a face by dimensions below.
      </p>
      <h3>Start with dimensions</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onOperation(
            shape === 'polygon'
              ? {
                  type: 'footprint',
                  name: `${sides}-sided profile`,
                  points: Array.from({ length: sides }, (_, i) => ({
                    x: (Math.cos((i * 2 * Math.PI) / sides) * width) / 2,
                    z: (Math.sin((i * 2 * Math.PI) / sides) * depth) / 2,
                  })),
                  height: 3,
                  extruded: false,
                  x: 0,
                  y: 0,
                  z: 0,
                  rotation: 0,
                }
              : {
                  type: 'create',
                  shape,
                  width,
                  depth: shape === 'circle' ? width : depth,
                  height: 3,
                  count: 1,
                },
          );
        }}
      >
        <div className="theme-options">
          {(
            [
              { shape: 'rectangle', label: 'Rectangle', Icon: Square },
              { shape: 'circle', label: 'Circle', Icon: Circle },
              { shape: 'polygon', label: 'Polygon', Icon: Hexagon },
            ] as const
          ).map((item) => (
            <button
              key={item.shape}
              type="button"
              aria-pressed={shape === item.shape}
              onClick={() => setShape(item.shape)}
            >
              <item.Icon size={17} />
              {item.label}
            </button>
          ))}
        </div>
        <label>
          {shape === 'circle' ? 'Diameter' : 'Shape width'} · m
          <input
            aria-label="Shape width"
            type="number"
            min="0.1"
            max="500"
            step="any"
            required
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          />
        </label>
        {shape !== 'circle' && (
          <label>
            Shape depth · m
            <input
              aria-label="Shape depth"
              type="number"
              min="0.1"
              max="500"
              step="any"
              required
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
            />
          </label>
        )}
        {shape === 'polygon' && (
          <label>
            Sides
            <input
              type="number"
              min="3"
              max="32"
              step="1"
              required
              value={sides}
              onChange={(e) => setSides(Number(e.target.value))}
            />
          </label>
        )}
        <button className="primary-studio-action" type="submit">
          Create 2D shape
        </button>
      </form>
      <p className="studio-caption">
        Create a flat profile, then lift it into a solid. You can also describe
        a custom outline to Atelier.
      </p>
      <div className="studio-divider" />
      <h3>
        {ids.length
          ? `${ids.length} selected`
          : 'Select an object to transform'}
      </h3>
      {ids.length > 0 && (
        <>
          <div className="theme-options">
            <button onClick={() => onTool('translate')}>
              <Move3D size={16} />
              Move together
            </button>
            <button onClick={() => onTool('reshape')}>
              <Maximize size={16} />
              Push / pull
            </button>
          </div>
          <p className="studio-caption">
            Push / pull stretches the active object's face; the opposite face
            stays fixed.
          </p>
          {selected && ids.includes(selected.id) && isProfile(selected) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onOperation({ type: 'extrude', target: selected.id, height });
              }}
            >
              <label>
                Extrusion height · m
                <input
                  type="number"
                  min="0.1"
                  max="500"
                  step="any"
                  required
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                />
              </label>
              <button className="primary-studio-action">
                Extrude selected shape
              </button>
            </form>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onOperation({ type: 'scale', targets: ids, factor, pivot: null });
            }}
          >
            <label>
              Scale factor
              <input
                type="number"
                min="0.01"
                max="100"
                step="any"
                required
                value={factor}
                onChange={(e) => setFactor(Number(e.target.value))}
              />
            </label>
            <button className="primary-studio-action">Scale selection</button>
          </form>
          <details className="model-stretch">
            <summary>Stretch a side precisely</summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onOperation({
                  type: 'stretch',
                  targets: ids,
                  axis,
                  side,
                  distance,
                });
              }}
            >
              <label>
                Direction
                <select
                  value={axis}
                  onChange={(e) => setAxis(e.target.value as typeof axis)}
                >
                  <option value="width">Width</option>
                  <option value="depth">Depth</option>
                  <option value="height">Height</option>
                </select>
              </label>
              <label>
                Side
                <select
                  value={side}
                  onChange={(e) => setSide(e.target.value as typeof side)}
                >
                  <option value="max">Positive side</option>
                  <option value="min">Negative side</option>
                </select>
              </label>
              <label>
                Stretch distance · m
                <input
                  type="number"
                  min="-500"
                  max="500"
                  step="any"
                  required
                  value={distance}
                  onChange={(e) => setDistance(Number(e.target.value))}
                />
              </label>
              <button className="primary-studio-action">
                Stretch selection
              </button>
            </form>
          </details>
          <button className="primary-studio-action" onClick={onGroups}>
            <Layers size={16} />
            Group this selection
          </button>
        </>
      )}
    </section>
  );
}
