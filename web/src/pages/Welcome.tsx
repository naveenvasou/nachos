import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { saveProfile } from '../profile';

const ROLES = [
  'Indie founder',
  'Freelancer / consultant',
  'Designer / maker',
  'Engineer',
  'Other',
];

export default function Welcome() {
  const navigate = useNavigate();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [name, setName] = useState('');
  const [role, setRole] = useState(ROLES[0]);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('18:00');

  const finish = () => {
    if (!name.trim()) return;
    saveProfile({
      name: name.trim(),
      role,
      workdayStartsAt: start,
      workdayEndsAt: end,
      onboardedAt: new Date().toISOString(),
    });
    // First-time user → straight into a brief with Cooper.
    navigate('/chat?mode=brief&firstRun=1', { replace: true });
  };

  return (
    <div style={styles.root}>
      <div style={styles.hero}>
        <div style={styles.brandRow}>
          <div style={styles.dot} />
          <div style={styles.brand}>cooper</div>
        </div>

        <h1 style={styles.title}>
          Your AI chief of staff
          <br />
          <span style={styles.titleAccent}>for people who'd rather talk than type.</span>
        </h1>

        <p style={styles.lede}>
          Two minutes in the morning. Two minutes at night. Cooper handles the planning so you
          can do the work.
        </p>
      </div>

      <div style={styles.card}>
        {step === 0 && (
          <Step
            heading="What should Cooper call you?"
            sub="First name is fine."
            cta={
              <PrimaryButton
                disabled={!name.trim()}
                onClick={() => setStep(1)}
                label="Continue"
              />
            }
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep(1)}
              placeholder="e.g. Naveen"
              style={styles.input}
            />
          </Step>
        )}

        {step === 1 && (
          <Step
            heading={`Nice to meet you, ${name.trim()}.`}
            sub="What best describes how you work?"
            cta={<PrimaryButton onClick={() => setStep(2)} label="Continue" />}
          >
            <div style={styles.roleGrid}>
              {ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  style={{
                    ...styles.roleChip,
                    borderColor: role === r ? '#000' : '#e5e7eb',
                    background: role === r ? '#000' : '#fff',
                    color: role === r ? '#fff' : '#1a1a1a',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </Step>
        )}

        {step === 2 && (
          <Step
            heading="When's your workday?"
            sub="Cooper will brief you near the start and review near the end."
            cta={<PrimaryButton onClick={finish} label="Talk to Cooper →" />}
          >
            <div style={styles.timeRow}>
              <label style={styles.timeLabel}>
                <span>Starts</span>
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  style={styles.timeInput}
                />
              </label>
              <label style={styles.timeLabel}>
                <span>Ends</span>
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  style={styles.timeInput}
                />
              </label>
            </div>
          </Step>
        )}
      </div>

      <div style={styles.footer}>
        <Pill>Voice-first</Pill>
        <Pill>Writes to your goals</Pill>
        <Pill>Anti-hustle</Pill>
      </div>
    </div>
  );
}

function Step(props: {
  heading: string;
  sub: string;
  children: React.ReactNode;
  cta: React.ReactNode;
}) {
  return (
    <>
      <div style={styles.heading}>{props.heading}</div>
      <div style={styles.sub}>{props.sub}</div>
      <div style={{ marginTop: 20 }}>{props.children}</div>
      <div style={{ marginTop: 24 }}>{props.cta}</div>
    </>
  );
}

function PrimaryButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        ...styles.primary,
        background: disabled ? '#e5e7eb' : '#000',
        color: disabled ? '#9ca3af' : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span>{label}</span>
      <ArrowRight size={18} />
    </button>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span style={styles.pill}>{children}</span>;
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: '#fafafa',
    padding: '40px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
  },
  hero: {
    paddingTop: 12,
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 28,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    background: '#8B5CF6',
  },
  brand: {
    fontWeight: 700,
    letterSpacing: -0.5,
    fontSize: 16,
  },
  title: {
    fontSize: 32,
    lineHeight: 1.15,
    fontWeight: 800,
    margin: '0 0 16px',
    letterSpacing: -0.5,
  },
  titleAccent: {
    color: '#8B5CF6',
  },
  lede: {
    fontSize: 16,
    lineHeight: 1.5,
    color: '#4b5563',
    margin: 0,
    maxWidth: 360,
  },
  card: {
    background: '#fff',
    borderRadius: 24,
    padding: 24,
    border: '1px solid #f0f0f0',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  heading: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    fontSize: 16,
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    outline: 'none',
    fontFamily: 'inherit',
  },
  roleGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleChip: {
    padding: '10px 14px',
    border: '1px solid #e5e7eb',
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 500,
    transition: 'all 0.15s ease',
  },
  timeRow: {
    display: 'flex',
    gap: 12,
  },
  timeLabel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 12,
    color: '#6b7280',
    fontWeight: 600,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  timeInput: {
    padding: '12px 14px',
    fontSize: 16,
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    outline: 'none',
    fontFamily: 'inherit',
  },
  primary: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'background 0.15s ease',
  },
  footer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 'auto',
    paddingTop: 12,
  },
  pill: {
    padding: '6px 12px',
    background: '#fff',
    border: '1px solid #f0f0f0',
    borderRadius: 999,
    fontSize: 12,
    color: '#4b5563',
    fontWeight: 600,
    letterSpacing: 0.2,
  },
};
