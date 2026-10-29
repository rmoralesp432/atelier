import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type KeyboardEvent,
} from 'react';
let front = 20;
/** Viewport-clamped, pointer and keyboard movable panels; never traps the close button offscreen. */
export function useFloatingPanel() {
  const ref = useRef<HTMLElement>(null);
  const [style, setStyle] = useState<CSSProperties>({});
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const raise = () => setStyle((s) => ({ ...s, zIndex: ++front }));
  const move = (left: number, top: number) => {
    const el = ref.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    setStyle((s) => ({
      ...s,
      position: 'fixed',
      left: Math.max(8, Math.min(left, innerWidth - box.width - 8)),
      top: Math.max(
        8,
        Math.min(top, innerHeight - Math.min(box.height, innerHeight - 16) - 8),
      ),
      right: 'auto',
      bottom: 'auto',
      height: box.height,
      maxHeight: 'calc(100dvh - 16px)',
    }));
  };
  useEffect(() => {
    const resize = () => {
      if (ref.current && ref.current.style.position === 'fixed') {
        const r = ref.current.getBoundingClientRect();
        move(r.left, r.top);
      }
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  return {
    ref,
    style,
    raise,
    handle: {
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if (
          e.button !== 0 ||
          (e.target as HTMLElement).closest('button,input,select')
        )
          return;
        const b = ref.current!.getBoundingClientRect();
        drag.current = { x: e.clientX, y: e.clientY, left: b.left, top: b.top };
        e.currentTarget.setPointerCapture(e.pointerId);
        e.preventDefault();
      },
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        const d = drag.current;
        if (d) move(d.left + e.clientX - d.x, d.top + e.clientY - d.y);
      },
      onPointerUp: () => {
        drag.current = null;
      },
      onPointerCancel: () => {
        drag.current = null;
      },
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
        if (
          e.target !== e.currentTarget ||
          !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
        )
          return;
        e.preventDefault();
        raise();
        const b = ref.current!.getBoundingClientRect();
        move(
          b.left +
            (e.key === 'ArrowLeft' ? -20 : e.key === 'ArrowRight' ? 20 : 0),
          b.top + (e.key === 'ArrowUp' ? -20 : e.key === 'ArrowDown' ? 20 : 0),
        );
      },
    },
  };
}
