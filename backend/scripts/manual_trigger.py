import asyncio
import sys
import os
from dotenv import load_dotenv

# Add backend to path logic to ensure imports work
# backend is at d:\nachos\backend
current_dir = os.path.dirname(os.path.abspath(__file__)) # d:\nachos\backend\scripts
backend_dir = os.path.dirname(current_dir) # d:\nachos\backend
sys.path.append(backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))

from agent import wake_cooper

async def main():
    reason = "Manual Verification Trigger (Dev Test)"
    print(f"🚀 Triggering Cooper with reason: '{reason}'")
    await wake_cooper(reason)
    print("✅ Trigger complete.")

if __name__ == "__main__":
    asyncio.run(main())
