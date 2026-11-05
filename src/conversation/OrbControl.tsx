import { useEffect, useRef, type ReactNode } from 'react';
/** Defer a single tap so a double tap opens chat without toggling the mic. */
export default function OrbControl({
  onVoice,
  onOpen,
  active,
  children,
}: {
  onVoice: () => void;
  onOpen: () => void;
  active: boolean;
  children: ReactNode;
}) {
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actions = useRef({ onVoice, onOpen });
  actions.current = { onVoice, onOpen };
  const cancel = () => {
    if (pending.current !== null) clearTimeout(pending.current);
    pending.current = null;
  };
  useEffect(() => cancel, []);
  return (
    <button
      className="orb-open"
      aria-label="Voice orb"
      aria-pressed={active}
      aria-description="Tap to start or stop voice. Double tap to open chat. Shift Enter opens chat with the keyboard."
      title="Tap: microphone · Double tap: chat"
      aria-keyshortcuts="Shift+Enter"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.shiftKey) {
          e.preventDefault();
          cancel();
          actions.current.onOpen();
        }
      }}
      onClick={(e) => {
        if (e.detail === 0) {
          cancel();
          actions.current.onVoice();
          return;
        }
        if (pending.current !== null) {
          cancel();
          actions.current.onOpen();
          return;
        }
        pending.current = setTimeout(() => {
          pending.current = null;
          actions.current.onVoice();
        }, 320);
      }}
    >
      {children}
    </button>
  );
}
