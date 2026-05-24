import React, { useState, useEffect } from 'react';
import { LandingFooter } from '../components/layout/LandingFooter';
import { apiUrl } from '../lib/api';

export function RecruiterPortal({ onOpenLegal }) {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl('/published-sessions'))
      .then(res => res.json())
      .then(data => {
        setSessions(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Recruiter Portal Error:", err);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) return (
    <div className="auth-page-container">
      <div className="mesh-glow-sphere sphere-1" />
      <span className="safety-badge-tiny" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', padding: '12px 24px' }}>
        SYNCHRONIZING TALENT DATA......
      </span>
    </div>
  );

  return (
    <div className="auth-page-container">
      <div className="auth-mesh-overlay" style={{ position: 'fixed', zIndex: 0 }} />
      <div className="mesh-glow-sphere sphere-1" style={{ width: '600px', height: '600px', top: '-10%', left: '20%', position: 'fixed' }} />

      <div style={{ flex: 1, padding: '60px 40px', position: 'relative', zIndex: 10 }}>

        <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
          <div style={{ marginBottom: '60px' }}>
            <h1 className="brand-text-gradient" style={{ fontSize: '42px', margin: 0 }}>
              Talent Dashboard<span className="brand-dot-end">.</span>
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '16px', marginTop: '12px', fontWeight: 500 }}>
              Displaying candidate-approved sessions verified by Monica AI.
            </p>
          </div>

          <div className="glass-panel-dark" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(10px)' }}>
                  <th style={{ padding: '24px 20px', fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Candidate Profile</th>
                  <th style={{ padding: '24px 20px', fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Context</th>
                  <th style={{ padding: '24px 20px', fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>AI Rigor Score</th>
                  <th style={{ padding: '24px 20px', fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Outcome</th>
                  <th style={{ padding: '24px 20px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.05)' }}></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, idx) => (
                  <tr key={s.id} style={{
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    transition: 'background 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'default'
                  }}
                    className="dashboard-row-hover"
                  >
                    <td style={{ padding: '28px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '16px', letterSpacing: '-0.01em' }}>{s.role}</div>
                      <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '6px', fontFamily: 'monospace' }}>ID: {s.id.slice(-8).toUpperCase()}</div>
                    </td>
                    <td style={{ padding: '28px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ color: 'rgba(255,255,255,0.8)', opacity: 0.9, fontSize: '14px', fontWeight: 500 }}>{s.company || "General Industry"}</div>
                      <div style={{ color: 'var(--accent)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, marginTop: '6px', letterSpacing: '0.1em' }}>{s.mode.replace('_', ' ')}</div>
                    </td>
                    <td style={{ padding: '28px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '12px',
                          background: s.score >= 80 ? 'rgba(130, 179, 66, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          border: `1px solid ${s.score >= 80 ? 'rgba(130, 179, 66, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '14px', fontWeight: 900,
                          color: s.score >= 80 ? 'var(--accent)' : '#ef4444'
                        }}>
                          {s.score}
                        </div>
                        <div style={{ height: '4px', width: '60px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${s.score}%`, background: s.score >= 80 ? 'var(--accent)' : '#ef4444' }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '28px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{
                        padding: '6px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 800,
                        background: s.score >= 80 ? 'rgba(130, 179, 66, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: s.score >= 80 ? 'var(--accent)' : '#ef4444',
                        border: `1px solid ${s.score >= 80 ? 'rgba(130, 179, 66, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                        letterSpacing: '0.05em'
                      }}>
                        {s.score >= 80 ? "EXCELLENT / READY" : "POTENTIAL / NEARLY READY"}
                      </span>
                    </td>
                    <td style={{ padding: '28px 20px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <button
                        onClick={() => window.location.href = `/report?room=${s.id}`}
                        className="pill-button"
                        style={{
                          padding: '10px 20px', fontSize: '13px', fontWeight: 700,
                          border: 'none', cursor: 'pointer', borderRadius: '999px',
                          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#ffffff',
                          margin: 0, transition: 'all 0.2s',
                          boxShadow: '0 4px 12px rgba(255,255,255,0.02)'
                        }}
                      >
                        Audit Session
                      </button>
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ padding: '80px', textAlign: 'center' }}>
                      <div style={{ fontSize: '32px', marginBottom: '16px' }}>📂</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', fontSize: '15px' }}>
                        No published talent profiles currently synchronized.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Monica Presence Card Restored */}
      <div className="monica-presence-card" style={{
        position: 'fixed',
        bottom: '40px',
        left: '40px',
        zIndex: 9999
      }}>
        <img
          src="/monica_executive_portrait.png"
          alt="Monica Portrait"
          className="presence-avatar"
          loading="lazy"
          width="40"
          height="40"
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>Monica is Online</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className="presence-status-dot"></div>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>Ready to interview</span>
          </div>
        </div>
      </div>

      <LandingFooter onOpenLegal={onOpenLegal} />
    </div>
  );
}
