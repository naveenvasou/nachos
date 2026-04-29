import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import StrategyMap from '../components/strategy/StrategyMap';

export default function Strategy() {
  const navigate = useNavigate();
  const quarterLabel = quarterOf(new Date());

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <button style={styles.backButton} onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={22} color="#1a1a1a" />
        </button>
        <div style={{ textAlign: 'center' }}>
          <h1 style={styles.title}>Strategy map</h1>
          <div style={styles.subtitle}>{quarterLabel} goals</div>
        </div>
        <button
          style={styles.addButton}
          aria-label="Add a goal"
          onClick={() => navigate('/chat?mode=plan-goal')}
        >
          <Plus size={20} color="#fff" />
        </button>
      </header>
      <div style={styles.mapWrap}>
        <StrategyMap />
      </div>
    </div>
  );
}

function quarterOf(d: Date): string {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh', background: '#fff',
    display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px', borderBottom: '1px solid #f3f4f6',
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20, background: '#F3F4F6',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  addButton: {
    width: 40, height: 40, borderRadius: 20, background: '#1a1a1a',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
  },
  title: { fontSize: 18, fontWeight: 700, color: '#1a1a1a', margin: 0 },
  subtitle: { fontSize: 12, color: '#666', fontWeight: 500 },
  mapWrap: { flex: 1, display: 'flex', minHeight: 0 },
};
