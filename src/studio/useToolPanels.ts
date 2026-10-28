import { useMemo, useState, type SetStateAction } from 'react';
const names = [
  'explore',
  'studio',
  'inspector',
  'section',
  'solar',
  'camera',
  'layers',
  'adding',
  'model',
  'ar',
] as const;
type Name = (typeof names)[number];
/** One tool panel at a time. Closing an inactive panel cannot close the current panel. */
export function useToolPanels(initial: Name | null) {
  const [active, setActive] = useState<Name | null>(initial);
  const setters = useMemo(
    () =>
      Object.fromEntries(
        names.map((name) => [
          name,
          (value: SetStateAction<boolean>) => {
            setActive((current) => {
              const open =
                typeof value === 'function' ? value(current === name) : value;
              return open ? name : current === name ? null : current;
            });
          },
        ]),
      ) as Record<Name, (v: SetStateAction<boolean>) => void>,
    [],
  );
  return { active, setters };
}
