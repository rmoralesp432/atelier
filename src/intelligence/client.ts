import type { SceneObservation } from './observation';
import { ModelPlanError } from './planFailure';
import { AudioMeter } from '../conversation/audioMeter';
import type { AudioLevels } from '../conversation/AudioOrb';
import type { ExecutionContext } from './executionProtocol';
import type { ValidationFeedback } from './checkedPlanner';
import { parsePlan, type Operation } from './plan';
import { sceneContext, type CameraContext } from './context';
import type { Session } from './engine';
export type Message = {
  role: 'user' | 'assistant';
  content: string;
  summary?: string;
  images?: string[];
};
export type Connection = {
  configured: boolean;
  authenticated: boolean;
  voiceConfigured: boolean;
  agentConfigured?: boolean;
};
export async function connection(): Promise<Connection> {
  try {
    const r = await fetch('/api/config');
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { configured: false, authenticated: true, voiceConfigured: false };
  }
}
export async function requestPlan(
  message: string,
  session: Session,
  camera: CameraContext,
  history: Message[],
  signal?: AbortSignal,
  pendingReview?: {
    message: string;
    operations: Operation[];
    outcome: string;
  } | null,
  workspace?: {
    solar?: import('../studio/solar').SolarStudy;
    mapVisible: boolean;
    arActive?: boolean;
    mapConfigured: boolean;
    view: 'perspective' | 'orthographic' | 'top';
    theme: 'day' | 'night';
    renderMode: 'studio' | 'wireframe' | 'hidden-line';
    section?: import('../studio/section').SectionView;
  },
  validationFeedback?: ValidationFeedback,
  images?: string[],
  execution?: ExecutionContext,
  observation?: SceneObservation,
) {
  const r = await fetch('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      execution,
      observation,
      validationFeedback,
      images,
      pendingReview,
      workspace,
      historyAvailability: {
        undo: session.past.length,
        redo: session.future.length,
      },
      scene: sceneContext(session.project, session.context, camera),
      history: history.slice(-20).map((m) => ({
        role: m.role,
        content: m.content.slice(0, 4000),
        ...(m.role === 'user' &&
        m === [...history].reverse().find((m) => m.images?.length) &&
        !images?.length
          ? { images: m.images }
          : {}),
      })),
    }),
    signal,
  });
  let data;
  try {
    data = await r.json();
  } catch {
    throw new Error(
      'The AI backend is unavailable. Open ATELIER through its configured application server.',
    );
  }
  if (!r.ok && data.code === 'invalid_plan')
    throw new ModelPlanError(data.error);
  if (!r.ok)
    throw new Error(
      data.error || 'The AI request failed. No geometry was changed.',
    );
  return parsePlan(data);
}
export class VoiceConnection {
  private peer: RTCPeerConnection | null = null;
  private stream: MediaStream | null = null;
  private channel: RTCDataChannel | null = null;
  private audio: HTMLAudioElement | null = null;
  private closed = true;
  private meter: AudioMeter | null = null;
  get active() {
    return !this.closed;
  }
  private request: AbortController | null = null;
  private handled = new Set<string>();
  private queue: Promise<void> = Promise.resolve();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private keepListening() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.stop();
      this.onStatus('Voice stopped after five minutes without speech.');
    }, 5 * 60_000);
  }
  constructor(
    private onInstruction: (text: string) => Promise<string>,
    private onStatus: (status: string) => void,
    private options: {
      levels?: AudioLevels;
      lobby?: { id: string; name: string }[];
    } = {},
  ) {}
  async start() {
    this.closed = false;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
      throw new Error('Voice requires HTTPS and microphone access.');
    try {
      this.onStatus('Connecting');
      if (this.options.levels) this.meter = new AudioMeter(this.options.levels);
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (this.closed) {
        this.stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.meter?.attach(this.stream, 'input');
      const peer = (this.peer = new RTCPeerConnection());
      this.audio = new Audio();
      this.audio.autoplay = true;
      peer.ontrack = (e) => {
        if (this.audio) {
          this.audio.srcObject = e.streams[0];
          this.meter?.attach(e.streams[0], 'output');
          void this.audio
            .play()
            .catch(() =>
              this.onStatus(
                'Click the microphone to reconnect and allow audio.',
              ),
            );
        }
      };
      this.stream.getTracks().forEach((t) => peer.addTrack(t, this.stream!));
      const channel = (this.channel = peer.createDataChannel('oai-events'));
      channel.onopen = () => {
        if (this.closed) return;
        this.keepListening();
        this.onStatus('Listening');
        if (this.options.lobby)
          channel.send(
            JSON.stringify({
              type: 'response.create',
              response: {
                instructions:
                  'Ask which project the user would like to open. Keep the greeting short.',
              },
            }),
          );
      };
      channel.onmessage = (e) => {
        // Keep speech/transport events immediate, but serialize modeling turns
        // so a spoken follow-up sees the preceding turn's resulting scene.
        let event;
        try {
          event = JSON.parse(e.data);
        } catch {
          return;
        }
        if (event.type === 'response.function_call_arguments.done') {
          this.queue = this.queue
            .then(() => this.event(e.data))
            .catch(() => {});
        } else void this.event(e.data);
      };
      peer.onconnectionstatechange = () => {
        if (
          ['failed', 'disconnected', 'closed'].includes(peer.connectionState) &&
          !this.closed
        ) {
          this.stop();
          this.onStatus('Voice disconnected');
        }
      };
      const offer = await peer.createOffer();
      if (this.closed) return;
      await peer.setLocalDescription(offer);
      await new Promise<void>((resolve, reject) => {
        if (peer.iceGatheringState === 'complete') {
          resolve();
          return;
        }
        const timer = setTimeout(() => {
          peer.removeEventListener('icegatheringstatechange', change);
          resolve();
        }, 3000);
        const change = () => {
          if (peer.iceGatheringState === 'complete') {
            clearTimeout(timer);
            peer.removeEventListener('icegatheringstatechange', change);
            resolve();
          }
        };
        peer.addEventListener('icegatheringstatechange', change);
      });
      if (this.closed) return;
      this.request = new AbortController();
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdp: peer.localDescription?.sdp,
          ...(this.options.lobby ? { lobby: this.options.lobby } : {}),
        }),
        signal: AbortSignal.any([
          this.request.signal,
          AbortSignal.timeout(45_000),
        ]),
      });
      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({ error: 'Voice backend unavailable.' }));
        throw new Error(data.error);
      }
      const sdp = await response.text();
      if (this.closed) return;
      await peer.setRemoteDescription({ type: 'answer', sdp });
    } catch (e) {
      if (this.closed) return;
      this.stop();
      throw e;
    }
  }
  private async event(raw: string) {
    if (this.closed) return;
    try {
      const e = JSON.parse(raw);
      if (e.type === 'error') {
        this.stop();
        this.onStatus('Voice service error. Reconnect to continue.');
        return;
      }
      if (e.type === 'output_audio_buffer.started') this.onStatus('Speaking');
      if (
        e.type === 'output_audio_buffer.stopped' ||
        e.type === 'output_audio_buffer.cleared'
      )
        this.onStatus('Listening');
      if (e.type === 'input_audio_buffer.speech_started') {
        this.keepListening();
        this.onStatus('Listening');
      }
      if (
        e.type !== 'response.function_call_arguments.done' ||
        e.name !== (this.options.lobby ? 'open_project' : 'design') ||
        this.handled.has(e.call_id)
      )
        return;
      this.handled.add(e.call_id);
      this.keepListening();
      this.onStatus('Working');
      let output: string;
      try {
        const args = JSON.parse(e.arguments);
        const instruction = this.options.lobby
          ? args.projectId
          : args.instruction;
        if (
          typeof instruction !== 'string' ||
          instruction.length > 4000 ||
          (this.options.lobby &&
            !this.options.lobby.some((p) => p.id === instruction))
        )
          throw new Error('Invalid voice instruction.');
        output = await this.onInstruction(instruction);
      } catch (err) {
        output =
          err instanceof Error
            ? err.message
            : 'The operation could not be completed.';
      }
      if (this.channel?.readyState === 'open') {
        this.channel.send(
          JSON.stringify({
            type: 'conversation.item.create',
            item: { type: 'function_call_output', call_id: e.call_id, output },
          }),
        );
        this.channel.send(JSON.stringify({ type: 'response.create' }));
        this.onStatus('Listening');
      }
    } catch {
      this.onStatus('Invalid voice event. Reconnect to continue.');
    }
  }
  stop() {
    this.closed = true;
    this.meter?.stop();
    this.meter = null;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    this.request?.abort();
    this.request = null;
    this.channel?.close();
    this.peer?.close();
    this.stream?.getTracks().forEach((t) => t.stop());
    if (this.audio) {
      this.audio.pause();
      this.audio.srcObject = null;
    }
    this.channel = null;
    this.peer = null;
    this.stream = null;
    this.audio = null;
    this.onStatus('Off');
  }
}
