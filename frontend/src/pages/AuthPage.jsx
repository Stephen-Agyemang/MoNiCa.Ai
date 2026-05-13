import React, { useState, useEffect } from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { LandingFooter } from '../components/layout/LandingFooter';
import { Building2, ShieldCheck, Zap, CheckCircle2, ArrowRight } from 'lucide-react';

// Small metric card used only on this landing/auth page
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
  layout: { socialButtonsPlacement: 'bottom', logoPlacement: 'none' },
  variables: {
    colorPrimary: '#82b342',
    colorBackground: 'transparent',
    colorInputBackground: 'rgba(255, 255, 255, 0.05)',
    colorInputText: '#ffffff',
    colorText: '#ffffff',
    colorTextSecondary: 'rgba(255, 255, 255, 0.7)',
    colorAlphaShade: 'white',
    borderRadius: '24px',
    fontFamily: '"Inter", sans-serif',
  },
  elements: {
    cardBox: { background: 'rgba(15, 20, 25, 0.75)', backdropFilter: 'blur(30px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' },
    card: { background: 'transparent', boxShadow: 'none', border: 'none', padding: '0' },
    headerTitle: { display: 'none' },
    headerSubtitle: { display: 'none' },
    footer: { background: 'rgba(255, 255, 255, 0.02)', padding: '24px 0', borderTop: '1px solid rgba(255,255,255,0.05)' },
    socialButtonsBlockButton: { borderRadius: '999px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#ffffff' },
    socialButtonsBlockButtonText: { color: '#ffffff', fontWeight: '600' },
    formButtonPrimary: { backgroundColor: 'var(--accent)', color: '#000000', fontWeight: '800', borderRadius: '999px', boxShadow: '0 4px 15px rgba(130, 179, 66, 0.25)', transition: 'all 0.2s' },
    formFieldInput: { borderRadius: '12px', borderColor: 'rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#ffffff' },
    formFieldLabel: { color: 'rgba(255,255,255,0.9)' },
    footerActionText: { color: 'rgba(255, 255, 255, 0.9) !important' },
    footerActionLink: { color: 'var(--accent) !important', fontWeight: '700' },
    dividerLine: { background: 'rgba(255, 255, 255, 0.1) !important' },
    dividerText: { color: 'rgba(255, 255, 255, 0.7) !important' }
  },
};

export function AuthPage({ onOpenLegal }) {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const isSignUp = hash === '#/sign-up';

  return (
    <div className="auth-page-container">
      <div className="auth-mesh-overlay" style={{ overflow: 'hidden' }}>
        <div className="mesh-glow-sphere sphere-1" />
        <div className="mesh-glow-sphere sphere-2" />
      </div>

      <div className="auth-centered-wrapper" style={{ padding: '40px 24px' }}>
        {/* Monica Presence Card */}
        <div className="monica-presence-card">
          <img src="/monica_executive_portrait.png" alt="Monica Portrait" className="presence-avatar" loading="lazy" width="40" height="40" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>Monica is Online</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div className="presence-status-dot"></div>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Ready to interview</span>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '24px', position: 'relative', zIndex: 10 }}>
          <h1 id="hero-section" className="brand-text-gradient" style={{ fontSize: '72px', margin: 0 }}>
            Mon<span className="brand-i-container">i<span className="brand-i-dot-highlight"></span></span>ca<span className="brand-dot-end">.</span>
          </h1>
          <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.7)', marginTop: '8px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            AI Interview Coach
          </p>
        </div>

        <div className="fancy-auth-wrapper">
          {isSignUp
            ? <SignUp routing="hash" appearance={CLERK_APPEARANCE} />
            : <SignIn routing="hash" appearance={CLERK_APPEARANCE} />
          }
        </div>

        <div style={{ marginTop: '32px', textAlign: 'center', position: 'relative', zIndex: 10 }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '16px', fontWeight: 500 }}>— or —</p>
          <button
            onClick={() => window.location.href = '/guest-practice'}
            className="settings-card"
            style={{ padding: '14px 32px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#ffffff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            Quick Practice <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500 }} aria-hidden="true">(No Account Needed)</span>
          </button>
        </div>
      </div>

      {/* Landing Page Extension Sections */}
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
            <span className="safety-badge-tiny" style={{ marginBottom: '24px', background: 'rgba(130, 179, 66, 0.15)', color: 'var(--accent)', border: '1px solid rgba(130, 179, 66, 0.3)' }}>Strategic Roadmap</span>
            <h3 style={{ fontSize: '36px', fontWeight: 800, margin: '0 0 24px 0', color: '#ffffff' }}>How Monica Crafts Your Success.</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {[
                { title: 'Behavioral Blueprint', desc: 'AI maps your personality against leadership criteria.' },
                { title: 'Technical Stress Test', desc: 'Live coding and problem solving under realistic pressure.' },
                { title: 'Boutique Feedback', desc: 'Granular analysis of tone, posture, and technical precision.' },
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(130, 179, 66, 0.1)', border: '1px solid rgba(130, 179, 66, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 900, color: 'var(--accent)', flexShrink: 0 }}>
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
        <button
          type="button"
          className="pill-button pill-button-primary"
          onClick={() => window.location.href = '/guest-practice'}
          style={{ padding: '20px 60px', fontSize: '18px' }}
          aria-label="Begin guest practice session"
        >
          Begin Experience <ArrowRight size={20} style={{ marginLeft: '12px' }} />
        </button>
      </section>

      <LandingFooter onOpenLegal={onOpenLegal} />
    </div>
  );
}
