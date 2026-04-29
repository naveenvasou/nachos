import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import CircularTimer from '../components/focus/CircularTimer';
import FocusControls from '../components/focus/FocusControls';

const DURATION = 25 * 60;

export default function Focus() {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!isActive) return;
    if (timeLeft <= 0) {
      setIsActive(false);
      return;
    }
    const id = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearInterval(id);
  }, [isActive, timeLeft]);

  const handleReset = () => {
    setIsActive(false);
    setTimeLeft(DURATION);
  };

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <button style={styles.backButton} onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={22} color="#1a1a1a" />
        </button>
        <h1 style={styles.title}>Deep Focus</h1>
        <div style={{ width: 40 }} />
      </header>

      <div style={styles.content}>
        <div style={styles.taskWrap}>
          <div style={styles.taskLabel}>CURRENT OBJECTIVE</div>
          <div style={styles.taskTitle}>Refactor Navigation</div>
        </div>

        <CircularTimer duration={DURATION} timeLeft={timeLeft} isActive={isActive} />

        <FocusControls
          isActive={isActive}
          onToggle={() => setIsActive((v) => !v)}
          onReset={handleReset}
        />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    background: '#F3F4F6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#1a1a1a',
    margin: 0,
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  taskWrap: {
    textAlign: 'center',
    marginBottom: 40,
  },
  taskLabel: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: '#888',
    fontWeight: 600,
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 24,
    fontWeight: 800,
    color: '#1a1a1a',
  },
};
