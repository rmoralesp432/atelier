import BrandMark from '../components/BrandMark';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, FolderOpen, Mic, MicOff, Plus } from 'lucide-react';
import AudioOrb, { type AudioLevels } from '../conversation/AudioOrb';
import {
  connection,
  VoiceConnection,
  type Connection,
} from '../intelligence/client';
import { projectById, type SavedProject, type ProjectSummary } from './library';
import { sampleHouse } from './sample';
import { newSession, serializeSession } from '../intelligence/engine';
export default function ProjectStart({
  projects,
  currentName,
  currentId,
  busy: parentBusy,
  error,
  onOpen,
}: {
  projects: ProjectSummary[];
  currentName?: string;
  currentId?: string;
  busy: boolean;
  error: string;
  onOpen: (project: SavedProject | null, ai: boolean) => Promise<boolean>;
}) {
  const [step, setStep] = useState<'connect' | 'projects'>('connect');
  const [opening, setOpening] = useState(false);
  const busy = parentBusy || opening;
  const [ai, setAI] = useState(false),
    [password, setPassword] = useState('');
  const [config, setConfig] = useState<Connection | null>(null);
  const [notice, setNotice] = useState(''),
    [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState('Off'),
    [name, setName] = useState('');
  const levels = useRef<AudioLevels>({ input: 0, output: 0 });
  const voice = useRef<VoiceConnection | null>(null);
  useEffect(() => {
    let live = true;
    void connection().then((c) => {
      if (live) setConfig(c);
    });
    return () => {
      live = false;
      voice.current?.stop();
    };
  }, []);
  const open = async (record: ProjectSummary | SavedProject | null) => {
    if (busy) return false;
    setOpening(true);
    voice.current?.stop();
    voice.current = null;
    try {
      const project =
        record && !('session' in record)
          ? await projectById(record.id)
          : (record as SavedProject | null);
      return await onOpen(project, ai);
    } catch (e) {
      setNotice((e as Error).message);
      return false;
    } finally {
      setOpening(false);
    }
  };
  const create = (title = 'Untitled study'): SavedProject => ({
    id: crypto.randomUUID(),
    name: title,
    updatedAt: Date.now(),
    session: serializeSession(newSession({ volumes: [], selectedId: null })),
    messages: [],
  });
  const enable = async () => {
    setConnecting(true);
    setNotice('');
    try {
      const c = await connection();
      if (!c.configured)
        throw new Error(
          'AI is not configured on this server yet. You can continue without it.',
        );
      if (!c.authenticated) {
        const r = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        setPassword('');
        if (!r.ok) throw new Error('That workspace password was not accepted.');
      }
      const unlocked = await connection();
      setConfig(unlocked);
      if (!unlocked.authenticated)
        throw new Error('Please unlock the workspace to enable AI.');
      setAI(true);
      setStep('projects');
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setConnecting(false);
    }
  };
  const startVoice = async () => {
    if (voice.current) {
      voice.current.stop();
      voice.current = null;
      return;
    }
    const choices = [
      ...projects.slice(0, 49).map(({ id, name }) => ({ id, name })),
      { id: '$sample', name: 'Sample glass pavilion' },
      { id: '$new', name: 'New blank project' },
      { id: '$current', name: currentName ?? 'Current workspace' },
    ];
    const v = new VoiceConnection(
      async (id) => {
        const record =
          id === '$sample'
            ? sampleHouse()
            : id === '$new'
              ? create()
              : id === '$current'
                ? null
                : projects.find((p) => p.id === id);
        if (record === undefined)
          return 'That project is unavailable. Choose a listed project.';
        return (await open(record))
          ? 'Project opened.'
          : 'The project could not be opened. See the project screen.';
      },
      (s) => {
        setStatus(s);
        if (!v.active && voice.current === v) voice.current = null;
      },
      { levels: levels.current, lobby: choices },
    );
    voice.current = v;
    try {
      await v.start();
    } catch (e) {
      setNotice((e as Error).message);
      voice.current = null;
    }
  };
  return (
    <main
      data-step={step}
      className="project-start"
      aria-label="ATELIER start screen"
    >
      <header>
        <span className="start-wordmark" role="img" aria-label="Atelier">
          <BrandMark />
        </span>
        <nav className="start-entry-actions">
          <details key={step} className="start-connection">
            <summary>AI settings</summary>{' '}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void enable();
              }}
            >
              {config?.configured && !config.authenticated && (
                <label>
                  Workspace password
                  <input
                    aria-label="Workspace password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              )}
              <button
                className="start-primary"
                disabled={!config || connecting}
                type="submit"
              >
                {connecting ? 'Connecting…' : 'Continue with AI'}
                <ArrowRight size={18} />
              </button>
            </form>
            <small>
              Your workspace password unlocks AI. Never enter an API key here.
            </small>
          </details>
        </nav>
      </header>
      <section className="start-intro">
        {
          <AudioOrb
            large
            levels={levels}
            state={
              status === 'Speaking'
                ? 'speaking'
                : status === 'Working' || status === 'Connecting'
                  ? 'thinking'
                  : status === 'Listening'
                    ? 'listening'
                    : 'idle'
            }
          />
        }
        <h1>
          {step === 'connect' ? 'Space for your ideas.' : 'Your projects.'}
        </h1>
        {step === 'connect' ? (
          <button
            className="start-enter"
            aria-label="Continue without AI"
            onClick={() => {
              setAI(false);
              setNotice('');
              setStep('projects');
            }}
          >
            Open studio <ArrowRight size={17} />
          </button>
        ) : (
          <>
            {ai && (
              <button
                className="start-voice"
                disabled={!config?.voiceConfigured || busy}
                onClick={() => void startVoice()}
              >
                {status === 'Off' ? <Mic size={18} /> : <MicOff size={18} />}
                {status === 'Off'
                  ? 'Talk to Atelier'
                  : `Stop voice · ${status}`}
              </button>
            )}
            {ai && (
              <small>
                Voice starts only when you tap. You can also choose a project
                below.
              </small>
            )}
            <form
              className="start-new-project"
              onSubmit={(e) => {
                e.preventDefault();
                void open(create(name.trim() || 'Untitled study'));
              }}
            >
              <input
                aria-label="Name your new project"
                placeholder="Name a new project…"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button disabled={busy} type="submit">
                <Plus size={18} />
                New project
              </button>
            </form>
            <div className="start-projects">
              <button disabled={busy} onClick={() => void open(null)}>
                <FolderOpen />
                <span>
                  <strong>{currentName ?? 'Continue workspace'}</strong>
                  <small>Your most recent space</small>
                </span>
                <ArrowRight size={18} />
              </button>
              {projects
                .filter((p) => p.id !== currentId)
                .map((p) => (
                  <button
                    key={p.id}
                    disabled={busy}
                    onClick={() => void open(p)}
                  >
                    <FolderOpen />
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        {new Date(p.updatedAt).toLocaleDateString()}
                      </small>
                    </span>
                    <ArrowRight size={18} />
                  </button>
                ))}
              <button disabled={busy} onClick={() => void open(sampleHouse())}>
                <span className="start-sample-mark">⌂</span>
                <span>
                  <strong>Explore the glass pavilion</strong>
                  <small>An editable sample house</small>
                </span>
                <ArrowRight size={18} />
              </button>
            </div>

            <label className="start-preference">
              <input
                type="checkbox"
                onChange={(e) => {
                  try {
                    localStorage.setItem(
                      'atelier.start-direct',
                      String(e.target.checked),
                    );
                  } catch {
                    /* Optional preference. */
                  }
                }}
              />
              Open my last project directly next time
            </label>
            <small>
              Projects are saved in this browser. Use project copies to move
              between devices.
            </small>
            <button
              className="start-back"
              onClick={() => {
                voice.current?.stop();
                setStep('connect');
                setAI(false);
              }}
            >
              Change AI preference
            </button>
          </>
        )}
        {(notice || error) && <p role="alert">{notice || error}</p>}
        {busy && <p role="status">Opening your project…</p>}
      </section>
    </main>
  );
}
