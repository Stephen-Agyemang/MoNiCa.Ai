import React, { useState } from 'react';
import { useUser, UserButton } from '@clerk/clerk-react';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import { LandingFooter } from '../components/layout/LandingFooter';
import { MonicaPresenceCard } from '../components/ui/MonicaPresenceCard';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import MainStage from '../features/interview/MainStage';
import { apiUrl } from '../lib/api';

export function InterviewPage({ guestMode = false, onOpenLegal }) {
  const { user } = useUser();
  const [token, setToken] = useState(null);
  const [url, setUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [mode, setMode] = useState('behavioral');
  const [strictness, setStrictness] = useState(3);
  const [resumeText, setResumeText] = useState('');
  const [resumeFilename, setResumeFilename] = useState('');
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [currentRoomName, setCurrentRoomName] = useState('');
  const [isInterviewCompleted, setIsInterviewCompleted] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx', 'txt'].includes(ext)) {
      setError('Unsupported file type. Please upload a PDF, DOCX, or TXT file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File is too large. Maximum size is 5 MB.');
      return;
    }

    setIsParsingPdf(true);
    setError(null);
    setResumeFilename(file.name);

    try {
      let fullText = '';
      if (ext === 'pdf') {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).href;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map((item) => item.str).join(' ') + '\n';
        }
      } else if (ext === 'docx') {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        fullText = result.value;
      } else if (ext === 'txt') {
        fullText = await file.text();
      }
      setResumeText(fullText.trim());
    } catch (err) {
      console.error('Error parsing resume:', err);
      setError('Could not read the file. Please try a different file or proceed without it.');
      setResumeFilename('');
    } finally {
      setIsParsingPdf(false);
    }
  };

  const startInterview = async () => {
    if (!role.trim()) {
      setError('Please enter a role to continue.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const metadataObj = {
        role, company, mode, strictness,
        userId: guestMode ? 'GUEST_USER' : user?.id,
        userName: guestMode ? 'Guest Candidate' : user?.fullName,
      };
      if (resumeText) {
        metadataObj.resumePromptContext = `The candidate uploaded their resume. Use this context if relevant:\n\n${resumeText.substring(0, 3000)}`;
      }
      const response = await fetch(apiUrl('/token'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, metadata: JSON.stringify(metadataObj) }),
      });
      if (!response.ok) throw new Error('Failed to connect to the backend server.');
      const data = await response.json();
      setToken(data.token);
      setUrl(data.url);
      setCurrentRoomName(data.roomName || data.room_name || '');
      setIsInterviewCompleted(false);
    } catch (err) {
      setError('The interview servers are currently at capacity or offline. Please try again later.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUrl(null);
    setRole('');
    setCompany('');
    setMode('behavioral');
    setStrictness(3);
    setIsInterviewCompleted(true);
  };

  // ── Interview Complete Screen ──
  if (isInterviewCompleted) {
    return (
      <main className="complete-screen">
        <div className="settings-card animate-fade-in-up" style={{ padding: '48px', textAlign: 'center', maxWidth: '500px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '16px', color: '#ffffff' }}>Interview Complete</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '20px', lineHeight: 1.6, fontSize: '15px' }}>
            Your responses have been recorded. Monica will have your feedback report ready shortly.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setIsInterviewCompleted(false)} className="pill-button pill-button-primary">
              Start New Session
            </button>
            <a
              href={`/report?room=${currentRoomName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="pill-button"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-light)', color: '#fff' }}
            >
              View Feedback Report
            </a>
          </div>
        </div>
      </main>
    );
  }

  // ── Live Session View ──
  if (token) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', background: 'transparent' }}>
        <div className="auth-mesh-overlay" style={{ opacity: 0.3, position: 'fixed' }} />
        <div className="mesh-glow-sphere sphere-1" style={{ width: '500px', height: '500px', position: 'fixed' }} />

        <header role="banner" className="session-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h2 className="brand-text-gradient" style={{ fontSize: '24px', margin: 0 }}>
              Mon<span className="brand-i-container">i<span className="brand-i-dot-highlight" style={{ width: '6px', height: '6px' }}></span></span>ca<span className="brand-dot-end">.</span>
            </h2>
            <div className="vert-divider" style={{ height: '16px' }} />
            <span className="safety-badge-tiny" style={{ background: 'rgba(22,163,74,0.1)', color: '#4ade80' }}>
              SESSION ACTIVE
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ThemeToggle />
            <button onClick={logout} className="session-end-btn">End Session</button>
          </div>
        </header>

        <LiveKitRoom
          token={token}
          serverUrl={url}
          onDisconnected={logout}
          video={true}
          audio={true}
          adaptiveStream={false}
          style={{ flex: 1, display: 'flex', overflow: 'hidden' }}
        >
          <MainStage role={role} company={company} mode={mode} />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    );
  }

  // ── Setup / Landing Form ──
  const INTERVIEW_MODES = [
    { id: 'behavioral', label: 'Behavioral' },
    { id: 'technical', label: 'Technical' },
    { id: 'system_design', label: 'System Design' },
    { id: 'resume_deep_dive', label: 'Resume Deep Dive' },
  ];

  const STRICTNESS_LABELS = [
    '', 'Practice mode — gentle and encouraging',
    'Light challenge — supportive with follow-ups',
    'Standard — balanced warmth and rigor',
    'Rigorous — demanding, expects precision',
    'Stress test — relentless and uncompromising',
  ];

  return (
    <>
    <MonicaPresenceCard />
    <div className="auth-page-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="auth-mesh-overlay" />
      <div className="mesh-glow-sphere sphere-1" />
      <div className="mesh-glow-sphere sphere-2" />

      {/* Top-right user control — sign out for authenticated users */}
      <div className="page-header" style={{ gap: '10px' }}>
        <ThemeToggle />
        {!guestMode && <UserButton signOutFallbackRedirectUrl="/" />}
      </div>

      <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 24px', position: 'relative', zIndex: 10 }}>
        <div style={{ width: '100%', maxWidth: '540px', margin: '0 auto' }}>

          {/* Hero */}
          <div className="animate-fade-in-up" style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1 id="hero-section" className="brand-text-gradient" style={{ fontSize: 'clamp(36px, 6vw, 56px)', fontWeight: 900, margin: 0, letterSpacing: '-0.04em', lineHeight: 1.1 }}>
              Mon<span className="brand-i-container">i<span className="brand-i-dot-highlight"></span></span>ca<span className="brand-dot-end">.</span>
            </h1>
            <p style={{ fontSize: '18px', color: 'var(--text-muted)', marginTop: '8px', fontWeight: 500, letterSpacing: '0.02em' }}>
              {guestMode ? 'Guest Practice Mode' : 'The Private AI Interview Coach.'}
            </p>
          </div>

          {/* Form Card */}
          <div className="glass-panel-dark animate-fade-in-up animate-delay-1" style={{ padding: '24px', marginBottom: '24px' }}>

            {/* Role + Company */}
            <div className="form-grid-2">
              <div>
                <label htmlFor="role-input" className="form-label">Target Role</label>
                <input
                  id="role-input"
                  type="text"
                  placeholder="e.g. Designer, Nurse, RA."
                  className="form-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && startInterview()}
                />
              </div>
              <div>
                <label htmlFor="company-input" className="form-label">
                  Company <span className="form-label-optional">(optional)</span>
                </label>
                <input
                  id="company-input"
                  type="text"
                  placeholder="e.g. Google, Campus IT"
                  className="form-input"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && startInterview()}
                />
              </div>
            </div>

            {/* Mode Selector */}
            <div style={{ marginBottom: '24px' }}>
              <label id="mode-label" className="form-label">Interview Type</label>
              <div role="group" aria-labelledby="mode-label" className="mode-grid">
                {INTERVIEW_MODES.map((m) => (
                  <button
                    key={m.id}
                    id={`mode-${m.id}`}
                    onClick={() => setMode(m.id)}
                    className={`mode-btn${mode === m.id ? ' active' : ''}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Strictness Slider */}
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="strictness-slider" className="form-label">Interview Intensity</label>
              <div className="strictness-row">
                <span className="strictness-side-label">Relaxed</span>
                <input
                  id="strictness-slider"
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={strictness}
                  onChange={(e) => setStrictness(parseInt(e.target.value))}
                  className="custom-range"
                  style={{
                    flex: 1,
                    WebkitAppearance: 'none',
                    appearance: 'none',
                    height: '6px',
                    borderRadius: '3px',
                    background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${(strictness - 1) * 25}%, rgba(255,255,255,0.2) ${(strictness - 1) * 25}%, rgba(255,255,255,0.2) 100%)`,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                />
                <div className="strictness-value-badge">{strictness}</div>
              </div>
              <p style={{ textAlign: 'center', marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                {STRICTNESS_LABELS[strictness]}
              </p>
            </div>

            {/* Error */}
            {error && <div role="alert" className="form-error">{error}</div>}

            {/* Resume Upload */}
            <div style={{ marginBottom: '24px' }}>
              <label className="form-label">
                Resume <span className="form-label-optional">(optional)</span>
              </label>
              <div
                className="resume-drop-zone"
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('drag-over');
                  if (e.dataTransfer.files?.length > 0) handleFileUpload({ target: { files: e.dataTransfer.files } });
                }}
                onClick={() => document.getElementById('resume-upload').click()}
              >
                <input
                  id="resume-upload"
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileUpload}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                  title="Upload Resume (PDF, DOCX, or TXT)"
                />
                {isParsingPdf ? (
                  <span style={{ fontSize: '15px', color: '#ffffff', fontWeight: 700 }}>
                    <span className="animate-soft-pulse">Reading resume...</span>
                  </span>
                ) : resumeFilename ? (
                  <>
                    <div style={{ fontSize: '28px', marginBottom: '8px', color: 'var(--accent)' }}>📄</div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--accent)' }}>✓ {resumeFilename} Ready</p>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '24px', marginBottom: '8px', color: 'rgba(255,255,255,0.7)' }}>📎</div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
                      Drag & drop or click to upload
                    </p>
                    <p style={{ margin: '8px 0 0', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                      PDF, DOCX, or TXT — up to 5MB
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* CTA */}
            <button
              id="start-interview-btn"
              onClick={startInterview}
              disabled={isLoading}
              className="btn-cta"
            >
              {isLoading ? 'CONNECTING...' : 'START INTERVIEW'}
            </button>
          </div>
        </div>
      </div>

      {/* Grounding Section */}
      <section className="grounding-section">
        <div className="grounding-inner">
          <h3 className="brand-text-gradient" style={{ fontSize: '32px', fontWeight: 800, marginBottom: '24px' }}>
            Calibrated to Professional Standards.
          </h3>
          <p style={{ fontSize: '18px', color: 'var(--text-muted)', maxWidth: '540px', margin: '0 auto 40px', lineHeight: 1.6 }}>
            Monica's assessment logic is grounded in technical merit and behavioral intelligence — a private, judgment-free space for professional growth.
          </p>
          <div className="grounding-stats">
            {[['Verified', 'Logic Engine'], ['Grounded', 'Fair Assessment'], ['Secure', 'Local-Only']].map(([val, lbl], i) => (
              <React.Fragment key={i}>
                {i > 0 && <div className="vert-divider" />}
                <div className="grounding-stat">
                  <div className="grounding-stat-value">{val}</div>
                  <div className="grounding-stat-label">{lbl}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      <LandingFooter onOpenLegal={onOpenLegal} />
    </div>
    </>
  );
}