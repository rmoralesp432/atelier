import { Play, Pause, SlidersHorizontal, X } from 'lucide-react';
import type { SolarStudy } from './solar';
export default function SolarPlayer({
  value,
  playing,
  onPlaying,
  onSettings,
  onStop,
}: {
  value: SolarStudy;
  playing: boolean;
  onPlaying: (value: boolean) => void;
  onSettings: () => void;
  onStop: () => void;
}) {
  const time =
    `${Math.floor(value.minutes / 60)}`.padStart(2, '0') +
    ':' +
    `${value.minutes % 60}`.padStart(2, '0');
  return (
    <section
      className="solar-player"
      aria-label="Sun study playback"
      data-minutes={value.minutes}
    >
      <button
        aria-label={playing ? 'Pause solar animation' : 'Play solar animation'}
        onClick={() => onPlaying(!playing)}
      >
        {playing ? <Pause size={17} /> : <Play size={17} />}
      </button>
      <time
        dateTime={`${value.date}T${time}`}
        title={`${value.date} · site time`}
      >
        {time}
      </time>
      <button aria-label="Open sun settings" onClick={onSettings}>
        <SlidersHorizontal size={17} />
      </button>
      <button aria-label="Stop sun study" onClick={onStop}>
        <X size={17} />
      </button>
    </section>
  );
}
