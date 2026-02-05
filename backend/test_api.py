import requests
import json

url = "http://127.0.0.1:8000/plan"
headers = {"Content-Type": "application/json"}
data = {
    "user_context": "I have a headache and only 2 hours.",
    "goals": [
        {"title": "Launch SaaS", "category": "Deep Work", "deadline": "2026-03-01"},
        {"title": "Learn Spanish", "category": "Personal", "deadline": "2026-12-31"}
    ]
}

try:
    response = requests.post(url, headers=headers, json=data)
    print(f"Status Code: {response.status_code}")
    print("Response JSON:")
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print(f"Error: {e}")
