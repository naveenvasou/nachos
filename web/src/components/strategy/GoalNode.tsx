interface Props {
  title: string;
  subtitle?: string;
  status?: 'active' | 'completed' | 'blocked';
  level?: 'objective' | 'key-result' | 'task';
  x?: number;
  y?: number;
  onClick?: () => void;
}

export default function GoalNode({
  title,
  subtitle,
  status = 'active',
  level = 'objective',
  x = 0,
  y = 0,
  onClick,
}: Props) {
  const isObjective = level === 'objective';
  const dotColor =
    status === 'active' ? '#22C55E' : status === 'completed' ? '#3B82F6' : '#EF4444';

  return (
    <button
      onClick={onClick}
      style={{
        ...styles.container,
        ...(isObjective ? styles.objective : styles.keyResult),
        left: x,
        top: y,
      }}
    >
      <div style={styles.header}>
        <span style={{ ...styles.dot, background: dotColor }} />
        <span style={styles.levelLabel}>{level.toUpperCase()}</span>
      </div>
      <div
        style={{
          ...styles.title,
          fontSize: isObjective ? 16 : 14,
        }}
      >
        {title}
      </div>
      {subtitle && <div style={styles.subtitle}>{subtitle}</div>}
      <span style={styles.connector} />
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    width: 180,
    borderRadius: 16,
    padding: 16,
    background: '#fff',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    border: '1px solid #f3f4f6',
    zIndex: 10,
    textAlign: 'left',
  },
  objective: {
    background: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  keyResult: {
    background: '#fff',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    display: 'inline-block',
  },
  levelLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  title: {
    color: '#1F2937',
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: 500,
  },
  connector: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    marginLeft: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    background: '#D1D5DB',
    border: '2px solid #fff',
  },
};
