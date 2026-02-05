from typing import Dict, Any
import prompts
import database

def get_debug_context() -> Dict[str, Any]:
    """
    Assembles the full context (System Prompts + Memory) for inspection.
    """
    # 1. System Context (The "Soul" + Tools + Tasks)
    system_instruction = prompts.get_system_context()
    
    # 2. Database Memory
    summary_text, recent_messages_dicts = database.get_memory_context()
    
    # 3. Assemble
    return {
        "system_instruction": system_instruction,
        "memory_summary": summary_text,
        "recent_messages": recent_messages_dicts
    }
