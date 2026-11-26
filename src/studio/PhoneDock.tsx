import { Layers, MessageCircle, Plus, Settings2 } from 'lucide-react';

/** The same workspace actions, placed within a thumb's reach. The live voice
 * orb occupies the center; there is no second microphone or conversation. */
export default function PhoneDock({
  active,
  onObjects,
  onCreate,
  onConversation,
  onTools,
}: {
  active: 'objects' | 'create' | 'chat' | 'tools' | null;
  onObjects: () => void;
  onCreate: () => void;
  onConversation: () => void;
  onTools: () => void;
}) {
  return (
    <nav className="phone-workspace-dock" aria-label="Workspace actions">
      <button
        aria-label={active === 'objects' ? 'Hide objects' : 'Show objects'}
        aria-pressed={active === 'objects'}
        onClick={onObjects}
      >
        <Layers size={20} />
        <span>Objects</span>
      </button>
      <button
        aria-label="Create a 3D shape"
        aria-pressed={active === 'create'}
        onClick={onCreate}
      >
        <Plus size={23} />
        <span>Create</span>
      </button>
      <span className="phone-orb-space" aria-hidden="true" />
      <button
        aria-label={active === 'chat' ? 'Hide chat' : 'Open chat'}
        aria-pressed={active === 'chat'}
        onClick={onConversation}
      >
        <MessageCircle size={20} />
        <span>Chat</span>
      </button>
      <button
        className="compact-tools-toggle"
        aria-label="Design tools"
        aria-expanded={active === 'tools'}
        onClick={onTools}
      >
        <Settings2 size={20} />
        <span>Tools</span>
      </button>
    </nav>
  );
}
