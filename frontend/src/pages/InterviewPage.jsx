import React, { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import { LandingFooter } from '../components/layout/LandingFooter';
import MainStage from '../features/interview/MainStage';

const TOKEN_SERVER_URL = 'http://localhost:8000/token';

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
    if (!file || file.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.');
      return;
    }
    setIsParsingPdf(true);
    setError(null);
    setResumeFilename(file.name);
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((item) => item.str).join(' ') + '\n';
      }
      setResumeText(fullText.trim());
    } catch (err) {
      console.error('Error parsing PDF:', err);
      setError('Could not read the PDF. Please try a different file or proceed without it.');
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
        role,
        company,
        mode,
        strictness,
        userId: guestMode ? 'GUEST_USER' : user?.id,
        userName: guestMode ? 'Guest Candidate' : user?.fullName,
      };
      if (resumeText) {
        metadataObj.resumePromptContext = `The candidate uploaded their resume. Use this context if relevant to your questions:\n\n${resumeText.substring(0, 3000)}`;
      }
      const metadata = JSON.stringify(metadataObj);
      const response = await fetch(
        `${TOKEN_SERVER_URL}?role=${encodeURIComponent(role)}&metadata=${encodeURIComponent(metadata)}`
      );
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
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', fontFamily: "'Inter', sans-serif" }}>
        <div className="settings-card animate-fade-in-up" style={{ padding: '48px', textAlign: 'center', maxWidth: '500px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '16px', color: '#1e293b' }}>Interview Complete</h2>
          <p style={{ color: 'rgba(0,0,0,0.6)', marginBottom: '20px', lineHeight: 1.6, fontSize: '15px' }}>
            Thank you for your time. Your responses have been recorded and your mock interview is now concluded.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button onClick={() => setIsInterviewCompleted(false)} className="pill-button pill-button-primary">
              Start New Session
            </button>
            <a
              href={`/report?room=${currentRoomName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="pill-button"
              style={{ background: '#1e293b', color: '#fff' }}
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
      <div className="auth-page-container" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="auth-mesh-overlay" style={{ opacity: 0.3 }} />
        <div className="mesh-glow-sphere sphere-1" style={{ width: '500px', height: '500px' }} />

        <header role="banner" className="settings-card" style={{
          padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none',
          background: 'rgba(15, 20, 25, 0.7)', position: 'relative', zIndex: 100
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h2 className="brand-text-gradient" style={{ fontSize: '24px', margin: 0 }}>
              Mon<span className="brand-i-container">i<span className="brand-i-dot-highlight" style={{ width: '6px', height: '6px' }}></span></span>ca<span className="brand-dot-end">.</span>
            </h2>
            <div style={{ height: '16px', width: '1px', background: 'rgba(0,0,0,0.1)' }} />
            <span className="safety-badge-tiny" style={{ background: 'rgba(22,163,74,0.1)', color: '#4ade80' }}>
              PROTOCOL ACTIVE
            </span>
          </div>
          <button
            onClick={logout}
            className="settings-card"
            style={{ padding: '8px 20px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', color: '#ff4d4d', fontSize: '11px', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}
          >
            End Protocol
          </button>
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
  return (
    <div className="auth-page-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="auth-mesh-overlay" />
      <div className="mesh-glow-sphere sphere-1" />
      <div className="mesh-glow-sphere sphere-2" />

      <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 24px 20px', position: 'relative', zIndex: 10 }}>
        {/* Monica Presence Card */}
        <div className="monica-presence-card" style={{ position: 'fixed', bottom: '40px', left: '40px', zIndex: 9999 }}>
          <img src="/monica_executive_portrait.png" alt="Monica Portrait" className="presence-avatar" loading="lazy" width="40" height="40" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>Monica is Online</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div className="presence-status-dot"></div>
              <span style={{ fontSize: '11px', color: 'rgba(0,0,0,0.7)', fontWeight: 500 }}>Ready to interview</span>
            </div>
          </div>
        </div>

        <div style={{ width: '100%', maxWidth: '540px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
          {/* Header */}
          <div className="animate-fade-in-up" style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1 id="hero-section" className="brand-text-gradient" style={{ fontSize: 'clamp(36px, 6vw, 56px)', fontWeight: 900, margin: 0, letterSpacing: '-0.04em', lineHeight: 1.1 }}>
              Mon<span className="brand-i-container">i<span className="brand-i-dot-highlight"></span></span>ca<span className="brand-dot-end">.</span>
            </h1>
            <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.6)', marginTop: '8px', fontWeight: 500, letterSpacing: '0.02em' }}>
              {guestMode ? 'Guest Practice Mode' : 'The Private AI Interview Coach.'}
            </p>
          </div>

          {/* Form Card */}
          <div className="glass-panel-dark animate-fade-in-up animate-delay-1" style={{ padding: '24px', marginBottom: '24px' }}>
            {/* Role + Company */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label htmlFor="role-input" style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>Target Role</label>
                <input
                  id="role-input" type="text" placeholder="e.g. Designer, Nurse, RA."
                  value={role} onChange={(e) => setRole(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && startInterview()}
                  style={{ width: '100%', padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#ffffff', fontSize: '15px', fontWeight: 500, outline: 'none', fontFamily: 'inherit', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = '0 0 15px rgba(130, 179, 66, 0.2)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.background = 'rgba(255,255,255,0.05)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              <div>
                <label htmlFor="company-input" style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>
                  Company <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'rgba(255,255,255,0.5)' }}>(optional)</span>
                </label>
                <input
                  id="company-input" type="text" placeholder="e.g. Google, Campus IT"
                  value={company} onChange={(e) => setCompany(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && startInterview()}
                  style={{ width: '100%', padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#ffffff', fontSize: '15px', fontWeight: 500, outline: 'none', fontFamily: 'inherit', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = '0 0 15px rgba(130, 179, 66, 0.2)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.background = 'rgba(255,255,255,0.05)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* Mode Selector */}
            <div style={{ marginBottom: '24px' }}>
              <label id="mode-label" style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>Interview Type</label>
              <div role="group" aria-labelledby="mode-label" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  { id: 'behavioral', label: 'Behavioral' },
                  { id: 'technical', label: 'Technical' },
                  { id: 'system_design', label: 'System Design' },
                  { id: 'resume_deep_dive', label: 'Resume Deep Dive' },
                ].map((m) => (
                  <button
                    key={m.id}
                    id={`mode-${m.id}`}
                    onClick={() => setMode(m.id)}
                    style={{ padding: '10px 14px', borderRadius: '24px', border: mode === m.id ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.2)', background: mode === m.id ? 'var(--accent)' : 'rgba(255,255,255,0.05)', color: mode === m.id ? '#ffffff' : 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit', boxShadow: mode === m.id ? '0 4px 12px rgba(130,179,66,0.4)' : 'none' }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Strictness Slider */}
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="strictness-slider" style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>Interview Intensity</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', fontWeight: 600, minWidth: '60px' }}>Relaxed</span>
                <input
                  id="strictness-slider" type="range" min="1" max="5" step="1"
                  value={strictness} onChange={(e) => setStrictness(parseInt(e.target.value))}
                  style={{ flex: 1, WebkitAppearance: 'none', appearance: 'none', height: '6px', borderRadius: '3px', background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${(strictness - 1) * 25}%, rgba(255,255,255,0.2) ${(strictness - 1) * 25}%, rgba(255,255,255,0.2) 100%)`, outline: 'none', cursor: 'pointer' }}
                  className="custom-range"
                />
                <div style={{ width: '32px', height: '32px', borderRadius: '16px', background: 'var(--accent)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, boxShadow: '0 2px 10px rgba(130,179,66,0.5)' }}>
                  {strictness}
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                {['', 'Practice mode — gentle and encouraging', 'Light challenge — supportive with follow-ups', 'Standard — balanced warmth and rigor', 'Rigorous — demanding, expects precision', 'Stress test — relentless and uncompromising'][strictness]}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div role="alert" style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#dc2626', fontSize: '13px', fontWeight: 500, textAlign: 'center' }}>
                {error}
              </div>
            )}

            {/* Resume Upload */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>Upload Resume (Optional PDF)</label>
              <div
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; }}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; if (e.dataTransfer.files?.length > 0) handleFileUpload({ target: { files: e.dataTransfer.files } }); }}
                onClick={() => document.getElementById('resume-upload').click()}
                style={{ position: 'relative', border: '1px dashed rgba(255,255,255,0.25)', borderRadius: '12px', padding: '30px 20px', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
              >
                <input id="resume-upload" type="file" accept=".pdf" onChange={handleFileUpload} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} title="Upload Resume PDF (Optional)" />
                {isParsingPdf ? (
                  <span style={{ fontSize: '15px', color: '#ffffff', fontWeight: 700 }}><span className="animate-soft-pulse">Reading PDF...</span></span>
                ) : resumeFilename ? (
                  <>
                    <div style={{ fontSize: '28px', marginBottom: '8px', color: '#82b342' }}>📄</div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#82b342' }}>✓ {resumeFilename} Ready</p>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '24px', marginBottom: '8px', color: 'rgba(255,255,255,0.7)' }}>📎</div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
                      {window.innerWidth < 480 ? 'Tap to upload Resume (PDF)' : 'Drag & drop or click to upload Resume'}
                    </p>
                    <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>PDF, DOCX up to 5MB</p>
                  </>
                )}
              </div>
            </div>

            {/* CTA */}
            <button
              id="start-interview-btn"
              onClick={startInterview}
              disabled={isLoading}
              style={{ width: '100%', padding: '18px', fontSize: '16px', margin: 0, background: 'var(--accent)', color: '#05070a', borderRadius: '24px', fontWeight: 900, border: 'none', cursor: 'pointer', letterSpacing: '0.05em', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 4px 20px rgba(130, 179, 66, 0.25)' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = 'var(--accent-hover)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(130, 179, 66, 0.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(130, 179, 66, 0.25)'; }}
            >
              {isLoading ? 'CONNECTING...' : 'START INTERVIEW'}
            </button>
          </div>
        </div>
      </div>

      {/* Grounding Section */}
      <section style={{ width: '100%', padding: '100px 24px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.2)', borderTop: '1px solid rgba(255, 255, 255, 0.6)', marginTop: '60px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h3 className="brand-text-gradient" style={{ fontSize: '32px', fontWeight: 800, marginBottom: '24px' }}>Calibrated to Professional Standards.</h3>
          <p style={{ fontSize: '18px', color: 'rgba(0,0,0,0.4)', maxWidth: '540px', margin: '0 auto 40px', lineHeight: 1.6 }}>
            Monica's assessment logic is grounded in technical merit and behavioral intelligence, providing a private sanctuary for professional growth.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '32px' }}>
            {[['Verified', 'Logic Engine'], ['Grounded', 'Bias Audit'], ['Secure', 'Local-Only']].map(([val, lbl], i) => (
              <React.Fragment key={i}>
                {i > 0 && <div style={{ height: '40px', width: '1px', background: 'rgba(0,0,0,0.1)' }} />}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b' }}>{val}</div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--accent)', fontWeight: 700, marginTop: '4px' }}>{lbl}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      <LandingFooter onOpenLegal={onOpenLegal} />
    </div>
  );
}
