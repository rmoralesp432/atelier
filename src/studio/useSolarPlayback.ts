import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { SolarStudy } from './solar';
/** Playback belongs to the workspace, not the lifetime of its settings panel. */
export function useSolarPlayback(
  value: SolarStudy,
  setValue: Dispatch<SetStateAction<SolarStudy>>,
  available: boolean,
) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!available || !value.enabled) setPlaying(false);
  }, [available, value.enabled]);
  useEffect(() => {
    if (!playing || !available || !value.enabled) return;
    const timer = setInterval(() => {
      if (!document.hidden)
        setValue((v) => ({ ...v, minutes: (v.minutes + 15) % 1440 }));
    }, 350);
    return () => clearInterval(timer);
  }, [playing, available, value.enabled, setValue]);
  return [playing, setPlaying] as const;
}
