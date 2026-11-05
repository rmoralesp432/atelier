import { useEffect, useId, useRef, type RefObject } from 'react';
export type AudioLevels = { input: number; output: number };
/** A soft, morphing form without an enclosing shell. Measured audio drives energy;
 * the separate thinking motion communicates a request, not invented speech. */
const contours = [
  'M50 9 C67 5 72 20 84 27 C98 36 88 49 86 59 C83 77 69 73 59 84 C48 96 38 83 25 80 C9 78 14 63 9 49 C3 33 21 30 28 20 C34 10 40 11 50 9 Z',
  'M50 13 C66 19 80 8 86 24 C91 37 77 43 84 58 C92 76 73 83 59 79 C44 74 43 93 27 83 C13 75 22 63 13 50 C2 34 14 20 29 24 C40 28 38 8 50 13 Z',
  'M50 7 C66 4 65 23 81 25 C99 27 86 45 89 58 C92 75 77 72 65 85 C51 99 42 78 27 80 C8 83 17 65 10 51 C2 35 22 34 25 23 C28 8 37 10 50 7 Z',
  'M50 16 C67 21 77 9 87 25 C97 40 78 45 83 58 C91 78 75 88 62 81 C46 73 40 92 26 79 C11 66 25 61 13 47 C1 33 18 17 30 22 C40 27 38 12 50 16 Z',
];
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
  const shape = useRef<SVGSVGElement>(null);
  const gradient = `orb-${useId().replace(/:/g, '')}`;
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      if (preference.matches) shape.current?.pauseAnimations();
      else shape.current?.unpauseAnimations();
    };
    sync();
    preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
  }, []);
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
      <svg ref={shape} className="orb-core" viewBox="0 0 100 100">
        <defs>
          <radialGradient id={gradient} cx="30%" cy="24%" r="80%">
            <stop offset="0" stopColor="#dce9eb" />
            <stop offset=".38" stopColor="#91aab5" />
            <stop offset="1" stopColor="#4d6979" />
          </radialGradient>
        </defs>
        <path d={contours[0]} fill={`url(#${gradient})`}>
          <animate
            attributeName="d"
            values={[...contours, contours[0]].join(';')}
            dur={state === 'thinking' ? '4s' : '8s'}
            repeatCount="indefinite"
            calcMode="spline"
            keyTimes="0;.25;.5;.75;1"
            keySplines=".42 0 .58 1;.42 0 .58 1;.42 0 .58 1;.42 0 .58 1"
          />
        </path>
      </svg>
    </span>
  );
}
