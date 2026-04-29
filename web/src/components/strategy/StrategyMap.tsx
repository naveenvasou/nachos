import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Sparkles, ArrowRight } from 'lucide-react';
import GoalNode from './GoalNode';
import { fetchGoals, fetchTasks, type Goal, type Task } from '../../api';

const NODE_W = 180;
const NODE_H = 100;

interface Layout {
  goal: Goal;
  x: number;
  y: number;
  level: 'objective' | 'key-result' | 'task';
  status: 'active' | 'completed' | 'blocked';
  taskCount: number;
  doneCount: number;
}

export default function StrategyMap() {
  const navigate = useNavigate();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [g, t] = await Promise.all([fetchGoals(), fetchTasks()]);
        setGoals(g);
        setTasks(t);
      } catch (e) {
        console.error(e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const layouts = useMemo<Layout[]>(() => {
    if (goals.length === 0) return [];

    // Top goal as the objective; rest as key-results below in a row;
    // simple deterministic layout that scales to ~6 goals.
    return goals.map((g, i) => {
      const linkedTasks = tasks.filter((t) => t.goal_id === g.id);
      const doneCount = linkedTasks.filter((t) => t.status === 'DONE').length;
      const status: Layout['status'] =
        linkedTasks.length === 0
          ? 'blocked' // "wish" — goal with no tasks
          : doneCount === linkedTasks.length
          ? 'completed'
          : 'active';

      if (i === 0) {
        return {
          goal: g,
          level: 'objective',
          x: 220,
          y: 40,
          status,
          taskCount: linkedTasks.length,
          doneCount,
        };
      }
      const idx = i - 1;
      const cols = 3;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      return {
        goal: g,
        level: 'key-result',
        x: 40 + col * (NODE_W + 24),
        y: 220 + row * (NODE_H + 80),
        status,
        taskCount: linkedTasks.length,
        doneCount,
      };
    });
  }, [goals, tasks]);

  const canvasWidth = 620;
  const canvasHeight = Math.max(
    520,
    220 + Math.ceil(Math.max(0, goals.length - 1) / 3) * (NODE_H + 80) + 80
  );

  if (loaded && goals.length === 0) {
    return (
      <div style={emptyStyles.wrap}>
        <div style={emptyStyles.icon}>
          <Target size={28} color="#92400e" />
        </div>
        <div style={emptyStyles.title}>No goals yet.</div>
        <div style={emptyStyles.body}>
          Goals are how Cooper keeps your daily work pointed at something that matters.
          Define your first one — it takes about a minute.
        </div>
        <button
          onClick={() => navigate('/chat?mode=plan-goal')}
          style={emptyStyles.cta}
        >
          <Sparkles size={16} color="#fff" />
          <span>Plan a goal with Cooper</span>
          <ArrowRight size={16} color="#fff" />
        </button>
      </div>
    );
  }

  return (
    <div style={styles.scroll}>
      <div style={{ ...styles.canvas, width: canvasWidth, height: canvasHeight }}>
        <svg
          width={canvasWidth}
          height={canvasHeight}
          style={{ position: 'absolute', top: 0, left: 0, zIndex: 0 }}
        >
          {layouts
            .filter((l) => l.level !== 'objective')
            .map((l, i) => {
              const root = layouts.find((x) => x.level === 'objective');
              if (!root) return null;
              const x1 = root.x + NODE_W / 2;
              const y1 = root.y + NODE_H;
              const x2 = l.x + NODE_W / 2;
              const y2 = l.y;
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#E5E7EB"
                  strokeWidth={2}
                  strokeDasharray="5,5"
                />
              );
            })}
        </svg>

        {layouts.map((l) => (
          <GoalNode
            key={l.goal.id}
            title={l.goal.title}
            subtitle={
              l.taskCount === 0
                ? 'No tasks yet'
                : `${l.doneCount}/${l.taskCount} tasks done`
            }
            level={l.level}
            status={l.status}
            x={l.x}
            y={l.y}
            onClick={() =>
              navigate(
                `/chat?mode=free&seed=${encodeURIComponent(
                  `Cooper, let's review the goal "${l.goal.title}". Where am I, what's blocking, what's next?`
                )}`
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  scroll: { flex: 1, overflow: 'auto', background: '#F9FAFB', height: '100%' },
  canvas: { position: 'relative' },
};

const emptyStyles: Record<string, React.CSSProperties> = {
  wrap: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '40px 32px', textAlign: 'center', gap: 12,
    background: '#F9FAFB',
  },
  icon: {
    width: 56, height: 56, borderRadius: 28,
    background: '#fef3c7',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 20, fontWeight: 800, color: '#1a1a1a', letterSpacing: -0.3 },
  body: {
    fontSize: 14, color: '#6b7280', lineHeight: 1.5,
    maxWidth: 320, marginBottom: 8,
  },
  cta: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '12px 18px', background: '#000', color: '#fff',
    borderRadius: 999, fontSize: 14, fontWeight: 600,
    boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
  },
};
