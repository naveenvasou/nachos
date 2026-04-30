/**
 * Analytics — env-gated. No PostHog key → all calls become no-ops.
 *
 * We measure the PMF signals from PRODUCT.md §11:
 *   - onboarding completion rate
 *   - morning brief / evening review frequency (the loop)
 *   - focus session usage
 *   - task throughput
 *
 * Set VITE_POSTHOG_KEY in `.env.local` (and optionally VITE_POSTHOG_HOST,
 * defaults to https://us.i.posthog.com).
 */
import posthog from 'posthog-js';
import type { Profile } from './profile';

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ??
  'https://us.i.posthog.com';

let initialized = false;

export function initAnalytics(): void {
  if (initialized || !KEY) return;
  initialized = true;
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: false, // we manually fire screen_viewed for SPA routes
    capture_pageleave: true,
    persistence: 'localStorage',
    autocapture: false, // intentional events only
  });
}

export function identifyFromProfile(profile: Profile | null): void {
  if (!initialized || !profile) return;
  // Stable anon id per browser; we'll swap to real user_id after auth.
  let anonId = localStorage.getItem('cooper_anon_id');
  if (!anonId) {
    anonId =
      'anon_' +
      Math.random().toString(36).slice(2) +
      Date.now().toString(36);
    localStorage.setItem('cooper_anon_id', anonId);
  }
  posthog.identify(anonId, {
    name: profile.name,
    role: profile.role,
    workday_starts_at: profile.workdayStartsAt,
    workday_ends_at: profile.workdayEndsAt,
    onboarded_at: profile.onboardedAt,
  });
}

export type AnalyticsEvent =
  | 'landing_viewed'
  | 'landing_cta_clicked'
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'onboarding_reset'
  | 'screen_viewed'
  | 'today_viewed'
  | 'brief_started'
  | 'review_started'
  | 'task_toggled'
  | 'task_focus_started'
  | 'focus_session_started'
  | 'focus_session_completed'
  | 'focus_task_marked_done'
  | 'chat_message_sent'
  | 'chat_seed_sent'
  | 'chat_voice_started'
  | 'chat_voice_stopped'
  | 'strategy_viewed'
  | 'goal_planning_started'
  | 'settings_saved'
  | 'habit_log_clicked'
  | 'habit_create_clicked';

export function track(
  event: AnalyticsEvent,
  props?: Record<string, unknown>
): void {
  if (!initialized) {
    if (import.meta.env.DEV) {
      // Visible in console during dev so you can sanity-check instrumentation.
      console.debug('[analytics] (no key)', event, props);
    }
    return;
  }
  posthog.capture(event, props);
}

export function resetAnalytics(): void {
  if (!initialized) return;
  posthog.reset();
}
