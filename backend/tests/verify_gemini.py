import sys
import os

# Add parent directory to path so we can import backend modules
current = os.path.dirname(os.path.realpath(__file__))
parent = os.path.dirname(current)
sys.path.append(parent)

from agent import run_chat_agent

if __name__ == "__main__":
    print("Testing Cooper with Gemini (Stream=False)...")
    try:
        # Call with stream=False to get the raw string or error
        response = run_chat_agent("Hi Cooper, are you awake?", stream=False)
        print(f"Response Type: {type(response)}")
        print(f"\nCooper Says:\n{response}")
    except Exception as e:
        print(f"\nFATAL LOGIC ERROR: {e}")
