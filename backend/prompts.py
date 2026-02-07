import os

# Get the directory of the current file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROMPTS_DIR = os.path.join(BASE_DIR, 'prompts')

def load_prompt(filename):
    try:
        with open(os.path.join(PROMPTS_DIR, filename), 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"Error loading prompt {filename}: {e}")
        return ""

# Load individual prompt components
SOUL_PROMPT = load_prompt('soul.md')
ACCOUNTABILITY_PROMPT = load_prompt('accountability_partner_skill.md')
GOAL_COACH_PROMPT = load_prompt('goal_coach_skill.md')
TOOLS_PROMPT = load_prompt('tools.md')

SYSTEM_PROMPT_GOAL_COACH = f"""
{SOUL_PROMPT}

{ACCOUNTABILITY_PROMPT}

{GOAL_COACH_PROMPT}

{TOOLS_PROMPT}

## TIME AWARENESS
All messages include timestamps, so you have a sense of the conversation flow and time between interactions. Use this context to:
- Reference previous conversations appropriately
- Understand the user's availability and work patterns
- Suggest realistic timelines based on their schedule
"""

import database

def get_system_context(summary_text: str = None) -> str:
    """
    Combines System Prompt + Heartbeat + Tasks + Summary into the full context.
    Accepts an optional pre-fetched summary_text to avoid a redundant DB call.
    """
    try:
        task_context = database.get_context_markdown()
    except Exception:
        task_context = "No tasks or goals found."

    try:
        with open(os.path.join(PROMPTS_DIR, 'heartbeat.md'), 'r', encoding='utf-8') as f:
            heartbeat_context = f.read()
    except Exception:
        heartbeat_context = ""

    # Only hit the DB if caller didn't pass a cached summary
    if summary_text is None:
        summary_text, _ = database.get_memory_context()

    full_prompt = f"{SYSTEM_PROMPT_GOAL_COACH}\n\n{heartbeat_context}\n\n{task_context}"
    if summary_text:
        full_prompt += f"\n\nPREVIOUS CONVERSATION SUMMARY:\n{summary_text}"

    return full_prompt

