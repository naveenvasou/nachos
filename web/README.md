# Nachos Web

Web version of the Nachos / Cooper mobile app. Same backend, browser-friendly front end so you can iterate without rebuilding native code.

## Stack
- Vite + React 18 + TypeScript
- React Router for navigation (Home, Chat, Focus, Strategy)
- `react-markdown` for assistant message rendering
- `lucide-react` for icons
- Plain inline styles to mirror the React Native styling closely

## Backend
By default the app talks to the deployed backend:

```
https://nachos-backend-728473520070.us-central1.run.app
```

Override it with a Vite env var when running locally:

```
echo "VITE_API_URL=http://localhost:8000" > .env.local
```

## Running

```bash
cd web
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

## Build

```bash
npm run build
npm run preview
```

## Notes
- The mic button uses the browser's `getUserMedia` + a `ScriptProcessorNode` to stream 16-bit PCM at 16 kHz to `/ws/transcribe`. This requires a secure context (HTTPS or localhost).
- Push notifications and on-device WatermelonDB sync are mobile-only and intentionally not ported.
