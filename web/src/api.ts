export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'https://nachos-backend-728473520070.us-central1.run.app';

export interface Task {
  id: number;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  scheduled_date?: string | null;
  due_date?: string | null;
  goal_id?: number | null;
  effort?: string;
  notes?: string;
  blocker_reason?: string | null;
}

export interface Goal {
  id: number;
  title: string;
  description?: string;
  notes?: string;
  status?: string;
  created_at?: string;
}

export interface ChatHistoryMessage {
  id: number | string;
  role: 'user' | 'assistant' | 'tool' | string;
  content: string;
  tool_calls?: unknown;
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export async function fetchTasks(status?: string): Promise<Task[]> {
  const url = status ? `${API_URL}/tasks?status=${status}` : `${API_URL}/tasks`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.status}`);
  return res.json();
}

export async function fetchGoals(): Promise<Goal[]> {
  const res = await fetch(`${API_URL}/goals`);
  if (!res.ok) throw new Error(`Failed to fetch goals: ${res.status}`);
  return res.json();
}

export async function updateTask(
  id: number,
  patch: Partial<
    Pick<
      Task,
      'status' | 'title' | 'priority' | 'scheduled_date' | 'due_date' | 'effort' | 'notes' | 'blocker_reason'
    >
  >
): Promise<void> {
  const res = await fetch(`${API_URL}/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update task: ${res.status}`);
}

export async function fetchChatHistory(): Promise<ChatHistoryMessage[]> {
  const res = await fetch(`${API_URL}/chat/history`);
  if (!res.ok) throw new Error(`Failed to fetch history: ${res.status}`);
  return res.json();
}

/**
 * Today's plan = top tasks scheduled for today, ordered by priority.
 * Top-3 doctrine: cap at 3 visible "must-dos"; the rest are "also today".
 */
export function pickTodaysPlan(tasks: Task[]): { topThree: Task[]; alsoToday: Task[] } {
  const today = todayISO();
  const todaysTasks = tasks.filter(
    (t) => t.scheduled_date === today || t.scheduled_date === 'TODAY'
  );
  const open = todaysTasks.filter((t) => t.status !== 'DONE');
  const done = todaysTasks.filter((t) => t.status === 'DONE');

  const priorityRank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const sorted = [...open].sort(
    (a, b) => (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3)
  );

  return {
    topThree: sorted.slice(0, 3),
    alsoToday: [...sorted.slice(3), ...done],
  };
}

/**
 * Stream a chat message from /chat/stream and call onToken / onDone as
 * SSE events arrive. Returns the final text.
 */
export async function streamChat(
  message: string,
  opts: {
    onToken?: (token: string, full: string) => void;
    onDone?: (full: string) => void;
    signal?: AbortSignal;
  } = {}
): Promise<string> {
  const res = await fetch(`${API_URL}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) throw new Error(`Stream failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let done = false;

  while (!done) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const event = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      for (const line of event.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        try {
          const data = JSON.parse(payload);
          if (data.token) {
            full += data.token;
            opts.onToken?.(data.token, full);
          }
          if (data.done) {
            opts.onDone?.(full);
            done = true;
          }
        } catch {
          // skip malformed line
        }
      }
    }
  }
  return full;
}
