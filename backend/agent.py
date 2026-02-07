import json
import os
import asyncio
from datetime import datetime
from typing import TypedDict, List
from dotenv import load_dotenv
from google import genai
from google.genai import types

from langgraph.graph import StateGraph, END
from langchain_core.callbacks.manager import adispatch_custom_event
from langchain_core.runnables import RunnableConfig

import database
import tools
import prompts

load_dotenv()

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")

TOOL_FUNCTIONS = {
    "create_task": tools.create_task,
    "update_task": tools.update_task,
    "delete_task": tools.delete_task,
    "bulk_update_tasks": tools.bulk_update_tasks,
    "create_goal": tools.create_goal,
    "update_goal": tools.update_goal,
    "list_tasks": tools.list_tasks,
    "list_goals": tools.list_goals,
    "get_task_stats": tools.get_task_stats,
    "get_overdue_tasks": tools.get_overdue_tasks,
    "get_goal_progress": tools.get_goal_progress,
    "get_rescheduled_tasks": tools.get_rescheduled_tasks,
    "get_streak_data": tools.get_streak_data,
    "create_habit": tools.create_habit,
    "log_habit": tools.log_habit,
    "get_habit_streaks": tools.get_habit_streaks,
    "update_profile": tools.update_profile,
    "get_profile": tools.get_profile,
    "save_reflection": tools.save_reflection,
    "get_recent_reflections": tools.get_recent_reflections,
    "schedule_wake_up": tools.schedule_wake_up,
}

TOOL_CALLABLES = list(TOOL_FUNCTIONS.values())


# ---------------------------------------------------------------------------
# History reconstruction
# ---------------------------------------------------------------------------

def load_history_from_db(buffer_dicts: list) -> List[types.Content]:
    """
    Convert DB message rows into Gemini Content objects.
    Properly pairs assistant function_calls with subsequent tool function_responses
    so the Gemini API sees a valid conversation structure.
    """
    contents: List[types.Content] = []
    i = 0

    while i < len(buffer_dicts):
        msg = buffer_dicts[i]

        if msg['role'] == 'user':
            if msg['content']:
                contents.append(types.Content(
                    role='user', parts=[types.Part(text=msg['content'])]
                ))
            i += 1

        elif msg['role'] == 'assistant':
            parts: List[types.Part] = []
            if msg['content']:
                parts.append(types.Part(text=msg['content']))

            # Reconstruct FunctionCall parts from stored tool_calls JSON
            tool_call_names: List[str] = []
            if msg['tool_calls']:
                try:
                    tc_raw = msg['tool_calls']
                    tc_list = json.loads(tc_raw) if isinstance(tc_raw, str) else tc_raw
                    # Handle legacy double-encoded JSON
                    if isinstance(tc_list, str):
                        tc_list = json.loads(tc_list)
                    for tc in tc_list:
                        parts.append(types.Part(
                            function_call=types.FunctionCall(
                                name=tc['name'], args=tc.get('args', {})
                            )
                        ))
                        tool_call_names.append(tc['name'])
                except (json.JSONDecodeError, KeyError, TypeError):
                    pass

            if parts:
                contents.append(types.Content(role='model', parts=parts))

            # Consume subsequent tool-output rows and pair with call names
            if tool_call_names:
                response_parts: List[types.Part] = []
                name_idx = 0
                while (i + 1 < len(buffer_dicts)
                       and buffer_dicts[i + 1]['role'] == 'tool'
                       and name_idx < len(tool_call_names)):
                    i += 1
                    response_parts.append(types.Part(
                        function_response=types.FunctionResponse(
                            name=tool_call_names[name_idx],
                            response={"result": buffer_dicts[i]['content'] or ""}
                        )
                    ))
                    name_idx += 1
                if response_parts:
                    contents.append(types.Content(role='user', parts=response_parts))

            i += 1

        elif msg['role'] == 'tool':
            # Orphaned tool row (no preceding assistant with tool_calls) — skip
            i += 1
        else:
            i += 1

    return contents


# ---------------------------------------------------------------------------
# LangGraph state
# ---------------------------------------------------------------------------

class AgentState(TypedDict):
    messages: List[types.Content]
    user_message_str: str
    system_prompt: str


# ---------------------------------------------------------------------------
# Graph nodes
# ---------------------------------------------------------------------------

async def call_model(state: AgentState, config: RunnableConfig):
    messages = state["messages"]

    conf = types.GenerateContentConfig(
        tools=TOOL_CALLABLES,
        system_instruction=state["system_prompt"],
        temperature=0.7,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )

    # Retry on transient API errors
    response_stream = None
    for attempt in range(3):
        try:
            response_stream = await client.aio.models.generate_content_stream(
                model=MODEL_NAME, contents=messages, config=conf,
            )
            break
        except Exception as e:
            if attempt < 2 and any(code in str(e) for code in ("429", "500", "503")):
                await asyncio.sleep(2 ** attempt)
            else:
                raise

    full_text = ""
    accumulated_parts: List[types.Part] = []

    async for chunk in response_stream:
        if chunk.text:
            full_text += chunk.text
            await adispatch_custom_event("token", {"text": chunk.text}, config=config)

        if chunk.candidates and chunk.candidates[0].content and chunk.candidates[0].content.parts:
            for part in chunk.candidates[0].content.parts:
                if part.function_call:
                    accumulated_parts.append(part)

    # Build final message
    final_parts: List[types.Part] = []
    if full_text:
        final_parts.append(types.Part(text=full_text))
    final_parts.extend(accumulated_parts)
    final_message = types.Content(role="model", parts=final_parts)

    # Persist to DB — pass list (not pre-encoded JSON) so add_message encodes once
    tool_calls_for_db = [
        {"name": p.function_call.name, "args": dict(p.function_call.args)}
        for p in accumulated_parts if p.function_call
    ] or None

    if full_text or tool_calls_for_db:
        database.add_message(
            role='assistant', content=full_text, tool_calls=tool_calls_for_db,
        )

    return {"messages": messages + [final_message]}


async def _run_tool(name: str, args_dict: dict):
    """Run a single tool function off the event-loop thread."""
    if name not in TOOL_FUNCTIONS:
        return name, f"Error: Tool {name} not found."
    try:
        result = await asyncio.to_thread(TOOL_FUNCTIONS[name], **args_dict)
        return name, str(result)
    except Exception as e:
        return name, f"Error executing {name}: {e}"


async def execute_tools(state: AgentState, config: RunnableConfig):
    last_message = state["messages"][-1]
    tool_calls = [p.function_call for p in last_message.parts if p.function_call]

    # Run all tool calls concurrently
    results = await asyncio.gather(
        *[_run_tool(fc.name, dict(fc.args)) for fc in tool_calls]
    )

    new_parts: List[types.Part] = []
    for name, output_text in results:
        database.add_message(role='tool', content=output_text)
        new_parts.append(types.Part(
            function_response=types.FunctionResponse(
                name=name, response={"result": output_text},
            )
        ))
        await adispatch_custom_event(
            "tool_output", {"name": name, "output": output_text}, config=config,
        )

    response_msg = types.Content(role="user", parts=new_parts)
    return {"messages": state["messages"] + [response_msg]}


# ---------------------------------------------------------------------------
# Edges
# ---------------------------------------------------------------------------

def should_continue(state: AgentState):
    last_message = state["messages"][-1]
    for part in last_message.parts:
        if part.function_call:
            return "tools"
    return END


# ---------------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------------

workflow = StateGraph(AgentState)
workflow.add_node("agent", call_model)
workflow.add_node("tools", execute_tools)
workflow.set_entry_point("agent")
workflow.add_conditional_edges("agent", should_continue)
workflow.add_edge("tools", "agent")
app_graph = workflow.compile()


# ---------------------------------------------------------------------------
# Streaming helper
# ---------------------------------------------------------------------------

async def _stream_generator(state: AgentState):
    async for event in app_graph.astream_events(state, version="v2"):
        if event["event"] == "on_custom_event" and event["name"] == "token":
            yield types.Part(text=event["data"]["text"])


# ---------------------------------------------------------------------------
# Memory summarization (runs in background — never blocks a response)
# ---------------------------------------------------------------------------

async def summarize_memory_if_needed(current_summary: str, buffer_dicts: list) -> str:
    if len(buffer_dicts) <= 40:
        return current_summary

    chunk_to_summarize = buffer_dicts[:20]
    last_summarized_id = chunk_to_summarize[-1]['id']

    text_log = ""
    for msg in chunk_to_summarize:
        role = msg['role'].upper()
        content = msg['content'] or (f"[Tool Call] {msg['tool_calls']}" if msg['tool_calls'] else "")
        text_log += f"{role}: {content}\n"

    summary_prompt = f"""
You are optimizing the memory for an AI Goal Coach named Cooper.

EXISTING LONG-TERM SUMMARY:
{current_summary}

NEW CHUNK OF CONVERSATION TO MERGE:
{text_log}

INSTRUCTIONS:
Produce an updated summary using EXACTLY these sections. Merge new information into existing sections.

## User Profile Facts
Key facts about the user: name, work schedule, energy patterns, communication style, preferences.
Only include facts explicitly stated or strongly implied by the user.

## Active Commitments
Goals, tasks, and habits the user has committed to. Include deadlines if mentioned.

## Open Loops
Things that were discussed but not resolved — pending decisions, unanswered questions,
tasks the user said they'd do but haven't confirmed completion of.

## Patterns & Insights
Recurring behaviors noticed: procrastination patterns, peak productivity times,
common blockers, what motivates the user, what causes them to stall.

## Recent Decisions
Key decisions made in the most recent conversations (last 2-3 sessions).

RULES:
- Keep each section concise (2-5 bullet points max).
- If a section has no content, write "None yet."
- Discard trivial chit-chat.
- Output ONLY the structured summary — no preamble.
"""

    print(f"Triggering Memory Summarization (Chunk size: {len(chunk_to_summarize)})...")
    try:
        response = await client.aio.models.generate_content(
            model=MODEL_NAME, contents=summary_prompt,
        )
        new_summary = response.text
        database.update_summary(new_summary, last_summarized_id)
        print("Memory Summarization Complete.")
        return new_summary
    except Exception as e:
        print(f"Summarization Failed: {e}")
        return current_summary


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def run_chat_agent_async(user_message: str, stream: bool = False):
    """
    Main agent runner.

    Returns:
        str              if stream=False
        AsyncGenerator   if stream=True  (yields types.Part)
    """
    # 1. Persist the user message
    database.add_message('user', f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] {user_message}")

    # 2. Load memory context ONCE (was previously fetched 3× per request)
    summary_text, buffer_dicts = database.get_memory_context()

    # 3. Kick off summarization in the background — don't block the response
    asyncio.create_task(summarize_memory_if_needed(summary_text, buffer_dicts))

    # 4. Build system prompt once, passing cached summary (avoids extra DB call)
    system_prompt = prompts.get_system_context(summary_text=summary_text)

    # 5. Reconstruct conversation history from the cached buffer
    initial_messages = load_history_from_db(buffer_dicts)

    state = AgentState(
        messages=initial_messages,
        user_message_str=user_message,
        system_prompt=system_prompt,
    )

    if stream:
        return _stream_generator(state)

    final_state = await app_graph.ainvoke(state)
    last_msg = final_state["messages"][-1]
    return "".join(p.text for p in last_msg.parts if p.text)


run_chat_agent = run_chat_agent_async


# ---------------------------------------------------------------------------
# Proactive wake-up
# ---------------------------------------------------------------------------

async def wake_cooper(reason: str):
    """Proactive entry point called by the scheduler."""
    try:
        print(f"Waking Cooper: {reason}")
        ctx = database.get_wake_context()

        sections = [
            "[SYSTEM EVENT]",
            f"**Action**: PROACTIVE WAKE UP",
            f"**Reason**: {reason}",
            f"**Time**: {ctx['time']}",
            f"\n**Today's Tasks**: {ctx['todays_done']}/{ctx['todays_scheduled']} complete",
        ]

        if ctx['todays_remaining']:
            remaining_str = ", ".join(
                f"'{t['title']}' ({t['priority']})" for t in ctx['todays_remaining'][:5]
            )
            sections.append(f"**Remaining Today**: {remaining_str}")

        if ctx['overdue_count'] > 0:
            overdue_str = ", ".join(
                f"'{t['title']}' ({t['days_overdue']}d overdue)" for t in ctx['overdue_tasks'][:3]
            )
            sections.append(f"**OVERDUE ({ctx['overdue_count']})**: {overdue_str}")

        if ctx['blocked_tasks']:
            blocked_str = ", ".join(
                f"'{t['title']}' (Reason: {t['blocker_reason']})" for t in ctx['blocked_tasks'][:3]
            )
            sections.append(f"**BLOCKED**: {blocked_str}")

        if ctx['habits_pending_today']:
            habits_str = ", ".join(
                f"'{h['title']}' (streak: {h['current_streak']}d)" for h in ctx['habits_pending_today'][:5]
            )
            sections.append(f"**Habits Not Logged Today**: {habits_str}")

        if ctx['postponed_tasks']:
            postponed_str = ", ".join(
                f"'{t['title']}' ({t['days_postponed']}d)" for t in ctx['postponed_tasks'][:3]
            )
            sections.append(f"**Repeatedly Postponed**: {postponed_str}")

        if ctx['hours_since_last_interaction'] is not None:
            sections.append(f"**Hours Since Last User Message**: {ctx['hours_since_last_interaction']}")

        sections.append("\n**Instruction**: Based on the above context, decide to Speak, Sleep, or Schedule.")

        response_text = await run_chat_agent_async(
            user_message="\n".join(sections), stream=False,
        )

        if "SLEEP" in response_text:
            print("Cooper decided to sleep.")
            return

        from connection_manager import manager
        print(f"Cooper speaks: {response_text}")
        await manager.broadcast_message(response_text)

    except Exception as e:
        print(f"Error in wake_cooper: {e}")
