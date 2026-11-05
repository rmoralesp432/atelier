import { useEffect, useRef, type RefObject } from 'react';
export type AudioLevels = { input: number; output: number };
/** Glass is a lightweight 2D composition. Only measured audio drives energy;
 * the separate thinking motion communicates a request, not invented speech. */
export default function AudioOrb({
  levels,
  state = 'idle',
  large = false,
}: {
  levels?: RefObject<AudioLevels>;
  state?: 'idle' | 'listening' | 'speaking' | 'thinking';
  large?: boolean;
}) {
  const element = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame = 0,
      smooth = 0;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const tick = () => {
      const target = Math.max(
        levels?.current.input ?? 0,
        levels?.current.output ?? 0,
      );
      smooth += (target - smooth) * 0.25;
      element.current?.style.setProperty(
        '--orb-energy',
        String(reduce.matches ? 0 : smooth),
      );
      if (element.current)
        element.current.dataset.audioLevel = smooth.toFixed(2);
      frame = requestAnimationFrame(tick);
    };
    if (state !== 'idle') tick();
    else if (element.current) {
      element.current.style.setProperty('--orb-energy', '0');
      element.current.dataset.audioLevel = '0.00';
    }
    return () => cancelAnimationFrame(frame);
  }, [levels, state]);
  return (
    <span
      ref={element}
      className={`audio-orb ${large ? 'orb-large' : ''}`}
      data-state={state}
      aria-hidden="true"
    >
      <span className="orb-core" />
      <span className="orb-caustic" />
      <span className="orb-rim" />
      <span className="orb-highlight" />
    </span>
  );
}
