import { useEffect, useRef, useState } from 'react';
import {
  X,
  ImagePlus,
  Box,
  StickyNote,
  Focus,
  Undo2,
  Redo2,
  Trash2,
  ArrowLeft,
} from 'lucide-react';
import BoardViewport from './BoardViewport';
import {
  boardItemPosition,
  parseBoard,
  type Moodboard as Board,
  type BoardItem,
} from './data';
import { referenceImage } from '../imports/reference';
import { listProjects, type SavedProject } from '../projects/library';
import { parseSession } from '../intelligence/engine';
import { isProfile } from '../geometry/kernel';
import { isVisible, type Project } from '../model';
export default function Moodboard({
  board,
  onChange,
  project,
  onClose,
  day,
  saved,
  saveError,
}: {
  board: Board;
  onChange: (board: Board) => void;
  project: Project;
  onClose: () => void;
  day: boolean;
  saved: boolean;
  saveError: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string | null>(
      board.items[0]?.id ?? null,
    ),
    [frame, setFrame] = useState(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState<SavedProject[]>([]),
    [source, setSource] = useState('current');
  const [past, setPast] = useState<Board[]>([]),
    [future, setFuture] = useState<Board[]>([]);
  const [note, setNote] = useState(''),
    [url, setUrl] = useState(''),
    [addingNote, setAddingNote] = useState(false);
  const current = useRef(board);
  current.current = board;
  useEffect(() => {
    dialog.current?.showModal();
    let active = true;
    void listProjects()
      .then((p) => {
        if (active) setEntries(p);
      })
      .catch(() => {
        if (active)
          setError(
            'Saved projects could not be listed. You can still add the current model.',
          );
      });
    return () => {
      active = false;
    };
  }, []);
  const commit = (next: Board) => {
    try {
      const valid = parseBoard(next);
      const previous = current.current;
      setPast((p) => [...p.slice(-9), previous]);
      setFuture([]);
      current.current = valid;
      onChange(valid);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const item = board.items.find((i) => i.id === selected);
  const patch = (id: string, values: Partial<BoardItem>) =>
    commit({
      ...current.current,
      items: current.current.items.map((i) =>
        i.id === id ? ({ ...i, ...values } as BoardItem) : i,
      ),
    });
  const add = (
    value:
      | { kind: 'image'; image: string }
      | { kind: 'model'; project: Project }
      | { kind: 'note'; text: string; url: string },
    title: string,
  ) => {
    const id = crypto.randomUUID();
    const next: Board = {
      version: 1,
      items: [
        ...current.current.items,
        {
          ...value,
          id,
          title: title.slice(0, 120),
          position: boardItemPosition(current.current.items.length),
          rotation: 0,
          scale: 1,
        },
      ],
    };
    parseBoard(next);
    commit(next);
    setSelected(id);
  };
  const addModel = () => {
    try {
      const entry = entries.find((e) => e.id === source);
      const p =
        source === 'current'
          ? project
          : entry
            ? parseSession(entry.session).project
            : null;
      if (!p || !p.volumes.some((v) => isVisible(v, p) && !isProfile(v)))
        throw new Error(
          'This project needs a visible 3D object. Extrude a shape or choose another project.',
        );
      add(
        { kind: 'model', project: JSON.parse(JSON.stringify(p)) },
        source === 'current' ? 'Current model' : entry!.name,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <dialog
      ref={dialog}
      className={`moodboard-dialog ${day ? 'board-day' : ''}`}
      aria-label="3D moodboard"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setError('Use Add image to bring an image into this board.');
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="board-header">
        <button onClick={onClose} aria-label="Back to model">
          <ArrowLeft size={17} />
          <span>Back to model</span>
        </button>
        <div>
          <strong>Moodboard</strong>
          <small>
            {saveError
              ? 'Not saved — export a project backup'
              : saved
                ? 'Saved with this project'
                : 'Saving board…'}
          </small>
        </div>
        <button
          onClick={() => setFrame((f) => f + 1)}
          aria-label="Frame moodboard"
        >
          <Focus size={18} />
        </button>
        <button onClick={onClose} aria-label="Close moodboard">
          <X size={18} />
        </button>
      </header>
      <div className="board-workspace">
        <BoardViewport
          board={board}
          selected={selected}
          onSelect={setSelected}
          onMove={(id, position) =>
            patch(id, {
              position: {
                x: Number(position.x.toFixed(3)),
                y: Number(position.y.toFixed(3)),
                z: Number(position.z.toFixed(3)),
              },
            })
          }
          onError={setError}
          day={day}
          frame={frame}
        />
        {!board.items.length && (
          <div className="board-empty">
            <span>Ideas, in space.</span>
            <p>
              Bring images, models and references together.
              <br />
              Start with an image or your current model.
            </p>
          </div>
        )}
        <aside className="board-shelf" aria-label="Moodboard library">
          <div className="board-add">
            <button disabled={busy} onClick={() => input.current?.click()}>
              <ImagePlus size={16} />
              {busy ? 'Reading image…' : 'Add image'}
            </button>
            <button onClick={() => setAddingNote((v) => !v)}>
              <StickyNote size={16} />
              Add reference
            </button>
          </div>
          <input
            ref={input}
            type="file"
            aria-label="Moodboard image"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setBusy(true);
              try {
                add(
                  { kind: 'image', image: await referenceImage(file) },
                  file.name.replace(/\.[^.]+$/, ''),
                );
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
          {addingNote && (
            <form
              className="board-reference-form"
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  add(
                    { kind: 'note', text: note.trim(), url: url.trim() },
                    note.trim().split('\n')[0].slice(0, 60) || 'Reference',
                  );
                  setAddingNote(false);
                  setNote('');
                  setUrl('');
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            >
              <label>
                Idea or reference
                <textarea
                  required
                  maxLength={1500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Light, texture, a spatial idea…"
                />
              </label>
              <label>
                Reference link (optional)
                <input
                  type="url"
                  value={url}
                  maxLength={2000}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…"
                />
              </label>
              <button type="submit">Place reference</button>
            </form>
          )}
          <label className="board-model-source">
            Model snapshot
            <select
              aria-label="Moodboard model source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="current">Current model</option>
              {entries.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <button className="board-add-model" onClick={addModel}>
            <Box size={16} />
            Add model to board
          </button>
          <div className="board-items" aria-label="Moodboard items">
            {board.items.map((i) => (
              <button
                key={i.id}
                aria-pressed={i.id === selected}
                onClick={() => setSelected(i.id)}
              >
                {i.kind === 'image' ? (
                  <ImagePlus size={15} />
                ) : i.kind === 'model' ? (
                  <Box size={15} />
                ) : (
                  <StickyNote size={15} />
                )}
                <span>{i.title || 'Untitled reference'}</span>
              </button>
            ))}
          </div>
          {item && (
            <div className="board-item-controls" key={item.id}>
              <label>
                Reference name
                <input
                  aria-label="Reference name"
                  defaultValue={item.title}
                  maxLength={120}
                  onBlur={(e) => {
                    if (e.target.value !== item.title)
                      patch(item.id, { title: e.target.value });
                  }}
                />
              </label>
              {item.kind === 'note' && (
                <>
                  <label>
                    Reference text
                    <textarea
                      defaultValue={item.text}
                      maxLength={1500}
                      onBlur={(e) => {
                        if (e.target.value !== item.text)
                          patch(item.id, { text: e.target.value });
                      }}
                    />
                  </label>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open reference ↗
                    </a>
                  )}
                </>
              )}
              <div className="board-fields">
                <label>
                  Size
                  <input
                    aria-label="Moodboard item size"
                    type="number"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={item.scale}
                    onChange={(e) => {
                      if (e.target.value)
                        patch(item.id, { scale: Number(e.target.value) });
                    }}
                  />
                </label>
                <label>
                  Turn °
                  <input
                    aria-label="Moodboard item rotation"
                    type="number"
                    min="-360"
                    max="360"
                    step="15"
                    value={item.rotation}
                    onChange={(e) => {
                      if (e.target.value)
                        patch(item.id, { rotation: Number(e.target.value) });
                    }}
                  />
                </label>
                <label>
                  Depth
                  <input
                    aria-label="Moodboard item depth"
                    type="number"
                    min="-100"
                    max="100"
                    step="0.5"
                    value={item.position.z}
                    onChange={(e) => {
                      if (e.target.value)
                        patch(item.id, {
                          position: {
                            ...item.position,
                            z: Number(e.target.value),
                          },
                        });
                    }}
                  />
                </label>
              </div>
              <button
                className="board-remove"
                onClick={() => {
                  commit({
                    ...board,
                    items: board.items.filter((i) => i.id !== item.id),
                  });
                  setSelected(null);
                }}
              >
                <Trash2 size={14} />
                Remove from board
              </button>
            </div>
          )}
          <p className="board-help">
            Drag a reference to arrange it. Drag empty space to orbit. Pinch or
            scroll to zoom. Models are independent snapshots.
          </p>
        </aside>
        <div className="board-history">
          <button
            aria-label="Undo moodboard edit"
            disabled={!past.length}
            onClick={() => {
              const previous = past.at(-1)!;
              setFuture((f) => [...f, board]);
              setPast((p) => p.slice(0, -1));
              current.current = previous;
              onChange(previous);
            }}
          >
            <Undo2 size={17} />
          </button>
          <button
            aria-label="Redo moodboard edit"
            disabled={!future.length}
            onClick={() => {
              const next = future.at(-1)!;
              setPast((p) => [...p, board]);
              setFuture((f) => f.slice(0, -1));
              current.current = next;
              onChange(next);
            }}
          >
            <Redo2 size={17} />
          </button>
          <span>{board.items.length} references</span>
        </div>
        {error && (
          <div role="alert" className="board-error">
            {error}
            <button
              onClick={() => setError('')}
              aria-label="Dismiss moodboard message"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
