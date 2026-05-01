# Cooper — Web

The voice-first AI chief of staff for people who'd rather talk than type.

This is the web client. It talks to the same FastAPI backend as the mobile app. See `/PRODUCT.md` at the repo root for positioning, ICP, and roadmap.

## Stack
- Vite + React 18 + TypeScript
- React Router for navigation
- `react-markdown` for assistant messages
- `lucide-react` for icons
- Plus Jakarta Sans (Google Fonts)
- No state library, no UI kit — kept light on purpose

## Surfaces
- `/welcome` — first-run onboarding (name, role, workday)
- `/` — Today: morning brief / evening review CTA, top-3, quick actions, also-today, "Talk to Cooper" FAB
- `/chat?mode=brief|review|capture|plan-goal&seed=&firstRun=` — chat with seeded openers; SSE streaming via `/chat/stream`; voice via `/ws/transcribe`
- `/focus?taskId=N` — Pomodoro tied to a specific task; "Mark done" routes back through the API or "Reflect with Cooper" routes back through chat
- `/strategy` — strategy map driven by `/goals` + `/tasks`; empty state CTA hands off to Cooper for goal planning
- `/settings` — local profile, workday, reset

## Backend
By default points at the deployed Cloud Run backend:
```
https://nachos-backend-728473520070.us-central1.run.app
```
Override locally:
```bash
echo "VITE_API_URL=http://localhost:8000" > .env.local
```

## Running

```bash
cd web
npm install
npm run dev
```

Voice (mic) requires HTTPS or localhost. Build with `npm run build`, preview with `npm run preview`.

## Design notes (intentional, not lazy)
- **Cooper is the interface for mutations.** The UI shows state; writes happen by talking to Cooper, who has agent tools for `create_task`, `create_goal`, etc. There's no "+ task" button in the UI on purpose.
- **First-run goes straight into a Morning Brief**, not an empty Today screen.
- **Top-3 doctrine.** Today shows at most 3 must-dos. Anything else is "also today" — visible but de-emphasized.
- **Profile is local-only** until backend has multi-tenant auth. Reset wipes localStorage; server data is untouched.
