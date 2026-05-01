import os
from typing import Optional

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

# --- Always-on components ---
SOUL_PROMPT = load_prompt('soul.md')
ACCOUNTABILITY_PROMPT = load_prompt('accountability_partner_skill.md')
GOAL_COACH_PROMPT = load_prompt('goal_coach_skill.md')
TOOLS_PROMPT = load_prompt('tools.md')

# --- Mode-specific skill overlays ---
# These are loaded once and added to the system prompt only when the user is
# explicitly running that mode. They're written to be additive on top of the
# base soul + skills, never to contradict them.
MODE_SKILLS = {
    'brief':     load_prompt('morning_brief_skill.md'),
    'review':    load_prompt('evening_review_skill.md'),
    'capture':   load_prompt('brain_dump_skill.md'),
    'plan-goal': load_prompt('plan_goal_skill.md'),
}

BASE_SYSTEM_PROMPT = f"""
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

def get_system_context(summary_text: Optional[str] = None, mode: Optional[str] = None) -> str:
    """
    Combines System Prompt + (optional Mode skill) + Heartbeat + State + Summary.

    Args:
        summary_text: Optional pre-fetched conversation summary, to avoid a
            redundant DB call when the caller already has it.
        mode: Optional skill mode — one of 'brief', 'review', 'capture',
            'plan-goal'. When set, the matching skill prompt is overlaid on
            top of the base prompt so the agent stays in-mode for that turn.
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

    if summary_text is None:
        summary_text, _ = database.get_memory_context()

    parts = [BASE_SYSTEM_PROMPT]

    if mode and mode in MODE_SKILLS and MODE_SKILLS[mode]:
        # Loud header so the model treats the overlay as the active skill,
        # not just more reading material.
        parts.append(
            f"## ACTIVE SKILL: {mode.upper()}\n"
            f"For this turn, you are running the **{mode}** skill. The "
            f"following overrides any conflicting general guidance — but the "
            f"soul and the goal-coach principles still apply.\n\n"
            f"{MODE_SKILLS[mode]}"
        )

    parts.append(heartbeat_context)
    parts.append(task_context)

    full_prompt = "\n\n".join(p for p in parts if p)
    if summary_text:
        full_prompt += f"\n\nPREVIOUS CONVERSATION SUMMARY:\n{summary_text}"

    return full_prompt
