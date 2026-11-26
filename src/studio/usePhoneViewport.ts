import { useEffect } from 'react';

/** Lift phone controls above Safari's keyboard without resizing/remounting the
 * modeling workspace. Pinch zoom must keep its normal browser behavior. */
export function usePhoneViewport(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const editing = document.activeElement?.matches(
          'input:not([type="range"]):not([type="checkbox"]), textarea, [contenteditable="true"]',
        );
        const lift =
          viewport && Math.abs(viewport.scale - 1) < 0.01 && editing
            ? Math.max(0, innerHeight - viewport.height - viewport.offsetTop)
            : 0;
        root.style.setProperty('--phone-keyboard-lift', `${lift}px`);
        root.style.setProperty(
          '--phone-visible-height',
          `${viewport?.height ?? innerHeight}px`,
        );
        root.toggleAttribute(
          'data-phone-keyboard',
          !!editing && (lift > 100 || innerHeight < 500),
        );
      });
    };
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
      root.style.removeProperty('--phone-keyboard-lift');
      root.style.removeProperty('--phone-visible-height');
      root.removeAttribute('data-phone-keyboard');
    };
  }, [enabled]);
}
