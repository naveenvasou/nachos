import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import CircularTimer from '../components/focus/CircularTimer';
import FocusControls from '../components/focus/FocusControls';
import { fetchTasks, updateTask, type Task } from '../api';
import { track } from '../analytics';

const DURATION = 25 * 60;

export default function Focus() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const taskId = useMemo(() => {
    const raw = params.get('taskId');
    return raw ? Number(raw) : null;
  }, [params]);

  const [task, setTask] = useState<Task | null>(null);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [isActive, setIsActive] = useState(false);
  const [completedSession, setCompletedSession] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    (async () => {
      try {
        const all = await fetchTasks();
        if (cancelled) return;
        const found = all.find((t) => t.id === taskId) ?? null;
        setTask(found);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { cancelled = true; };
  }, [taskId]);

  useEffect(() => {
    if (!isActive) return;
    if (timeLeft <= 0) {
      setIsActive(false);
      setCompletedSession(true);
      track('focus_session_completed', {
        task_id: taskId,
        duration_seconds: DURATION,
      });
      try { navigator.vibrate?.(300); } catch { /* ignore */ }
      return;
    }
    const id = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearInterval(id);
  }, [isActive, timeLeft, taskId]);

  const handleReset = () => {
    setIsActive(false);
    setTimeLeft(DURATION);
    setCompletedSession(false);
  };

  const markDone = async () => {
    if (!task) return;
    try {
      await updateTask(task.id, { status: 'DONE' });
      track('focus_task_marked_done', { task_id: task.id });
      navigate('/');
    } catch (e) {
      console.error(e);
    }
  };

  const reflectWithCooper = () => {
    if (!task) return;
    // Drop into chat with a tailored seed; Cooper will write the reflection
    // (and update task status if appropriate) through tools.
    const seed = `Cooper, I just finished a focus session on "${task.title}". Here's how it went: `;
    navigate(`/chat?mode=free&seed=${encodeURIComponent(seed)}`);
  };

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <button style={styles.backButton} onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={22} color="#1a1a1a" />
        </button>
        <h1 style={styles.title}>Focus session</h1>
        <div style={{ width: 40 }} />
      </header>

      <div style={styles.content}>
        <div style={styles.taskWrap}>
          <div style={styles.taskLabel}>
            {task ? 'CURRENT TASK' : taskId ? 'LOADING…' : 'NO TASK SELECTED'}
          </div>
          <div style={styles.taskTitle}>
            {task ? task.title : taskId ? '…' : 'Pick a task from Today'}
          </div>
          {task?.priority && (
            <div style={styles.taskMeta}>
              {task.priority} priority
              {task.effort ? ` · ${task.effort.toLowerCase()} effort` : ''}
            </div>
          )}
        </div>

        <CircularTimer duration={DURATION} timeLeft={timeLeft} isActive={isActive} />

        <FocusControls
          isActive={isActive}
          onToggle={() => {
            setIsActive((v) => {
              if (!v) track('focus_session_started', { task_id: taskId });
              return !v;
            });
          }}
          onReset={handleReset}
        />

        {completedSession && task && (
          <div style={styles.completionCard}>
            <div style={styles.completionTitle}>Session complete.</div>
            <div style={styles.completionSub}>
              Did you finish "{task.title}"?
            </div>
            <div style={styles.completionActions}>
              <button onClick={markDone} style={styles.completionPrimary}>
                <Check size={16} />
                <span>Mark done</span>
              </button>
              <button onClick={reflectWithCooper} style={styles.completionSecondary}>
                Reflect with Cooper
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px',
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20, background: '#F3F4F6',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: 700, color: '#1a1a1a', margin: 0 },
  content: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', paddingBottom: 60,
    gap: 40,
  },
  taskWrap: { textAlign: 'center', maxWidth: 320, padding: '0 20px' },
  taskLabel: {
    fontSize: 11, letterSpacing: 1.5, color: '#888',
    fontWeight: 700, marginBottom: 8,
  },
  taskTitle: {
    fontSize: 22, fontWeight: 800, color: '#1a1a1a',
    lineHeight: 1.25, letterSpacing: -0.3,
  },
  taskMeta: { fontSize: 12, color: '#9ca3af', marginTop: 8, fontWeight: 600 },
  completionCard: {
    margin: '0 24px', padding: 20, borderRadius: 20,
    background: '#ecfdf5', border: '1px solid #a7f3d0',
    width: 'calc(100% - 48px)', maxWidth: 360,
  },
  completionTitle: { fontSize: 16, fontWeight: 700, color: '#065f46', marginBottom: 4 },
  completionSub: { fontSize: 14, color: '#047857', marginBottom: 14 },
  completionActions: { display: 'flex', gap: 8 },
  completionPrimary: {
    flex: 1, height: 44, borderRadius: 22, background: '#059669', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    fontSize: 14, fontWeight: 600,
  },
  completionSecondary: {
    flex: 1, height: 44, borderRadius: 22, background: '#fff', color: '#065f46',
    fontSize: 14, fontWeight: 600, border: '1px solid #a7f3d0',
  },
};
