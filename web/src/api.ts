export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'https://nachos-backend-728473520070.us-central1.run.app';

export interface Task {
  id: number;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | string;
  priority: string;
  scheduled_date?: string;
  due_date?: string;
  goal_id?: number;
  effort?: string;
  notes?: string;
}

export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch(`${API_URL}/tasks`);
  if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.status}`);
  return res.json();
}

export async function updateTask(
  id: number,
  patch: Partial<Pick<Task, 'status' | 'title' | 'priority' | 'scheduled_date' | 'due_date'>>
): Promise<void> {
  const res = await fetch(`${API_URL}/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update task: ${res.status}`);
}

export interface ChatHistoryMessage {
  id: number | string;
  role: 'user' | 'assistant' | 'tool' | string;
  content: string;
  tool_calls?: unknown;
}

export async function fetchChatHistory(): Promise<ChatHistoryMessage[]> {
  const res = await fetch(`${API_URL}/chat/history`);
  if (!res.ok) throw new Error(`Failed to fetch history: ${res.status}`);
  return res.json();
}
