import { Calendar } from 'lucide-react';

export default function HeroCard() {
  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div style={styles.dateBadge}>
          <Calendar size={16} color="#4b5563" />
          <span style={styles.dateText}>8 June</span>
        </div>
        <div style={styles.reportBadge}>
          <span style={styles.reportText}>AI-REPORT</span>
        </div>
      </div>

      <div style={styles.textContent}>
        <div style={styles.subLabel}>TODAY'S AI ANALYSIS</div>
        <div style={styles.mainTitle}>
          You Have 8 Tasks <span style={styles.highlight}>Urgent</span> For Today.
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    background: '#efe9ff',
    borderRadius: 32,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 24,
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontWeight: 700,
    fontSize: 14,
    color: '#1f1f1f',
  },
  reportBadge: {
    padding: '4px 12px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.5)',
    border: '1px solid #2dd4bf',
  },
  reportText: {
    fontWeight: 700,
    fontSize: 10,
    color: '#0f766e',
    letterSpacing: 0.5,
  },
  textContent: {
    marginTop: 16,
  },
  subLabel: {
    fontWeight: 600,
    fontSize: 12,
    color: 'rgba(31,31,31,0.6)',
    marginBottom: 8,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  mainTitle: {
    fontWeight: 800,
    fontSize: 30,
    lineHeight: 1.1,
    color: '#1f1f1f',
  },
  highlight: {
    color: '#9333ea',
  },
};
