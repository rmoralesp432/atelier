import type { AudioLevels } from './AudioOrb';
export function audioEnergy(samples: Float32Array) {
  const rms = Math.sqrt(
    samples.reduce((sum, v) => sum + v * v, 0) / Math.max(1, samples.length),
  );
  return Math.min(1, Math.max(0, (rms - 0.006) * 6));
}
export class AudioMeter {
  private context: AudioContext | null = null;
  private nodes: {
    source: MediaStreamAudioSourceNode;
    analyser: AnalyserNode;
    values: Float32Array<ArrayBuffer>;
    channel: keyof AudioLevels;
  }[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  constructor(private levels: AudioLevels) {
    try {
      const Audio = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Audio) return;
      this.context = new Audio();
      void this.context!.resume().catch(() => {});
      this.timer = setInterval(() => {
        this.levels.input = this.levels.output = 0;
        for (const node of this.nodes) {
          node.analyser.getFloatTimeDomainData(node.values);
          this.levels[node.channel] = audioEnergy(node.values);
        }
      }, 40);
    } catch {
      this.stop();
    }
  }
  attach(stream: MediaStream, channel: keyof AudioLevels) {
    if (!this.context) return;
    for (const node of this.nodes.filter((n) => n.channel === channel)) {
      node.source.disconnect();
      node.analyser.disconnect();
    }
    this.nodes = this.nodes.filter((n) => n.channel !== channel);
    const source = this.context.createMediaStreamSource(stream),
      analyser = this.context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser); // Never route microphone audio to the speakers.
    this.nodes.push({
      source,
      analyser,
      values: new Float32Array(512),
      channel,
    });
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.nodes.forEach(({ source, analyser }) => {
      source.disconnect();
      analyser.disconnect();
    });
    this.nodes = [];
    void this.context?.close().catch(() => {});
    this.context = null;
    this.levels.input = this.levels.output = 0;
  }
}
