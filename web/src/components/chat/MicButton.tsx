import { Mic, Square, Loader2 } from 'lucide-react';

interface Props {
  isRecording: boolean;
  isProcessing?: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export default function MicButton({
  isRecording,
  isProcessing,
  onStartRecording,
  onStopRecording,
}: Props) {
  if (isProcessing) {
    return (
      <button style={{ ...styles.button, background: '#f3f4f6' }} disabled>
        <Loader2 size={20} color="#666" className="spin" />
      </button>
    );
  }

  if (isRecording) {
    return (
      <button
        style={{ ...styles.button, background: '#ef4444' }}
        onClick={onStopRecording}
        aria-label="Stop recording"
      >
        <Square size={18} color="#fff" fill="#fff" />
      </button>
    );
  }

  return (
    <button
      style={{ ...styles.button, background: '#f3f4f6' }}
      onClick={onStartRecording}
      aria-label="Start recording"
    >
      <Mic size={20} color="#666" />
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
};
