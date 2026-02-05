import sys
import os

# Add parent dir to path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))

import backend.database as db
from backend.tools import bulk_update_tasks

def verify_bulk_update():
    print("--- Starting Bulk Update Verification ---")
    
    # 1. Setup: Create 3 dummy tasks
    print("Creating 3 dummy tasks...")
    id1 = db.create_task(title="Mock Task A")
    id2 = db.create_task(title="Mock Task B")
    id3 = db.create_task(title="Mock Task C")
    
    print(f"Created IDs: {id1}, {id2}, {id3}")
    
    # 2. Execute: Bulk Update
    # Task A -> DONE
    # Task B -> High Priority
    # Task C -> Scheduled for Tomorrow
    
    updates = [
        {"id": id1, "status": "DONE"},
        {"id": id2, "priority": "HIGH"},
        {"id": id3, "scheduled_date": "2026-02-02"}
    ]
    
    print(f"Executing bulk_update_tasks with payload: {updates}")
    
    try:
        # We invoke the tool wrapper directly to test JSON parsing too if we passed string, 
        # but here we pass list object as the LLM would via binding.
        result_json = bulk_update_tasks.invoke({"updates": updates})
        print(f"Tool Result: {result_json}")
    except Exception as e:
        print(f"FAILED: Tool invocation error: {e}")
        return

    # 3. Validation: Check DB State
    tasks = db.list_tasks(limit=10) # Get recent
    
    task_a = next((t for t in tasks if t['id'] == id1), None)
    task_b = next((t for t in tasks if t['id'] == id2), None)
    task_c = next((t for t in tasks if t['id'] == id3), None)
    
    errors = []
    
    if task_a['status'] != 'DONE':
        errors.append(f"Task A (ID {id1}) status is {task_a['status']}, expected DONE")
    
    if task_b['priority'] != 'HIGH':
        errors.append(f"Task B (ID {id2}) priority is {task_b['priority']}, expected HIGH")

    if task_c['scheduled_date'] != '2026-02-02':
        errors.append(f"Task C (ID {id3}) scheduled_date is {task_c['scheduled_date']}, expected 2026-02-02")
        
    if errors:
        print("\n❌ VERIFICATION FAILED:")
        for e in errors:
            print(f" - {e}")
    else:
        print("\n✅ VERIFICATION SUCCESS: All tasks updated correctly.")

    # Cleanup (Optional, but good practice)
    # db.delete_task... (we don't have delete generic yet, so leaving them is fine for dev)

if __name__ == "__main__":
    verify_bulk_update()
