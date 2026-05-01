import { useNavigate } from 'react-router-dom';
import { Flame, Check, Plus } from 'lucide-react';
import type { Habit } from '../../api';
import { track } from '../../analytics';

interface Props {
  habits: Habit[];
  loaded: boolean;
}

export default function HabitStrip({ habits, loaded }: Props) {
  const navigate = useNavigate();

  const onLog = (h: Habit) => {
    track('habit_log_clicked', { habit_id: h.habit_id, was_logged: h.logged_today });
    const seed = h.logged_today
      ? `Cooper, undo today's log for habit "${h.title}".`
      : `Cooper, log "${h.title}" as done for today.`;
    navigate(`/chat?mode=free&seed=${encodeURIComponent(seed)}`);
  };

  const onAdd = () => {
    track('habit_create_clicked');
    const seed = `Cooper, I want to start a new daily habit. Help me sharpen it: what am I committing to, how often, and how will I know I did it. Don't create until I confirm.`;
    navigate(`/chat?mode=free&seed=${encodeURIComponent(seed)}`);
  };

  // Don't render the strip at all if backend hasn't loaded yet AND we have no
  // habits — avoids a layout flash during first paint.
  if (!loaded && habits.length === 0) return null;

  return (
    <section style={styles.section}>
      <div style={styles.header}>
        <h2 style={styles.title}>Habits</h2>
        {habits.length > 0 && (
          <span style={styles.meta}>
            {habits.filter((h) => h.logged_today).length}/{habits.length} today
          </span>
        )}
      </div>

      {habits.length === 0 ? (
        <button onClick={onAdd} style={styles.empty}>
          <span style={{ flex: 1, textAlign: 'left' }}>
            <span style={{ fontWeight: 700 }}>No habits yet.</span>
            <span style={{ color: '#6b7280', marginLeft: 6 }}>
              Cooper can sharpen one.
            </span>
          </span>
          <Plus size={18} color="#6b7280" />
        </button>
      ) : (
        <div className="no-scrollbar" style={styles.lane}>
          {habits.map((h) => (
            <button
              key={h.habit_id}
              onClick={() => onLog(h)}
              style={{
                ...styles.card,
                background: h.logged_today ? '#ecfdf5' : '#fff',
                borderColor: h.logged_today ? '#a7f3d0' : '#f3f4f6',
              }}
            >
              <div style={styles.cardTop}>
                {h.logged_today ? (
                  <div style={styles.doneBadge}>
                    <Check size={12} color="#059669" strokeWidth={3} />
                  </div>
                ) : (
                  <div style={styles.dot} />
                )}
                {h.current_streak > 0 && (
                  <span style={styles.streak}>
                    <Flame size={11} color="#dc2626" />
                    {h.current_streak}
                  </span>
                )}
              </div>
              <div style={styles.cardTitle}>{h.title}</div>
              <div style={styles.cardSub}>
                {h.frequency}
                {h.completion_rate > 0 && ` · ${h.completion_rate}%`}
              </div>
            </button>
          ))}
          <button onClick={onAdd} style={styles.addCard}>
            <Plus size={20} color="#9ca3af" />
          </button>
        </div>
      )}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: { marginBottom: 28 },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 },
  meta: { fontSize: 13, color: '#6b7280', fontWeight: 600 },

  empty: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: 18, background: '#fff',
    border: '1px dashed #d1d5db',
  },

  lane: {
    display: 'flex', gap: 10,
    overflowX: 'auto', paddingBottom: 4,
  },
  card: {
    minWidth: 140, padding: 14, borderRadius: 18,
    border: '1px solid', textAlign: 'left',
    display: 'flex', flexDirection: 'column', gap: 6,
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  },
  cardTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  dot: {
    width: 18, height: 18, borderRadius: 9, background: '#f3f4f6',
    border: '2px solid #d1d5db',
  },
  doneBadge: {
    width: 18, height: 18, borderRadius: 9, background: '#22c55e',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  streak: {
    display: 'inline-flex', alignItems: 'center', gap: 3,
    padding: '2px 7px', borderRadius: 999,
    background: '#fef2f2', color: '#dc2626',
    fontSize: 11, fontWeight: 700,
  },
  cardTitle: {
    fontSize: 14, fontWeight: 700, color: '#111827',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  cardSub: { fontSize: 11, color: '#6b7280', fontWeight: 500 },

  addCard: {
    minWidth: 56, borderRadius: 18,
    background: '#f9fafb', border: '1px dashed #d1d5db',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};
