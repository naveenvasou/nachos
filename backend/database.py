import sqlite3
import os
import re
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
import json
from contextlib import contextmanager

# Check for PostgreSQL dependency
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor, execute_batch
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
    with get_cursor() as c:
        created_at = datetime.now().isoformat()
        tool_calls_json = json.dumps(tool_calls) if tool_calls else None
        
        query = "INSERT INTO messages (role, content, tool_calls, tool_call_id, created_at) VALUES (?, ?, ?, ?, ?)"
        query = normalize_query(query)
        
        c.execute(query, (role, content, tool_calls_json, tool_call_id, created_at))
        
        if DATABASE_URL:
            # Postgres needs explicit RETURNING for ID if using psycopg2 directly sometimes, but lastrowid doesn't work well
            # Actually, standard SQL is returning id.
            # But let's fix the query for Postgres to return ID.
            pass
        
        if DATABASE_URL:
            # We need to execute a Fetch to get the ID for postgres
            # The previous execute didn't return anything.
            # Let's adjust logic.
            # We can't easily retro-fix the previous execute.
            # We should use RETURNING id in the insert for Postgres.
            pass

    # RE-DOING add_message to handle RETURNING ID correctly across both
    conn = get_db_connection()
    try:
        if DATABASE_URL:
            cur = conn.cursor()
            created_at = datetime.now().isoformat()
            tool_calls_json = json.dumps(tool_calls) if tool_calls else None
            
            cur.execute("""
                INSERT INTO messages (role, content, tool_calls, tool_call_id, created_at) 
                VALUES (%s, %s, %s, %s, %s) RETURNING id
            """, (role, content, tool_calls_json, tool_call_id, created_at))
            msg_id = cur.fetchone()[0]
            conn.commit()
            return msg_id
        else:
            cur = conn.cursor()
            created_at = datetime.now().isoformat()
            tool_calls_json = json.dumps(tool_calls) if tool_calls else None
            cur.execute('''
                INSERT INTO messages (role, content, tool_calls, tool_call_id, created_at)
                VALUES (?, ?, ?, ?, ?)
            ''', (role, content, tool_calls_json, tool_call_id, created_at))
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
        
        current_batch_keys = None
        current_batch_query = None
        current_batch_params = []

        def execute_current_batch():
            nonlocal total_affected
            if not current_batch_params:
                return

            if DATABASE_URL:
                execute_batch(cur, current_batch_query, current_batch_params)
                total_affected += len(current_batch_params)
            else:
                cur.executemany(current_batch_query, current_batch_params)
                total_affected += cur.rowcount

        for update_item in updates_list:
            if 'id' not in update_item:
                continue
            task_id = update_item.get('id')

            # Determine keys to update
            keys = sorted([k for k in update_item.keys() if k != 'id' and k in ALLOWED_TASK_COLUMNS])
            if not keys:
                continue
            
            # Prepare values corresponding to sorted keys
            values = [update_item[k] for k in keys]
            
            # Add updated_at
            keys.append('updated_at')
            values.append(updated_at)
            
            # Tuple of keys identifies the query structure
            keys_tuple = tuple(keys)

            # Add ID to values for the WHERE clause
            values.append(task_id)

            # Check if we need to switch batch
            if keys_tuple != current_batch_keys:
                execute_current_batch()

                # Setup new batch
                current_batch_keys = keys_tuple
                fields = [f"{k} = %s" if DATABASE_URL else f"{k} = ?" for k in keys]
                # WHERE id is last
                current_batch_query = f"UPDATE tasks SET {', '.join(fields)} WHERE id = %s" if DATABASE_URL else f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?"
                current_batch_params = []

            current_batch_params.append(tuple(values))

        # Execute any remaining batch
        execute_current_batch()
            
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

def get_context_markdown() -> str:
    goals = list_goals()
    tasks = list_tasks(limit=10000)
    
    today_date = datetime.now().strftime("%Y-%m-%d")
    
    md_output = f"## 📅 CURRENT STATE ({today_date})\n"
    md_output += "> \"The difference between successful people and very successful people is that very successful people say 'no' to almost everything.\" - Warren Buffet\n\n"
    
    md_output += "### 🎯 ACTIVE GOALS\n"
    if not goals:
        md_output += "- No active goals yet.\n"
    else:
        for g in goals:
            notes = f" (Notes: {g['notes']})" if g['notes'] else ""
            md_output += f"- [ID: {g['id']}] **{g['title']}**: {g['description']}{notes}\n"
    
    md_output += "\n---\n"
    
    todays_tasks = [t for t in tasks if t['scheduled_date'] == today_date or t['scheduled_date'] == 'TODAY']
    
    md_output += "### 🔥 TODAY'S SIGNAL (Focus List)\n"
    if not todays_tasks:
        md_output += "*No tasks explicitly scheduled for today yet. Access the backlog to pick your battles.*\n"
    else:
        for t in todays_tasks:
            status_icon = "✅" if t['status'] == 'DONE' else "⬜"
            md_output += f"{status_icon} [ID: {t['id']}] **{t['title']}** (Priority: {t['priority']})\n"

    md_output += "\n### 🗄️ FULL BACKLOG / HISTORY\n"
    
    today_ids = [t['id'] for t in todays_tasks]
    other_tasks = [t for t in tasks if t['id'] not in today_ids]
    
    if not other_tasks:
        md_output += "- No other tasks found.\n"
    else:
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

