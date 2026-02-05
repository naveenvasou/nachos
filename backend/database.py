import sqlite3
import os
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
import json

DB_NAME = "nachos.db"

ALLOWED_TASK_COLUMNS = {'status', 'title', 'priority', 'due_date', 'scheduled_date', 'effort', 'notes', 'blocker_reason'}
ALLOWED_GOAL_COLUMNS = {'title', 'description', 'status', 'notes'}

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    
    # Create Goals Table
    c.execute('''
        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, ARCHIVED
            created_at TEXT,
            notes TEXT
        )
    ''')
    
    # Check if 'notes' column exists in goals, if not add it
    c.execute("PRAGMA table_info(goals)")
    columns = [column[1] for column in c.fetchall()]
    if 'notes' not in columns:
        c.execute("ALTER TABLE goals ADD COLUMN notes TEXT")
    
    # Create Tasks Table
    c.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            goal_id INTEGER,
            title TEXT NOT NULL,
            status TEXT DEFAULT 'TODO', -- TODO, IN_PROGRESS, DONE, BLOCKED
            priority TEXT DEFAULT 'MEDIUM', -- HIGH, MEDIUM, LOW
            due_date TEXT, -- External deadline
            scheduled_date TEXT, -- Internal plan date (YYYY-MM-DD or 'TODAY')
            effort TEXT, -- SMALL, MEDIUM, LARGE
            blocker_reason TEXT,
            notes TEXT,
            created_at TEXT,
            updated_at TEXT,
            FOREIGN KEY (goal_id) REFERENCES goals (id)
        )
    ''')
    
    # Check if new columns exist in tasks, if not add them
    c.execute("PRAGMA table_info(tasks)")
    columns = [column[1] for column in c.fetchall()]
    if 'notes' not in columns:
        c.execute("ALTER TABLE tasks ADD COLUMN notes TEXT")
    if 'scheduled_date' not in columns:
        c.execute("ALTER TABLE tasks ADD COLUMN scheduled_date TEXT")

    # --- MEMORY TABLES ---
    c.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT NOT NULL,    -- user, assistant, tool
            content TEXT,
            tool_calls TEXT,       -- JSON string
            tool_call_id TEXT,     -- For tool outputs
            created_at TEXT
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS session_summary (
            id INTEGER PRIMARY KEY DEFAULT 1, -- Singleton row
            content TEXT,
            last_summarized_message_id INTEGER DEFAULT 0
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            push_token TEXT UNIQUE,
            created_at TEXT,
            last_active TEXT
        )
    ''')

    # Initialize summary row if it doesn't exist
    c.execute("INSERT OR IGNORE INTO session_summary (id, content, last_summarized_message_id) VALUES (1, '', 0)")

    conn.commit()
    conn.close()

# Initialize DB on module load (or we could call this explicitly)
if not os.path.exists(DB_NAME):
    init_db()
else:
    # Ensure tables/columns exist even if db file exists
    init_db()

# --- MEMORY FUNCTIONS ---

def save_push_token(token: str) -> bool:
    conn = get_db_connection()
    try:
        c = conn.cursor()
        now = datetime.now().isoformat()

        c.execute('''
            INSERT OR REPLACE INTO users (push_token, created_at, last_active)
            VALUES (?, COALESCE((SELECT created_at FROM users WHERE push_token = ?), ?), ?)
        ''', (token, token, now, now))

        conn.commit()
        return True
    except Exception as e:
        print(f"Error saving push token: {e}")
        return False
    finally:
        conn.close()

def get_push_tokens() -> List[str]:
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute("SELECT push_token FROM users WHERE push_token IS NOT NULL")
        rows = c.fetchall()
        return [row['push_token'] for row in rows]
    finally:
        conn.close()

def add_message(role: str, content: str, tool_calls: Optional[List[Dict]] = None, tool_call_id: Optional[str] = None) -> int:
    conn = get_db_connection()
    try:
        c = conn.cursor()
        created_at = datetime.now().isoformat()

        tool_calls_json = json.dumps(tool_calls) if tool_calls else None

        c.execute('''
            INSERT INTO messages (role, content, tool_calls, tool_call_id, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (role, content, tool_calls_json, tool_call_id, created_at))

        msg_id = c.lastrowid
        conn.commit()
        return msg_id
    finally:
        conn.close()

def update_message_content(message_id: int, new_content: str) -> bool:
    """
    Updates the content of a specific message. Useful for fixing history.
    """
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute("UPDATE messages SET content = ? WHERE id = ?", (new_content, message_id))

        rows = c.rowcount
        conn.commit()
        return rows > 0
    except Exception as e:
        print(f"Error updating message {message_id}: {e}")
        return False
    finally:
        conn.close()

def delete_message(message_id: int) -> bool:
    """
    Deletes a specific message from the database.
    """
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute("DELETE FROM messages WHERE id = ?", (message_id,))
        rows = c.rowcount
        conn.commit()
        return rows > 0
    except Exception as e:
        print(f"Error deleting message {message_id}: {e}")
        return False
    finally:
        conn.close()

def get_memory_context() -> Tuple[str, List[Dict[str, Any]]]:
    """
    Returns (current_summary, list_of_unsummarized_messages)
    """
    conn = get_db_connection()
    try:
        c = conn.cursor()

        # 1. Get Summary
        c.execute("SELECT content, last_summarized_message_id FROM session_summary WHERE id = 1")
        row = c.fetchone()
        summary = row['content'] if row else ""
        last_id = row['last_summarized_message_id'] if row else 0

        # 2. Get Unsummarized Messages (Buffer)
        c.execute("SELECT * FROM messages WHERE id > ? ORDER BY id ASC", (last_id,))
        messages = [dict(r) for r in c.fetchall()]

        return summary, messages
    finally:
        conn.close()

def update_summary(new_content: str, last_summarized_id: int):
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute("UPDATE session_summary SET content = ?, last_summarized_message_id = ? WHERE id = 1",
                  (new_content, last_summarized_id))
        conn.commit()
    finally:
        conn.close()

def get_messages_range(start_id: int, limit: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute("SELECT * FROM messages WHERE id >= ? ORDER BY id ASC LIMIT ?", (start_id, limit))
        rows = c.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def create_goal(title: str, description: str = "", notes: str = "") -> int:
    conn = get_db_connection()
    try:
        c = conn.cursor()
        created_at = datetime.now().isoformat()
        c.execute('INSERT INTO goals (title, description, status, created_at, notes) VALUES (?, ?, ?, ?, ?)',
                  (title, description, 'ACTIVE', created_at, notes))
        goal_id = c.lastrowid
        conn.commit()
        return goal_id
    finally:
        conn.close()

def create_task(title: str, goal_id: Optional[int] = None, priority: str = "MEDIUM", due_date: Optional[str] = None, scheduled_date: Optional[str] = None, effort: str = "MEDIUM", notes: str = "") -> int:
    conn = get_db_connection()
    try:
        c = conn.cursor()
        created_at = datetime.now().isoformat()
        c.execute('''
            INSERT INTO tasks (title, goal_id, status, priority, due_date, scheduled_date, effort, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (title, goal_id, 'TODO', priority, due_date, scheduled_date, effort, notes, created_at, created_at))
        task_id = c.lastrowid
        conn.commit()
        return task_id
    finally:
        conn.close()

def update_task_status(task_id: int, status: str, blocker_reason: Optional[str] = None) -> bool:
    # Kept for backward compatibility, but update_task generic should be preferred
    return update_task(task_id, {"status": status, "blocker_reason": blocker_reason})

def update_task(task_id: int, updates: Dict[str, Any]) -> bool:
    conn = get_db_connection()
    try:
        c = conn.cursor()
        updated_at = datetime.now().isoformat()

        fields = []
        values = []

        for key, value in updates.items():
            if key not in ALLOWED_TASK_COLUMNS:
                continue
            fields.append(f"{key} = ?")
            values.append(value)

        fields.append("updated_at = ?")
        values.append(updated_at)

        if len(fields) <= 1:
            return False

        query = f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?"
        values.append(task_id)

        c.execute(query, values)
        rows_affected = c.rowcount
        conn.commit()
        return rows_affected > 0
    finally:
        conn.close()


def delete_task(task_id: int) -> bool:
    """
    Deletes a task from the database.
    """
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        rows_affected = c.rowcount
        conn.commit()
        return rows_affected > 0
    finally:
        conn.close()


def bulk_update_tasks(updates_list: List[Dict[str, Any]]) -> int:
    """
    Executes multiple task updates in a single transaction.
    Each dictionary in the list MUST contain an 'id' key.
    Returns the total number of rows affected.
    """
    conn = get_db_connection()
    c = conn.cursor()
    updated_at = datetime.now().isoformat()
    total_affected = 0
    
    try:
        for update_item in updates_list:
            if 'id' not in update_item:
                continue
                
            task_id = update_item.get('id')

            fields = []
            values = []

            for key, value in update_item.items():
                if key == 'id':
                    continue
                if key not in ALLOWED_TASK_COLUMNS:
                    continue
                fields.append(f"{key} = ?")
                values.append(value)
            
            # Skip if no actual fields to update
            if not fields:
                continue
            
            fields.append("updated_at = ?")
            values.append(updated_at)
            
            query = f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?"
            values.append(task_id)
            
            c.execute(query, values)
            total_affected += c.rowcount
            
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Bulk Update Error: {e}")
        raise e
    finally:
        conn.close()
        
    return total_affected

def get_recent_messages(limit: int = 50) -> List[Dict[str, Any]]:
    """
    Retrieves recent chat messages for the UI.
    Returns chronological order (Older -> Newer).
    Strips internal timestamps from user messages for clean UI display.
    Filters out internal [SYSTEM EVENT] triggers and SLEEP responses.
    """
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute('''
            SELECT * FROM (
                SELECT id, role, content, created_at
                FROM messages
                ORDER BY created_at DESC
                LIMIT ?
            ) ORDER BY created_at ASC
        ''', (limit,))
        rows = c.fetchall()
    finally:
        conn.close()
    
    clean_messages = []
    import re
    timestamp_pattern = re.compile(r"^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] ")

    for row in rows:
        msg = dict(row)
        content = msg.get('content') or ""
        
        # 1. Filter out System Events (Proactive Triggers)
        if msg['role'] == 'user' and "[SYSTEM EVENT]" in content:
            continue
            
        # 2. Filter out SLEEP responses (Proactive Dormant state)
        if msg['role'] == 'assistant' and "SLEEP" in content:
            continue
        
        # Strip timestamp context from user messages
        if msg['role'] == 'user' and content:
            msg['content'] = timestamp_pattern.sub("", content)
            
        clean_messages.append(msg)
        
    return clean_messages


def update_goal(goal_id: int, updates: Dict[str, Any]) -> bool:
    conn = get_db_connection()
    try:
        c = conn.cursor()

        fields = []
        values = []

        for key, value in updates.items():
            if key not in ALLOWED_GOAL_COLUMNS:
                continue
            fields.append(f"{key} = ?")
            values.append(value)

        if not fields:
            return False

        query = f"UPDATE goals SET {', '.join(fields)} WHERE id = ?"
        values.append(goal_id)

        c.execute(query, values)
        rows_affected = c.rowcount
        conn.commit()
        return rows_affected > 0
    finally:
        conn.close()

def list_tasks(status: Optional[str] = None, limit: int = 10000) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        c = conn.cursor()

        query = 'SELECT * FROM tasks'
        params = []

        if status:
            query += ' WHERE status = ?'
            params.append(status)

        query += ' ORDER BY created_at DESC LIMIT ?'
        params.append(limit)

        c.execute(query, params)
        rows = c.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()

def list_goals() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute('SELECT * FROM goals WHERE status = "ACTIVE"')
        rows = c.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_context_markdown() -> str:
    """
    Generates a Markdown string representing the current state of Goals and Tasks.
    """
    goals = list_goals()
    tasks = list_tasks(limit=10000) # Get ALL tasks (practically)
    
    today_date = datetime.now().strftime("%Y-%m-%d")
    
    md_output = f"## 📅 CURRENT STATE ({today_date})\n"
    md_output += "> \"The difference between successful people and very successful people is that very successful people say 'no' to almost everything.\" - Warren Buffet\n\n"
    
    # 1. GOALS
    md_output += "### 🎯 ACTIVE GOALS\n"
    if not goals:
        md_output += "- No active goals yet.\n"
    else:
        for g in goals:
            notes = f" (Notes: {g['notes']})" if g['notes'] else ""
            md_output += f"- [ID: {g['id']}] **{g['title']}**: {g['description']}{notes}\n"
    
    md_output += "\n---\n"
    
    # 2. TODAY'S PLAN (Scheduled for Today)
    # We define 'Today' as scheduled_date matching today OR marked explicitly as 'TODAY'
    todays_tasks = [t for t in tasks if t['scheduled_date'] == today_date or t['scheduled_date'] == 'TODAY']
    
    md_output += "### 🔥 TODAY'S SIGNAL (Focus List)\n"
    if not todays_tasks:
        md_output += "*No tasks explicitly scheduled for today yet. Access the backlog to pick your battles.*\n"
    else:
        for t in todays_tasks:
            status_icon = "✅" if t['status'] == 'DONE' else "⬜"
            md_output += f"{status_icon} [ID: {t['id']}] **{t['title']}** (Priority: {t['priority']})\n"

    md_output += "\n### 🗄️ FULL BACKLOG / HISTORY\n"
    
    # Filter out today's tasks from the rest to avoid duplicates
    today_ids = [t['id'] for t in todays_tasks]
    other_tasks = [t for t in tasks if t['id'] not in today_ids]
    
    if not other_tasks:
        md_output += "- No other tasks found.\n"
    else:
        # Group by status
        todo = [t for t in other_tasks if t['status'] == 'TODO']
        in_progress = [t for t in other_tasks if t['status'] == 'IN_PROGRESS']
        done = [t for t in other_tasks if t['status'] == 'DONE']
        blocked = [t for t in other_tasks if t['status'] == 'BLOCKED']
        cancelled = [t for t in other_tasks if t['status'] == 'CANCELLED']
        
        if in_progress:
            md_output += "**In Progress**:\n"
            for t in in_progress:
                md_output += f"- [ID: {t['id']}] {t['title']} (Due: {t['due_date'] or 'None'})\n"
        
        if todo:
            md_output += "**To Do**:\n"
            for t in todo:
                 md_output += f"- [ID: {t['id']}] {t['title']} (Due: {t['due_date'] or 'None'}, Sched: {t['scheduled_date'] or 'None'})\n"
                 
        if blocked:
             md_output += "**🚫 Blocked**:\n"
             for t in blocked:
                 md_output += f"- [ID: {t['id']}] {t['title']} (Reason: {t['blocker_reason']})\n"

        if done:
            md_output += "**✅ Completed (History)**:\n"
            for t in done:
                md_output += f"- [ID: {t['id']}] {t['title']}\n"

        if cancelled:
            md_output += "**❌ Cancelled**:\n"
            for t in cancelled:
                md_output += f"- [ID: {t['id']}] {t['title']}\n"
    
    return md_output
