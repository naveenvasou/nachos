from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from agent import run_planning_agent

app = FastAPI(title="AI Goal Coach API")

class Goal(BaseModel):
    title: str
    category: str
    deadline: str

class PlanRequest(BaseModel):
    user_context: str
    goals: List[Goal]

@app.get("/")
def read_root():
    return {"message": "AI Goal Coach Brain is Active"}

@app.post("/plan")
def generate_plan(request: PlanRequest):
    goals_list = [g.dict() for g in request.goals]
    plan = run_planning_agent(request.user_context, goals_list)
    return {"plan": plan}

