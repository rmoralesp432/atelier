import { useEffect, useId, useRef, type RefObject } from 'react';
export type AudioLevels = { input: number; output: number };
/** A gently deforming, polished form without an enclosing shell. Measured audio drives energy;
 * the separate thinking motion communicates a request, not invented speech. */
const contours = [
  'M50 10 C73 9 90 27 90 50 C91 73 72 89 50 90 C28 91 10 72 10 50 C9 29 29 11 50 10 Z',
  'M47 9 C68 7 89 31 92 49 C95 69 71 89 51 92 C29 95 13 69 10 51 C7 31 26 13 47 9 Z',
  'M53 11 C77 10 87 27 87 47 C89 69 78 91 53 89 C31 86 7 75 10 53 C13 29 29 14 53 11 Z',
  'M49 10 C71 14 93 28 89 51 C85 73 75 86 49 89 C24 91 11 72 11 49 C11 25 27 6 49 10 Z',
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
            <stop offset="0" stopColor="#fafafa" />
            <stop offset=".3" stopColor="#c8c8c8" stopOpacity=".76" />
            <stop offset=".68" stopColor="#454545" stopOpacity=".68" />
            <stop offset=".86" stopColor="#999999" stopOpacity=".82" />
            <stop offset="1" stopColor="#eeeeee" />
          </radialGradient>
          <radialGradient id={`${gradient}-shine`}>
            <stop offset="0" stopColor="white" stopOpacity="1" />
            <stop offset=".5" stopColor="white" stopOpacity=".65" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${gradient}-gloss`} cx="36%" cy="30%" r="70%">
            <stop offset="0" stopColor="white" stopOpacity="0" />
            <stop offset=".48" stopColor="white" stopOpacity=".02" />
            <stop offset=".75" stopColor="white" stopOpacity=".3" />
            <stop offset=".9" stopColor="white" stopOpacity=".12" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        <defs>
          <path id={`${gradient}-surface`} d={contours[0]}>
            <animate
              attributeName="d"
              values={[...contours, contours[0]].join(';')}
              dur={state === 'thinking' ? '10s' : '14s'}
              repeatCount="indefinite"
              calcMode="spline"
              keyTimes="0;.25;.5;.75;1"
              keySplines=".42 0 .58 1;.42 0 .58 1;.42 0 .58 1;.42 0 .58 1"
            />
          </path>
        </defs>
        <use href={`#${gradient}-surface`} fill={`url(#${gradient})`} />
        <use
          className="orb-gloss"
          href={`#${gradient}-surface`}
          fill={`url(#${gradient}-gloss)`}
        />
        <use
          href={`#${gradient}-surface`}
          fill="none"
          stroke="white"
          strokeOpacity=".35"
          strokeWidth=".45"
        />
        <ellipse
          cx="33"
          cy="25"
          rx="15"
          ry="5"
          transform="rotate(-32 33 25)"
          fill={`url(#${gradient}-shine)`}
        />
      </svg>
    </span>
  );
}
