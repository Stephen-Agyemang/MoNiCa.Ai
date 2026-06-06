import React, { useRef, useState } from 'react';
import { VideoTrack, AudioTrack } from '@livekit/components-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import InductionOverlay from './InductionOverlay';
import TavusPlayer from './TavusPlayer';
import EmotionHUD from './EmotionHUD';
import TranscriptPanel from './TranscriptPanel';

export default function TechnicalLayout({
  role, company,
  showOverlay, isOverlayFadingOut,
  videoRef, localTrack,
  agentVideoTrack, agentAudioTrack,
  isLoaded, emotions,
  isTyping, liveGrade,
  question, hint,
  code, setCode,
  isSubmitting, submitFeedback,
  submitCode,
  transcriptEntries, sessionStartTime,
  isTranscriptionSupported,
  getLiveWpm, getLiveFillerCount,
  isRecording,
}) {
  const textareaRef = useRef(null);
  const [showTranscript, setShowTranscript] = useState(false);

  const composureScore = emotions.length > 0
    ? Math.round(
        emotions.slice(-20).filter(e => ['neutral', 'happy', 'surprised'].includes(e.emotion)).length /
        Math.min(emotions.length, 20) * 100
      )
    : null;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '16px',
      height: '100%',
      maxHeight: '100%',
      background: 'transparent',
      overflow: 'hidden',
      position: 'relative',
      zIndex: 5,
      boxSizing: 'border-box'
    }}>
      {showOverlay && <InductionOverlay show={showOverlay} fadeOut={isOverlayFadingOut} />}
      <video ref={videoRef} autoPlay muted playsInline style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', width: '1px', height: '1px' }} />

      <div className="workspace-layout">
        {/* Left Column: Avatar + Self-View + Session Info */}
        <div style={{
          width: '280px',
          minWidth: '240px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          {/* Monica Avatar */}
          <div style={{
            height: '200px',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            position: 'relative',
            background: 'rgba(15, 20, 25, 0.45)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(130, 179, 66, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            {agentVideoTrack ? (
              <TavusPlayer videoTrack={agentVideoTrack} audioTrack={agentAudioTrack} />
            ) : (
              <div className="avatar-placeholder">
                <div className="monica-loading-shimmer" style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                  animation: 'shimmer 2s infinite linear'
                }} />
                <span style={{ position: 'relative', zIndex: 1 }}>M</span>
                <div style={{
                  position: 'absolute',
                  bottom: '-30px',
                  width: '200px',
                  textAlign: 'center',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: '#C5E898',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em'
                }}>Connecting to Monica Engine...</div>
              </div>
            )}
            <div style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(15, 20, 25, 0.65)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '6px 12px',
              borderRadius: '100px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              zIndex: 10
            }}>
              <div className="animate-soft-pulse" style={{
                width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444',
                boxShadow: '0 0 6px #ef4444'
              }} />
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#ffffff', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Live • Monica</span>
              {isTyping && (
                <span className="animate-pulse" style={{ fontSize: '9px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase' }}> • Taking notes... 📝</span>
              )}
            </div>

            {/* Recording badge */}
            {isRecording && (
              <div style={{
                position: 'absolute', top: '10px', right: '10px',
                display: 'flex', alignItems: 'center', gap: '5px',
                background: 'rgba(15, 20, 25, 0.65)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '4px 10px', borderRadius: '100px', zIndex: 10,
              }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px #ef4444', animation: 'soft-pulse 1.5s ease-in-out infinite' }} />
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#ffffff', letterSpacing: '0.08em', textTransform: 'uppercase' }}>REC</span>
              </div>
            )}
          </div>

          {/* Self View */}
          <div style={{
            height: '140px',
            flexShrink: 0,
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            background: '#1a2e35',
            position: 'relative',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          }}>
            {localTrack && (
              <VideoTrack trackRef={localTrack} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            )}
            <EmotionHUD isLoaded={isLoaded} emotions={emotions} />
          </div>

          {/* Session Info + Engagement */}
          <div className="settings-card" style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', margin: 0 }}>
            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Contextual Protocol</span>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-heading)', margin: '4px 0 2px', lineHeight: 1.3 }}>{role}</h4>
            {company && <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', margin: '0 0 8px' }}>at {company}</p>}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <span style={{ display: 'inline-block', fontSize: '9px', fontWeight: 600, padding: '3px 8px', borderRadius: 'var(--radius-pill)', background: 'rgba(251,146,60,0.1)', color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Technical</span>
              {liveGrade !== null && (
                <span style={{ display: 'inline-block', fontSize: '9px', fontWeight: 600, padding: '3px 8px', borderRadius: 'var(--radius-pill)', background: 'rgba(56,189,248,0.1)', color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Grade: {liveGrade}/100</span>
              )}
            </div>

            {/* Engagement metrics */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>WPM</span>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#93c5fd', lineHeight: 1.2 }}>{getLiveWpm()}</div>
              </div>
              {composureScore !== null && (
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Composure</span>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: composureScore >= 70 ? '#4ade80' : composureScore >= 40 ? '#fbbf24' : '#f87171', lineHeight: 1.2 }}>{composureScore}%</div>
                </div>
              )}
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Fillers</span>
                <div style={{ fontSize: '16px', fontWeight: 800, color: getLiveFillerCount() > 10 ? '#f87171' : 'rgba(255,255,255,0.7)', lineHeight: 1.2 }}>{getLiveFillerCount()}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Question + Code Editor + Transcript toggle */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
        }}>
          {/* Question Panel */}
          <div className="settings-card" style={{
            minHeight: '120px',
            maxHeight: '38%',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            margin: 0,
            flexShrink: 0,
          }}>
            <div style={{ padding: '10px 20px', background: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }}>
              <span style={{ fontSize: '14px' }}>📋</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Question</span>
              {question && <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'rgba(0,0,0,0.4)', fontWeight: 500 }}>Read-only</span>}
            </div>
            <div className="markdown-content" style={{
              flex: 1, padding: '16px 20px', fontSize: '14px', lineHeight: 1.75,
              color: 'rgba(255,255,255,0.85)', fontWeight: 400,
              userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none',
              borderLeft: question ? '3px solid #C5E898' : 'none',
            }}>
              {question ? (
                <>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{question}</ReactMarkdown>
                  {hint && (
                    <div style={{ marginTop: '8px', padding: '12px 16px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '10px', fontSize: '13px', color: '#fbbf24', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      💡 {hint}
                    </div>
                  )}
                </>
              ) : (
                <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' }}>Waiting for Monica to present the first question...</span>
              )}
            </div>
          </div>

          {/* Code Editor */}
          <div style={{
            flex: showTranscript ? '0 0 auto' : 1,
            maxHeight: showTranscript ? '40%' : undefined,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            border: '1px solid var(--border-light)',
            background: '#1e1e2e',
            minHeight: '160px',
          }}>
            <div style={{ padding: '10px 16px', background: '#181825', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px' }}>💻</span>
                <label htmlFor="code-editor" style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Your Code</label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setShowTranscript(v => !v)}
                  title={showTranscript ? 'Hide transcript' : 'Show transcript'}
                  style={{
                    padding: '5px 12px', borderRadius: 'var(--radius-pill)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: showTranscript ? 'rgba(147,197,253,0.15)' : 'rgba(255,255,255,0.05)',
                    color: showTranscript ? '#93c5fd' : 'rgba(255,255,255,0.4)',
                    fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.2s',
                    letterSpacing: '0.05em',
                  }}
                >
                  {showTranscript ? '▼ Transcript' : '▲ Transcript'}
                </button>
                <button
                  onClick={submitCode}
                  disabled={isSubmitting || !code.trim()}
                  aria-label="Submit code for evaluation"
                  style={{
                    padding: '6px 16px', borderRadius: 'var(--radius-pill)', border: 'none',
                    background: code.trim() ? '#C5E898' : 'rgba(255,255,255,0.08)',
                    color: code.trim() ? '#1a2e10' : 'rgba(255,255,255,0.3)',
                    fontSize: '11px', fontWeight: 600, cursor: code.trim() ? 'pointer' : 'default',
                    transition: 'all 0.2s',
                  }}
                >
                  {isSubmitting ? 'Sending...' : '▶ Submit Code'}
                </button>
              </div>
            </div>
            <textarea
              id="code-editor"
              ref={textareaRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={"Type your solution here...\n\nYou can explain your thought process verbally to Monica as you type."}
              spellCheck={false}
              style={{
                flex: 1, width: '100%', padding: '16px 20px',
                background: 'transparent', color: '#cdd6f4',
                border: 'none', outline: 'none', resize: 'none',
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
                fontSize: '13px', lineHeight: 1.7, tabSize: 4,
              }}
              onKeyDown={(e) => {
                if (e.key === 'Tab') {
                  e.preventDefault();
                  const start = e.target.selectionStart;
                  const end = e.target.selectionEnd;
                  setCode(code.substring(0, start) + '    ' + code.substring(end));
                  requestAnimationFrame(() => {
                    textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4;
                  });
                }
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  submitCode();
                }
              }}
            />
            {submitFeedback && (
              <div style={{ padding: '8px 16px', background: 'rgba(197,232,152,0.1)', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '11px', color: '#C5E898', fontWeight: 500 }}>
                {submitFeedback}
              </div>
            )}
          </div>

          {/* Collapsible Transcript Panel */}
          {showTranscript && (
            <div className="settings-card" style={{
              flex: 1,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              margin: 0,
              minHeight: 0,
              overflow: 'hidden',
            }}>
              <TranscriptPanel
                entries={transcriptEntries}
                sessionStartTime={sessionStartTime}
                isSupported={isTranscriptionSupported}
                compact
              />
            </div>
          )}
        </div>
      </div>

      {agentAudioTrack && !agentVideoTrack && <AudioTrack trackRef={agentAudioTrack} />}
    </div>
  );
}
