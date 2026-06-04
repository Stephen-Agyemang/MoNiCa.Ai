import { useState, useEffect } from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { LandingFooter } from '../components/layout/LandingFooter';
import { MonicaPresenceCard } from '../components/ui/MonicaPresenceCard';
import { Building2, ShieldCheck, Zap, CheckCircle2, ArrowRight } from 'lucide-react';

function DataMetric({ value, label, icon: Icon }) {
  return (
    <div className="settings-card metric-card" role="group" aria-label={`Metric: ${label}`}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: 'var(--accent)' }}>
        {Icon && <Icon size={24} aria-hidden="true" />}
      </div>
      <span className="metric-value">{value}</span>
      <span className="metric-label">{label}</span>
    </div>
  );
}

const CLERK_APPEARANCE = {
  layout: { socialButtonsPlacement: 'bottom', socialButtonsVariant: 'blockButton', logoPlacement: 'none' },
  variables: {
    colorPrimary: '#82b342',
    colorBackground: 'transparent',
    colorInputBackground: 'rgba(255, 255, 255, 0.07)',
    colorInputText: '#ffffff',
    colorText: '#ffffff',
    colorTextSecondary: 'rgba(255, 255, 255, 0.55)',
    colorAlphaShade: 'white',
    borderRadius: '12px',
    fontFamily: '"Inter", sans-serif',
  },
  elements: {
    cardBox: {
      background: 'rgba(255, 255, 255, 0.04)',
      backdropFilter: 'blur(48px)',
      WebkitBackdropFilter: 'blur(48px)',
      border: '1px solid rgba(255,255,255,0.1)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 48px 96px -24px rgba(0,0,0,0.7)',
      borderRadius: '24px',
    },
    card: { background: 'transparent', boxShadow: 'none', border: 'none', padding: '36px 32px' },
    headerTitle: { display: 'none' },
    headerSubtitle: { display: 'none' },
    // Hide Clerk's built-in footer — we render our own toggle below the card
    footer: { display: 'none' },
    socialButtonsRoot: { width: '100%' },
    socialButtons: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      width: '100%',
    },
    socialButtonsBlockButton: {
      borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.18)',
      background: 'rgba(255,255,255,0.08)',
      color: '#ffffff',
      height: '44px',
      fontSize: '14px',
      transition: 'background 0.15s ease, border-color 0.15s ease',
    },
    socialButtonsBlockButtonText: { color: '#ffffff', fontWeight: '600', fontSize: '14px' },
    socialButtonsBlockButtonArrow: { color: 'rgba(255,255,255,0.5)' },
    formButtonPrimary: {
      background: 'linear-gradient(135deg, #a8e05a 0%, #82b342 100%)',
      color: '#03070a',
      fontWeight: '800',
      borderRadius: '10px',
      letterSpacing: '0.02em',
      boxShadow: '0 4px 24px rgba(130,179,66,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    },
    formFieldInput: {
      borderRadius: '10px',
      border: '1.5px solid rgba(255,255,255,0.12)',
      background: 'rgba(255,255,255,0.06)',
      color: '#ffffff',
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    },
    formFieldLabel: { color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
    dividerLine: { background: 'rgba(255,255,255,0.1)' },
    dividerText: { color: 'rgba(255,255,255,0.45)' },
    identityPreviewText: { color: '#ffffff' },
    identityPreviewEditButtonIcon: { color: 'rgba(255,255,255,0.6)' },
    formResendCodeLink: { color: '#82b342' },
    otpCodeFieldInput: {
      border: '1.5px solid rgba(255,255,255,0.15)',
      background: 'rgba(255,255,255,0.07)',
      color: '#ffffff',
      borderRadius: '10px',
    },
  },
};

export function AuthPage({ onOpenLegal }) {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // '#signup' is our toggle hash; '#/sign-up*' are Clerk's internal multi-step sub-paths
  const isSignUp = hash === '#signup' || hash.startsWith('#/sign-up');

  return (
    <>
    <MonicaPresenceCard />
    <div className="auth-page-container">
      <div className="auth-mesh-overlay" style={{ overflow: 'hidden' }}>
        <div className="mesh-glow-sphere sphere-1" />
        <div className="mesh-glow-sphere sphere-2" />
      </div>

      <div className="auth-centered-wrapper" style={{ padding: '40px 24px' }}>

        <div style={{ textAlign: 'center', marginBottom: '24px', position: 'relative', zIndex: 10 }}>
          <h1 id="hero-section" className="brand-text-gradient" style={{ fontSize: '72px', margin: 0 }}>
            Mon<span className="brand-i-container">i<span className="brand-i-dot-highlight"></span></span>ca<span className="brand-dot-end">.</span>
          </h1>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginTop: '12px', fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
            AI Interview Coach
          </p>
        </div>

        {/*
          Only the active component is mounted. With Clerk v5, re-initialization is
          cached at the ClerkProvider level so the switch is fast. Conditional mounting
          also prevents the hidden <SignIn> from seeing Clerk's #/sign-up hash and
          redirecting to the Account Portal.
        */}
        <div className="fancy-auth-wrapper">
          {isSignUp ? (
            <SignUp routing="hash" appearance={CLERK_APPEARANCE} />
          ) : (
            <SignIn routing="hash" appearance={CLERK_APPEARANCE} />
          )}
          {/* Custom footer toggle — replaces Clerk's built-in footer links */}
          <div style={{ marginTop: '16px', textAlign: 'center', padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            {isSignUp ? (
              <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.55)' }}>
                Already have an account?{' '}
                <a
                  href="/"
                  onClick={e => { e.preventDefault(); window.location.hash = ''; }}
                  style={{ color: '#82b342', fontWeight: 700, textDecoration: 'none' }}
                >
                  Sign in
                </a>
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.55)' }}>
                Don&apos;t have an account?{' '}
                <a
                  href="/#signup"
                  onClick={e => { e.preventDefault(); window.location.hash = '#signup'; }}
                  style={{ color: '#82b342', fontWeight: 700, textDecoration: 'none' }}
                >
                  Sign up
                </a>
              </p>
            )}
          </div>
        </div>

        <div style={{ marginTop: '32px', textAlign: 'center', position: 'relative', zIndex: 10 }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '16px', fontWeight: 500 }}>— or —</p>
          <a
            href="/guest-practice"
            className="settings-card"
            style={{
              display: 'inline-block',
              padding: '14px 32px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.05em',
              textDecoration: 'none',
              borderRadius: '20px',
              transition: 'background 0.2s, transform 0.2s',
            }}
          >
            Quick Practice <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500 }} aria-hidden="true">(No Account Needed)</span>
          </a>
        </div>
      </div>

      {/* Landing Extension */}
      <section className="landing-section">
        <div style={{ textAlign: 'center', marginBottom: '80px' }}>
          <h2 className="brand-text-gradient" style={{ fontSize: '42px', margin: '0 0 16px 0' }}>The Monica Standard.</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '18px', maxWidth: '600px', margin: '0 auto', fontWeight: 500, lineHeight: 1.6 }}>
            Unrivaled performance metrics verified by over 100,000+ professional-level interview simulations.
          </p>
        </div>
        <div className="metric-grid">
          <DataMetric value="0.4ms" label="Latency Protocol" icon={Zap} />
          <DataMetric value="99.7%" label="Clarity Score" icon={CheckCircle2} />
          <DataMetric value="24/7" label="Monica Availability" icon={Building2} />
          <DataMetric value="AES-256" label="Privacy Floor" icon={ShieldCheck} />
        </div>
      </section>

      <section className="landing-section" style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }}>
          <div>
            <span className="safety-badge-tiny" style={{ marginBottom: '24px', background: 'rgba(130,179,66,0.15)', color: 'var(--accent)', border: '1px solid rgba(130,179,66,0.3)', display: 'inline-block' }}>Strategic Roadmap</span>
            <h3 style={{ fontSize: '36px', fontWeight: 800, margin: '16px 0 24px', color: '#ffffff' }}>How Monica Crafts Your Success.</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {[
                { title: 'Behavioral Blueprint', desc: 'AI maps your personality against leadership criteria.' },
                { title: 'Technical Stress Test', desc: 'Live coding and problem solving under realistic pressure.' },
                { title: 'Boutique Feedback', desc: 'Granular analysis of tone, pacing, and technical precision.' },
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-subtle)', border: '1px solid rgba(130,179,66,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 900, color: 'var(--accent)', flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div>
                    <h5 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>{step.title}</h5>
                    <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="settings-card glass-panel-dark" style={{ padding: '40px', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(to right, transparent, var(--accent), transparent)', opacity: 0.8 }} />
            <pre style={{ margin: 0, color: 'rgba(255,255,255,0.85)', fontSize: '13px', fontWeight: 600, fontFamily: 'monospace', lineHeight: 1.6 }}>
              {`// System Initialization v2.4.0\n// Loading Core Analysis Module...\n[SUCCESS] Audio Mapping Active\n[SUCCESS] Logic Engine Calibrated\n[SUCCESS] Context Filtering Verified\n// Dashboard online.`}
            </pre>
          </div>
        </div>
      </section>

      <section className="landing-section" style={{ textAlign: 'center' }}>
        <h3 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '20px' }}>Ready to Elevate Your Practice?</h3>
        <a
          href="/guest-practice"
          className="pill-button pill-button-primary"
          style={{ padding: '20px 60px', fontSize: '18px', display: 'inline-flex', alignItems: 'center', gap: '12px' }}
          aria-label="Begin guest practice session"
        >
          Begin Experience <ArrowRight size={20} aria-hidden="true" />
        </a>
      </section>

      <LandingFooter onOpenLegal={onOpenLegal} />
    </div>
    </>
  );
}