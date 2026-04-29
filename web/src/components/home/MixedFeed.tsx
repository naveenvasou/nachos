import { useEffect, useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { fetchTasks, updateTask, type Task } from '../../api';

export default function MixedFeed() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchTasks();
        if (cancelled) return;
        const todayStr = new Date().toISOString().split('T')[0];
        setTasks(
          data.filter(
            (t) => t.scheduled_date === todayStr || t.scheduled_date === 'TODAY'
          )
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (task: Task) => {
    const newStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
    const previous = tasks;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    );
    try {
      await updateTask(task.id, { status: newStatus });
    } catch {
      setTasks(previous);
    }
  };

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Agenda */}
      <section style={{ marginBottom: 32 }}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>The Agenda</h2>
          <button style={styles.sectionAction}>See All</button>
        </div>
        <div className="no-scrollbar" style={styles.horizontalLane}>
          <div style={styles.timelineCard}>
            <div style={{ ...styles.statusDot, background: '#22c55e' }} />
            <div style={styles.timeText}>09:00 AM</div>
            <div style={styles.eventTitle}>Deep Work</div>
          </div>
          <div style={styles.timelineCard}>
            <div style={{ ...styles.statusDot, background: '#facc15' }} />
            <div style={styles.timeText}>02:00 PM</div>
            <div style={styles.eventTitle}>Team Sync</div>
          </div>
          <button style={styles.addCard}>
            <Plus size={24} color="#9ca3af" />
          </button>
        </div>
      </section>

      {/* Today's tasks */}
      <section>
        <h2 style={{ ...styles.sectionTitle, marginBottom: 16 }}>Today's Tasks</h2>

        {isLoading ? (
          <div style={styles.muted}>Loading tasks...</div>
        ) : error ? (
          <div style={styles.muted}>Could not load tasks ({error})</div>
        ) : tasks.length === 0 ? (
          <div style={styles.muted}>
            No tasks scheduled for today. Explore the backlog?
          </div>
        ) : (
          <div style={styles.taskContainer}>
            {tasks.map((task) => {
              const done = task.status === 'DONE';
              return (
                <button
                  key={task.id}
                  style={styles.taskRow}
                  onClick={() => toggle(task)}
                >
                  <div
                    style={{
                      ...styles.checkbox,
                      borderColor: done ? 'transparent' : '#d1d5db',
                    }}
                  >
                    {done && <Check size={14} color="#22c55e" strokeWidth={3} />}
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div
                      style={{
                        ...styles.taskText,
                        color: done ? '#9ca3af' : '#111827',
                        textDecoration: done ? 'line-through' : 'none',
                      }}
                    >
                      {task.title}
                    </div>
                    <div style={styles.taskMeta}>{task.priority} Priority</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#111827',
    margin: 0,
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: 600,
    color: '#3b82f6',
  },
  horizontalLane: {
    display: 'flex',
    gap: 12,
    overflowX: 'auto',
    paddingBottom: 4,
  },
  timelineCard: {
    minWidth: 140,
    background: '#fff',
    borderRadius: 24,
    padding: '24px 16px 16px',
    border: '1px solid #f3f4f6',
    position: 'relative',
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
  },
  addCard: {
    minWidth: 100,
    background: '#f9fafb',
    borderRadius: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    top: 16,
    right: 16,
  },
  timeText: {
    fontSize: 12,
    fontWeight: 500,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#111827',
  },
  taskContainer: {
    background: '#fff',
    borderRadius: 32,
    padding: 24,
    border: '1px solid #f9fafb',
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  taskRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    border: '2px solid #d1d5db',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  taskText: {
    fontSize: 15,
    fontWeight: 500,
  },
  taskMeta: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: 500,
    marginTop: 2,
  },
  muted: {
    color: '#9ca3af',
    fontWeight: 500,
  },
};
