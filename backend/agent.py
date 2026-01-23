from typing import TypedDict, List
from langgraph.graph import StateGraph, END

class AgentState(TypedDict):
    user_context: str
    goals: List[dict]
    plan: str

def planner_node(state: AgentState):
    # Mocking the LLM planning logic for Phase 1
    # In Phase 2 this will use actual LLM calls
    goals = state['goals']
    context = state['user_context']
    
    plan_text = f"Based on your context '{context}', here is the plan:\n"
    for goal in goals:
        plan_text += f"- Focus on {goal['title']} ({goal['category']})\n"
    
    return {"plan": plan_text}

workflow = StateGraph(AgentState)
workflow.add_node("planner", planner_node)
workflow.set_entry_point("planner")
workflow.add_edge("planner", END)

app = workflow.compile()

def run_planning_agent(user_context: str, goals: list):
    """
    Orchestrates the planning process using LangGraph.
    """
    inputs = {"user_context": user_context, "goals": goals, "plan": ""}
    result = app.invoke(inputs)
    return result['plan']

