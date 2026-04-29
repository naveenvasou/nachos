import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sun, Moon, Target, Map as MapIcon, Mic, ArrowRight,
  Check, Flame, ChevronRight, Settings as SettingsIcon, Sparkles,
} from 'lucide-react';
import {
  fetchTasks, fetchGoals, updateTask, pickTodaysPlan,
  type Task, type Goal,
} from '../api';
import { loadProfile, greeting, dayPhase, type Profile } from '../profile';

export default function Today() {
  const navigate = useNavigate();
  const profile = loadProfile();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [t, g] = await Promise.all([fetchTasks(), fetchGoals()]);
      setTasks(t);
      setGoals(g);
    } catch (e) {
      console.error(e);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Refetch when window regains focus — the user just came back from chat,
  // where Cooper may have written new tasks.
  useEffect(() => {
    const onVis = () => { if (!document.hidden) reload(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [reload]);

  const { topThree, alsoToday } = pickTodaysPlan(tasks);
  const phase = dayPhase(profile);
  const primaryMode = phase === 'evening' || phase === 'after-hours' ? 'review' : 'brief';

  const toggle = async (task: Task) => {
    const next = task.status === 'DONE' ? 'TODO' : 'DONE';
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    try { await updateTask(task.id, { status: next }); }
    catch { setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t))); }
  };

  const onFocus = (taskId: number) => navigate(`/focus?taskId=${taskId}`);

  return (
    <div className="scroll-area" style={styles.root}>
      <div style={styles.content}>
        <header style={styles.header}>
          <div>
            <div style={styles.greeting}>{greeting()}</div>
            <div style={styles.userName}>{profile?.name || 'friend'}</div>
          </div>
          <button style={styles.settingsBtn} onClick={() => navigate('/settings')} aria-label="Settings">
            <SettingsIcon size={18} color="#1a1a1a" />
          </button>
        </header>

        <BriefCard
          mode={primaryMode}
          onClick={() => navigate(`/chat?mode=${primaryMode}`)}
        />

        <TodaySection
          loaded={loaded}
          topThree={topThree}
          onToggle={toggle}
          onFocus={onFocus}
          onPlan={() => navigate('/chat?mode=brief')}
        />

        <QuickActions
          goalsCount={goals.length}
          onCapture={() => navigate('/chat?mode=capture')}
          onStrategy={() => navigate('/strategy')}
          onPlanGoal={() => navigate('/chat?mode=plan-goal')}
        />

        {alsoToday.length > 0 && (
          <AlsoTodayList tasks={alsoToday} onToggle={toggle} onFocus={onFocus} />
        )}

        <div style={{ height: 110 }} />
      </div>

      <div style={styles.fabWrap}>
        <button style={styles.fab} onClick={() => navigate('/chat')}>
          <Mic size={20} color="#fff" />
          <span style={styles.fabText}>Talk to Cooper</span>
          <ArrowRight size={18} color="#fff" />
        </button>
      </div>
    </div>
  );
}

function BriefCard({ mode, onClick }: { mode: 'brief' | 'review'; onClick: () => void }) {
  const isMorning = mode === 'brief';
  return (
    <button onClick={onClick} style={{ ...styles.briefCard, background: isMorning ? '#efe9ff' : '#fff8e1' }}>
      <div style={styles.briefIcon}>
        {isMorning ? <Sun size={22} color="#8B5CF6" /> : <Moon size={22} color="#b45309" />}
      </div>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={styles.briefKicker}>
          {isMorning ? 'TWO MINUTES · MORNING BRIEF' : 'TWO MINUTES · EVENING REVIEW'}
        </div>
        <div style={styles.briefTitle}>
          {isMorning
            ? "Plan today's top-3 with Cooper."
            : 'Close out the day with Cooper.'}
        </div>
      </div>
      <ArrowRight size={20} color={isMorning ? '#8B5CF6' : '#b45309'} />
    </button>
  );
}

function TodaySection({
  loaded, topThree, onToggle, onFocus, onPlan,
}: {
  loaded: boolean;
  topThree: Task[];
  onToggle: (t: Task) => void;
  onFocus: (id: number) => void;
  onPlan: () => void;
}) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <h2 style={styles.sectionTitle}>Today's top-3</h2>
        {topThree.length > 0 && (
          <span style={styles.sectionMeta}>
            {topThree.filter((t) => t.status === 'DONE').length}/{topThree.length} done
          </span>
        )}
      </div>

      {!loaded ? (
        <div style={styles.skeletonList}>
          <div style={styles.skeleton} />
          <div style={styles.skeleton} />
          <div style={styles.skeleton} />
        </div>
      ) : topThree.length === 0 ? (
        <button onClick={onPlan} style={styles.emptyCta}>
          <Sparkles size={18} color="#8B5CF6" />
          <span style={{ flex: 1, textAlign: 'left' }}>
            <span style={{ fontWeight: 700 }}>No plan yet.</span>
            <span style={{ color: '#6b7280', marginLeft: 6 }}>Let Cooper help.</span>
          </span>
          <ArrowRight size={18} color="#8B5CF6" />
        </button>
      ) : (
        <div style={styles.taskList}>
          {topThree.map((t, i) => (
            <TaskRow
              key={t.id}
              index={i}
              task={t}
              onToggle={() => onToggle(t)}
              onFocus={() => onFocus(t.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TaskRow({
  index, task, onToggle, onFocus,
}: {
  index: number;
  task: Task;
  onToggle: () => void;
  onFocus: () => void;
}) {
  const done = task.status === 'DONE';
  return (
    <div style={styles.taskRow}>
      <button
        onClick={onToggle}
        aria-label={done ? 'Mark not done' : 'Mark done'}
        style={{
          ...styles.checkbox,
          background: done ? '#22c55e' : '#fff',
          borderColor: done ? '#22c55e' : '#d1d5db',
        }}
      >
        {done ? <Check size={14} color="#fff" strokeWidth={3} /> : <span style={styles.checkboxIndex}>{index + 1}</span>}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            ...styles.taskText,
            color: done ? '#9ca3af' : '#111827',
            textDecoration: done ? 'line-through' : 'none',
          }}
        >
          {task.title}
        </div>
        <div style={styles.taskMeta}>
          <PriorityChip priority={task.priority} />
          {task.effort && <span style={styles.metaText}>· {task.effort.toLowerCase()} effort</span>}
        </div>
      </div>
      {!done && (
        <button onClick={onFocus} style={styles.focusBtn} aria-label="Focus on this">
          <Flame size={14} color="#fff" />
          <span>Focus</span>
        </button>
      )}
    </div>
  );
}

function PriorityChip({ priority }: { priority: string }) {
  const color =
    priority === 'HIGH' ? '#dc2626'
    : priority === 'LOW' ? '#6b7280'
    : '#9333ea';
  const bg =
    priority === 'HIGH' ? '#fef2f2'
    : priority === 'LOW' ? '#f3f4f6'
    : '#f5f3ff';
  return (
    <span style={{ ...styles.chip, color, background: bg }}>{priority || 'MEDIUM'}</span>
  );
}

function QuickActions({
  goalsCount, onCapture, onStrategy, onPlanGoal,
}: {
  goalsCount: number;
  onCapture: () => void;
  onStrategy: () => void;
  onPlanGoal: () => void;
}) {
  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>Quick actions</h2>
      <div style={styles.quickGrid}>
        <button style={{ ...styles.quickCard, background: '#e1f0fe' }} onClick={onCapture}>
          <div style={styles.quickIcon}><Mic size={20} color="#1d4ed8" /></div>
          <div style={styles.quickTitle}>Brain dump</div>
          <div style={styles.quickSub}>Cooper sorts the noise</div>
        </button>
        <button
          style={{ ...styles.quickCard, background: goalsCount > 0 ? '#ffecba' : '#fff' }}
          onClick={goalsCount > 0 ? onStrategy : onPlanGoal}
        >
          <div style={styles.quickIcon}>
            {goalsCount > 0 ? <MapIcon size={20} color="#92400e" /> : <Target size={20} color="#92400e" />}
          </div>
          <div style={styles.quickTitle}>
            {goalsCount > 0 ? 'Strategy map' : 'Set a goal'}
          </div>
          <div style={styles.quickSub}>
            {goalsCount > 0 ? `${goalsCount} active` : 'Aim before you run'}
          </div>
        </button>
      </div>
    </section>
  );
}

function AlsoTodayList({
  tasks, onToggle, onFocus,
}: {
  tasks: Task[];
  onToggle: (t: Task) => void;
  onFocus: (id: number) => void;
}) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <h2 style={styles.sectionTitle}>Also today</h2>
        <span style={styles.sectionMeta}>{tasks.length}</span>
      </div>
      <div style={styles.alsoList}>
        {tasks.map((t) => {
          const done = t.status === 'DONE';
          return (
            <div key={t.id} style={styles.alsoRow}>
              <button
                onClick={() => onToggle(t)}
                style={{
                  ...styles.smallCheckbox,
                  background: done ? '#22c55e' : '#fff',
                  borderColor: done ? '#22c55e' : '#d1d5db',
                }}
                aria-label={done ? 'Mark not done' : 'Mark done'}
              >
                {done && <Check size={11} color="#fff" strokeWidth={3} />}
              </button>
              <span
                style={{
                  ...styles.alsoText,
                  color: done ? '#9ca3af' : '#111827',
                  textDecoration: done ? 'line-through' : 'none',
                }}
              >
                {t.title}
              </span>
              {!done && (
                <button
                  onClick={() => onFocus(t.id)}
                  style={styles.smallFocus}
                  aria-label="Focus"
                >
                  <ChevronRight size={16} color="#9ca3af" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: '#fdfbff', position: 'relative' },
  content: { padding: '32px 24px 40px' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 24,
  },
  greeting: { fontSize: 14, color: '#6b7280', fontWeight: 500, marginBottom: 2 },
  userName: { fontSize: 30, fontWeight: 800, color: '#111827', letterSpacing: -0.5 },
  settingsBtn: {
    width: 40, height: 40, borderRadius: 20, background: '#f3f4f6',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  briefCard: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 16,
    padding: 20, borderRadius: 24, marginBottom: 28,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  briefIcon: {
    width: 44, height: 44, borderRadius: 22,
    background: 'rgba(255,255,255,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  briefKicker: {
    fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
    color: 'rgba(31,31,31,0.55)', textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  briefTitle: { fontSize: 16, fontWeight: 700, color: '#1f1f1f', lineHeight: 1.3 },

  section: { marginBottom: 28 },
  sectionHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 },
  sectionMeta: { fontSize: 13, color: '#6b7280', fontWeight: 600 },

  skeletonList: { display: 'flex', flexDirection: 'column', gap: 10 },
  skeleton: { height: 64, borderRadius: 16, background: '#f3f4f6' },

  emptyCta: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
    padding: 18, borderRadius: 18, background: '#fff',
    border: '1px dashed #d1d5db',
  },

  taskList: { display: 'flex', flexDirection: 'column', gap: 10 },
  taskRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: '#fff', borderRadius: 18, padding: 14,
    border: '1px solid #f3f4f6',
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  },
  checkbox: {
    width: 28, height: 28, borderRadius: 14, border: '2px solid #d1d5db',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxIndex: { fontSize: 12, fontWeight: 700, color: '#9ca3af' },
  taskText: { fontSize: 15, fontWeight: 600, marginBottom: 4 },
  taskMeta: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, fontWeight: 600,
  },
  chip: {
    fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
    padding: '2px 8px', borderRadius: 999,
  },
  metaText: { color: '#9ca3af', fontWeight: 500 },
  focusBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: '#000', color: '#fff', padding: '6px 10px',
    borderRadius: 999, fontSize: 12, fontWeight: 600,
  },

  quickGrid: { display: 'flex', gap: 12 },
  quickCard: {
    flex: 1, padding: 18, borderRadius: 22, textAlign: 'left',
    display: 'flex', flexDirection: 'column', gap: 8,
    border: '1px solid rgba(0,0,0,0.04)',
  },
  quickIcon: {
    width: 40, height: 40, borderRadius: 20,
    background: 'rgba(255,255,255,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  quickTitle: { fontSize: 15, fontWeight: 700, color: '#1f1f1f' },
  quickSub: { fontSize: 12, color: 'rgba(31,31,31,0.6)', fontWeight: 500 },

  alsoList: {
    background: '#fff', borderRadius: 20, padding: 8,
    border: '1px solid #f3f4f6',
  },
  alsoRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 8px',
  },
  smallCheckbox: {
    width: 20, height: 20, borderRadius: 10, border: '2px solid #d1d5db',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  alsoText: { flex: 1, fontSize: 14, fontWeight: 500 },
  smallFocus: {
    width: 28, height: 28, borderRadius: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  fabWrap: {
    position: 'sticky', bottom: 16, padding: '0 24px', zIndex: 50,
  },
  fab: {
    width: '100%', height: 56, borderRadius: 28,
    background: '#000', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    fontSize: 15, fontWeight: 600,
    boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
  },
  fabText: { letterSpacing: 0.2 },
};
