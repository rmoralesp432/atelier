import { useEffect, useId, useRef, type RefObject } from 'react';
export type AudioLevels = { input: number; output: number };
/** A gently deforming, polished form without an enclosing shell. Measured audio drives energy;
 * the separate thinking motion communicates a request, not invented speech. */
const contours = [
  'M50 10 C73 9 90 27 90 50 C91 73 72 89 50 90 C28 91 10 72 10 50 C9 29 29 11 50 10 Z',
  'M46 8 C70 5 89 29 92 48 C96 70 72 91 51 92 C29 95 12 70 9 51 C6 30 25 12 46 8 Z',
  'M54 11 C78 9 89 26 88 47 C90 70 78 92 53 90 C30 87 6 75 10 53 C13 29 30 14 54 11 Z',
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
  const response = useRef<SVGGElement>(null);
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
      smooth = 0,
      phase = 0,
      previous = 0;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const draw = (energy: number) => {
      element.current?.style.setProperty('--orb-energy', String(energy));
      // Deform the entire glass surface and its highlights together. Silence
      // has no speech motion; the slower idle contour remains independent.
      const flex = Math.sin(phase) * energy * 0.18;
      const tilt = Math.sin(phase * 0.63) * energy * 14;
      response.current?.setAttribute(
        'transform',
        `translate(50 50) rotate(${tilt}) scale(${1 + flex} ${1 - flex * 0.72}) translate(-50 -50)`,
      );
    };
    const tick = (now: number) => {
      const elapsed = previous
        ? Math.min((now - previous) / 1000, 0.05)
        : 1 / 60;
      previous = now;
      const measured = Math.max(
        levels?.current.input ?? 0,
        levels?.current.output ?? 0,
      );
      // Compress the visual range so ordinary, quieter speech is visible too.
      // The meter's noise floor stays intact; this does not amplify audio.
      const target = Math.min(1, Math.sqrt(Math.max(0, measured)) * 1.35);
      const responseTime = target > smooth ? 0.06 : 0.18;
      smooth += (target - smooth) * (1 - Math.exp(-elapsed / responseTime));
      phase += elapsed * (5 + smooth * 8);
      draw(reduce.matches ? 0 : smooth);
      if (element.current)
        element.current.dataset.audioLevel = smooth.toFixed(2);
      frame = requestAnimationFrame(tick);
    };
    if (state !== 'idle') frame = requestAnimationFrame(tick);
    else if (element.current) {
      draw(0);
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
          <radialGradient id={gradient} cx="32%" cy="24%" r="81%">
            <stop offset="0" stopColor="#ffffff" stopOpacity=".9" />
            <stop offset=".26" stopColor="#ddd" stopOpacity=".78" />
            <stop offset=".54" stopColor="#7a7a7a" stopOpacity=".75" />
            <stop offset=".76" stopColor="#303030" stopOpacity=".85" />
            <stop offset=".91" stopColor="#969696" stopOpacity=".75" />
            <stop offset="1" stopColor="#fafafa" stopOpacity=".9" />
          </radialGradient>
          <radialGradient id={`${gradient}-shine`}>
            <stop offset="0" stopColor="white" stopOpacity="1" />
            <stop offset=".5" stopColor="white" stopOpacity=".65" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${gradient}-gloss`} cx="33%" cy="25%" r="73%">
            <stop offset="0" stopColor="white" stopOpacity="0" />
            <stop offset=".48" stopColor="white" stopOpacity=".02" />
            <stop offset=".75" stopColor="white" stopOpacity=".48" />
            <stop offset=".9" stopColor="white" stopOpacity=".2" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <linearGradient
            id={`${gradient}-reflection`}
            x1="0"
            y1="0"
            x2=".8"
            y2="1"
          >
            <stop offset="0" stopColor="white" stopOpacity=".95" />
            <stop offset=".5" stopColor="white" stopOpacity=".4" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`${gradient}-depth`} cx="64%" cy="66%" r="58%">
            <stop offset="0" stopColor="#000" stopOpacity=".2" />
            <stop offset=".65" stopColor="#000" stopOpacity=".04" />
            <stop offset="1" stopColor="#fff" stopOpacity=".18" />
          </radialGradient>
        </defs>
        <defs>
          <path id={`${gradient}-surface`} d={contours[0]}>
            <animate
              attributeName="d"
              values={[...contours, contours[0]].join(';')}
              dur={state === 'thinking' ? '7s' : '10s'}
              repeatCount="indefinite"
              calcMode="spline"
              keyTimes="0;.25;.5;.75;1"
              keySplines=".42 0 .58 1;.42 0 .58 1;.42 0 .58 1;.42 0 .58 1"
            />
          </path>
          <clipPath id={`${gradient}-clip`}>
            <use href={`#${gradient}-surface`} />
          </clipPath>
        </defs>
        <g ref={response} className="orb-response">
          <use href={`#${gradient}-surface`} fill={`url(#${gradient})`} />
          <use href={`#${gradient}-surface`} fill={`url(#${gradient}-depth)`} />
          <use
            className="orb-gloss"
            href={`#${gradient}-surface`}
            fill={`url(#${gradient}-gloss)`}
          />
          <use
            href={`#${gradient}-surface`}
            fill="none"
            stroke="white"
            strokeOpacity=".5"
            strokeWidth=".45"
          />
          <g clipPath={`url(#${gradient}-clip)`}>
            <g className="orb-reflections">
              <path
                d="M18 42 C17 25 33 13 49 15 C35 17 25 29 24 43 C22 47 20 46 18 42Z"
                fill={`url(#${gradient}-reflection)`}
              />
              <path
                d="M33 78 C52 91 79 74 82 52 C85 72 67 88 51 88 C43 86 37 83 33 78Z"
                fill={`url(#${gradient}-reflection)`}
                opacity=".72"
              />
              <ellipse
                cx="35"
                cy="23"
                rx="16"
                ry="6"
                transform="rotate(-30 35 23)"
                fill={`url(#${gradient}-shine)`}
              />
              <path
                d="M77 28 C87 42 85 59 77 69"
                fill="none"
                stroke={`url(#${gradient}-reflection)`}
                strokeWidth=".7"
              />
            </g>
          </g>
        </g>
      </svg>
    </span>
  );
}
