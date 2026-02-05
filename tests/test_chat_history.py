import pytest
import sys
import os

# Set mock keys BEFORE import
os.environ["GOOGLE_API_KEY"] = "dummy"
os.environ["GROQ_API_KEY"] = "dummy"
os.environ["DEEPGRAM_API_KEY"] = "dummy"

from fastapi.testclient import TestClient

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# Add backend to path
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))

from backend.main import app

client = TestClient(app)

def test_get_chat_history():
    response = client.get("/chat/history")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        assert "role" in data[0]
        assert "content" in data[0]

def test_get_chat_history_structure():
    response = client.get("/chat/history")
    assert response.status_code == 200
