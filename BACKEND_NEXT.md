# Backend — what to ship next

This doc is the source-of-truth for the backend work that unblocks Cooper from
"single-tenant demo" → "thing we can actually sell." It's a plan, not a
finished design — challenge anything that's wrong.

> **Status as of this commit:** the backend (`/backend`) is single-tenant.
> Every request hits the same Postgres rows. There are no users, no auth, no
> billing, and no rate limits. The web app stores a "profile" in localStorage
> as a placeholder for what should eventually be a server-side user.

The order below is the order we should ship. Each step is roughly
self-contained and reversible.

---

## 1. Auth + multi-tenant data (the unblocker)

**Why first:** without this, we cannot accept a second user. Everything else
(billing, push, sharing) is downstream of users existing.

### 1a. Schema changes

Every domain table gets a `user_id` (UUID, NOT NULL after backfill, indexed).
Concretely, in `backend/database.py`:

| Table | Add | Notes |
|---|---|---|
| `users` | NEW | `id UUID PK`, `email CITEXT UNIQUE`, `password_hash`, `name`, `created_at`, `last_seen_at`, `stripe_customer_id` |
| `goals` | `user_id UUID NOT NULL REFERENCES users(id)` | index `(user_id, status)` |
| `tasks` | `user_id UUID NOT NULL REFERENCES users(id)` | index `(user_id, scheduled_date, status)` |
| `habits` | `user_id` | |
| `messages` | `user_id` | this is the chat history; biggest table |
| `reflections` | `user_id` | |
| `summaries` | `user_id` | |
| `push_tokens` | `user_id` | |
| `profile` | replace single-row with `user_id PK` | currently `get_profile()` reads one global row |

**Migration plan**:
1. Add columns nullable.
2. Create one "legacy" user, backfill all rows to its id.
3. Make columns NOT NULL.
4. Add CHECK constraint on `messages` etc. that no row has NULL user_id.

There's no real production data to worry about — this is all dev. Ship it as
a single migration.

### 1b. Endpoint shape

Add a small auth surface; everything else gains a `Depends(current_user)`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/auth/signup` | email + password (or magic link), returns JWT |
| `POST` | `/auth/login` | returns JWT |
| `POST` | `/auth/logout` | invalidate (blacklist or short JWT TTL + refresh) |
| `GET`  | `/auth/me` | returns current user |

Existing endpoints to gate (see `backend/main.py`):
- `POST /chat`, `POST /chat/stream`, `GET /chat/history`
- `GET/POST /tasks`, `PUT /tasks/{id}`
- `GET /goals`
- `WS /ws/transcribe` (auth via query token: `/ws/transcribe?token=…`)
- `POST /transcribe`
- `POST /notifications/register-token`
- `/debug/*` — gate behind admin role, not just any user

Recommend: `python-jose` + `passlib[bcrypt]` + a `Depends(get_current_user)`
that pulls from `Authorization: Bearer …`. Short access tokens (15 min) +
refresh tokens (7 days) stored in `httpOnly` cookies.

### 1c. Agent context per user

`agent.py` and the prompts pull the "CURRENT STATE" markdown via
`get_context_markdown()`. That function currently has no notion of user. It
needs to take a `user_id` and pass it through every read in `database.py`
(see `list_tasks`, `list_goals`, `get_task_stats`, `get_overdue_tasks`,
`get_goal_progress`, `get_recent_reflections`, `get_streak_data`,
`get_wake_context`, `get_memory_context`).

Likewise the agent's tools (`backend/tools.py`) need user_id threaded so
`create_task`, `update_task`, `create_goal`, etc. write to the correct user.

The cleanest path: a `UserContext` dataclass passed into the agent invocation
and into every tool call; the tool wrappers close over it.

### 1d. Web client changes

- New routes `/login` and `/signup` (public, full-width like `/landing`).
- A `auth.ts` module: `getToken()`, `setToken()`, `logout()`, `useUser()`.
- All API calls add `Authorization: Bearer <token>`.
- `RequireProfile` becomes `RequireAuth` (real session, not localStorage flag).
- The current `profile.ts` becomes a thin cache for `/auth/me` response.
- Onboarding (`/welcome`) runs *after* signup, not in place of it.

Estimated effort: **2–3 days** of focused work. Most of the time is in
threading user_id everywhere in the agent and tools and not regressing
single-tenant behavior in the meantime.

---

## 2. Stripe + paywall

**Pricing reminder (`PRODUCT.md` §7):** $19/mo Pro, $180/yr, 7-day trial.

### 2a. Endpoints
- `POST /billing/checkout-session` — returns Stripe Checkout URL.
- `POST /billing/portal-session` — returns customer portal URL.
- `POST /billing/webhook` — listen for `customer.subscription.*` events,
  update `users.subscription_status` + `users.current_period_end`.

### 2b. Gate
A single decorator on chat endpoints: if the user's subscription is `active`
or `trialing` (or trial < 7 days old), allow. Else 402 Payment Required and
the web client routes to a paywall page.

**Free trial logic:** on signup we set `trial_ends_at = created_at + 7 days`.
The chat gate accepts trial OR active subscription. After trial expires
without subscribing, we still let them log in and see history but block
sending messages.

### 2c. Web changes
- New page `/billing` showing plan + manage button (links to Stripe portal).
- Modal interception: trying to send a message with no active sub →
  paywall sheet.

Estimated effort: **1 day.** Stripe is well-trodden territory.

---

## 3. Web push for proactive nudges

The product thesis (`PRODUCT.md` §4) leans on Cooper being proactive. Right
now `proactive_scheduler.py` exists and `push_tokens` are stored, but the
scheduler currently has no FCM hookup AND only mobile would receive them.

### 3a. Web Push (VAPID)
- Service worker in `web/public/sw.js` registered from `main.tsx`.
- `POST /notifications/subscribe-web` accepts a `PushSubscription` JSON;
  store in `push_tokens` with `kind = 'web'`.
- Add `pywebpush` to the backend; have the scheduler send to all of a user's
  subscriptions, log delivery, prune dead ones.

### 3b. Triggers (the actual product)
- **Morning brief reminder** at `users.workday_starts_at` if no message in
  the last 12 hours.
- **Evening review reminder** ~30 minutes before `workday_ends_at` if no
  review for today.
- **Stuck task** if the same task has been "rescheduled" 2+ times
  (`get_rescheduled_tasks` already exposes this).
- **Drift alert** weekly: tasks done that aren't linked to active goals.

Don't ship all four day one. Start with the morning brief reminder — it's
the one that activates the loop.

Estimated effort: **1 day** for plumbing, **+ ongoing tuning** to avoid
spammy nudges.

---

## 4. Calendar (Google) read

Cooper's morning brief is way more useful if it knows about your meetings.

- `GET /integrations/google/auth-url` and `/integrations/google/callback`
- Store `google_oauth_tokens` per user.
- Cache today's calendar events; expose `get_todays_calendar(user_id)` to
  the agent so it appears in CURRENT STATE markdown.

Don't write to calendar yet. Read-only is enough to make the brief 2x better
without entering "scheduling assistant" territory.

Estimated effort: **1.5 days.**

---

## 5. Observability

- Sentry on backend (FastAPI) + frontend (React).
- Structured logs with user_id where it matters.
- A `/health` endpoint with DB + LLM-provider checks.

The web app already has PostHog (gated by `VITE_POSTHOG_KEY`). Mirror with
PostHog server-side capture from the backend so we can join chat events with
backend latency and errors.

Estimated effort: **0.5 day.**

---

## 6. Things to NOT do yet

In order of "tempting but wrong":

- **Teams / sharing.** Do not introduce orgs, workspaces, invites. Single-
  user is the wedge. Adding teams now triples the data model complexity for
  zero PMF signal.
- **Mobile push parity.** Web push first; FCM is a mobile-only re-build.
  Don't fork the scheduler before web works end-to-end.
- **Background agents** (Cooper that "thinks while you sleep"). Sounds cool,
  but burns LLM cost without proven engagement. Add it after we have
  retained users.
- **Custom LLM hosting.** Not yet. Stick with provider APIs. We're not
  cost-bound.

---

## TL;DR — what unlocks paying users

```
[1. Auth + multi-tenant]  ⟶  [2. Stripe paywall]  ⟶  beta with paid users
                                                  ⟶  [3. Web push]  ⟶  retention loop closes
```

That's roughly **5 working days** end-to-end. Everything else is downstream
or optional.
