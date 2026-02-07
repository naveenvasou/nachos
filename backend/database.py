import sqlite3
import os
import re
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
import json
from contextlib import contextmanager

# Check for PostgreSQL dependency
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    from psycopg2 import pool
    HAS_POSTGRES = True
except ImportError:
    HAS_POSTGRES = False

DATABASE_URL = os.getenv("DATABASE_URL")
DB_NAME = "nachos.db"

# Global connection pool for Postgres
pg_pool = None

ALLOWED_TASK_COLUMNS = {'status', 'title', 'priority', 'due_date', 'scheduled_date', 'effort', 'notes', 'blocker_reason'}
ALLOWED_GOAL_COLUMNS = {'title', 'description', 'status', 'notes'}
ALLOWED_HABIT_COLUMNS = {'title', 'frequency', 'goal_id', 'active'}
ALLOWED_PROFILE_KEYS = {
    'preferred_work_hours', 'energy_pattern', 'communication_style',
    'timezone', 'wake_time', 'sleep_time', 'focus_blocks',
    'biggest_goal', 'motivation_style', 'check_in_preference',
}

def get_db_connection():
    """
    Returns a database connection.
    If DATABASE_URL is set, returns a Postgres connection.
    Otherwise, returns a SQLite connection.
    """
    global pg_pool
    if DATABASE_URL:
        if not HAS_POSTGRES:
            raise ImportError("psycopg2-binary is required for PostgreSQL but not installed. Please add it to requirements.txt.")
        
        if pg_pool is None:
            pg_pool = psycopg2.pool.SimpleConnectionPool(1, 10, DATABASE_URL)
        
        conn = pg_pool.getconn()
        return conn
    else:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

def release_db_connection(conn):
    """
    Releases the connection back to the pool (Postgres) or closes it (SQLite).
    """
    global pg_pool
    if DATABASE_URL and pg_pool:
        pg_pool.putconn(conn)
    else:
        conn.close()

def _dict_factory(cursor, row):
    """
    Custom row factory for SQLite to behave like RealDictCursor
    """
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

@contextmanager
def get_cursor():
    """
    Context manager to yield a cursor and handle commit/rollback/close automatically.
    """
    conn = get_db_connection()
    try:
        if DATABASE_URL:
            # Postgres
            cur = conn.cursor(cursor_factory=RealDictCursor)
            yield cur
        else:
            # SQLite
            # We don't set row_factory here because we might need raw tuples for some ops,
            # but for consistency with RealDictCursor, we should convert rows to dicts mainly in fetch.
            # However, sqlite3.Row is already dict-like enough for access by name.
            cur = conn.cursor()
            yield cur
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        if not DATABASE_URL:
            # For SQLite we close cursor implied by connection close, but good practice
            cur.close()
        try:
            # For Postgres, we must close cursor before returning to pool usually, 
            # though putconn often handles reset. Explicit close is safer.
            if DATABASE_URL:
                cur.close()
        except:
            pass
        release_db_connection(conn)

def normalize_query(query: str) -> str:
    """
    Adapts SQL query for the target database.
    - Convert '?' to '%s' for Postgres.
    - Handle AUTOINCREMENT replacement if necessary (though usually handled by SERIAL/sequence implicity).
    """
    if DATABASE_URL:
        # Replace ? with %s
        query = query.replace('?', '%s')
        
        # Replace weak SQLite types if needed, though Postgres often casts.
        # Handle "INSERT OR REPLACE" -> Postgres "INSERT ... ON CONFLICT"
        # This is a naive regex replacement, complex queries might need manual adjustment.
        if "INSERT OR REPLACE" in query:
             # This is tricky without knowing the PK. 
             # For simple Key-Value tables like users(push_token), we can do ON CONFLICT.
             # Ideally, we rewrite the specific functions using this.
             pass
    return query

def init_db():
    # Detect if we need to Initialize Postgres or SQLite
    if DATABASE_URL:
        init_postgres()
    else:
        init_sqlite()

def init_sqlite():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
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

    # --- HABITS TABLES ---
    c.execute('''
        CREATE TABLE IF NOT EXISTS habits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            frequency TEXT DEFAULT 'daily',  -- daily, weekdays, MWF, TTh, weekly
            goal_id INTEGER,
            active INTEGER DEFAULT 1,
            created_at TEXT,
            FOREIGN KEY (goal_id) REFERENCES goals (id)
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS habit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            habit_id INTEGER NOT NULL,
            log_date TEXT NOT NULL,       -- YYYY-MM-DD
            status TEXT DEFAULT 'done',   -- done, skipped
            skip_reason TEXT,
            created_at TEXT,
            FOREIGN KEY (habit_id) REFERENCES habits (id)
        )
    ''')

    # --- USER PROFILE TABLE (key-value store) ---
    c.execute('''
        CREATE TABLE IF NOT EXISTS user_profile (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TEXT
        )
    ''')

    # --- REFLECTIONS TABLE ---
    c.execute('''
        CREATE TABLE IF NOT EXISTS reflections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            reflection_type TEXT DEFAULT 'daily',  -- daily, weekly, milestone
            created_at TEXT
        )
    ''')

    # Initialize summary row if it doesn't exist
    c.execute("INSERT OR IGNORE INTO session_summary (id, content, last_summarized_message_id) VALUES (1, '', 0)")

    conn.commit()
    conn.close()

def init_postgres():
    # Initialize Postgres Tables
    # Postgres uses SERIAL for auto-increment.
    # We must use separate connection logic here.
    with get_cursor() as c:
        # Create Goals Table
        c.execute('''
            CREATE TABLE IF NOT EXISTS goals (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'ACTIVE',
                created_at TEXT,
                notes TEXT
            )
        ''')
        
        # Check if 'notes' column exists in goals - Postgres way
        c.execute("SELECT column_name FROM information_schema.columns WHERE table_name='goals' AND column_name='notes'")
        if not c.fetchone():
            c.execute("ALTER TABLE goals ADD COLUMN notes TEXT")
        
        # Create Tasks Table
        c.execute('''
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                goal_id INTEGER,
                title TEXT NOT NULL,
                status TEXT DEFAULT 'TODO',
                priority TEXT DEFAULT 'MEDIUM',
                due_date TEXT,
                scheduled_date TEXT,
                effort TEXT,
                blocker_reason TEXT,
                notes TEXT,
                created_at TEXT,
                updated_at TEXT,
                FOREIGN KEY (goal_id) REFERENCES goals (id)
            )
        ''')
        
         # Check columns for tasks
        c.execute("SELECT column_name FROM information_schema.columns WHERE table_name='tasks' AND column_name='notes'")
        if not c.fetchone():
            c.execute("ALTER TABLE tasks ADD COLUMN notes TEXT")
            
        c.execute("SELECT column_name FROM information_schema.columns WHERE table_name='tasks' AND column_name='scheduled_date'")
        if not c.fetchone():
             c.execute("ALTER TABLE tasks ADD COLUMN scheduled_date TEXT")

        # --- MEMORY TABLES ---
        c.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                role TEXT NOT NULL,
                content TEXT,
                tool_calls TEXT,
                tool_call_id TEXT,
                created_at TEXT
            )
        ''')

        c.execute('''
            CREATE TABLE IF NOT EXISTS session_summary (
                id INTEGER PRIMARY KEY DEFAULT 1,
                content TEXT,
                last_summarized_message_id INTEGER DEFAULT 0
            )
        ''')
        
        c.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                push_token TEXT UNIQUE,
                created_at TEXT,
                last_active TEXT
            )
        ''')
        
        # --- HABITS TABLES ---
        c.execute('''
            CREATE TABLE IF NOT EXISTS habits (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                frequency TEXT DEFAULT 'daily',
                goal_id INTEGER,
                active INTEGER DEFAULT 1,
                created_at TEXT,
                FOREIGN KEY (goal_id) REFERENCES goals (id)
            )
        ''')

        c.execute('''
            CREATE TABLE IF NOT EXISTS habit_logs (
                id SERIAL PRIMARY KEY,
                habit_id INTEGER NOT NULL,
                log_date TEXT NOT NULL,
                status TEXT DEFAULT 'done',
                skip_reason TEXT,
                created_at TEXT,
                FOREIGN KEY (habit_id) REFERENCES habits (id)
            )
        ''')

        # --- USER PROFILE TABLE ---
        c.execute('''
            CREATE TABLE IF NOT EXISTS user_profile (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TEXT
            )
        ''')

        # --- REFLECTIONS TABLE ---
        c.execute('''
            CREATE TABLE IF NOT EXISTS reflections (
                id SERIAL PRIMARY KEY,
                content TEXT NOT NULL,
                reflection_type TEXT DEFAULT 'daily',
                created_at TEXT
            )
        ''')

        # Initialize summary row
        c.execute("INSERT INTO session_summary (id, content, last_summarized_message_id) VALUES (1, '', 0) ON CONFLICT (id) DO NOTHING")

# Initialize DB
# For SQLite, we can init on module load since it's local
# For Postgres, we defer to the app lifespan event to ensure network is ready
if not DATABASE_URL:
    if not os.path.exists(DB_NAME):
        init_sqlite()
    else:
        # Ensure tables/columns exist
        init_sqlite()

# NOTE: For Postgres (DATABASE_URL set), init_postgres() is called 
# from main.py's lifespan event to ensure networking is ready.


# --- MEMORY FUNCTIONS ---

def save_push_token(token: str) -> bool:
    try:
        with get_cursor() as c:
            now = datetime.now().isoformat()
            
            if DATABASE_URL:
                # Postgres UPSERT
                c.execute('''
                    INSERT INTO users (push_token, created_at, last_active)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (push_token) 
                    DO UPDATE SET last_active = EXCLUDED.last_active
                ''', (token, now, now))
            else:
                # SQLite UPSERT-ish
                c.execute('''
                    INSERT OR REPLACE INTO users (push_token, created_at, last_active)
                    VALUES (?, COALESCE((SELECT created_at FROM users WHERE push_token = ?), ?), ?)
                ''', (token, token, now, now))
            return True
    except Exception as e:
        print(f"Error saving push token: {e}")
        return False

def get_push_tokens() -> List[str]:
    with get_cursor() as c:
        c.execute("SELECT push_token FROM users WHERE push_token IS NOT NULL")
        rows = c.fetchall()
        # Row factory handles dict access for both
        return [row['push_token'] for row in rows]

def add_message(role: str, content: str, tool_calls: Optional[List[Dict]] = None, tool_call_id: Optional[str] = None) -> int:
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        created_at = datetime.now().isoformat()
        tool_calls_json = json.dumps(tool_calls) if tool_calls else None

        if DATABASE_URL:
            cur.execute(
                "INSERT INTO messages (role, content, tool_calls, tool_call_id, created_at) "
                "VALUES (%s, %s, %s, %s, %s) RETURNING id",
                (role, content, tool_calls_json, tool_call_id, created_at)
            )
            msg_id = cur.fetchone()[0]
        else:
            cur.execute(
                "INSERT INTO messages (role, content, tool_calls, tool_call_id, created_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (role, content, tool_calls_json, tool_call_id, created_at)
            )
            msg_id = cur.lastrowid

        conn.commit()
        return msg_id
    finally:
        release_db_connection(conn)


def update_message_content(message_id: int, new_content: str) -> bool:
    with get_cursor() as c:
        query = "UPDATE messages SET content = ? WHERE id = ?"
        query = normalize_query(query)
        c.execute(query, (new_content, message_id))
        return c.rowcount > 0

def delete_message(message_id: int) -> bool:
    with get_cursor() as c:
        query = "DELETE FROM messages WHERE id = ?"
        query = normalize_query(query)
        c.execute(query, (message_id,))
        return c.rowcount > 0

def get_memory_context() -> Tuple[str, List[Dict[str, Any]]]:
    with get_cursor() as c:
        # 1. Get Summary
        query_sum = "SELECT content, last_summarized_message_id FROM session_summary WHERE id = 1"
        c.execute(query_sum)
        row = c.fetchone()
        summary = row['content'] if row else ""
        last_id = row['last_summarized_message_id'] if row else 0

        # 2. Get Unsummarized Messages
        query_msg = "SELECT * FROM messages WHERE id > ? ORDER BY id ASC"
        query_msg = normalize_query(query_msg)
        c.execute(query_msg, (last_id,))
        messages = [dict(r) for r in c.fetchall()]

        return summary, messages

def update_summary(new_content: str, last_summarized_id: int):
    with get_cursor() as c:
        query = "UPDATE session_summary SET content = ?, last_summarized_message_id = ? WHERE id = 1"
        query = normalize_query(query)
        c.execute(query, (new_content, last_summarized_id))

def get_messages_range(start_id: int, limit: int) -> List[Dict[str, Any]]:
    with get_cursor() as c:
        query = "SELECT * FROM messages WHERE id >= ? ORDER BY id ASC LIMIT ?"
        query = normalize_query(query)
        c.execute(query, (start_id, limit))
        return [dict(r) for r in c.fetchall()]

def create_goal(title: str, description: str = "", notes: str = "") -> int:
    conn = get_db_connection()
    try:
        created_at = datetime.now().isoformat()
        if DATABASE_URL:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO goals (title, description, status, created_at, notes) 
                VALUES (%s, %s, 'ACTIVE', %s, %s) RETURNING id
            """, (title, description, created_at, notes))
            goal_id = cur.fetchone()[0]
            conn.commit()
            return goal_id
        else:
            cur = conn.cursor()
            cur.execute('INSERT INTO goals (title, description, status, created_at, notes) VALUES (?, ?, "ACTIVE", ?, ?)',
                      (title, description, created_at, notes))
            goal_id = cur.lastrowid
            conn.commit()
            return goal_id
    finally:
        release_db_connection(conn)

def create_task(title: str, goal_id: Optional[int] = None, priority: str = "MEDIUM", due_date: Optional[str] = None, scheduled_date: Optional[str] = None, effort: str = "MEDIUM", notes: str = "") -> int:
    conn = get_db_connection()
    try:
        created_at = datetime.now().isoformat()
        if DATABASE_URL:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO tasks (title, goal_id, status, priority, due_date, scheduled_date, effort, notes, created_at, updated_at)
                VALUES (%s, %s, 'TODO', %s, %s, %s, %s, %s, %s, %s) RETURNING id
            """, (title, goal_id, priority, due_date, scheduled_date, effort, notes, created_at, created_at))
            task_id = cur.fetchone()[0]
            conn.commit()
            return task_id
        else:
            cur = conn.cursor()
            cur.execute('''
                INSERT INTO tasks (title, goal_id, status, priority, due_date, scheduled_date, effort, notes, created_at, updated_at)
                VALUES (?, ?, 'TODO', ?, ?, ?, ?, ?, ?, ?)
            ''', (title, goal_id, priority, due_date, scheduled_date, effort, notes, created_at, created_at))
            task_id = cur.lastrowid
            conn.commit()
            return task_id
    finally:
        release_db_connection(conn)

def update_task_status(task_id: int, status: str, blocker_reason: Optional[str] = None) -> bool:
    return update_task(task_id, {"status": status, "blocker_reason": blocker_reason})

def update_task(task_id: int, updates: Dict[str, Any]) -> bool:
    with get_cursor() as c:
        updated_at = datetime.now().isoformat()

        fields = []
        values = []

        for key, value in updates.items():
            if key not in ALLOWED_TASK_COLUMNS:
                continue
            fields.append(f"{key} = ?" if not DATABASE_URL else f"{key} = %s")
            values.append(value)

        fields.append("updated_at = ?" if not DATABASE_URL else "updated_at = %s")
        values.append(updated_at)

        if len(fields) <= 1:
            return False

        query = f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?"
        if DATABASE_URL:
            query = query.replace("?", "%s") # Safety net
        
        values.append(task_id)

        c.execute(query, values)
        return c.rowcount > 0

def delete_task(task_id: int) -> bool:
    with get_cursor() as c:
        query = "DELETE FROM tasks WHERE id = ?"
        query = normalize_query(query)
        c.execute(query, (task_id,))
        return c.rowcount > 0

def bulk_update_tasks(updates_list: List[Dict[str, Any]]) -> int:
    # Transaction handling is tricky with pool vs single conn, so we use explcit conn
    conn = get_db_connection()
    updated_at = datetime.now().isoformat()
    total_affected = 0
    
    try:
        cur = conn.cursor()
        
        for update_item in updates_list:
            if 'id' not in update_item:
                continue
            task_id = update_item.get('id')

            fields = []
            values = []

            for key, value in update_item.items():
                if key == 'id': continue
                if key not in ALLOWED_TASK_COLUMNS: continue
                fields.append(f"{key} = ?" if not DATABASE_URL else f"{key} = %s")
                values.append(value)
            
            if not fields: continue
            
            fields.append("updated_at = ?" if not DATABASE_URL else "updated_at = %s")
            values.append(updated_at)
            
            query = f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?"
            if DATABASE_URL:
                query = query.replace("?", "%s")
                
            values.append(task_id)
            cur.execute(query, values)
            total_affected += cur.rowcount
            
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Bulk Update Error: {e}")
        raise e
    finally:
        if DATABASE_URL:
            cur.close()
        release_db_connection(conn)
        
    return total_affected

def get_recent_messages(limit: int = 50) -> List[Dict[str, Any]]:
    with get_cursor() as c:
        if DATABASE_URL:
             # Postgres subquery layout
            query = """
                SELECT * FROM (
                    SELECT id, role, content, created_at
                    FROM messages
                    ORDER BY created_at DESC
                    LIMIT %s
                ) AS sub ORDER BY created_at ASC
            """
            c.execute(query, (limit,))
        else:
             c.execute('''
                SELECT * FROM (
                    SELECT id, role, content, created_at
                    FROM messages
                    ORDER BY created_at DESC
                    LIMIT ?
                ) ORDER BY created_at ASC
            ''', (limit,))
            
        rows = c.fetchall()
        # Process rows...
        # Since we use dict_factory/RealDictCursor, rows are dicts
        
    clean_messages = []
    import re
    timestamp_pattern = re.compile(r"^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] ")

    for row in rows:
        msg = dict(row) # ensure dict
        content = msg.get('content') or ""
        
        if msg['role'] == 'user' and "[SYSTEM EVENT]" in content:
            continue
        if msg['role'] == 'assistant' and "SLEEP" in content:
            continue
        if msg['role'] == 'user' and content:
            msg['content'] = timestamp_pattern.sub("", content)
            
        clean_messages.append(msg)
    return clean_messages

def update_goal(goal_id: int, updates: Dict[str, Any]) -> bool:
    with get_cursor() as c:
        fields = []
        values = []

        for key, value in updates.items():
            if key not in ALLOWED_GOAL_COLUMNS: continue
            fields.append(f"{key} = ?" if not DATABASE_URL else f"{key} = %s")
            values.append(value)

        if not fields: return False

        query = f"UPDATE goals SET {', '.join(fields)} WHERE id = ?"
        if DATABASE_URL: query = query.replace("?", "%s")
        values.append(goal_id)

        c.execute(query, values)
        return c.rowcount > 0

def list_tasks(status: Optional[str] = None, limit: int = 10000) -> List[Dict[str, Any]]:
    with get_cursor() as c:
        query = 'SELECT * FROM tasks'
        params = []

        if status:
            query += ' WHERE status = ?' if not DATABASE_URL else ' WHERE status = %s'
            params.append(status)

        query += ' ORDER BY created_at DESC LIMIT ?' if not DATABASE_URL else ' ORDER BY created_at DESC LIMIT %s'
        params.append(limit)

        c.execute(query, params)
        rows = c.fetchall()
        return [dict(row) for row in rows]

def list_goals() -> List[Dict[str, Any]]:
    with get_cursor() as c:
        c.execute('SELECT * FROM goals WHERE status = "ACTIVE"' if not DATABASE_URL else "SELECT * FROM goals WHERE status = 'ACTIVE'")
        rows = c.fetchall()
        return [dict(row) for row in rows]

# --- HABIT FUNCTIONS ---

def create_habit(title: str, frequency: str = "daily", goal_id: Optional[int] = None) -> int:
    conn = get_db_connection()
    try:
        created_at = datetime.now().isoformat()
        if DATABASE_URL:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO habits (title, frequency, goal_id, active, created_at)
                VALUES (%s, %s, %s, 1, %s) RETURNING id
            """, (title, frequency, goal_id, created_at))
            habit_id = cur.fetchone()[0]
            conn.commit()
            return habit_id
        else:
            cur = conn.cursor()
            cur.execute('''
                INSERT INTO habits (title, frequency, goal_id, active, created_at)
                VALUES (?, ?, ?, 1, ?)
            ''', (title, frequency, goal_id, created_at))
            habit_id = cur.lastrowid
            conn.commit()
            return habit_id
    finally:
        release_db_connection(conn)

def log_habit(habit_id: int, log_date: Optional[str] = None, status: str = "done", skip_reason: str = "") -> int:
    conn = get_db_connection()
    try:
        created_at = datetime.now().isoformat()
        if not log_date:
            log_date = datetime.now().strftime("%Y-%m-%d")
        if DATABASE_URL:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO habit_logs (habit_id, log_date, status, skip_reason, created_at)
                VALUES (%s, %s, %s, %s, %s) RETURNING id
            """, (habit_id, log_date, status, skip_reason, created_at))
            log_id = cur.fetchone()[0]
            conn.commit()
            return log_id
        else:
            cur = conn.cursor()
            cur.execute('''
                INSERT INTO habit_logs (habit_id, log_date, status, skip_reason, created_at)
                VALUES (?, ?, ?, ?, ?)
            ''', (habit_id, log_date, status, skip_reason, created_at))
            log_id = cur.lastrowid
            conn.commit()
            return log_id
    finally:
        release_db_connection(conn)

def list_habits(active_only: bool = True) -> List[Dict[str, Any]]:
    with get_cursor() as c:
        if active_only:
            query = "SELECT * FROM habits WHERE active = 1 ORDER BY created_at ASC"
        else:
            query = "SELECT * FROM habits ORDER BY created_at ASC"
        c.execute(query)
        return [dict(row) for row in c.fetchall()]

def update_habit(habit_id: int, updates: Dict[str, Any]) -> bool:
    with get_cursor() as c:
        fields = []
        values = []
        for key, value in updates.items():
            if key not in ALLOWED_HABIT_COLUMNS:
                continue
            fields.append(f"{key} = ?" if not DATABASE_URL else f"{key} = %s")
            values.append(value)
        if not fields:
            return False
        query = f"UPDATE habits SET {', '.join(fields)} WHERE id = ?"
        if DATABASE_URL:
            query = query.replace("?", "%s")
        values.append(habit_id)
        c.execute(query, values)
        return c.rowcount > 0

def get_habit_streaks() -> List[Dict[str, Any]]:
    """Compute current streak, longest streak, and completion rate per habit."""
    habits = list_habits(active_only=True)
    today = datetime.now().strftime("%Y-%m-%d")
    results = []

    with get_cursor() as c:
        for habit in habits:
            hid = habit['id']
            query = "SELECT log_date, status FROM habit_logs WHERE habit_id = ? ORDER BY log_date DESC"
            query = normalize_query(query)
            c.execute(query, (hid,))
            logs = [dict(r) for r in c.fetchall()]

            done_dates = sorted(set(l['log_date'] for l in logs if l['status'] == 'done'), reverse=True)
            total_logs = len(logs)
            done_count = len([l for l in logs if l['status'] == 'done'])

            # Current streak: consecutive days ending today (or yesterday)
            current_streak = 0
            check_date = datetime.now().date()
            for _ in range(365):
                date_str = check_date.strftime("%Y-%m-%d")
                if date_str in done_dates:
                    current_streak += 1
                    check_date -= timedelta(days=1)
                elif current_streak == 0 and check_date == datetime.now().date():
                    # Today not logged yet — check from yesterday
                    check_date -= timedelta(days=1)
                    continue
                else:
                    break

            # Longest streak
            longest_streak = 0
            if done_dates:
                sorted_asc = sorted(done_dates)
                streak = 1
                for i in range(1, len(sorted_asc)):
                    prev = datetime.strptime(sorted_asc[i-1], "%Y-%m-%d").date()
                    curr = datetime.strptime(sorted_asc[i], "%Y-%m-%d").date()
                    if (curr - prev).days == 1:
                        streak += 1
                    else:
                        longest_streak = max(longest_streak, streak)
                        streak = 1
                longest_streak = max(longest_streak, streak)

            completion_rate = round(done_count / total_logs * 100) if total_logs > 0 else 0

            results.append({
                "habit_id": hid,
                "title": habit['title'],
                "frequency": habit['frequency'],
                "current_streak": current_streak,
                "longest_streak": longest_streak,
                "completion_rate": completion_rate,
                "total_logs": total_logs,
                "logged_today": today in [l['log_date'] for l in logs],
            })
    return results


# --- USER PROFILE FUNCTIONS ---

def set_profile(key: str, value: str) -> bool:
    with get_cursor() as c:
        now = datetime.now().isoformat()
        if DATABASE_URL:
            c.execute("""
                INSERT INTO user_profile (key, value, updated_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
            """, (key, value, now))
        else:
            c.execute("""
                INSERT OR REPLACE INTO user_profile (key, value, updated_at)
                VALUES (?, ?, ?)
            """, (key, value, now))
        return True

def get_profile() -> Dict[str, str]:
    with get_cursor() as c:
        c.execute("SELECT key, value FROM user_profile")
        rows = c.fetchall()
        return {row['key']: row['value'] for row in rows}


# --- REFLECTION FUNCTIONS ---

def save_reflection(content: str, reflection_type: str = "daily") -> int:
    conn = get_db_connection()
    try:
        created_at = datetime.now().isoformat()
        if DATABASE_URL:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO reflections (content, reflection_type, created_at)
                VALUES (%s, %s, %s) RETURNING id
            """, (content, reflection_type, created_at))
            rid = cur.fetchone()[0]
            conn.commit()
            return rid
        else:
            cur = conn.cursor()
            cur.execute('''
                INSERT INTO reflections (content, reflection_type, created_at)
                VALUES (?, ?, ?)
            ''', (content, reflection_type, created_at))
            rid = cur.lastrowid
            conn.commit()
            return rid
    finally:
        release_db_connection(conn)

def get_recent_reflections(limit: int = 5, reflection_type: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_cursor() as c:
        if reflection_type:
            query = "SELECT * FROM reflections WHERE reflection_type = ? ORDER BY created_at DESC LIMIT ?"
            query = normalize_query(query)
            c.execute(query, (reflection_type, limit))
        else:
            query = "SELECT * FROM reflections ORDER BY created_at DESC LIMIT ?"
            query = normalize_query(query)
            c.execute(query, (limit,))
        return [dict(r) for r in c.fetchall()]


# --- ANALYTICS FUNCTIONS ---

def get_task_stats() -> Dict[str, Any]:
    """Compute task analytics: completion rates, overdue count, avg completion time."""
    tasks = list_tasks(limit=10000)
    today = datetime.now().strftime("%Y-%m-%d")

    total = len(tasks)
    done = [t for t in tasks if t['status'] == 'DONE']
    todo = [t for t in tasks if t['status'] == 'TODO']
    in_progress = [t for t in tasks if t['status'] == 'IN_PROGRESS']
    blocked = [t for t in tasks if t['status'] == 'BLOCKED']

    # Overdue: tasks with due_date < today and not DONE/CANCELLED
    overdue = []
    for t in tasks:
        if t['due_date'] and t['status'] not in ('DONE', 'CANCELLED'):
            try:
                if t['due_date'] < today:
                    overdue.append(t)
            except (TypeError, ValueError):
                pass

    # Completion rate
    completed_or_active = [t for t in tasks if t['status'] in ('DONE', 'TODO', 'IN_PROGRESS', 'BLOCKED')]
    completion_rate = round(len(done) / len(completed_or_active) * 100) if completed_or_active else 0

    # Avg time to complete (created_at -> updated_at for DONE tasks)
    completion_times = []
    for t in done:
        if t.get('created_at') and t.get('updated_at'):
            try:
                created = datetime.fromisoformat(t['created_at'])
                updated = datetime.fromisoformat(t['updated_at'])
                delta = (updated - created).total_seconds() / 3600  # hours
                completion_times.append(delta)
            except (ValueError, TypeError):
                pass
    avg_completion_hours = round(sum(completion_times) / len(completion_times), 1) if completion_times else None

    # Tasks completed this week
    week_start = (datetime.now() - timedelta(days=datetime.now().weekday())).strftime("%Y-%m-%d")
    completed_this_week = sum(1 for t in done if t.get('updated_at', '') >= week_start)

    return {
        "total_tasks": total,
        "done": len(done),
        "todo": len(todo),
        "in_progress": len(in_progress),
        "blocked": len(blocked),
        "overdue": len(overdue),
        "overdue_tasks": [{"id": t['id'], "title": t['title'], "due_date": t['due_date']} for t in overdue],
        "completion_rate": completion_rate,
        "avg_completion_hours": avg_completion_hours,
        "completed_this_week": completed_this_week,
    }

def get_overdue_tasks() -> List[Dict[str, Any]]:
    """Return all tasks that are past their due_date and not DONE/CANCELLED."""
    tasks = list_tasks(limit=10000)
    today = datetime.now().strftime("%Y-%m-%d")
    overdue = []
    for t in tasks:
        if t['due_date'] and t['status'] not in ('DONE', 'CANCELLED'):
            try:
                if t['due_date'] < today:
                    days_overdue = (datetime.now().date() - datetime.strptime(t['due_date'], "%Y-%m-%d").date()).days
                    t['days_overdue'] = days_overdue
                    overdue.append(t)
            except (TypeError, ValueError):
                pass
    overdue.sort(key=lambda x: x.get('days_overdue', 0), reverse=True)
    return overdue

def get_goal_progress(goal_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """Get progress for goals based on linked tasks."""
    goals = list_goals()
    tasks = list_tasks(limit=10000)

    results = []
    target_goals = [g for g in goals if g['id'] == goal_id] if goal_id else goals

    for g in target_goals:
        linked = [t for t in tasks if t.get('goal_id') == g['id']]
        total = len(linked)
        done = sum(1 for t in linked if t['status'] == 'DONE')
        in_progress = sum(1 for t in linked if t['status'] == 'IN_PROGRESS')
        blocked = sum(1 for t in linked if t['status'] == 'BLOCKED')
        overdue = sum(1 for t in linked if t.get('due_date') and t['due_date'] < datetime.now().strftime("%Y-%m-%d") and t['status'] not in ('DONE', 'CANCELLED'))
        pct = round(done / total * 100) if total > 0 else 0

        results.append({
            "goal_id": g['id'],
            "title": g['title'],
            "total_tasks": total,
            "done": done,
            "in_progress": in_progress,
            "blocked": blocked,
            "overdue": overdue,
            "progress_pct": pct,
        })
    return results

def get_rescheduled_tasks(threshold: int = 2) -> List[Dict[str, Any]]:
    """Identify tasks scheduled for past dates that are still TODO — likely rescheduled/postponed."""
    tasks = list_tasks(limit=10000)
    today = datetime.now().strftime("%Y-%m-%d")
    postponed = []
    for t in tasks:
        if t['status'] == 'TODO' and t.get('scheduled_date') and t['scheduled_date'] != 'TODAY':
            try:
                if t['scheduled_date'] < today:
                    days_postponed = (datetime.now().date() - datetime.strptime(t['scheduled_date'], "%Y-%m-%d").date()).days
                    if days_postponed >= threshold:
                        t['days_postponed'] = days_postponed
                        postponed.append(t)
            except (TypeError, ValueError):
                pass
    postponed.sort(key=lambda x: x.get('days_postponed', 0), reverse=True)
    return postponed

def get_streak_data() -> Dict[str, Any]:
    """Compute consecutive days with at least one task completed."""
    tasks = list_tasks(limit=10000)
    done_tasks = [t for t in tasks if t['status'] == 'DONE' and t.get('updated_at')]

    # Collect unique completion dates
    done_dates = set()
    for t in done_tasks:
        try:
            d = datetime.fromisoformat(t['updated_at']).strftime("%Y-%m-%d")
            done_dates.add(d)
        except (ValueError, TypeError):
            pass

    if not done_dates:
        return {"current_streak": 0, "longest_streak": 0, "total_productive_days": 0}

    sorted_dates = sorted(done_dates, reverse=True)

    # Current streak
    current_streak = 0
    check_date = datetime.now().date()
    for _ in range(365):
        ds = check_date.strftime("%Y-%m-%d")
        if ds in done_dates:
            current_streak += 1
            check_date -= timedelta(days=1)
        elif current_streak == 0:
            # Today not done yet — check yesterday
            check_date -= timedelta(days=1)
            continue
        else:
            break

    # Longest streak
    sorted_asc = sorted(done_dates)
    longest = 1
    streak = 1
    for i in range(1, len(sorted_asc)):
        prev = datetime.strptime(sorted_asc[i-1], "%Y-%m-%d").date()
        curr = datetime.strptime(sorted_asc[i], "%Y-%m-%d").date()
        if (curr - prev).days == 1:
            streak += 1
        else:
            longest = max(longest, streak)
            streak = 1
    longest = max(longest, streak)

    return {
        "current_streak": current_streak,
        "longest_streak": longest,
        "total_productive_days": len(done_dates),
    }


# --- WAKE CONTEXT (for proactive agent) ---

def get_wake_context() -> Dict[str, Any]:
    """Build a rich context payload for proactive wake-ups."""
    today = datetime.now().strftime("%Y-%m-%d")
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    tasks = list_tasks(limit=10000)

    # Today's tasks
    todays_tasks = [t for t in tasks if t.get('scheduled_date') == today or t.get('scheduled_date') == 'TODAY']
    todays_done = [t for t in todays_tasks if t['status'] == 'DONE']
    todays_remaining = [t for t in todays_tasks if t['status'] not in ('DONE', 'CANCELLED')]

    # Overdue tasks
    overdue = get_overdue_tasks()

    # Blocked tasks
    blocked = [t for t in tasks if t['status'] == 'BLOCKED']

    # Last user message time
    last_user_time = None
    with get_cursor() as c:
        query = "SELECT created_at FROM messages WHERE role = 'user' ORDER BY id DESC LIMIT 1"
        c.execute(query)
        row = c.fetchone()
        if row:
            last_user_time = row['created_at']

    hours_since_last_interaction = None
    if last_user_time:
        try:
            last_dt = datetime.fromisoformat(last_user_time)
            hours_since_last_interaction = round((datetime.now() - last_dt).total_seconds() / 3600, 1)
        except (ValueError, TypeError):
            pass

    # Habit status
    habit_streaks = get_habit_streaks()
    habits_not_logged = [h for h in habit_streaks if not h['logged_today']]

    # Postponed tasks
    postponed = get_rescheduled_tasks(threshold=2)

    return {
        "time": now_str,
        "todays_scheduled": len(todays_tasks),
        "todays_done": len(todays_done),
        "todays_remaining": [{"id": t['id'], "title": t['title'], "priority": t['priority']} for t in todays_remaining],
        "overdue_count": len(overdue),
        "overdue_tasks": [{"id": t['id'], "title": t['title'], "due_date": t['due_date'], "days_overdue": t.get('days_overdue', 0)} for t in overdue[:5]],
        "blocked_tasks": [{"id": t['id'], "title": t['title'], "blocker_reason": t.get('blocker_reason', '')} for t in blocked],
        "hours_since_last_interaction": hours_since_last_interaction,
        "habits_pending_today": [{"id": h['habit_id'], "title": h['title'], "current_streak": h['current_streak']} for h in habits_not_logged],
        "postponed_tasks": [{"id": t['id'], "title": t['title'], "days_postponed": t.get('days_postponed', 0)} for t in postponed[:5]],
    }


# --- ENRICHED CONTEXT MARKDOWN ---

def _urgency_tag(due_date_str: str) -> str:
    """Return an urgency label based on how close the deadline is."""
    try:
        due = datetime.strptime(due_date_str, "%Y-%m-%d").date()
        delta = (due - datetime.now().date()).days
        if delta < 0:
            return f"OVERDUE by {abs(delta)}d"
        elif delta == 0:
            return "DUE TODAY"
        elif delta == 1:
            return "DUE TOMORROW"
        elif delta <= 3:
            return f"DUE in {delta}d"
        elif delta <= 7:
            return f"due in {delta}d"
        else:
            return ""
    except (ValueError, TypeError):
        return ""

def get_context_markdown() -> str:
    goals = list_goals()
    tasks = list_tasks(limit=10000)
    habits = list_habits(active_only=True)
    habit_streak_data = get_habit_streaks()
    profile = get_profile()

    today_date = datetime.now().strftime("%Y-%m-%d")

    md_output = f"## CURRENT STATE ({today_date})\n\n"

    # --- User Profile ---
    if profile:
        md_output += "### USER PROFILE\n"
        for k, v in profile.items():
            md_output += f"- **{k}**: {v}\n"
        md_output += "\n"

    # --- Goals with Progress ---
    md_output += "### ACTIVE GOALS\n"
    if not goals:
        md_output += "- No active goals yet.\n"
    else:
        goal_progress = get_goal_progress()
        progress_map = {gp['goal_id']: gp for gp in goal_progress}
        for g in goals:
            notes = f" | Notes: {g['notes']}" if g['notes'] else ""
            gp = progress_map.get(g['id'])
            if gp and gp['total_tasks'] > 0:
                bar_fill = round(gp['progress_pct'] / 10)
                bar = "=" * bar_fill + "-" * (10 - bar_fill)
                progress_str = f" [{bar}] {gp['progress_pct']}% ({gp['done']}/{gp['total_tasks']} tasks)"
                if gp['overdue'] > 0:
                    progress_str += f" | {gp['overdue']} overdue"
                if gp['blocked'] > 0:
                    progress_str += f" | {gp['blocked']} blocked"
            else:
                progress_str = " (no linked tasks)"
            md_output += f"- [ID: {g['id']}] **{g['title']}**: {g['description']}{progress_str}{notes}\n"

    md_output += "\n---\n"

    # --- Habits ---
    if habits:
        md_output += "### HABITS\n"
        for hs in habit_streak_data:
            logged_icon = "done" if hs['logged_today'] else "NOT DONE"
            streak_str = f"Streak: {hs['current_streak']}d" if hs['current_streak'] > 0 else "No streak"
            md_output += f"- [ID: {hs['habit_id']}] **{hs['title']}** ({hs['frequency']}) | Today: {logged_icon} | {streak_str} | Best: {hs['longest_streak']}d | Rate: {hs['completion_rate']}%\n"
        md_output += "\n---\n"

    # --- Today's Signal ---
    todays_tasks = [t for t in tasks if t['scheduled_date'] == today_date or t['scheduled_date'] == 'TODAY']

    md_output += "### TODAY'S SIGNAL (Focus List)\n"
    if not todays_tasks:
        md_output += "*No tasks explicitly scheduled for today yet. Access the backlog to pick your battles.*\n"
    else:
        done_today = sum(1 for t in todays_tasks if t['status'] == 'DONE')
        md_output += f"*Progress: {done_today}/{len(todays_tasks)} complete*\n"
        for t in todays_tasks:
            status_icon = "[DONE]" if t['status'] == 'DONE' else ("[BLOCKED]" if t['status'] == 'BLOCKED' else "[ ]")
            urgency = ""
            if t.get('due_date'):
                urgency_tag = _urgency_tag(t['due_date'])
                if urgency_tag:
                    urgency = f" **{urgency_tag}**"
            md_output += f"{status_icon} [ID: {t['id']}] **{t['title']}** (Priority: {t['priority']}){urgency}\n"

    # --- Overdue ---
    overdue = get_overdue_tasks()
    if overdue:
        md_output += "\n### OVERDUE\n"
        for t in overdue:
            md_output += f"- [ID: {t['id']}] **{t['title']}** — {t.get('days_overdue', '?')} days overdue (Due: {t['due_date']})\n"

    # --- Blocked ---
    blocked_tasks = [t for t in tasks if t['status'] == 'BLOCKED']
    if blocked_tasks:
        md_output += "\n### BLOCKED (needs attention)\n"
        for t in blocked_tasks:
            # Compute how long it's been blocked
            blocked_days = ""
            if t.get('updated_at'):
                try:
                    updated = datetime.fromisoformat(t['updated_at'])
                    days = (datetime.now() - updated).days
                    if days > 0:
                        blocked_days = f" | blocked for {days}d"
                except (ValueError, TypeError):
                    pass
            md_output += f"- [ID: {t['id']}] **{t['title']}** — Reason: {t.get('blocker_reason', 'Unknown')}{blocked_days}\n"

    # --- Backlog ---
    md_output += "\n### FULL BACKLOG\n"

    today_ids = set(t['id'] for t in todays_tasks)
    overdue_ids = set(t['id'] for t in overdue)
    blocked_ids = set(t['id'] for t in blocked_tasks)
    exclude_ids = today_ids | overdue_ids | blocked_ids
    other_tasks = [t for t in tasks if t['id'] not in exclude_ids]

    if not other_tasks:
        md_output += "- No other tasks found.\n"
    else:
        in_progress = [t for t in other_tasks if t['status'] == 'IN_PROGRESS']
        todo = [t for t in other_tasks if t['status'] == 'TODO']
        done = [t for t in other_tasks if t['status'] == 'DONE']
        cancelled = [t for t in other_tasks if t['status'] == 'CANCELLED']

        if in_progress:
            md_output += "**In Progress**:\n"
            for t in in_progress:
                urgency = ""
                if t.get('due_date'):
                    tag = _urgency_tag(t['due_date'])
                    if tag:
                        urgency = f" **{tag}**"
                md_output += f"- [ID: {t['id']}] {t['title']} (Due: {t['due_date'] or 'None'}){urgency}\n"

        if todo:
            md_output += "**To Do**:\n"
            for t in todo:
                urgency = ""
                if t.get('due_date'):
                    tag = _urgency_tag(t['due_date'])
                    if tag:
                        urgency = f" **{tag}**"
                md_output += f"- [ID: {t['id']}] {t['title']} (Due: {t['due_date'] or 'None'}, Sched: {t['scheduled_date'] or 'None'}){urgency}\n"

        if done:
            md_output += "**Completed (History)**:\n"
            for t in done[:20]:  # Limit history noise
                md_output += f"- [ID: {t['id']}] {t['title']}\n"
            if len(done) > 20:
                md_output += f"- ... and {len(done) - 20} more completed tasks\n"

        if cancelled:
            md_output += "**Cancelled**:\n"
            for t in cancelled:
                md_output += f"- [ID: {t['id']}] {t['title']}\n"

    return md_output

