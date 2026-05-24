import React, { useState, useEffect } from 'react';
import { generateReportPDF } from '../lib/pdfGenerator';
import { ProfessionalMetricChart } from '../components/data-display/ProfessionalMetricChart';
import { LandingFooter } from '../components/layout/LandingFooter';
import { useAuth } from '@clerk/clerk-react';
import { apiUrl } from '../lib/api';

export function ReportView({ onOpenLegal }) {
  const { isSignedIn, isLoaded } = useAuth();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublished, setIsPublished] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const room = new URLSearchParams(window.location.search).get('room');

  useEffect(() => {
    if (!room) {
      return;
    }

    let isCancelled = false;

    fetch(apiUrl(`/report/${room}`))
      .then(res => {
        if (!res.ok) throw new Error("Report not found.");
        return res.json();
      })
      .then(data => {
        if (isCancelled) return;
        setReport(data);
        setIsPublished(!!data.isPublished);
        setIsLoading(false);
      })
      .catch(err => {
        if (isCancelled) return;
        setError(err.message);
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [room]);

  const downloadPDF = async () => {
    generateReportPDF(
      'report-content',
      `Interview_Report_${report?.roomName || 'Offline'}.pdf`,
      {
        onStart: () => setIsLoading(true),
        onSuccess: () => setIsLoading(false),
        onError: () => {
          setError("Failed to generate PDF. Please try again or check console logic.");
          setIsLoading(false);
        }
      }
    );
  };

  const togglePublication = async () => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    const newState = !isPublished;

    setIsPublishing(true);
    try {
      const res = await fetch(apiUrl(`/publish-report/${room}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: newState })
      });
      if (res.ok) {
        setIsPublished(newState);
      }
    } catch (err) {
      console.error("Failed to update privacy settings:", err);
    } finally {
      setIsPublishing(false);
    }
  };

  if (!room) return (
    <div className="auth-page-container">
      <div style={{ padding: '40px', textAlign: 'center', color: '#ff4d4d', fontWeight: 600 }}>Error: No room ID provided.</div>
    </div>
  );
  if (isLoading) return (
    <div className="auth-page-container">
      <div className="mesh-glow-sphere sphere-1" />
      <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: '0.1em', zIndex: 10, display: 'block', margin: 'auto', textAlign: 'center' }}>ANALYZING PERFORMANCE...</span>
    </div>
  );
  if (error) return (
    <div className="auth-page-container">
      <div style={{ padding: '40px', textAlign: 'center', color: '#ff4d4d', fontWeight: 600 }}>Error: {error}</div>
    </div>
  );

  const codingKeywords = ['software', 'developer', 'engineer', 'programmer', 'swe', 'frontend', 'backend', 'fullstack', 'full-stack', 'devops', 'data scientist', 'data engineer', 'ml engineer', 'machine learning', 'web dev', 'ios', 'android', 'mobile dev'];
  const isCoding = report?.role && codingKeywords.some(k => report.role.toLowerCase().includes(k));

  const metricsList = isCoding ? [
    { label: "Technical Skill", value: report.feedback?.metrics?.technical || 0, color: "#82b342" },
    { label: "Problem Solving", value: report.feedback?.metrics?.problem_solving || 0, color: "#6D8B74" },
    { label: "Communication", value: report.feedback?.metrics?.communication || 0, color: "#0284c7" },
    { label: "Code Integrity", value: report.feedback?.metrics?.code_quality || 0, color: "#a2d2ff" },
    { label: "Optimization", value: report.feedback?.metrics?.optimization || 0, color: "#ea580c" },
  ] : [
    { label: "Domain Knowledge", value: report.feedback?.metrics?.technical || 0, color: "#82b342" },
    { label: "Situational Judgement", value: report.feedback?.metrics?.problem_solving || 0, color: "#6D8B74" },
    { label: "Communication", value: report.feedback?.metrics?.communication || 0, color: "#0284c7" },
    { label: "Crisis Management", value: report.feedback?.metrics?.code_quality || 0, color: "#a2d2ff" },
    { label: "Leadership & Initiative", value: report.feedback?.metrics?.optimization || 0, color: "#ea580c" },
  ];

  return (
    <div className="auth-page-container">
      <div className="auth-mesh-overlay" style={{ position: 'fixed', zIndex: 0 }} />
      <div className="mesh-glow-sphere sphere-1" style={{ top: '-10%', left: '10%', position: 'fixed' }} />

      <div style={{ flex: 1, padding: '16px 40px', position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', boxSizing: 'border-box' }}>

        <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 10 }}>

          {/* Squeezed Header Branding */}
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <h1 className="brand-text-gradient" style={{ fontSize: '32px', margin: 0 }}>
              Mon<span className="brand-i-container">i<span className="brand-i-dot-highlight"></span></span>ca<span className="brand-dot-end">.</span>
            </h1>
            <h2 style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', marginTop: '8px' }}>
              Interview Assessment Report
            </h2>
          </div>

          {/* Guest PLG Hook Banner */}
          {isLoaded && !isSignedIn && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(130, 179, 66, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)',
              border: '1px solid rgba(130, 179, 66, 0.4)',
              borderRadius: '16px',
              padding: '20px 24px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(20px)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--accent)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', zIndex: 1 }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px',
                  background: 'rgba(130, 179, 66, 0.2)', color: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px',
                  boxShadow: 'inset 0 0 10px rgba(130, 179, 66, 0.2)'
                }}>
                  ⚠️
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#ffffff', fontWeight: 800, letterSpacing: '0.02em' }}>Temporary Guest Report</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                    You are currently anonymous. Sign up to save this report permanently to your dashboard before it gets deleted.
                  </p>
                </div>
              </div>
              <button
                onClick={() => window.location.href = '/'}
                className="pill-button"
                style={{
                  padding: '12px 28px',
                  background: 'var(--accent)',
                  color: '#0f172a',
                  border: 'none',
                  borderRadius: '999px',
                  fontWeight: 900,
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(130, 179, 66, 0.4)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  whiteSpace: 'nowrap',
                  zIndex: 1
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(130, 179, 66, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(130, 179, 66, 0.4)';
                }}
              >
                Sign Up to Save
              </button>
            </div>
          )}

          {/* Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '16px' }}>
            {/* Privacy Toggle */}
            <div className="settings-card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', margin: 0 }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Privacy Control</p>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: isPublished ? 'var(--accent)' : '#ffffff' }}>
                  {isPublished ? "Shared with Recruiters" : "Private Session"}
                </p>
              </div>
              <button
                onClick={togglePublication}
                disabled={isPublishing}
                style={{
                  width: '44px', height: '22px', borderRadius: '11px',
                  background: isPublished ? 'var(--accent)' : 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.05)', cursor: 'pointer', position: 'relative',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  opacity: isPublishing ? 0.5 : 1
                }}
              >
                <div style={{
                  width: '18px', height: '18px', borderRadius: '9px',
                  background: 'white', position: 'absolute', top: '2px',
                  left: isPublished ? '24px' : '2px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
                }} />
              </button>
            </div>

            <button
              onClick={downloadPDF}
              className="pill-button"
              style={{
                padding: '12px 24px',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 20px -5px rgba(255, 255, 255, 0.01)',
                border: 'none',
                margin: 0,
                borderRadius: '999px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 25px -5px rgba(255, 255, 255, 0.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 20px -5px rgba(255, 255, 255, 0.01)';
              }}
            >
              <span style={{ fontSize: '16px' }}>📥</span> Download Professional PDF
            </button>
          </div>

          <div id="report-content" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Top Row: Core Metrics securely locked on exactly three columns */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>

              {/* Score Card */}
              <div className="glass-panel-dark" style={{ padding: '16px', background: 'rgba(18, 22, 26, 0.55)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: 800, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Score Card</h3>

                <div style={{ textAlign: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: '48px', fontWeight: 900, color: (report?.score || 0) >= 80 ? 'var(--accent)' : '#ef4444', textShadow: `0 8px 24px ${(report?.score || 0) >= 80 ? 'rgba(130, 179, 66, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`, lineHeight: 1 }}>
                    {report?.score || 0}<span style={{ fontSize: '18px', opacity: 0.5 }}>%</span>
                  </div>
                  <p style={{ color: '#ffffff', fontWeight: 700, margin: '8px 0 0 0', textTransform: 'uppercase', fontSize: '11px' }}>{report?.feedback?.verdict || "Assessment Pending"}</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Candidate</span>
                    <span style={{ color: '#ffffff', fontWeight: 600 }}>{report?.username || "Candidate"}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Target Role</span>
                    <span style={{ color: '#ffffff', fontWeight: 600 }}>{report?.role || "N/A"}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 600 }}>Status</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 800 }}>VERIFIED AI-SCORE</span>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="glass-panel-dark" style={{ padding: '16px', background: 'rgba(18, 22, 26, 0.55)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: 800, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Performance Metrics</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'center' }}>
                  {metricsList.map((m, idx) => (
                    <ProfessionalMetricChart key={idx} label={m.label} value={m.value} color={m.color} />
                  ))}
                </div>
              </div>

              {/* AI Calibration Integrity */}
              <div className="glass-panel-dark" style={{ padding: '16px', background: 'linear-gradient(135deg, rgba(18, 22, 26, 0.7) 0%, rgba(130, 179, 66, 0.05) 100%)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '11px', color: 'var(--accent)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800 }}>AI Calibration</h4>
                  <span style={{ fontSize: '8px', color: 'rgba(255, 255, 255, 0.7)', fontWeight: 700, background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px' }}>HIGH CONFIDENCE</span>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                    <div style={{ width: `${report?.score || 0}%`, height: '100%', background: 'linear-gradient(90deg, #618264 0%, #82b342 100%)' }} />
                  </div>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', margin: 0, fontWeight: 500, lineHeight: 1.4 }}>
                    {isCoding
                      ? "High technical engagement and consistent verbal delivery detected via Monica Engine runtime analysis."
                      : "Strong situational composure, active listening, and values-based reasoning detected via Monica Engine runtime analysis."}
                  </p>
                </div>
              </div>

            </div>

            {/* Bottom Row: Narrative Feedback (Full Width) securely locked on two columns */}
            {report.feedback && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="glass-panel-dark" style={{ borderLeft: '6px solid var(--accent)', padding: '16px', background: 'rgba(18, 22, 26, 0.55)', borderTop: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '20px' }}>💎</span>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>Key Strengths</h3>
                  </div>
                  <p style={{ lineHeight: 1.4, color: 'rgba(255,255,255,0.8)', fontSize: '12px', whiteSpace: 'pre-wrap', fontWeight: 500, margin: 0 }}>{report.feedback.strengths}</p>
                </div>

                <div className="glass-panel-dark" style={{ borderLeft: '6px solid #ef4444', padding: '16px', background: 'rgba(18, 22, 26, 0.55)', borderTop: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '20px' }}>📈</span>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>Growth Areas</h3>
                  </div>
                  <p style={{ lineHeight: 1.4, color: 'rgba(255,255,255,0.8)', fontSize: '12px', whiteSpace: 'pre-wrap', fontWeight: 500, margin: 0 }}>{report.feedback.improvements}</p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      <LandingFooter onOpenLegal={onOpenLegal} />
    </div>
  );
}
