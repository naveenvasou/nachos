import GoalNode from './GoalNode';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 100;

interface Goal {
  id: string;
  title: string;
  subtitle: string;
  level: 'objective' | 'key-result' | 'task';
  x: number;
  y: number;
}

const GOALS: Goal[] = [
  { id: '1', title: 'Launch MVP', subtitle: 'Q1 Objective', level: 'objective', x: 200, y: 50 },
  { id: '2', title: 'Complete Frontend', subtitle: 'React Native', level: 'key-result', x: 60, y: 220 },
  { id: '3', title: 'Backend API', subtitle: 'FastAPI + AI', level: 'key-result', x: 340, y: 220 },
  { id: '4', title: 'User Testing', subtitle: '5 Beta Users', level: 'task', x: 60, y: 390 },
];

const CONNECTIONS = [
  { from: '1', to: '2' },
  { from: '1', to: '3' },
  { from: '2', to: '4' },
];

const CANVAS_W = 600;
const CANVAS_H = 600;

export default function StrategyMap() {
  return (
    <div style={styles.scroll}>
      <div style={{ ...styles.canvas, width: CANVAS_W, height: CANVAS_H }}>
        <svg
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ position: 'absolute', top: 0, left: 0, zIndex: 0 }}
        >
          {CONNECTIONS.map((c, i) => {
            const start = GOALS.find((g) => g.id === c.from);
            const end = GOALS.find((g) => g.id === c.to);
            if (!start || !end) return null;
            const x1 = start.x + NODE_WIDTH / 2;
            const y1 = start.y + NODE_HEIGHT;
            const x2 = end.x + NODE_WIDTH / 2;
            const y2 = end.y;
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

        {GOALS.map((g) => (
          <GoalNode
            key={g.id}
            title={g.title}
            subtitle={g.subtitle}
            level={g.level}
            x={g.x}
            y={g.y}
          />
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  scroll: {
    flex: 1,
    overflow: 'auto',
    background: '#F9FAFB',
    height: '100%',
  },
  canvas: {
    position: 'relative',
  },
};
