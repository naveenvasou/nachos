from typing import Optional, List, Dict, Any
import database
import json
import os

# Define the path for the context file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONTEXT_FILE = os.path.join(BASE_DIR, 'prompts', 'context.md')

def sync_context_file():
    """
    Writes the current database state to prompts/context.md
    """
    try:
        content = database.get_context_markdown()
        with open(CONTEXT_FILE, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Synced context to {CONTEXT_FILE}")
    except Exception as e:
        print(f"Error syncing context file: {e}")

def create_task(title: str, goal_id: Optional[int] = None, priority: str = "MEDIUM", due_date: Optional[str] = None, scheduled_date: Optional[str] = None, effort: str = "MEDIUM", notes: str = "") -> str:
    """
    Creates a new task in the database.
    
    Args:
        title: The name/description of the task.
        goal_id: Optional ID of the parent goal.
        priority: Priority level (HIGH, MEDIUM, LOW). Default is MEDIUM.
        due_date: DEADLINE date string (e.g. YYYY-MM-DD). Date the task MUST be done by. Optional.
        scheduled_date: PLAN date string (e.g. YYYY-MM-DD or 'TODAY'). Date you intend to DO the task.
        effort: Estimated effort (SMALL, MEDIUM, LARGE). Default is MEDIUM.
        notes: Any additional context or notes.
        
    Returns:
        A JSON string containing the confirmation and the new Task ID.
    """
    try:
        task_id = database.create_task(title, goal_id, priority, due_date, scheduled_date, effort, notes)

        return json.dumps({"status": "success", "message": f"Task '{title}' created.", "task_id": task_id})
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

def update_task(task_id: int, status: Optional[str] = None, title: Optional[str] = None, priority: Optional[str] = None, due_date: Optional[str] = None, scheduled_date: Optional[str] = None, effort: Optional[str] = None, notes: Optional[str] = None, blocker_reason: Optional[str] = None) -> str:
    """
    Updates ANY field of an existing task. Only provide the fields you want to change.
    
    Args:
        task_id: The numeric ID of the task.
        status: (TODO, IN_PROGRESS, DONE, BLOCKED)
        title: New title
        priority: (HIGH, MEDIUM, LOW)
        due_date: Deadline (YYYY-MM-DD)
        scheduled_date: Plan Date (YYYY-MM-DD or 'TODAY')
        effort: (SMALL, MEDIUM, LARGE)
        notes: Text notes
        blocker_reason: Reason if status is BLOCKED
        
    Returns:
        JSON string confirming update.
    """
    try:
        # Construct updates dictionary dynamically
        updates = {}
        if status is not None: updates['status'] = status
        if title is not None: updates['title'] = title
        if priority is not None: updates['priority'] = priority
        if due_date is not None: updates['due_date'] = due_date
        if scheduled_date is not None: updates['scheduled_date'] = scheduled_date
        if effort is not None: updates['effort'] = effort
        if notes is not None: updates['notes'] = notes
        if blocker_reason is not None: updates['blocker_reason'] = blocker_reason
        
        success = database.update_task(task_id, updates)

        if success:
            return json.dumps({"status": "success", "message": f"Task {task_id} updated."})
        else:
            return json.dumps({"status": "error", "message": f"Task {task_id} not found."})
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

def delete_task(task_id: int) -> str:
    """
    Deletes a task from the list.
    
    Args:
        task_id: The ID of the task to delete.
        
    Returns:
        JSON string confirming deletion.
    """
    try:
        success = database.delete_task(task_id)

        if success:
            return json.dumps({"status": "success", "message": f"Task {task_id} deleted."})
        else:
            return json.dumps({"status": "error", "message": f"Task {task_id} not found."})
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

def create_goal(title: str, description: str = "", notes: str = "") -> str:
    """
    Creates a new long-term goal.
    
    Args:
        title: Title of the goal.
        description: Detailed description or vision.
        notes: Additional notes.
        
    Returns:
        JSON string with Goal ID.
    """
    try:
        goal_id = database.create_goal(title, description, notes)

        return json.dumps({"status": "success", "message": f"Goal '{title}' created.", "goal_id": goal_id})
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

def update_goal(goal_id: int, title: Optional[str] = None, description: Optional[str] = None, status: Optional[str] = None, notes: Optional[str] = None) -> str:
    """
    Updates fields of a goal.
    
    Args:
        goal_id: ID of the goal
        title: New title
        description: New description
        status: (ACTIVE, COMPLETED, ARCHIVED)
        notes: New notes
    """
    try:
        updates = {}
        if title is not None: updates['title'] = title
        if description is not None: updates['description'] = description
        if status is not None: updates['status'] = status
        if notes is not None: updates['notes'] = notes
        
        success = database.update_goal(goal_id, updates)

        if success:
            return json.dumps({"status": "success", "message": f"Goal {goal_id} updated."})
        else:
            return json.dumps({"status": "error", "message": f"Goal {goal_id} not found."})
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

# List tasks and goals helpers can be useful for manual tool access or debugging
def list_tasks(status: Optional[str] = None) -> str:
    """Lists tasks, optionally filtering by status."""
    return json.dumps(database.list_tasks(status))

def list_goals() -> str:
    """Lists all goals."""
    return json.dumps(database.list_goals())

# Initial sync on module load to ensure file exists
try:
    sync_context_file()
except:
    pass

def bulk_update_tasks(updates: List[Dict[str, Any]]) -> str:
    """
    Perform multiple updates to different tasks in a single action.
    This is much more efficient than calling update_task multiple times.
    
    Args:
        updates: A list of dictionaries. Each dictionary MUST contain an 'id' key for the task to modify, 
                 plus any other fields you want to update (status, priority, scheduled_date, etc).
                 
        Example:
        [
            {"id": 1, "status": "DONE"},
            {"id": 5, "scheduled_date": "2026-02-05", "priority": "HIGH"},
            {"id": 8, "notes": "Discussed in meeting, blocked by backend"}
        ]
        
    Returns:
        JSON string confirming the number of tasks updated.
    """
    try:
        # If the model passes a string instead of a list (common edge case), try to parse it
        if isinstance(updates, str):
            try:
                updates = json.loads(updates)
            except:
                return json.dumps({"status": "error", "message": "Invalid format for updates. Must be a List of Dictionaries or a JSON string."})
        
        count = database.bulk_update_tasks(updates)

        return json.dumps({"status": "success", "message": f"Successfully updated {count} tasks."})
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

# --- ANALYTICS TOOLS ---

def get_task_stats() -> str:
    """
    Returns productivity analytics: completion rate, overdue count, tasks done this week,
    average completion time, and status breakdown. Use this to give the user data-driven insights.

    Returns:
        JSON string with stats.
    """
    try:
        stats = database.get_task_stats()
        return json.dumps(stats)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

def get_overdue_tasks() -> str:
    """
    Returns all tasks that are past their due_date and not yet completed.
    Each task includes a 'days_overdue' count. Use this to flag urgent items.

    Returns:
        JSON string with overdue task list.
    """
    try:
        overdue = database.get_overdue_tasks()
        return json.dumps(overdue)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

def get_goal_progress(goal_id: Optional[int] = None) -> str:
    """
    Returns progress metrics for goals: total tasks, done, in_progress, blocked, overdue, and progress percentage.
    If goal_id is provided, returns data for that specific goal. Otherwise returns all active goals.

    Args:
        goal_id: Optional specific goal ID to check. If omitted, all goals are returned.

    Returns:
        JSON string with goal progress data.
    """
    try:
        progress = database.get_goal_progress(goal_id)
        return json.dumps(progress)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

def get_rescheduled_tasks(threshold: int = 2) -> str:
    """
    Returns tasks that have been sitting with a past scheduled_date but are still TODO.
    These are likely tasks the user keeps postponing. Use this for pattern recognition.

    Args:
        threshold: Minimum number of days past scheduled_date to include. Default 2.

    Returns:
        JSON string with postponed tasks and days_postponed count.
    """
    try:
        postponed = database.get_rescheduled_tasks(threshold)
        return json.dumps(postponed)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

def get_streak_data() -> str:
    """
    Returns the user's productivity streak: consecutive days with at least one task completed,
    plus longest streak ever and total productive days.

    Returns:
        JSON string with streak data.
    """
    try:
        streaks = database.get_streak_data()
        return json.dumps(streaks)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})


# --- HABIT TOOLS ---

def create_habit(title: str, frequency: str = "daily", goal_id: Optional[int] = None) -> str:
    """
    Creates a new recurring habit to track.

    Args:
        title: Name of the habit (e.g. "Morning Run", "Read 30 minutes").
        frequency: How often — "daily", "weekdays", "MWF", "TTh", or "weekly". Default "daily".
        goal_id: Optional goal this habit contributes to.

    Returns:
        JSON string with the new habit ID.
    """
    try:
        habit_id = database.create_habit(title, frequency, goal_id)
        return json.dumps({"status": "success", "message": f"Habit '{title}' created ({frequency}).", "habit_id": habit_id})
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

def log_habit(habit_id: int, status: str = "done", skip_reason: str = "") -> str:
    """
    Logs a habit entry for today. Call this when the user completes or skips a habit.

    Args:
        habit_id: The ID of the habit.
        status: "done" or "skipped".
        skip_reason: If skipped, why? (e.g. "sick", "traveling")

    Returns:
        JSON confirmation.
    """
    try:
        log_id = database.log_habit(habit_id, status=status, skip_reason=skip_reason)
        return json.dumps({"status": "success", "message": f"Habit {habit_id} logged as '{status}'.", "log_id": log_id})
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

def get_habit_streaks() -> str:
    """
    Returns streak data for all active habits: current streak, longest streak,
    completion rate, and whether the habit has been logged today.

    Returns:
        JSON string with per-habit streak data.
    """
    try:
        streaks = database.get_habit_streaks()
        return json.dumps(streaks)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})


# --- USER PROFILE TOOLS ---

def update_profile(key: str, value: str) -> str:
    """
    Stores a persistent fact about the user in their profile.
    Use this to remember preferences, patterns, and important personal context
    that should NEVER be lost to memory summarization.

    Args:
        key: The profile key (e.g. "preferred_work_hours", "energy_pattern",
             "communication_style", "wake_time", "sleep_time", "motivation_style",
             "biggest_goal", "check_in_preference", "focus_blocks", "timezone").
        value: The value to store.

    Returns:
        JSON confirmation.
    """
    try:
        database.set_profile(key, value)
        return json.dumps({"status": "success", "message": f"Profile updated: {key} = {value}"})
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

def get_profile() -> str:
    """
    Returns the full user profile — all stored preferences, patterns, and personal context.

    Returns:
        JSON string with key-value profile data.
    """
    try:
        profile = database.get_profile()
        return json.dumps(profile)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})


# --- REFLECTION TOOLS ---

def save_reflection(content: str, reflection_type: str = "daily") -> str:
    """
    Saves a reflection or journal entry. Use after daily check-ins, weekly retros,
    or when the user shares a meaningful insight about their progress.

    Args:
        content: The reflection text (Cooper's summary of the user's insight).
        reflection_type: "daily", "weekly", or "milestone".

    Returns:
        JSON confirmation with reflection ID.
    """
    try:
        rid = database.save_reflection(content, reflection_type)
        return json.dumps({"status": "success", "message": "Reflection saved.", "reflection_id": rid})
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

def get_recent_reflections(limit: int = 5, reflection_type: Optional[str] = None) -> str:
    """
    Retrieves recent reflections/journal entries. Use during weekly retros or
    to reference past insights ("Last week you said...").

    Args:
        limit: Number of reflections to return. Default 5.
        reflection_type: Optional filter by type ("daily", "weekly", "milestone").

    Returns:
        JSON string with list of reflections.
    """
    try:
        refs = database.get_recent_reflections(limit, reflection_type)
        return json.dumps(refs)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})


def schedule_wake_up(minutes: int, reason: str) -> str:
    """
    Schedules Cooper to wake up proactively after a set number of minutes.
    Use this when you want to check back on the user later.
    
    Args:
        minutes: Number of minutes to wait before waking up.
        reason: Why are you scheduling this? (e.g. "Check if user finished writing")
        
    Returns:
        Confirmation string.
    """
    try:
        # Import lazily to avoid circular imports if scheduler imports tools
        from proactive_scheduler import scheduler
        from agent import wake_cooper
        from apscheduler.triggers.date import DateTrigger
        from datetime import datetime, timedelta
        
        run_date = datetime.now() + timedelta(minutes=minutes)
        
        scheduler.add_job(
            wake_cooper, 
            DateTrigger(run_date=run_date), 
            args=[reason],
            name=f"Self-Scheduled: {reason}"
        )
        
        return json.dumps({"status": "success", "message": f"I will wake up in {minutes} minutes to: {reason}"})
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})
