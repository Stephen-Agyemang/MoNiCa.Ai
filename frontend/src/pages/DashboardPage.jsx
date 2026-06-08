import { useState, useEffect } from 'react';
import { UserButton, useAuth } from '@clerk/clerk-react';
import { LandingFooter } from '../components/layout/LandingFooter';
import { MonicaPresenceCard } from '../components/ui/MonicaPresenceCard';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { apiUrl, authedFetch } from '../lib/api';

export function RecruiterPortal({ onOpenLegal }) {
  const { getToken } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authedFetch(apiUrl('/published-sessions'), {}, getToken)
      .then(res => res.json())
      .then(data => { setSessions(data); setIsLoading(false); })
      .catch(err => { console.error('Recruiter Portal Error:', err); setIsLoading(false); });
  }, []);

  if (isLoading) return (
    <div className="auth-page-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div className="mesh-glow-sphere sphere-1" />
      <p style={{ color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.05em', zIndex: 10 }}>
        Loading talent dashboard...
      </p>
    </div>
  );

  return (
    <>
    <MonicaPresenceCard />
    <div className="auth-page-container">
      <div className="auth-mesh-overlay" style={{ position: 'fixed', zIndex: 0 }} />
      <div className="mesh-glow-sphere sphere-1" style={{ width: '600px', height: '600px', top: '-10%', left: '20%', position: 'fixed' }} />

      <div style={{ flex: 1, padding: '60px 40px', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

          <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <h1 className="brand-text-gradient" style={{ fontSize: '42px', margin: 0 }}>
                Talent Dashboard<span className="brand-dot-end">.</span>
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '10px', fontWeight: 500 }}>
                Candidate-approved sessions verified by Monica AI.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <a href="/" className="report-back-btn">← Back to Interview</a>
              <ThemeToggle />
              <UserButton signOutFallbackRedirectUrl="/" />
            </div>
          </div>

          <div className="glass-panel-dark recruiter-table-wrap" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-light)' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left', minWidth: '680px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {['Candidate Profile', 'Context', 'AI Rigor Score', 'Outcome', ''].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        padding: '20px',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        borderBottom: '1px solid var(--border-light)',
                        textAlign: i === 4 ? 'right' : 'left',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, idx) => {
                  const pass = s.score >= 80;
                  return (
                    <tr key={s.id} className="dashboard-row-hover" style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)', cursor: 'default' }}>
                      <td style={{ padding: '24px 20px', borderBottom: '1px solid var(--border-light)' }}>
                        <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '15px' }}>{s.role}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px', fontFamily: 'monospace' }}>
                          ID: {s.id.slice(-8).toUpperCase()}
                        </div>
                      </td>
                      <td style={{ padding: '24px 20px', borderBottom: '1px solid var(--border-light)' }}>
                        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', fontWeight: 500 }}>{s.company || 'General Industry'}</div>
                        <div style={{ color: 'var(--accent)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, marginTop: '4px', letterSpacing: '0.1em' }}>
                          {s.mode.replace('_', ' ')}
                        </div>
                      </td>
                      <td style={{ padding: '24px 20px', borderBottom: '1px solid var(--border-light)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '40px', height: '40px', borderRadius: '12px',
                            background: pass ? 'var(--accent-subtle)' : 'rgba(239,68,68,0.1)',
                            border: `1px solid ${pass ? 'rgba(130,179,66,0.3)' : 'rgba(239,68,68,0.3)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '14px', fontWeight: 900,
                            color: pass ? 'var(--accent)' : '#ef4444',
                          }}>
                            {s.score}
                          </div>
                          <div style={{ height: '4px', width: '60px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(s.score, 100)}%`, background: pass ? 'var(--accent)' : '#ef4444' }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '24px 20px', borderBottom: '1px solid var(--border-light)' }}>
                        <span style={{
                          padding: '6px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 800,
                          background: pass ? 'var(--accent-subtle)' : 'rgba(239,68,68,0.1)',
                          color: pass ? 'var(--accent)' : '#ef4444',
                          border: `1px solid ${pass ? 'rgba(130,179,66,0.2)' : 'rgba(239,68,68,0.2)'}`,
                          letterSpacing: '0.05em',
                          whiteSpace: 'nowrap',
                        }}>
                          {pass ? 'EXCELLENT / READY' : 'POTENTIAL / NEARLY READY'}
                        </span>
                      </td>
                      <td style={{ padding: '24px 20px', textAlign: 'right', borderBottom: '1px solid var(--border-light)' }}>
                        <button
                          onClick={() => window.location.href = `/report?room=${s.id}`}
                          className="report-back-btn"
                        >
                          View Report
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ padding: '80px', textAlign: 'center' }}>
                      <div style={{ fontSize: '32px', marginBottom: '16px' }}>📂</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
                        No published candidate profiles found.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      <LandingFooter onOpenLegal={onOpenLegal} />
    </div>
    </>
  );
}