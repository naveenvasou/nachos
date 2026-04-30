# Cooper — AI chief of staff

> Voice-first AI coach for people who'd rather talk than type.
> See **[PRODUCT.md](./PRODUCT.md)** for positioning, ICP, and roadmap;
> see **[BACKEND_NEXT.md](./BACKEND_NEXT.md)** for the path from
> single-tenant demo to paid product.

## Project Structure
- **/web**: Vite + React web app — primary surface, what we ship to users.
- **/mobile**: React Native (Expo) app — same backend, mobile shell.
- **/backend**: Python FastAPI server with the LangGraph agent (Cooper).

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

### 3. Web
1. Navigate to `/web`
2. Install dependencies: `npm install`
3. Run dev server: `npm run dev`
   - Defaults to the deployed Cloud Run backend. To use a local backend, create `web/.env.local` with `VITE_API_URL=http://localhost:8000`.
