# Cooper — Product Strategy

> The AI chief of staff for people who'd rather talk than type.

This document is the source of truth for what Cooper is, who it's for, and what we're building. If a decision contradicts this doc, either the decision is wrong or this doc is wrong. Pick one.

---

## 1. The one-liner

**Cooper is a voice-first AI chief of staff that turns scattered ambition into a clear weekly plan and quietly nudges you to actually do the work.**

Not a todo app. Not a chatbot. An *agent that acts* — Cooper writes to your goals, tasks, and reflections; you talk, it organizes.

## 2. Who it's for (sharp on purpose)

**Primary ICP: solo operators with execution friction.**

- Indie founders, freelancers, makers, designers-who-also-code.
- Self-identify as "I have great ideas but Notion is where ideas go to die."
- Often (not always) ADHD-coded, or have ADHD. High-agency, scattered execution.
- Already pay for ChatGPT Plus and at least one productivity tool, and are still unhappy.
- 25–40, terminally online, will try 3 productivity apps a quarter.

**Secondary (later, not now):** engineering managers, technical PMs.

**We are NOT for:** teams, enterprises, "I want to track my fitness habits" hobbyists, students. Saying yes to those breaks the wedge.

## 3. The job-to-be-done

> "Help me figure out what to actually do today, in the time I have, without making me think about it."

Friction we kill, in priority order:
1. **Planning friction.** Opening Notion, deciding the top-3, breaking down a goal — exhausting before any real work happens.
2. **Capture friction.** Idea hits at 11pm; goes nowhere; lost.
3. **Alignment friction.** Daily work drifts away from quarterly goals. Nobody re-reads their OKRs.
4. **Closing friction.** "What did I even do this week?" → no answer → guilt.

## 4. The wedge (why we win, briefly)

| Lever | Why it matters | Status in code |
|---|---|---|
| **Voice-first** with realtime end-of-turn STT | Talking is 3× faster than typing; lowers capture friction to zero | ✅ Deepgram Flux already wired (`backend/flux_stt_service.py`) |
| **Agent that acts** (writes to DB) | Most "AI productivity" tools are read-only chat. Cooper edits state. | ✅ LangGraph agent w/ `tools.py` |
| **Proactive nudges** | Asynchronous coaching, not a chatbot waiting to be opened | ✅ `proactive_scheduler.py` exists, FCM hookup pending |
| **Daily ↔ Weekly ↔ Quarterly alignment** | Connects today's task to what actually matters | 🟡 Goals + tasks model exists, UI surfaces it shallowly |
| **Persona / soul** | Tone (anti-hustle, signal vs noise) is a brand. ChatGPT can't be opinionated. | ✅ `prompts/soul.md` |

ChatGPT can mimic 30% of this for free. Sunsama/Motion can mimic the calendar-y 30%. Nobody combines voice + agent + proactive + opinionated coach.

## 5. The core loop (this is the product)

```
  Morning Brief (2 min)            Evening Review (2 min)
        ↓                                  ↑
   Top-3 must-dos for today  →  Focus sessions on a task  →  Mark done by voice
        ↑                                                    ↓
            Weekly Review (10 min) — align with quarterly goals
```

A user who runs this loop 5 days in a row gets the value. Everything in the product exists to make this loop frictionless. If a feature doesn't serve the loop, cut it.

## 6. Onboarding (first 60 seconds)

1. Land on welcome → "Tell Cooper your name."
2. "What are you trying to ship this quarter?" → Cooper extracts a goal via chat.
3. Cooper proposes 3 tasks for today; user confirms.
4. Drop into Today screen with active plan. Done.

No empty states. The first session creates state.

## 7. Pricing thesis

| Tier | Price | What you get |
|---|---|---|
| **Trial** | Free, 7 days | Everything |
| **Cooper Pro** | **$19/mo** | Unlimited voice, proactive nudges, weekly reviews, full history |
| **Cooper Yearly** | $180/yr ($15/mo equiv) | Same as Pro, 1 month free |

No teams plan. No freemium with caps that punish daily use. We need users who pay because the loop is valuable, not users who churn because the cap stings.

LTV target: $250 (12-month avg life × $19 + a chunk on yearly). CAC ceiling: $50 from organic + influencer; <$25 from paid.

## 8. Distribution thesis

In order of what to try first:
1. **Founder Twitter / Indie Hackers** — me-as-founder posts the loop weekly, raw. Free.
2. **ADHD productivity TikTok / Reels** — paid creators show the morning brief on camera. $1k/mo experiment.
3. **Product Hunt** — once the loop is rock-solid (not before).
4. **SEO** — "morning brief app", "AI executive function coach", later.

## 9. Roadmap (90 days)

**Now (week 1–2)** — positioning + frictionless loop in web app
- ✅ Sharp Today screen, no mocks
- ✅ Brief / Review / Capture flows seeded into chat
- ✅ Focus tied to a task, voice mark-done
- ✅ Strategy map driven by real goals

**Next (week 3–6)** — make it feel alive
- Proactive nudges: morning push at user's wake time, evening at end-of-workday (need FCM + web push)
- Streaks: brief/review streak counter (data already in `get_streak_data`)
- Habits surface (DB has it, UI doesn't)
- Stripe + auth + multi-user backend (currently single-tenant)

**Then (week 7–12)** — distribution
- Public landing page with demo video of voice loop
- Referral codes
- Calendar sync (Google) so brief knows your meetings
- iOS app reuses RN code; PWA for everyone else

## 10. What we are explicitly NOT building (yet)

- Teams / sharing / collaboration
- Calendar bookings / scheduling assistant
- Email integration
- Note-taking / second brain
- Mobile push for Android specifically (until web push is solid)
- A free tier that lasts forever

Each of these is a distraction from the loop.

## 11. What "PMF" looks like for us

We have PMF when, of users who finish onboarding:
- 40% run the morning brief 4+ days in week 1
- 25% are still running it in week 4
- Sean Ellis test (would be very disappointed if Cooper went away) ≥ 40% at day 14

We measure these from day one. If they're not moving by week 6 of paid traffic, the wedge is wrong, not the marketing.

## 12. Risks (and what kills us)

- **OpenAI ships a "tasks" feature that's good enough.** Mitigation: lean into voice + proactive, which OpenAI won't do well.
- **Voice STT cost per user explodes.** Mitigation: cap minutes on Pro, offer text-only fallback.
- **Loop is too rigid for users who don't have ADHD-shaped problems.** Mitigation: ICP discipline; do not broaden until the narrow case is winning.
- **Onboarding fails because Cooper hallucinates a bad first plan.** Mitigation: seeded prompts, system message says "be conservative on first session."
