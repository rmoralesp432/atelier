import {
  readLanguage,
  saveLanguage,
  requestedLanguage,
  languagePolicy,
  type ConversationLanguage,
} from './language';
import { AudioMeter } from './audioMeter';
import type { AudioLevels } from './AudioOrb';
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
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private responseActive = false;
  private responsePending = false;
  private working = 0;
  private muted = false;
  private hidden = false;
  private speaking = false;
  private language: ConversationLanguage = 'en';
  private readonly visibility = () => {
    this.hidden = document.visibilityState === 'hidden';
    this.updateCapture();
  };
  private readonly pageHide = () => this.stop();
  private updateCapture() {
    // Echo cancellation permits normal Realtime barge-in. Where the browser
    // cannot provide it, pause capture during playback rather than feed it back.
    // Support alone does not mean the active microphone actually enabled AEC.
    // Unsupported constraints are normally omitted, not reported as false.
    const echo = this.stream
      ?.getTracks()
      .every((track) => track.getSettings?.().echoCancellation === true);
    const enabled =
      !this.closed && !this.muted && !this.hidden && (echo || !this.speaking);
    this.stream?.getTracks().forEach((t) => {
      t.enabled = enabled;
    });
    if (!this.closed)
      this.onStatus(
        this.hidden
          ? 'Paused while in background'
          : this.muted
            ? 'Muted'
            : this.working
              ? 'Working'
              : this.speaking
                ? 'Speaking'
                : 'Listening',
      );
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    this.updateCapture();
  }
  setLanguage(language: ConversationLanguage) {
    if (this.language === language) return;
    this.language = language;
    saveLanguage(language);
    if (!this.closed && this.channel?.readyState === 'open')
      this.channel.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'system',
            content: [{ type: 'input_text', text: languagePolicy(language) }],
          },
        }),
      );
  }
  private requestResponse() {
    if (
      this.closed ||
      !this.responsePending ||
      this.responseActive ||
      this.channel?.readyState !== 'open'
    )
      return;
    this.responsePending = false;
    this.responseActive = true;
    this.channel.send(JSON.stringify({ type: 'response.create' }));
  }
  constructor(
    private onInstruction: (text: string) => Promise<string>,
    private onStatus: (status: string) => void,
    private options: {
      levels?: AudioLevels;
      language?: ConversationLanguage;
      lobby?: { id: string; name: string }[];
    } = {},
  ) {}
  async start() {
    this.closed = false;
    this.language = this.options.language ?? readLanguage();
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.stop();
      throw new Error('Voice requires HTTPS and microphone access.');
    }
    try {
      this.onStatus('Connecting');
      if (this.options.levels) this.meter = new AudioMeter(this.options.levels);
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (this.closed) {
        this.stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream.getTracks().forEach((track) => {
        track.onended = () => {
          if (!this.closed) {
            this.stop();
            this.onStatus('Microphone interrupted. Start voice to reconnect.');
          }
        };
      });
      if (typeof document !== 'undefined')
        document.addEventListener('visibilitychange', this.visibility);
      window.addEventListener?.('pagehide', this.pageHide);
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
        if (this.closed) return;
        if (peer.connectionState === 'connected') {
          if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
          this.disconnectTimer = null;
          this.updateCapture();
        } else if (peer.connectionState === 'disconnected') {
          this.onStatus('Reconnecting voice…');
          if (!this.disconnectTimer)
            this.disconnectTimer = setTimeout(() => {
              this.stop();
              this.onStatus('Voice disconnected. Start voice to reconnect.');
            }, 15_000);
        } else if (['failed', 'closed'].includes(peer.connectionState)) {
          this.stop();
          this.onStatus('Voice disconnected. Start voice to reconnect.');
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
          language: this.language,
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
        if (e.error?.code === 'conversation_already_has_active_response') {
          // A tool may finish before Realtime's response.done. Defer its spoken
          // result; do not tear down the microphone or repeat the modeling call.
          this.responsePending = true;
          this.responseActive = true;
          return;
        }
        if (e.error?.code === 'response_cancel_not_active') return;
        this.stop();
        this.onStatus('Voice service error. Start voice to reconnect.');
        return;
      }
      if (e.type === 'response.created') this.responseActive = true;
      if (e.type === 'response.done') {
        this.responseActive = false;
        this.requestResponse();
        this.updateCapture();
      }
      if (e.type === 'output_audio_buffer.started') {
        this.speaking = true;
        this.updateCapture();
      }
      if (
        e.type === 'output_audio_buffer.stopped' ||
        e.type === 'output_audio_buffer.cleared'
      ) {
        this.speaking = false;
        this.updateCapture();
      }
      if (e.type === 'input_audio_buffer.speech_started') this.updateCapture();
      if (
        e.type !== 'response.function_call_arguments.done' ||
        e.name !== (this.options.lobby ? 'open_project' : 'design') ||
        this.handled.has(e.call_id)
      )
        return;
      this.handled.add(e.call_id);
      this.working++;
      this.updateCapture();
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
        if (!this.options.lobby)
          this.setLanguage(requestedLanguage(instruction, this.language));
        output = await this.onInstruction(instruction);
      } catch (err) {
        output =
          err instanceof Error
            ? err.message
            : 'The operation could not be completed.';
      }
      this.working--;
      if (!this.closed && this.channel?.readyState === 'open') {
        this.channel.send(
          JSON.stringify({
            type: 'conversation.item.create',
            item: { type: 'function_call_output', call_id: e.call_id, output },
          }),
        );
        this.responsePending = true;
        this.requestResponse();
        this.updateCapture();
      }
    } catch {
      this.onStatus('Invalid voice event. Reconnect to continue.');
    }
  }
  stop() {
    this.closed = true;
    this.meter?.stop();
    this.meter = null;
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    this.disconnectTimer = null;
    this.responsePending = false;
    this.responseActive = false;
    if (typeof document !== 'undefined')
      document.removeEventListener('visibilitychange', this.visibility);
    window.removeEventListener?.('pagehide', this.pageHide);
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
