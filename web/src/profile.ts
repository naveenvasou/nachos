// Local-only user profile (until backend has real auth/users).
// Stored in localStorage; cleared on Reset in Settings.

const KEY = 'cooper_profile_v1';

export interface Profile {
  name: string;
  role: string; // "Indie founder", "Freelancer", etc.
  workdayStartsAt: string; // "09:00"
  workdayEndsAt: string; // "18:00"
  onboardedAt: string; // ISO
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Profile;
    if (!parsed.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveProfile(p: Profile): void {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function clearProfile(): void {
  localStorage.removeItem(KEY);
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Up late,';
  if (h < 12) return 'Good morning,';
  if (h < 17) return 'Good afternoon,';
  if (h < 21) return 'Good evening,';
  return 'Late night,';
}

export function isWithinWorkday(p: Profile, now: Date = new Date()): boolean {
  const [sH, sM] = p.workdayStartsAt.split(':').map(Number);
  const [eH, eM] = p.workdayEndsAt.split(':').map(Number);
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= sH * 60 + sM && mins <= eH * 60 + eM;
}

export function dayPhase(
  p: Profile | null,
  now: Date = new Date()
): 'morning' | 'midday' | 'evening' | 'after-hours' {
  const h = now.getHours();
  if (p) {
    const [sH] = p.workdayStartsAt.split(':').map(Number);
    const [eH] = p.workdayEndsAt.split(':').map(Number);
    if (h < sH) return 'morning';
    if (h < sH + 3) return 'morning';
    if (h < eH - 1) return 'midday';
    if (h < eH + 1) return 'evening';
    return 'after-hours';
  }
  if (h < 11) return 'morning';
  if (h < 16) return 'midday';
  if (h < 21) return 'evening';
  return 'after-hours';
}
