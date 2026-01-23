# AI Goal Coach

## Project Structure
- **/mobile**: React Native (Expo) app.
- **/backend**: Python FastAPI server with LangGraph agent.

## Setup & Running

### 1. Backend
1. Navigate to `/backend`
2. Activate venv: `venv\Scripts\activate`
3. Run server: `run.bat` (Starts on port 8000)

### 2. Mobile
1. Navigate to `/mobile`
2. Install dependencies: `npm install`
3. Run app: `npx expo start`
   - Note: WatermelonDB requires native code. Use `npx expo run:android` or use a development build.
