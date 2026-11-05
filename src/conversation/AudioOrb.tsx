import { useEffect, useId, useRef, type RefObject } from 'react';
export type AudioLevels = { input: number; output: number };
/** A gently deforming, polished form without an enclosing shell. Measured audio drives energy;
 * the separate thinking motion communicates a request, not invented speech. */
const contours = [
  'M50 10 C73 9 90 27 90 50 C91 73 72 89 50 90 C28 91 10 72 10 50 C9 29 29 11 50 10 Z',
  'M48 9 C69 8 89 30 91 49 C94 70 71 89 51 91 C29 94 12 70 10 51 C8 30 27 12 48 9 Z',
  'M52 11 C76 10 88 27 88 48 C89 70 77 91 52 89 C30 87 8 74 10 52 C12 29 29 13 52 11 Z',
  'M49 10 C71 13 92 28 89 51 C86 73 74 87 49 89 C25 91 11 72 11 49 C11 26 27 7 49 10 Z',
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
          <radialGradient id={gradient} cx="32%" cy="26%" r="78%">
            <stop offset="0" stopColor="#f1f7f8" />
            <stop offset=".3" stopColor="#b9cbd1" />
            <stop offset=".68" stopColor="#698594" />
            <stop offset=".86" stopColor="#8da9b4" />
            <stop offset="1" stopColor="#d6e7e9" />
          </radialGradient>
          <radialGradient id={`${gradient}-shine`}>
            <stop offset="0" stopColor="white" stopOpacity=".9" />
            <stop offset=".5" stopColor="white" stopOpacity=".5" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d={contours[0]} fill={`url(#${gradient})`}>
          <animate
            attributeName="d"
            values={[...contours, contours[0]].join(';')}
            dur={state === 'thinking' ? '12s' : '18s'}
            repeatCount="indefinite"
            calcMode="spline"
            keyTimes="0;.25;.5;.75;1"
            keySplines=".42 0 .58 1;.42 0 .58 1;.42 0 .58 1;.42 0 .58 1"
          />
        </path>
        <ellipse
          cx="33"
          cy="25"
          rx="15"
          ry="6"
          transform="rotate(-32 33 25)"
          fill={`url(#${gradient}-shine)`}
        />
      </svg>
    </span>
  );
}
