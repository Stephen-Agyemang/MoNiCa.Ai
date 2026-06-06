import { useState, useEffect, useRef, useCallback } from 'react';
import { generateReportPDF } from '../lib/pdfGenerator';
import { ProfessionalMetricChart } from '../components/data-display/ProfessionalMetricChart';
import { LandingFooter } from '../components/layout/LandingFooter';
import { useAuth } from '@clerk/clerk-react';
import { apiUrl, authedFetch } from '../lib/api';
import { loadSession } from '../lib/sessionStorage';

const CODING_KEYWORDS = ['software', 'developer', 'engineer', 'programmer', 'swe', 'frontend', 'backend', 'fullstack', 'full-stack', 'devops', 'data scientist', 'data engineer', 'ml engineer', 'machine learning', 'web dev', 'ios', 'android', 'mobile dev'];

function formatTimestamp(ts, startTime) {
  if (!startTime) return '';
  const secs = Math.floor((ts - startTime) / 1000);
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function TranscriptEntry({ entry, startTime, isHighlighted, onClick }) {
  const isMonica = entry.speaker === 'monica';
  const timeLabel = formatTimestamp(entry.timestamp, startTime);

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
        padding: '10px 14px',
        borderRadius: '10px',
        background: isHighlighted
          ? (isMonica ? 'rgba(130,179,66,0.12)' : 'rgba(147,197,253,0.1)')
          : 'rgba(255,255,255,0.02)',
        border: isHighlighted
          ? `1px solid ${isMonica ? 'rgba(130,179,66,0.3)' : 'rgba(147,197,253,0.2)'}`
          : '1px solid transparent',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: isMonica ? 'var(--accent)' : '#93c5fd',
        }}>
          {isMonica ? 'Monica' : 'You'}
        </span>
        {timeLabel && (
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
            {timeLabel}
          </span>
        )}
      </div>
      <p style={{
        margin: 0, fontSize: '13px',
        color: isMonica ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.9)',
        lineHeight: 1.6, fontWeight: 400,
      }}>
        {entry.text}
      </p>
    </div>
  );
}

export function ReportView({ onOpenLegal }) {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Session replay state
  const [sessionData, setSessionData] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [activeTranscriptIdx, setActiveTranscriptIdx] = useState(-1);
  const videoRef = useRef(null);

  const room = new URLSearchParams(window.location.search).get('room');

  useEffect(() => {
    if (!room) return;
    let isCancelled = false;
    fetch(apiUrl(`/report/${room}`))
      .then(res => { if (!res.ok) throw new Error('Report not found.'); return res.json(); })
      .then(data => { if (isCancelled) return; setReport(data); setIsPublished(!!data.isPublished); setIsLoading(false); })
      .catch(err => { if (isCancelled) return; setError(err.message); setIsLoading(false); });
    return () => { isCancelled = true; };
  }, [room]);

  // Load session recording + transcript from IndexedDB
  useEffect(() => {
    if (!room) return;
    loadSession(room).then(data => {
      if (!data) return;
      setSessionData(data);
      if (data.videoBlob) {
        setVideoUrl(URL.createObjectURL(data.videoBlob));
      }
    });
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  // Sync transcript highlight to video playback time
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || !sessionData?.transcript || !sessionData?.sessionStartTime) return;
    const currentMs = sessionData.sessionStartTime + videoRef.current.currentTime * 1000;
    const finalEntries = sessionData.transcript.filter(e => e.isFinal);
    let best = -1;
    for (let i = 0; i < finalEntries.length; i++) {
      if (finalEntries[i].timestamp <= currentMs) best = i;
      else break;
    }
    setActiveTranscriptIdx(best);
  }, [sessionData]);

  const seekToEntry = useCallback((entry) => {
    if (!videoRef.current || !sessionData?.sessionStartTime) return;
    const secs = (entry.timestamp - sessionData.sessionStartTime) / 1000;
    if (secs >= 0 && secs <= videoRef.current.duration) {
      videoRef.current.currentTime = secs;
      videoRef.current.play();
    }
  }, [sessionData]);

  const downloadPDF = () => {
    generateReportPDF(
      'report-content',
      `Interview_Report_${report?.roomName || 'Offline'}.pdf`,
      {
        onStart: () => setIsGeneratingPDF(true),
        onSuccess: () => setIsGeneratingPDF(false),
        onError: () => { setError('Failed to generate PDF. Please try again.'); setIsGeneratingPDF(false); },
      }
    );
  };

  const togglePublication = async () => {
    const newState = !isPublished;
    setIsPublishing(true);
    try {
      const res = await authedFetch(apiUrl(`/publish-report/${room}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: newState }),
      }, getToken);
      if (res.ok) setIsPublished(newState);
    } catch (err) {
      console.error('Failed to update privacy settings:', err);
    } finally {
      setIsPublishing(false);
    }
  };

  if (!room) return (
    <div className="auth-page-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ padding: '40px', textAlign: 'center', color: '#ff4d4d', fontWeight: 600 }}>Error: No room ID provided.</div>
    </div>
  );

  if (isLoading) return (
    <div className="auth-page-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div className="mesh-glow-sphere sphere-1" />
      <p style={{ color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.1em', zIndex: 10 }}>ANALYZING PERFORMANCE...</p>
    </div>
  );

  if (error) return (
    <div className="auth-page-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ padding: '40px', textAlign: 'center', color: '#ff4d4d', fontWeight: 600 }}>Error: {error}</div>
    </div>
  );

  const isCoding = report?.role && CODING_KEYWORDS.some(k => report.role.toLowerCase().includes(k));

  const metricsList = isCoding ? [
    { label: 'Technical Skill',  value: report.feedback?.metrics?.technical     || 0, color: '#82b342' },
    { label: 'Problem Solving',  value: report.feedback?.metrics?.problem_solving || 0, color: '#6D8B74' },
    { label: 'Communication',    value: report.feedback?.metrics?.communication  || 0, color: '#0284c7' },
    { label: 'Code Integrity',   value: report.feedback?.metrics?.code_quality   || 0, color: '#a2d2ff' },
    { label: 'Optimization',     value: report.feedback?.metrics?.optimization   || 0, color: '#ea580c' },
  ] : [
    { label: 'Domain Knowledge',        value: report.feedback?.metrics?.technical      || 0, color: '#82b342' },
    { label: 'Situational Judgement',   value: report.feedback?.metrics?.problem_solving || 0, color: '#6D8B74' },
    { label: 'Communication',           value: report.feedback?.metrics?.communication   || 0, color: '#0284c7' },
    { label: 'Crisis Management',       value: report.feedback?.metrics?.code_quality    || 0, color: '#a2d2ff' },
    { label: 'Leadership & Initiative', value: report.feedback?.metrics?.optimization    || 0, color: '#ea580c' },
  ];

  const pass = (report?.score ?? 0) >= 80;
  const finalTranscript = sessionData?.transcript?.filter(e => e.isFinal) || [];
  const hasReplay = !!videoUrl;
  const hasTranscript = finalTranscript.length > 0;

  return (
    <div className="auth-page-container">
      <div className="auth-mesh-overlay" style={{ position: 'fixed', zIndex: 0 }} />
      <div className="mesh-glow-sphere sphere-1" style={{ top: '-10%', left: '10%', position: 'fixed' }} />

      <div style={{ flex: 1, padding: '16px 40px 40px', position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>

          {/* Brand Header */}
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
              background: 'linear-gradient(135deg, var(--accent-subtle) 0%, rgba(15,23,42,0.8) 100%)',
              border: '1px solid rgba(130,179,66,0.4)',
              borderRadius: '16px',
              padding: '20px 24px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(20px)',
              position: 'relative',
              overflow: 'hidden',
              flexWrap: 'wrap',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--accent)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', zIndex: 1 }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent-subtle)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>
                  ⚠️
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#ffffff', fontWeight: 800 }}>Temporary Guest Report</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Sign up to save this report before it's deleted.</p>
                </div>
              </div>
              <button onClick={() => window.location.href = '/'} className="btn-cta" style={{ width: 'auto', padding: '12px 28px', borderRadius: '999px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, zIndex: 1 }}>
                Sign Up to Save
              </button>
            </div>
          )}

          {/* Back nav + download row */}
          <div className="report-action-bar">
            <a href="/" className="report-back-btn">← Start New Interview</a>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Privacy Toggle */}
              <div className="settings-card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', margin: 0 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Privacy Control</p>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: isPublished ? 'var(--accent)' : '#ffffff' }}>
                    {isPublished ? 'Shared with Recruiters' : 'Private Session'}
                  </p>
                </div>
                <button
                  onClick={togglePublication}
                  disabled={isPublishing}
                  aria-label={isPublished ? 'Make private' : 'Share with recruiters'}
                  style={{
                    width: '44px', height: '22px', borderRadius: '11px',
                    background: isPublished ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer', position: 'relative',
                    transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                    opacity: isPublishing ? 0.5 : 1,
                  }}
                >
                  <div style={{
                    width: '18px', height: '18px', borderRadius: '9px',
                    background: 'white', position: 'absolute', top: '2px',
                    left: isPublished ? '24px' : '2px',
                    transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                  }} />
                </button>
              </div>

              {/* Download PDF */}
              <button onClick={downloadPDF} disabled={isGeneratingPDF} className="report-back-btn" style={{ padding: '12px 20px' }}>
                <span>📥</span>
                <span>{isGeneratingPDF ? 'Generating...' : 'Download PDF'}</span>
              </button>
            </div>
          </div>

          {/* Report Content */}
          <div id="report-content" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Top Row — 3 columns */}
            <div className="report-grid-3">

              {/* Score Card */}
              <div className="glass-panel-dark" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', fontWeight: 800, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Score Card</h3>
                <div className="score-display">
                  <div className={`score-number ${pass ? 'pass' : 'fail'}`}>
                    {report?.score ?? 0}<span style={{ fontSize: '18px', opacity: 0.5 }}>%</span>
                  </div>
                  <p className="score-verdict">{report?.feedback?.verdict || 'Assessment Pending'}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="stat-row">
                    <span className="stat-label">Candidate</span>
                    <span className="stat-value">{report?.username || 'Candidate'}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Target Role</span>
                    <span className="stat-value">{report?.role || 'N/A'}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Status</span>
                    <span className="stat-value-accent">VERIFIED AI-SCORE</span>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="glass-panel-dark" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', fontWeight: 800, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Performance Metrics</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'center' }}>
                  {metricsList.map((m, idx) => (
                    <ProfessionalMetricChart key={idx} label={m.label} value={m.value} color={m.color} />
                  ))}
                </div>
              </div>

              {/* AI Calibration */}
              <div className="glass-panel-dark report-calibration-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '11px', color: 'var(--accent)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800 }}>AI Calibration</h4>
                  <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.7)', fontWeight: 700, background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px' }}>HIGH CONFIDENCE</span>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                    <div style={{ width: `${report?.score ?? 0}%`, height: '100%', background: 'linear-gradient(90deg, #618264 0%, #82b342 100%)' }} />
                  </div>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', margin: 0, fontWeight: 500, lineHeight: 1.4 }}>
                    {isCoding
                      ? 'High technical engagement and consistent verbal delivery detected via Monica Engine runtime analysis.'
                      : 'Strong situational composure, active listening, and values-based reasoning detected via Monica Engine runtime analysis.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Strengths + Growth Areas */}
            {report.feedback && (
              <div className="report-grid-2">
                <div className="glass-panel-dark" style={{ borderLeft: '6px solid var(--accent)', padding: '16px', borderTop: '1px solid var(--border-light)', borderRight: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '20px' }}>💎</span>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>Key Strengths</h3>
                  </div>
                  <p style={{ lineHeight: 1.4, color: 'rgba(255,255,255,0.8)', fontSize: '12px', whiteSpace: 'pre-wrap', fontWeight: 500, margin: 0 }}>{report.feedback.strengths}</p>
                </div>

                <div className="glass-panel-dark" style={{ borderLeft: '6px solid #ef4444', padding: '16px', borderTop: '1px solid var(--border-light)', borderRight: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '20px' }}>📈</span>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>Growth Areas</h3>
                  </div>
                  <p style={{ lineHeight: 1.4, color: 'rgba(255,255,255,0.8)', fontSize: '12px', whiteSpace: 'pre-wrap', fontWeight: 500, margin: 0 }}>{report.feedback.improvements}</p>
                </div>
              </div>
            )}

            {/* Vocal Analytics — shown if we have session data */}
            {sessionData && (
              <div className="report-grid-3">
                <div className="glass-panel-dark" style={{ padding: '16px' }}>
                  <h3 style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', fontWeight: 800, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Speaking Pace</h3>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '48px', fontWeight: 900, color: '#93c5fd', lineHeight: 1 }}>{sessionData.wpm || 0}</span>
                    <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: '6px' }}>WPM</span>
                  </div>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.5 }}>
                    {(sessionData.wpm || 0) < 100
                      ? 'Speaking pace is a bit slow — aim for 120–150 WPM for natural conversation.'
                      : (sessionData.wpm || 0) > 180
                        ? 'Speaking pace is fast — slowing down slightly improves clarity.'
                        : 'Speaking pace is in the optimal range for an interview.'}
                  </p>
                </div>

                <div className="glass-panel-dark" style={{ padding: '16px' }}>
                  <h3 style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', fontWeight: 800, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Filler Words</h3>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '48px', fontWeight: 900, color: (sessionData.totalFillers || 0) > 15 ? '#f87171' : '#4ade80', lineHeight: 1 }}>{sessionData.totalFillers || 0}</span>
                    <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: '6px' }}>total</span>
                  </div>
                  {sessionData.fillerWords && Object.keys(sessionData.fillerWords).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {Object.entries(sessionData.fillerWords)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([word, count]) => (
                          <span key={word} style={{
                            fontSize: '10px', fontWeight: 600, padding: '3px 8px',
                            borderRadius: 'var(--radius-pill)',
                            background: 'rgba(255,255,255,0.06)',
                            color: 'rgba(255,255,255,0.6)',
                          }}>
                            "{word}" ×{count}
                          </span>
                        ))}
                    </div>
                  )}
                </div>

                <div className="glass-panel-dark" style={{ padding: '16px' }}>
                  <h3 style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', fontWeight: 800, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Session Stats</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="stat-row">
                      <span className="stat-label">Total Exchanges</span>
                      <span className="stat-value">{finalTranscript.length}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Your Responses</span>
                      <span className="stat-value">{finalTranscript.filter(e => e.speaker === 'candidate').length}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Monica Questions</span>
                      <span className="stat-value">{finalTranscript.filter(e => e.speaker === 'monica').length}</span>
                    </div>
                    {hasReplay && (
                      <div className="stat-row">
                        <span className="stat-label">Recording</span>
                        <span className="stat-value-accent">SAVED</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Session Replay + Transcript */}
            {(hasReplay || hasTranscript) && (
              <div style={{ display: 'grid', gridTemplateColumns: hasReplay ? '1fr 1fr' : '1fr', gap: '12px' }}>

                {/* Video Replay */}
                {hasReplay && (
                  <div className="glass-panel-dark" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '20px' }}>🎬</span>
                      <h3 style={{ margin: 0, fontSize: '15px', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>Session Replay</h3>
                      <span style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: 700, background: 'rgba(130,179,66,0.15)', color: 'var(--accent)', padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Local Only</span>
                    </div>
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      controls
                      onTimeUpdate={handleTimeUpdate}
                      style={{
                        width: '100%',
                        borderRadius: '12px',
                        background: '#000',
                        maxHeight: '340px',
                        objectFit: 'contain',
                      }}
                    />
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: '10px 0 0', lineHeight: 1.5 }}>
                      Recording is stored locally in your browser. Click a transcript entry to jump to that moment.
                    </p>
                  </div>
                )}

                {/* Full Transcript */}
                {hasTranscript && (
                  <div className="glass-panel-dark" style={{ padding: '16px', display: 'flex', flexDirection: 'column', maxHeight: '500px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexShrink: 0 }}>
                      <span style={{ fontSize: '20px' }}>📝</span>
                      <h3 style={{ margin: 0, fontSize: '15px', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>Full Transcript</h3>
                      <span style={{ marginLeft: 'auto', fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                        {finalTranscript.length} entries
                      </span>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {finalTranscript.map((entry, i) => (
                        <TranscriptEntry
                          key={i}
                          entry={entry}
                          startTime={sessionData?.sessionStartTime}
                          isHighlighted={hasReplay && i === activeTranscriptIdx}
                          onClick={hasReplay ? () => seekToEntry(entry) : undefined}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      <LandingFooter onOpenLegal={onOpenLegal} />
    </div>
  );
}
