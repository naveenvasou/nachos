interface Props {
  duration: number;
  timeLeft: number;
  isActive: boolean;
}

const SIZE = 280;
const STROKE = 20;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function CircularTimer({ duration, timeLeft, isActive }: Props) {
  const progress = duration > 0 ? timeLeft / duration : 0;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  const formatted = `${m}:${s < 10 ? '0' : ''}${s}`;

  return (
    <div style={styles.container}>
      <svg
        width={SIZE}
        height={SIZE}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="#F3F4F6"
          strokeWidth={STROKE}
          fill="transparent"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="#8B5CF6"
          strokeWidth={STROKE}
          fill="transparent"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div style={styles.textOverlay}>
        <div style={styles.time}>{formatted}</div>
        <div style={styles.status}>{isActive ? 'FOCUSING' : 'PAUSED'}</div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    width: SIZE,
    height: SIZE,
  },
  textOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    fontSize: 48,
    fontWeight: 800,
    color: '#1a1a1a',
  },
  status: {
    fontSize: 14,
    marginTop: 8,
    letterSpacing: 2,
    color: '#666',
    fontWeight: 600,
  },
};
