import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, RotateCcw, ExternalLink } from 'lucide-react';
import { loadProfile, saveProfile, clearProfile } from '../profile';
import { API_URL } from '../api';
import { track, resetAnalytics } from '../analytics';
import { clearStreaks } from '../streak';

const ROLES = [
  'Indie founder',
  'Freelancer / consultant',
  'Designer / maker',
  'Engineer',
  'Other',
];

export default function Settings() {
  const navigate = useNavigate();
  const initial = loadProfile();
  const [name, setName] = useState(initial?.name ?? '');
  const [role, setRole] = useState(initial?.role ?? ROLES[0]);
  const [start, setStart] = useState(initial?.workdayStartsAt ?? '09:00');
  const [end, setEnd] = useState(initial?.workdayEndsAt ?? '18:00');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const save = () => {
    if (!name.trim()) return;
    saveProfile({
      name: name.trim(),
      role,
      workdayStartsAt: start,
      workdayEndsAt: end,
      onboardedAt: initial?.onboardedAt ?? new Date().toISOString(),
    });
    track('settings_saved', { role });
    setSavedAt(Date.now());
  };

  const clearChatLocal = () => {
    if (!confirm('Clear local chat cache? Server history is unaffected.')) return;
    localStorage.removeItem('cooper_chat_history_v1');
  };

  const fullReset = () => {
    if (
      !confirm(
        'Reset onboarding? You\'ll go through Welcome again. Server data is unaffected.'
      )
    )
      return;
    track('onboarding_reset');
    clearProfile();
    clearStreaks();
    localStorage.removeItem('cooper_chat_history_v1');
    resetAnalytics();
    navigate('/welcome', { replace: true });
  };

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <button style={styles.backButton} onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={22} color="#1a1a1a" />
        </button>
        <h1 style={styles.title}>Settings</h1>
        <div style={{ width: 40 }} />
      </header>

      <div style={styles.body}>
        <Section title="Profile" sub="How Cooper addresses you and shapes coaching.">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.input}
            />
          </Field>
          <Field label="Role">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={styles.input}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Field>
        </Section>

        <Section title="Workday" sub="Cooper plans briefs near the start, reviews near the end.">
          <div style={styles.timeRow}>
            <Field label="Starts">
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                style={styles.input}
              />
            </Field>
            <Field label="Ends">
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                style={styles.input}
              />
            </Field>
          </div>
        </Section>

        <button
          onClick={save}
          disabled={!name.trim()}
          style={{
            ...styles.primary,
            background: name.trim() ? '#000' : '#e5e7eb',
            color: name.trim() ? '#fff' : '#9ca3af',
            cursor: name.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          {savedAt && Date.now() - savedAt < 2000 ? 'Saved ✓' : 'Save changes'}
        </button>

        <Section title="Backend" sub="Where Cooper's brain lives.">
          <div style={styles.kv}>
            <span style={styles.kvKey}>API</span>
            <span style={styles.kvValue}>{API_URL}</span>
          </div>
        </Section>

        <Section title="Danger zone" sub="Local-only — your server-side data is untouched.">
          <button onClick={clearChatLocal} style={styles.danger}>
            <RotateCcw size={16} />
            <span>Clear local chat cache</span>
          </button>
          <button onClick={fullReset} style={{ ...styles.danger, color: '#dc2626' }}>
            <Trash2 size={16} />
            <span>Reset onboarding</span>
          </button>
        </Section>

        <a
          href="https://github.com/naveenvasou/nachos"
          target="_blank"
          rel="noreferrer"
          style={styles.link}
        >
          <ExternalLink size={14} />
          <span>Cooper is open source</span>
        </a>
      </div>
    </div>
  );
}

function Section({
  title, sub, children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      {sub && <div style={styles.sectionSub}>{sub}</div>}
      <div style={styles.sectionBody}>{children}</div>
    </section>
  );
}

function Field({
  label, children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: '#fafafa' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, background: '#fff', borderBottom: '1px solid #f3f4f6',
  },
  title: { fontSize: 18, fontWeight: 700, color: '#1a1a1a', margin: 0 },
  backButton: {
    width: 40, height: 40, borderRadius: 20, background: '#f3f4f6',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  body: { padding: 20, display: 'flex', flexDirection: 'column', gap: 18 },

  section: {
    background: '#fff', borderRadius: 18, padding: 18,
    border: '1px solid #f0f0f0',
  },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#6b7280', marginBottom: 14 },
  sectionBody: { display: 'flex', flexDirection: 'column', gap: 12 },

  field: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1 },
  fieldLabel: {
    fontSize: 11, fontWeight: 700, color: '#6b7280',
    letterSpacing: 0.4, textTransform: 'uppercase' as const,
  },
  input: {
    padding: '12px 14px', fontSize: 15,
    border: '1px solid #e5e7eb', borderRadius: 10,
    outline: 'none', fontFamily: 'inherit', background: '#fff',
  },
  timeRow: { display: 'flex', gap: 12 },

  primary: {
    width: '100%', height: 48, borderRadius: 12,
    fontSize: 14, fontWeight: 600,
  },

  kv: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 13, color: '#374151',
  },
  kvKey: { fontWeight: 700, color: '#6b7280' },
  kvValue: {
    fontFamily: 'Menlo, Consolas, monospace', fontSize: 12,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    maxWidth: 220,
  },

  danger: {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    background: '#fff', color: '#374151',
    border: '1px solid #f0f0f0',
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600,
  },
  link: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    color: '#6b7280', fontSize: 12, fontWeight: 600,
    margin: '8px auto', textDecoration: 'none',
  },
};
