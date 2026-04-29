import { Plus, Play } from 'lucide-react';
import HeroCard from '../components/home/HeroCard';
import UtilityGrid from '../components/home/UtilityGrid';
import MixedFeed from '../components/home/MixedFeed';

export default function Home() {
  return (
    <div className="scroll-area" style={styles.root}>
      <div style={styles.content}>
        <header style={styles.header}>
          <div>
            <div style={styles.greeting}>Good Morning,</div>
            <div style={styles.userName}>Naveen</div>
          </div>
          <button style={styles.avatar} aria-label="Profile">
            <span style={styles.avatarText}>J</span>
          </button>
        </header>

        <HeroCard />
        <UtilityGrid />
        <MixedFeed />

        <div style={{ height: 110 }} />
      </div>

      <div style={styles.floatingBarWrap}>
        <div style={styles.floatingBar}>
          <span style={styles.floatingText}>Active Session</span>
          <div style={styles.floatingActions}>
            <button style={styles.btnSmall} aria-label="Add">
              <Plus size={20} color="#fff" />
            </button>
            <button style={styles.btnLarge} aria-label="Play">
              <Play size={20} color="#000" fill="#000" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    position: 'relative',
    background: '#fdfbff',
  },
  content: {
    padding: '32px 24px 40px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: 500,
    marginBottom: 2,
  },
  userName: {
    fontSize: 30,
    fontWeight: 800,
    color: '#111827',
    letterSpacing: -0.5,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
  },
  floatingBarWrap: {
    position: 'sticky',
    bottom: 24,
    margin: '0 24px',
    zIndex: 50,
  },
  floatingBar: {
    background: '#000',
    height: 64,
    borderRadius: 9999,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 24,
    paddingRight: 8,
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
  },
  floatingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 500,
  },
  floatingActions: {
    display: 'flex',
    gap: 8,
  },
  btnSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    background: 'rgba(255,255,255,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
