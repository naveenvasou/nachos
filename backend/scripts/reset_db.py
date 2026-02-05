import sqlite3
import os

DB_NAME = "nachos.db"

def reset_db():
    if not os.path.exists(DB_NAME):
        print(f"Database {DB_NAME} not found.")
        return

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    print("Clearing 'tasks' table...")
    c.execute("DELETE FROM tasks")
    c.execute("DELETE FROM sqlite_sequence WHERE name='tasks'") # Reset ID counter
    
    print("Clearing 'goals' table...")
    c.execute("DELETE FROM goals")
    c.execute("DELETE FROM sqlite_sequence WHERE name='goals'")
    
    print("Clearing 'messages' table...")
    c.execute("DELETE FROM messages")
    c.execute("DELETE FROM sqlite_sequence WHERE name='messages'")
    
    print("Resetting 'session_summary'...")
    c.execute("DELETE FROM session_summary")
    c.execute("DELETE FROM sqlite_sequence WHERE name='session_summary'")
    # Re-initialize summary row
    c.execute("INSERT INTO session_summary (id, content, last_summarized_message_id) VALUES (1, '', 0)")
    
    conn.commit()
    conn.close()
    print("Database reset complete.")

if __name__ == "__main__":
    reset_db()
