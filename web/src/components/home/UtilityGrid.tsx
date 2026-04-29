import { useNavigate } from 'react-router-dom';
import { Mic, Focus as FocusIcon, Map } from 'lucide-react';

export default function UtilityGrid() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <button
        style={{ ...styles.bigCard }}
        onClick={() => navigate('/chat')}
      >
        <div style={{ ...styles.iconCircle, background: 'rgba(255,255,255,0.6)' }}>
          <Mic size={24} color="#3b82f6" />
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ ...styles.cardTitle, color: '#1e3a8a' }}>Talk with Cooper</div>
          <div style={{ ...styles.cardSubtitle, color: 'rgba(30,58,138,0.6)' }}>
            Let's prioritize.
          </div>
        </div>
      </button>

      <div style={styles.row}>
        <button
          style={{ ...styles.smallCard, background: '#ffecba' }}
          onClick={() => navigate('/focus')}
        >
          <div style={{ ...styles.iconCircle, background: '#fdf2d4' }}>
            <FocusIcon size={24} color="#362e29" />
          </div>
          <div style={{ ...styles.cardTitle, color: '#362e29' }}>Focus Mode</div>
        </button>

        <button
          style={{ ...styles.smallCard, background: '#25262a' }}
          onClick={() => navigate('/strategy')}
        >
          <div style={{ ...styles.iconCircle, background: '#3a3b3f' }}>
            <Map size={24} color="#fff" />
          </div>
          <div style={{ ...styles.cardTitle, color: '#fff' }}>Strategize</div>
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginBottom: 32,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  row: {
    display: 'flex',
    gap: 16,
  },
  bigCard: {
    width: '100%',
    background: '#e1f0fe',
    borderRadius: 32,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    textAlign: 'left',
  },
  smallCard: {
    flex: 1,
    height: 140,
    borderRadius: 32,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    fontWeight: 500,
  },
};
