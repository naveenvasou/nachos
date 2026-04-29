import type { Profile } from './profile';

export type ChatMode = 'brief' | 'review' | 'capture' | 'plan-goal' | 'free';

export interface SeedContext {
  profile: Profile | null;
  topTaskTitles?: string[];
}

/**
 * Seeded first-message prompts. The user can edit before sending if they want.
 * Tone matches Cooper's `prompts/soul.md` — direct, anti-fluff.
 */
export function seedFor(mode: ChatMode, ctx: SeedContext): string {
  const name = ctx.profile?.name?.trim();
  const namePart = name ? `, ${name}` : '';

  switch (mode) {
    case 'brief':
      return [
        `Cooper, run my morning brief${namePart}.`,
        `Walk me through what's on the plate today, what matters most, and what I should park.`,
        `Help me commit to a top-3 for today.`,
      ].join(' ');

    case 'review':
      return [
        `Cooper, run my evening review.`,
        `What got done, what didn't, and what's blocking me.`,
        `Help me close loops and set up tomorrow's top-3.`,
      ].join(' ');

    case 'capture':
      return `Cooper, I want to brain-dump. Listen, then organize what's worth keeping into goals or tasks. Don't write anything yet — let me dump first.`;

    case 'plan-goal':
      return `Cooper, I want to define a new quarterly goal. Help me sharpen it: what does "done" look like, what's the timeline, and what are the 2-3 first concrete steps. Don't create anything until I confirm.`;

    case 'free':
    default:
      return '';
  }
}

export function modeTitle(mode: ChatMode): string {
  switch (mode) {
    case 'brief':
      return 'Morning Brief';
    case 'review':
      return 'Evening Review';
    case 'capture':
      return 'Brain Dump';
    case 'plan-goal':
      return 'Plan a Goal';
    default:
      return 'Cooper';
  }
}
