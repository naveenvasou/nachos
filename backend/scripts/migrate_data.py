
import sqlite3
import psycopg2
import os
import sys
from psycopg2.extras import execute_values

# Add parent directory to path to import database definitions if needed
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configuration
SQLITE_DB = "d:/nachos/backend/nachos.db" # Assume running from repo root or absolute path
TARGET_DB_URL = os.getenv("TARGET_DATABASE_URL")

def migrate():
    if not TARGET_DB_URL:
        print("Error: TARGET_DATABASE_URL environment variable is not set.")
        sys.exit(1)
        
    print(f"Migrating data from {SQLITE_DB} to Postgres...")
    
    if not os.path.exists(SQLITE_DB):
        print(f"Error: Source SQLite DB not found at {SQLITE_DB}")
        sys.exit(1)

    # 1. Connect to SQLite
    sqlite_conn = sqlite3.connect(SQLITE_DB)
    sqlite_conn.row_factory = sqlite3.Row
    s_cur = sqlite_conn.cursor()
    
    # 2. Connect to Postgres
    try:
        pg_conn = psycopg2.connect(TARGET_DB_URL)
        p_cur = pg_conn.cursor()
    except Exception as e:
        print(f"Failed to connect to Postgres: {e}")
        return

    # 3. Migrate Users
    print("Migrating users...")
    s_cur.execute("SELECT push_token, created_at, last_active FROM users")
    users = s_cur.fetchall()
    if users:
        execute_values(p_cur, """
            INSERT INTO users (push_token, created_at, last_active) VALUES %s
            ON CONFLICT (push_token) DO NOTHING
        """, [(u['push_token'], u['created_at'], u['last_active']) for u in users])
    
    # 4. Migrate Goals
    print("Migrating goals...")
    s_cur.execute("SELECT id, title, description, status, created_at, notes FROM goals")
    goals = s_cur.fetchall()
    # Note: We preserve IDs to keep FKs intact.
    # Postgres SERIAL starts at 1, so we might need to reset sequence after insert.
    for g in goals:
        p_cur.execute("""
            INSERT INTO goals (id, title, description, status, created_at, notes)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET 
                title=EXCLUDED.title, 
                description=EXCLUDED.description,
                status=EXCLUDED.status,
                notes=EXCLUDED.notes
        """, (g['id'], g['title'], g['description'], g['status'], g['created_at'], g['notes']))

    # 5. Migrate Tasks
    print("Migrating tasks...")
    # Get columns dynamically or hardcode known ones defined in database.py
    # id, goal_id, title, status, priority, due_date, scheduled_date, effort, blocker_reason, notes, created_at, updated_at
    s_cur.execute("""
        SELECT id, goal_id, title, status, priority, due_date, scheduled_date, effort, blocker_reason, notes, created_at, updated_at 
        FROM tasks
    """)
    tasks = s_cur.fetchall()
    for t in tasks:
        p_cur.execute("""
            INSERT INTO tasks (id, goal_id, title, status, priority, due_date, scheduled_date, effort, blocker_reason, notes, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                title=EXCLUDED.title,
                status=EXCLUDED.status,
                updated_at=EXCLUDED.updated_at
        """, (t['id'], t['goal_id'], t['title'], t['status'], t['priority'], t['due_date'], t['scheduled_date'], t['effort'], t['blocker_reason'], t['notes'], t['created_at'], t['updated_at']))

    # 6. Migrate Messages (Optional - might be large)
    print("Migrating messages (this might take a while)...")
    s_cur.execute("SELECT id, role, content, tool_calls, tool_call_id, created_at FROM messages")
    messages = s_cur.fetchall()
    if messages:
        # Batch insert for speed
        msg_data = [(m['id'], m['role'], m['content'], m['tool_calls'], m['tool_call_id'], m['created_at']) for m in messages]
        execute_values(p_cur, """
            INSERT INTO messages (id, role, content, tool_calls, tool_call_id, created_at)
            VALUES %s
            ON CONFLICT (id) DO NOTHING
        """, msg_data)

    # 7. Update Sequences (Essential for Postgres so next INSERT doesn't collide with migrated IDs)
    print("Resetting sequences...")
    for table in ['goals', 'tasks', 'messages', 'users']:
        try:
             # This SQL works for Postgres > 10 identity columns or serial
             # Simplest generic way for SERIAL:
             p_cur.execute(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE(MAX(id), 1) + 1, false) FROM {table}")
        except Exception as e:
            print(f"Warning resetting sequence for {table}: {e}")

    pg_conn.commit()
    print("Migration Complete! 🌮")
    
    s_cur.close()
    p_cur.close()
    sqlite_conn.close()
    pg_conn.close()

if __name__ == "__main__":
    migrate()
