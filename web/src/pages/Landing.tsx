import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic, Sun, Moon, Flame, Target, ArrowRight, Check,
} from 'lucide-react';
import { track } from '../analytics';

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => { track('landing_viewed'); }, []);

  const start = (source: string) => {
    track('landing_cta_clicked', { source });
    navigate('/welcome');
  };

  return (
    <div style={styles.root}>
      <Nav onStart={() => start('nav')} />

      <Hero onStart={() => start('hero')} />

      <Section title="The loop." sub="Two minutes in. Two minutes out. The rest of your day stays yours.">
        <Loop />
      </Section>

      <Section title="Why Cooper." sub="A small set of opinions, executed well.">
        <Why />
      </Section>

      <Section title="Who it's for." sub="Sharp on purpose.">
        <ICP />
      </Section>

      <Section title="Pricing." sub="One tier. Cancel anytime.">
        <Pricing onStart={() => start('pricing')} />
      </Section>

      <Section title="FAQ." sub="The honest ones.">
        <FAQ />
      </Section>

      <FinalCTA onStart={() => start('footer')} />
      <Footer />
    </div>
  );
}

function Nav({ onStart }: { onStart: () => void }) {
  return (
    <nav style={styles.nav}>
      <div style={styles.brandRow}>
        <div style={styles.brandDot} />
        <span style={styles.brand}>cooper</span>
      </div>
      <button onClick={onStart} style={styles.navCta}>
        Start free <ArrowRight size={14} />
      </button>
    </nav>
  );
}

function Hero({ onStart }: { onStart: () => void }) {
  return (
    <header style={styles.hero}>
      <div style={styles.heroKicker}>
        <span style={styles.kickerDot} />
        <span>For people who'd rather talk than type</span>
      </div>
      <h1 style={styles.h1}>
        The AI chief of staff that
        <br />
        <span style={styles.h1Accent}>actually moves you forward.</span>
      </h1>
      <p style={styles.lede}>
        Cooper plans your day with you in two minutes, keeps you focused on
        what matters, and closes loops at night. Voice-first. Opinionated.
        Anti-hustle.
      </p>
      <div style={styles.heroCtas}>
        <button onClick={onStart} style={styles.primaryCta}>
          <Mic size={16} /> Talk to Cooper <ArrowRight size={16} />
        </button>
        <a
          href="#loop"
          style={styles.secondaryCta}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById('loop')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          See the loop
        </a>
      </div>
      <div style={styles.heroProof}>
        <Proof>Voice-first</Proof>
        <Proof>Writes to your goals</Proof>
        <Proof>No hustle-bro vibes</Proof>
      </div>
    </header>
  );
}

function Section({
  title, sub, children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  const id = title.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
  return (
    <section id={id} style={styles.section}>
      <div style={styles.sectionInner}>
        <h2 style={styles.h2}>{title}</h2>
        <p style={styles.sub}>{sub}</p>
        {children}
      </div>
    </section>
  );
}

function Loop() {
  const steps = [
    {
      icon: <Sun size={18} color="#7c3aed" />,
      kicker: 'MORNING · 2 MIN',
      title: 'Brief',
      body: "Cooper reads back your goals, calendar, and unfinished work. You agree on the top-3 you'll actually do today.",
    },
    {
      icon: <Flame size={18} color="#dc2626" />,
      kicker: 'DURING THE DAY',
      title: 'Focus',
      body: 'Pick a task, start a focus session. Cooper keeps the noise out. Mark done by voice.',
    },
    {
      icon: <Moon size={18} color="#b45309" />,
      kicker: 'EVENING · 2 MIN',
      title: 'Review',
      body: "What shipped, what slipped, what's blocking. Cooper turns the day into a one-line summary and sets up tomorrow.",
    },
    {
      icon: <Target size={18} color="#059669" />,
      kicker: 'WEEKLY',
      title: 'Align',
      body: "Cooper checks daily work against quarterly goals. If you've drifted, you'll hear about it.",
    },
  ];
  return (
    <div style={styles.loopGrid}>
      {steps.map((s, i) => (
        <div key={i} style={styles.loopCard}>
          <div style={styles.loopIcon}>{s.icon}</div>
          <div style={styles.loopKicker}>{s.kicker}</div>
          <div style={styles.loopTitle}>{s.title}</div>
          <div style={styles.loopBody}>{s.body}</div>
        </div>
      ))}
    </div>
  );
}

function Why() {
  const items = [
    {
      title: 'Voice-first, not voice-bolted-on',
      body: "Realtime end-of-turn STT. You talk like you'd talk to a person — not push-to-talk like a walkie-talkie.",
    },
    {
      title: 'An agent that acts',
      body: "Most AI tools are read-only chatbots. Cooper writes to your goals and tasks directly. You talk; the plan changes.",
    },
    {
      title: 'Proactive, not passive',
      body: "Cooper nudges at the right moments — start of workday, before a deadline, when something's been parked too long.",
    },
    {
      title: 'Opinionated coach',
      body: 'Cooper has a soul: signal vs. noise, anti-hustle, top-3 doctrine. ChatGPT will agree with anything you say. Cooper will push back.',
    },
  ];
  return (
    <div style={styles.whyGrid}>
      {items.map((it, i) => (
        <div key={i} style={styles.whyCard}>
          <div style={styles.whyTitle}>{it.title}</div>
          <div style={styles.whyBody}>{it.body}</div>
        </div>
      ))}
    </div>
  );
}

function ICP() {
  const yes = [
    'Indie founders shipping a product alone',
    'Freelancers / consultants juggling clients',
    'Designers and engineers with side projects',
    'Anyone with great ideas and scattered execution',
  ];
  const no = [
    'Teams that need shared workspaces (not yet)',
    'Calendar / scheduling assistants (use a real one)',
    'Habit-tracking hobbyists (try Streaks)',
    'Enterprise compliance / SOC 2 buyers',
  ];
  return (
    <div style={styles.icpGrid}>
      <div style={{ ...styles.icpCol, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
        <div style={styles.icpHead}>Built for</div>
        <ul style={styles.icpList}>
          {yes.map((y) => (
            <li key={y} style={styles.icpItem}>
              <Check size={14} color="#059669" />
              <span>{y}</span>
            </li>
          ))}
        </ul>
      </div>
      <div style={{ ...styles.icpCol, background: '#fafafa', borderColor: '#e5e7eb' }}>
        <div style={styles.icpHead}>Not (yet)</div>
        <ul style={styles.icpList}>
          {no.map((n) => (
            <li key={n} style={{ ...styles.icpItem, color: '#6b7280' }}>
              <span style={styles.icpDot}>·</span>
              <span>{n}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Pricing({ onStart }: { onStart: () => void }) {
  return (
    <div style={styles.pricingWrap}>
      <div style={styles.pricingCard}>
        <div style={styles.pricingTier}>Cooper Pro</div>
        <div style={styles.pricingPriceRow}>
          <span style={styles.pricingDollar}>$</span>
          <span style={styles.pricingAmount}>19</span>
          <span style={styles.pricingPer}>/month</span>
        </div>
        <div style={styles.pricingNote}>7-day free trial. Cancel anytime.</div>
        <ul style={styles.pricingList}>
          {[
            'Unlimited voice + text with Cooper',
            'Morning Brief & Evening Review',
            'Focus sessions tied to tasks',
            'Strategy map (quarterly goals)',
            'Proactive nudges (coming)',
            'Full conversation history',
          ].map((f) => (
            <li key={f} style={styles.pricingItem}>
              <Check size={14} color="#059669" /> <span>{f}</span>
            </li>
          ))}
        </ul>
        <button onClick={onStart} style={styles.pricingCta}>
          Start your trial <ArrowRight size={14} />
        </button>
        <div style={styles.pricingSmall}>
          Yearly: $180 (one month free). No teams plan, on purpose.
        </div>
      </div>
    </div>
  );
}

function FAQ() {
  const items = [
    {
      q: 'Is this just ChatGPT with extra steps?',
      a: 'ChatGPT is a generalist that forgets you between sessions. Cooper has a persistent memory of your goals, tasks, and reflections, an opinionated coaching style, and tools that actually edit your plan. It also shows up before you ask — at the start of your workday, near the end, when something has been parked too long.',
    },
    {
      q: 'Why voice?',
      a: "Typing into Notion is where ideas go to die. Voice is 3x faster, and it lowers the planning friction that's blocking you. You can still type — Cooper works fine either way.",
    },
    {
      q: 'What about my data?',
      a: 'Your goals, tasks, and conversations are stored on our backend. We use them to coach you, not to train models. Export and delete on request. Multi-tenant auth is rolling out soon.',
    },
    {
      q: 'Does it integrate with my calendar / Notion / Linear?',
      a: 'Not yet. We are starting narrow on the loop because too many integrations turn the product into a swiss army knife. Calendar (Google) is next.',
    },
    {
      q: "I tried Sunsama / Motion / Reclaim — why is this different?",
      a: "Those are calendar-first scheduling tools. Cooper is a voice-first coach. The job is different: less 'fit work into my day', more 'figure out what to actually do today and stop drifting.'",
    },
  ];
  return (
    <div style={styles.faqList}>
      {items.map((it, i) => (
        <details key={i} style={styles.faqItem}>
          <summary style={styles.faqQ}>{it.q}</summary>
          <p style={styles.faqA}>{it.a}</p>
        </details>
      ))}
    </div>
  );
}

function FinalCTA({ onStart }: { onStart: () => void }) {
  return (
    <section style={styles.finalCta}>
      <div style={styles.sectionInner}>
        <h2 style={styles.h2Center}>Two minutes. One loop. Done with drift.</h2>
        <p style={{ ...styles.sub, textAlign: 'center', maxWidth: 520, margin: '0 auto 24px' }}>
          You don't need another todo app. You need someone to do the planning
          with you. That's Cooper.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button onClick={onStart} style={styles.primaryCta}>
            <Mic size={16} /> Talk to Cooper <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={styles.footer}>
      <span>© Cooper</span>
      <span style={{ flex: 1 }} />
      <a
        href="https://github.com/naveenvasou/nachos"
        target="_blank"
        rel="noreferrer"
        style={styles.footerLink}
      >
        Open source
      </a>
    </footer>
  );
}

function Proof({ children }: { children: React.ReactNode }) {
  return <span style={styles.proof}>{children}</span>;
}

const styles: Record<string, React.CSSProperties> = {
  root: { background: '#fafafa', minHeight: '100vh' },
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 24px', position: 'sticky', top: 0, zIndex: 10,
    background: 'rgba(250,250,250,0.85)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    borderBottom: '1px solid #f0f0f0',
  },
  brandRow: { display: 'flex', alignItems: 'center', gap: 8 },
  brandDot: { width: 10, height: 10, borderRadius: 5, background: '#8B5CF6' },
  brand: { fontWeight: 700, fontSize: 16, letterSpacing: -0.3 },
  navCta: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 999,
    background: '#000', color: '#fff', fontSize: 13, fontWeight: 600,
  },

  hero: { padding: '48px 24px 56px' },
  heroKicker: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 999,
    background: '#fff', border: '1px solid #f0f0f0',
    fontSize: 12, color: '#4b5563', fontWeight: 600, marginBottom: 18,
  },
  kickerDot: { width: 6, height: 6, borderRadius: 3, background: '#8B5CF6' },
  h1: {
    margin: '0 0 16px', fontSize: 42, lineHeight: 1.05,
    fontWeight: 800, letterSpacing: -1,
  },
  h1Accent: { color: '#8B5CF6' },
  lede: {
    margin: '0 0 24px', fontSize: 17, lineHeight: 1.5,
    color: '#4b5563', maxWidth: 480,
  },
  heroCtas: { display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  primaryCta: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '14px 22px', borderRadius: 999,
    background: '#000', color: '#fff', fontSize: 15, fontWeight: 600,
    boxShadow: '0 8px 22px rgba(0,0,0,0.18)',
  },
  secondaryCta: {
    display: 'inline-flex', alignItems: 'center',
    padding: '14px 22px', borderRadius: 999,
    background: '#fff', color: '#1a1a1a', fontSize: 15, fontWeight: 600,
    border: '1px solid #e5e7eb',
  },
  heroProof: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  proof: {
    padding: '4px 10px', borderRadius: 999,
    background: '#fff', border: '1px solid #f0f0f0',
    fontSize: 12, color: '#4b5563', fontWeight: 600,
  },

  section: { padding: '32px 24px' },
  sectionInner: { maxWidth: 720, margin: '0 auto' },
  h2: { fontSize: 28, fontWeight: 800, letterSpacing: -0.5, margin: '0 0 8px' },
  h2Center: {
    fontSize: 30, fontWeight: 800, letterSpacing: -0.5,
    margin: '0 0 12px', textAlign: 'center',
  },
  sub: { fontSize: 15, color: '#4b5563', margin: '0 0 20px', lineHeight: 1.5 },

  loopGrid: { display: 'grid', gap: 12 },
  loopCard: {
    background: '#fff', border: '1px solid #f0f0f0', borderRadius: 18,
    padding: 18,
  },
  loopIcon: {
    width: 36, height: 36, borderRadius: 18, background: '#fafafa',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  loopKicker: {
    fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
    color: '#6b7280', marginBottom: 4,
  },
  loopTitle: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  loopBody: { fontSize: 14, color: '#4b5563', lineHeight: 1.5 },

  whyGrid: { display: 'grid', gap: 12 },
  whyCard: {
    background: '#fff', border: '1px solid #f0f0f0', borderRadius: 18,
    padding: 18,
  },
  whyTitle: { fontSize: 16, fontWeight: 700, marginBottom: 6 },
  whyBody: { fontSize: 14, color: '#4b5563', lineHeight: 1.5 },

  icpGrid: { display: 'grid', gap: 12 },
  icpCol: {
    borderRadius: 18, padding: 18, border: '1px solid',
  },
  icpHead: {
    fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
    textTransform: 'uppercase' as const, marginBottom: 12,
    color: '#374151',
  },
  icpList: { listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 },
  icpItem: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 14, color: '#1a1a1a', fontWeight: 500,
  },
  icpDot: { color: '#9ca3af', width: 14, textAlign: 'center' },

  pricingWrap: { display: 'flex', justifyContent: 'center' },
  pricingCard: {
    background: '#fff', border: '1px solid #f0f0f0', borderRadius: 24,
    padding: 28, width: '100%', maxWidth: 360,
    boxShadow: '0 4px 28px rgba(0,0,0,0.04)',
  },
  pricingTier: {
    fontSize: 12, fontWeight: 700, letterSpacing: 0.6,
    color: '#7c3aed', textTransform: 'uppercase' as const, marginBottom: 8,
  },
  pricingPriceRow: { display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 },
  pricingDollar: { fontSize: 20, fontWeight: 700, color: '#111827' },
  pricingAmount: { fontSize: 56, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1 },
  pricingPer: { fontSize: 14, color: '#6b7280', fontWeight: 500 },
  pricingNote: { fontSize: 13, color: '#6b7280', marginBottom: 18 },
  pricingList: { listStyle: 'none', padding: 0, margin: '0 0 18px', display: 'grid', gap: 8 },
  pricingItem: {
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#1a1a1a',
  },
  pricingCta: {
    width: '100%', padding: '14px 20px', borderRadius: 14,
    background: '#000', color: '#fff', fontSize: 14, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  pricingSmall: {
    fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 12,
    lineHeight: 1.5,
  },

  faqList: { display: 'flex', flexDirection: 'column', gap: 8 },
  faqItem: {
    background: '#fff', border: '1px solid #f0f0f0', borderRadius: 14,
    padding: '14px 16px',
  },
  faqQ: {
    fontSize: 15, fontWeight: 600, color: '#1a1a1a',
    cursor: 'pointer', listStyle: 'none',
  },
  faqA: { fontSize: 14, color: '#4b5563', lineHeight: 1.55, margin: '10px 0 0' },

  finalCta: { padding: '40px 24px', background: '#fff' },
  footer: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '20px 24px', borderTop: '1px solid #f0f0f0',
    fontSize: 12, color: '#6b7280',
  },
  footerLink: { color: '#6b7280', textDecoration: 'none', fontWeight: 600 },
};
