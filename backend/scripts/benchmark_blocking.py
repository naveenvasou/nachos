import asyncio
import httpx
import time
import subprocess
import os
import sys
import signal

SERVER_PORT = 8001
BASE_URL = f"http://127.0.0.1:{SERVER_PORT}"

async def run_benchmark(concurrency=50):
    async with httpx.AsyncClient() as client:
        # Start the load requests
        load_tasks = []
        for _ in range(concurrency):
            load_tasks.append(client.get(f"{BASE_URL}/chat/history"))

        # Start a victim request slightly after
        await asyncio.sleep(0.01)
        victim_start = time.time()
        victim_response = await client.get(f"{BASE_URL}/non-existent-endpoint")
        victim_end = time.time()

        await asyncio.gather(*load_tasks)

        victim_latency = victim_end - victim_start
        print(f"Victim request latency (during {concurrency} load reqs): {victim_latency:.4f}s")

def start_server():
    # Run uvicorn from backend directory
    env = os.environ.copy()
    env["PYTHONPATH"] = os.getcwd()
    env["GOOGLE_API_KEY"] = "dummy_google_key"
    env["GROQ_API_KEY"] = "dummy_groq_key"
    env["DEEPGRAM_API_KEY"] = "dummy_deepgram_key"

    server_process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--port", str(SERVER_PORT)],
        cwd="backend",
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE
    )
    return server_process

async def wait_for_server():
    async with httpx.AsyncClient() as client:
        for _ in range(50):
            try:
                await client.get(f"{BASE_URL}/docs")
                return True
            except httpx.ConnectError:
                await asyncio.sleep(0.2)
    return False

async def main():
    print("Starting server...")
    server = start_server()
    try:
        if not await wait_for_server():
            print("Server failed to start")
            _, stderr = server.communicate()
            print(f"Stderr: {stderr.decode()}")
            return

        print("Server started. Running benchmark...")

        print("\n--- Benchmark (Concurrency=50) ---")
        await run_benchmark(concurrency=50)

    finally:
        print("\nStopping server...")
        server.terminate()
        server.wait()

if __name__ == "__main__":
    asyncio.run(main())
