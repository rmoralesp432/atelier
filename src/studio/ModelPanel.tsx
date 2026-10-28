import type { DrawingMode } from '../drawing/profile';
import { useEffect, useState } from 'react';
import {
  X,
  Box,
  Cylinder,
  Orbit,
  Square,
  Circle,
  Hexagon,
  Move3D,
  Maximize,
  Layers,
  RotateCw,
  Copy,
  FlipHorizontal2,
  Grid2X2,
} from 'lucide-react';
import { isLocked, isVisible, type Project } from '../model';
import { isProfile } from '../geometry/kernel';
import type { Operation } from '../intelligence/plan';
import { useFloatingPanel } from './useFloatingPanel';
export default function ModelPanel({
  project,
  initialAction,
  onOperation,
  onDraw,
  onTool,
  onGroups,
  onClose,
}: {
  project: Project;
  initialAction?: string | null;
  onOperation: (op: Operation) => void;
  onDraw: (mode: DrawingMode) => void;
  onTool: (t: 'translate' | 'reshape' | 'rotate') => void;
  onGroups: () => void;
  onClose: () => void;
}) {
  const floating = useFloatingPanel();
  const [activeAction, setActiveAction] = useState(initialAction ?? 'solid');
  const reveal = (action: string) => {
    setActiveAction(action);
    floating.ref.current?.scrollTo({ top: 0, behavior: 'instant' });
  };
  useEffect(() => {
    if (initialAction) reveal(initialAction);
  }, [initialAction]);
  const [solidShape, setSolidShape] = useState<'box' | 'cylinder' | 'sphere'>(
    'box',
  );
  const [copyDistance, setCopyDistance] = useState(10);
  const [mirrorAxis, setMirrorAxis] = useState<'x' | 'z'>('x');
  const [mirrorCoordinate, setMirrorCoordinate] = useState(0);
  const [columns, setColumns] = useState(3),
    [rows, setRows] = useState(1);
  const [spacingX, setSpacingX] = useState(10),
    [spacingZ, setSpacingZ] = useState(10);
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
      <div className="segmented-control" aria-label="Creation mode">
        <button
          aria-pressed={activeAction === 'solid'}
          onClick={() => reveal('solid')}
        >
          3D shapes
        </button>
        <button
          aria-pressed={activeAction === 'draw'}
          onClick={() => reveal('draw')}
        >
          Draw 2D
        </button>
        {ids.length > 0 && (
          <button
            aria-pressed={!['solid', 'draw'].includes(activeAction)}
            onClick={() => reveal('scale')}
          >
            Edit selection
          </button>
        )}
      </div>
      {activeAction === 'solid' && (
        <form
          className="solid-creation"
          onSubmit={(e) => {
            e.preventDefault();
            onOperation({
              type: 'create',
              shape: solidShape,
              width,
              depth: solidShape === 'box' ? depth : width,
              height: solidShape === 'sphere' ? width : height,
              count: 1,
            });
          }}
        >
          <h3>Create in three dimensions</h3>
          <div className="solid-shapes">
            {(
              [
                { id: 'box', name: 'Box', Icon: Box },
                { id: 'cylinder', name: 'Cylinder', Icon: Cylinder },
                { id: 'sphere', name: 'Sphere', Icon: Orbit },
              ] as const
            ).map(({ id, name, Icon }) => (
              <button
                type="button"
                key={id}
                aria-pressed={solidShape === id}
                onClick={() => setSolidShape(id)}
              >
                <Icon size={30} strokeWidth={1.2} />
                <span>{name}</span>
              </button>
            ))}
          </div>
          <div className="solid-dimensions">
            <label>
              {solidShape === 'box' ? 'Width' : 'Diameter'} · m
              <input
                aria-label="Solid width"
                type="number"
                min="0.1"
                max="500"
                step="any"
                required
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
              />
            </label>
            {solidShape === 'box' && (
              <label>
                Depth · m
                <input
                  aria-label="Solid depth"
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
            {solidShape !== 'sphere' && (
              <label>
                Height · m
                <input
                  aria-label="Solid height"
                  type="number"
                  min="0.1"
                  max="500"
                  step="any"
                  required
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                />
              </label>
            )}
          </div>
          <button className="primary-studio-action" type="submit">
            Create 3D shape
          </button>
          <p className="studio-caption">
            Start with a solid. Adjust it by dragging, using dimensions, or
            talking to Atelier.
          </p>
        </form>
      )}
      {ids.length > 0 && !['solid', 'draw'].includes(activeAction) && (
        <div className="model-action-grid" aria-label="Quick modeling actions">
          <button onClick={() => onTool('reshape')}>
            <Maximize size={19} />
            <strong>Push / pull</strong>
            <small>Drag a face</small>
            <kbd>P</kbd>
          </button>
          <button onClick={() => onTool('translate')}>
            <Move3D size={19} />
            <strong>Move</strong>
            <small>Drag arrows</small>
            <kbd>M</kbd>
          </button>
          <button onClick={() => onTool('rotate')}>
            <RotateCw size={19} />
            <strong>Rotate</strong>
            <small>Snap angles</small>
            <kbd>Q</kbd>
          </button>
          {['Scale', 'Stretch', 'Copy', 'Mirror', 'Array'].map((label) => (
            <button
              key={label}
              aria-pressed={activeAction === label.toLowerCase()}
              onClick={() => reveal(label.toLowerCase())}
            >
              <strong>{label}</strong>
              <small>
                {label === 'Stretch'
                  ? 'Keep one side fixed'
                  : label === 'Scale'
                    ? 'Resize together'
                    : 'Set precisely'}
              </small>
            </button>
          ))}
        </div>
      )}
      <div hidden={activeAction !== 'draw'}>
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
          Create a flat profile, then lift it into a solid. You can also
          describe a custom outline to Atelier.
        </p>
      </div>
      <div className="studio-divider" hidden={activeAction === 'solid'} />
      <h3 hidden={activeAction === 'solid'}>
        {ids.length
          ? `${ids.length} selected`
          : 'Select an object to transform'}
      </h3>
      {ids.length > 0 && activeAction !== 'solid' && (
        <>
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
          <section hidden={activeAction !== 'scale'}>
            <h3>Scale · resize proportionally</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onOperation({
                  type: 'scale',
                  targets: ids,
                  factor,
                  pivot: null,
                });
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
          </section>
          <section
            className="model-stretch"
            hidden={activeAction !== 'stretch'}
          >
            <h3>Stretch a side precisely</h3>
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
          </section>
          <section hidden={activeAction !== 'copy'}>
            <h3>
              <Copy size={15} /> Copy · keep the original
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onOperation({
                  type: 'duplicate',
                  targets: ids,
                  count: 1,
                  direction: 'east',
                  distance: copyDistance,
                });
              }}
            >
              <label>
                Copy spacing along project X · m
                <input
                  type="number"
                  min="0.1"
                  max="500"
                  step="any"
                  required
                  value={copyDistance}
                  onChange={(e) => setCopyDistance(Number(e.target.value))}
                />
              </label>
              <button className="primary-studio-action">Copy selection</button>
            </form>
          </section>
          <section hidden={activeAction !== 'mirror'}>
            <h3>
              <FlipHorizontal2 size={15} /> Mirror · create a reflected copy
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onOperation({
                  type: 'mirror',
                  targets: ids,
                  axis: mirrorAxis,
                  coordinate: mirrorCoordinate,
                  copy: true,
                });
              }}
            >
              <label>
                Mirror plane normal
                <select
                  value={mirrorAxis}
                  onChange={(e) => setMirrorAxis(e.target.value as 'x' | 'z')}
                >
                  <option value="x">Project X</option>
                  <option value="z">Project Z</option>
                </select>
              </label>
              <label>
                Mirror plane coordinate · m
                <input
                  type="number"
                  min="-1000"
                  max="1000"
                  step="any"
                  required
                  value={mirrorCoordinate}
                  onChange={(e) => setMirrorCoordinate(Number(e.target.value))}
                />
              </label>
              <button className="primary-studio-action">Mirror a copy</button>
            </form>
          </section>
          <section hidden={activeAction !== 'array'}>
            <h3>
              <Grid2X2 size={15} /> Array · repeat in a grid
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onOperation({
                  type: 'array_grid',
                  targets: ids,
                  rows,
                  columns,
                  spacingX,
                  spacingZ,
                });
              }}
            >
              <div className="model-field-pair">
                <label>
                  Columns
                  <input
                    type="number"
                    min="1"
                    max="20"
                    required
                    value={columns}
                    onChange={(e) => setColumns(Number(e.target.value))}
                  />
                </label>
                <label>
                  Rows
                  <input
                    type="number"
                    min="1"
                    max="20"
                    required
                    value={rows}
                    onChange={(e) => setRows(Number(e.target.value))}
                  />
                </label>
                <label>
                  X spacing · m
                  <input
                    type="number"
                    min="0.1"
                    max="1000"
                    step="any"
                    required
                    value={spacingX}
                    onChange={(e) => setSpacingX(Number(e.target.value))}
                  />
                </label>
                <label>
                  Z spacing · m
                  <input
                    type="number"
                    min="0.1"
                    max="1000"
                    step="any"
                    required
                    value={spacingZ}
                    onChange={(e) => setSpacingZ(Number(e.target.value))}
                  />
                </label>
              </div>
              <p className="studio-caption">
                Counts include the original. Spacing is center to center in
                project axes.
              </p>
              <button className="primary-studio-action">Create array</button>
            </form>
          </section>
          <button className="primary-studio-action" onClick={onGroups}>
            <Layers size={16} />
            Group this selection
          </button>
        </>
      )}
    </section>
  );
}
