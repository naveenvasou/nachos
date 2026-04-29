import { Square, Settings, Play, Pause } from 'lucide-react';

interface Props {
  isActive: boolean;
  onToggle: () => void;
  onReset: () => void;
}

export default function FocusControls({ isActive, onToggle, onReset }: Props) {
  return (
    <div style={styles.container}>
      <button style={styles.secondary} onClick={onReset} aria-label="Reset">
        <Square size={22} color="#666" />
      </button>
      <button style={styles.primary} onClick={onToggle} aria-label={isActive ? 'Pause' : 'Play'}>
        {isActive ? <Pause size={36} color="#fff" fill="#fff" /> : <Play size={36} color="#fff" fill="#fff" />}
      </button>
      <button style={styles.secondary} aria-label="Settings">
        <Settings size={22} color="#666" />
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    marginTop: 40,
  },
  primary: {
    width: 80,
    height: 80,
    borderRadius: 40,
    background: '#8B5CF6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(139,92,246,0.35)',
  },
  secondary: {
    width: 50,
    height: 50,
    borderRadius: 25,
    background: '#F3F4F6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
