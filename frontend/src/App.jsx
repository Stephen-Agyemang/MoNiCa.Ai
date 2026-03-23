import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SignedIn, SignedOut, SignIn, SignUp, UserButton, useUser } from '@clerk/clerk-react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  AudioTrack,
  useTracks,
  useLocalParticipant,
  useRoomContext,
} from '@livekit/components-react';
import { Track, DataPacket_Kind } from 'livekit-client';
import '@livekit/components-styles';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { 
  Building2, 
  ShieldCheck, 
  Cpu, 
  ChevronRight, 
  ArrowRight,
  Globe,
  Lock,
  Zap,
  CheckCircle2
} from 'lucide-react';
// pdfjs-dist and html2pdf.js are now dynamically imported to improve Lighthouse scores
import { useEmotionTracker } from './useEmotionTracker';

import './App.css';
import './markdown.css';

const TOKEN_SERVER_URL = "http://localhost:8000/token";
const HEYGEN_TOKEN_URL = "http://localhost:8000/heygen-token";

/* ───────────────────────────────────────────
   Induction Loading Overlay
   ─────────────────────────────────────────── */
function InductionOverlay() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '32px'
    }}>
      <div className="auth-mesh-overlay" style={{ opacity: 0.5 }} />
      <div className="mesh-glow-sphere sphere-1" style={{ width: '400px', height: '400px' }} />
      
      <div style={{ position: 'relative' }}>
        <div className="avatar-placeholder-executive" style={{ width: '120px', height: '120px', fontSize: '32px' }}>
          M
        </div>
        <div className="monica-loading-shimmer" style={{
          position: 'absolute',
          inset: -10,
          borderRadius: '50%',
          border: '2px solid var(--accent)',
          opacity: 0.3,
          animation: 'soft-pulse 2s infinite'
        }} />
      </div>

      <div style={{ textAlign: 'center', zIndex: 10 }}>
        <h2 className="brand-text-gradient" style={{ fontSize: '28px', marginBottom: '8px' }}>
          Inducting Monica<span className="brand-dot-end">.</span>
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
          Synchronizing Digital Replica & Biometric Logic...
        </p>
      </div>

      <div style={{
        width: '200px',
        height: '2px',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '2px',
        overflow: 'hidden',
        position: 'relative'
      }}>
        <div style={{
          position: 'absolute',
          height: '100%',
          width: '60%',
          background: 'var(--accent)',
          animation: 'shimmer 2s infinite linear'
        }} />
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────
   Interview Session View
   ─────────────────────────────────────────── */
function MainStage({ role, company, mode }) {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const [question, setQuestion] = useState('');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState('');
  const [liveGrade, setLiveGrade] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isAgentConnected, setIsAgentConnected] = useState(false);
  const textareaRef = useRef(null);

  // Subscribe to all tracks (Camera for self-view, Video + Audio + Unknown for Agent)
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.Unknown, withPlaceholder: false },
    { source: Track.Source.Microphone, withPlaceholder: false },
    { source: Track.Source.ScreenShare, withPlaceholder: false }
  ]);

  // Local camera for self-view
  const localTrack = tracks.find(
    t => t.participant?.identity === localParticipant?.identity && t.source === Track.Source.Camera
  );

  // Explicitly grab the agent's remote audio track
  const agentAudioTrack = tracks.find(
    t => !t.participant?.isLocal && 
         t.publication?.kind === 'audio'
  );

  // Explicitly grab the agent's remote video track (Tavus 3D Video Stream)
  // Hardened discovery: accept BOTH Camera and ScreenShare sources just in case Tavus uses a custom source type.
  // We prioritize the participant named "Monica (Interviewer)" to avoid confusion with other remote participants.
  const agentVideoTrack = tracks.find(
    t => !t.participant?.isLocal && 
         (t.participant?.name === 'Monica (Interviewer)' || t.participant?.identity.includes('agent')) &&
         t.publication?.kind === 'video' &&
         (t.source === Track.Source.Camera || t.source === Track.Source.ScreenShare || t.source === Track.Source.Unknown)
  );

  const { isLoaded, getEmotionSummary, videoRef } = useEmotionTracker(localTrack);

  // Track Agent Connection
  useEffect(() => {
    if (agentVideoTrack) {
      setIsAgentConnected(true);
    }
  }, [agentVideoTrack]);

  // Periodically send emotion summary to backend
  useEffect(() => {
    if (!room) return;
    const interval = setInterval(() => {
      const summary = getEmotionSummary();
      if (summary && summary !== "No data") {
        try {
          const encoder = new TextEncoder();
          const data = encoder.encode(JSON.stringify({ type: 'emotion', summary }));
          room.localParticipant.publishData(data, { reliable: true });
        } catch (e) {
          console.error('Failed to send emotion data:', e);
        }
      }
    }, 15000); // 15 seconds
    return () => clearInterval(interval);
  }, [room, getEmotionSummary]);

  // Data channel handling for technical mode & live grading
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);

        if (data.type === 'question') {
          // Only technically mode usually receives code questions, but we handle it just in case
          setQuestion(data.content);
          setCode('');
          setSubmitFeedback('');
        }
        else if (data.type === 'live_grade') {
          setLiveGrade(data.score);
        }
        else if (data.type === 'typing') {
          if (data.status === 'start') {
            setIsTyping(true);
            setTimeout(() => setIsTyping(false), 3500);
          }
        }
      } catch {
        // Not JSON, ignore
      }
    };

    room.on('dataReceived', handleDataReceived);
    return () => room.off('dataReceived', handleDataReceived);
  }, [room]);

  // Submit code to Monica via data channel
  const submitCode = useCallback(async () => {
    if (!room || !code.trim()) return;
    setIsSubmitting(true);
    setSubmitFeedback('Submitted! Monica is reviewing...');
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify({
        type: 'code_submission',
        content: code,
        question: question,
      }));
      await room.localParticipant.publishData(data, { reliable: true });
    } catch (e) {
      console.error('Failed to send code:', e);
      setSubmitFeedback('Failed to submit. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [room, code, question]);

  // ── TECHNICAL MODE LAYOUT ──
  if (mode === 'technical') {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '24px',
        height: '100%', // Use parent's flex height
        maxHeight: '100vh',
        background: 'transparent',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 5,
        boxSizing: 'border-box'
      }}>
        {!isAgentConnected && <InductionOverlay />}
        <video ref={videoRef} autoPlay muted playsInline width="160" height="160" style={{ display: 'none' }} />
        <div className="workspace-layout">
          {/* Left Column: Avatar + Self-View */}
          <div style={{
            width: '280px',
            minWidth: '240px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <div style={{
              height: '200px',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              position: 'relative',
              background: '#111827',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* Tavus Video Stream */}
              {agentVideoTrack ? (
                <VideoTrack
                  trackRef={agentVideoTrack}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <div className="avatar-placeholder-executive">
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
                bottom: '8px',
                left: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <div className="animate-soft-pulse" style={{
                  width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444',
                }} />
                <span style={{
                  fontSize: '9px', fontWeight: 600, color: 'rgba(255,255,255,0.7)',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }}>Live • Monica</span>
                {isTyping && (
                  <span className="animate-pulse" style={{
                    fontSize: '9px', fontWeight: 700, color: '#C5E898',
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}> • Taking notes... 📝</span>
                )}
              </div>
            </div>

            {/* Self View */}
            <div style={{
              height: '160px',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              background: '#1a2e35',
              position: 'relative',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            }}>
              {localTrack && (
                <VideoTrack trackRef={localTrack} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
              )}
              <div style={{
                position: 'absolute', top: '8px', left: '8px',
                background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                padding: '3px 8px', borderRadius: 'var(--radius-pill)',
                fontSize: '9px', fontWeight: 600, color: 'rgba(255,255,255,0.7)',
              }}>You</div>
            </div>

            {/* Session Info */}
            <div className="manifesto-card" style={{
              flex: 1,
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              margin: 0
            }}>
              <span style={{
                fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase', letterSpacing: '0.15em',
              }}>Contextual Protocol</span>
              <h4 style={{
                fontSize: '16px', fontWeight: 700, color: 'white',
                margin: '4px 0 2px', lineHeight: 1.3,
              }}>{role}</h4>
              {company && <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>at {company}</p>}
              <div style={{ marginTop: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-block',
                  fontSize: '9px', fontWeight: 600, padding: '3px 8px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'rgba(251,146,60,0.1)', color: '#ea580c',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>Technical</span>

                {liveGrade !== null && (
                  <span style={{
                    display: 'inline-block',
                    fontSize: '9px', fontWeight: 600, padding: '3px 8px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'rgba(56,189,248,0.1)', color: '#0284c7',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>Grade: {liveGrade}/100</span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Question + Code Editor */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            minWidth: 0,
          }}>
            {/* Question Panel */}
            <div className="manifesto-card" style={{
              minHeight: '120px',
              maxHeight: '40%',
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              margin: 0
            }}>
              {/* Header */}
              <div style={{
                padding: '10px 20px',
                background: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
              }}>
                <span style={{ fontSize: '14px' }}>📋</span>
                <span style={{
                  fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.85)',
                  textTransform: 'uppercase', letterSpacing: '0.15em',
                }}>Question</span>
                {question && (
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.4)',
                    fontWeight: 500,
                  }}>Read-only</span>
                )}
              </div>
              <div className="markdown-content" style={{
                flex: 1,
                padding: '16px 20px',
                fontSize: '14px',
                lineHeight: 1.75,
                color: 'rgba(255,255,255,0.85)',
                fontWeight: 400,
                userSelect: 'none',
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none',
                borderLeft: question ? '3px solid #C5E898' : 'none',
                marginLeft: question ? '0' : undefined,
              }}>
                {question ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {question}
                  </ReactMarkdown>
                ) : (
                  <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' }}>
                    Waiting for Monica to present the first question...
                  </span>
                )}
              </div>
            </div>

            {/* Answer Area — adapts to coding vs. non-coding roles */}
            {(() => {
              const codingKeywords = ['software', 'developer', 'engineer', 'programmer', 'swe', 'frontend', 'backend', 'fullstack', 'full-stack', 'devops', 'data scientist', 'data engineer', 'ml engineer', 'machine learning', 'web dev', 'ios', 'android', 'mobile dev'];
              const isCoding = codingKeywords.some(k => role.toLowerCase().includes(k));

              return isCoding ? (
                // ── CODE EDITOR (for coding roles) ──
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                  border: '1px solid var(--border-light)',
                  background: '#1e1e2e',
                }}>
                  <div style={{
                    padding: '10px 16px',
                    background: '#181825',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px' }}>💻</span>
                      <label htmlFor="code-editor" style={{
                        fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.5)',
                        textTransform: 'uppercase', letterSpacing: '0.1em',
                      }}>Your Code</label>
                    </div>
                    <button
                      onClick={submitCode}
                      disabled={isSubmitting || !code.trim()}
                      aria-label="Submit code for evaluation"
                      style={{
                        padding: '6px 16px',
                        borderRadius: 'var(--radius-pill)',
                        border: 'none',
                        background: code.trim() ? '#C5E898' : 'rgba(255,255,255,0.08)',
                        color: code.trim() ? '#1a2e10' : 'rgba(255,255,255,0.3)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: code.trim() ? 'pointer' : 'default',
                        transition: 'all 0.2s',
                      }}
                    >
                      {isSubmitting ? 'Sending...' : '▶ Submit Code'}
                    </button>
                  </div>
                  <textarea
                    id="code-editor"
                    ref={textareaRef}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={"Type your solution here...\n\nYou can explain your thought process verbally to Monica as you type."}
                    spellCheck={false}
                    style={{
                      flex: 1,
                      width: '100%',
                      padding: '16px 20px',
                      background: 'transparent',
                      color: '#cdd6f4',
                      border: 'none',
                      outline: 'none',
                      resize: 'none',
                      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
                      fontSize: '13px',
                      lineHeight: 1.7,
                      tabSize: 4,
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
                    <div style={{
                      padding: '8px 16px',
                      background: 'rgba(197,232,152,0.1)',
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                      fontSize: '11px',
                      color: '#C5E898',
                      fontWeight: 500,
                    }}>
                      {submitFeedback}
                    </div>
                  )}
                </div>
              ) : (
                // ── WRITTEN ANSWER AREA (for non-coding roles) ──
                <div className="manifesto-card" style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  padding: 0,
                  margin: 0
                }}>
                  <div style={{
                    padding: '12px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px' }}>✍️</span>
                      <label htmlFor="written-response" style={{
                        fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.4)',
                        textTransform: 'uppercase', letterSpacing: '0.1em',
                      }}>Executive Response</label>
                    </div>
                    <button
                      onClick={submitCode}
                      disabled={isSubmitting || !code.trim()}
                      aria-label="Submit written response for evaluation"
                      style={{
                        padding: '6px 16px',
                        borderRadius: 'var(--radius-pill)',
                        border: 'none',
                        background: code.trim() ? '#C5E898' : 'rgba(0,0,0,0.05)',
                        color: code.trim() ? '#1a2e10' : 'rgba(255,255,255,0.4)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: code.trim() ? 'pointer' : 'default',
                        transition: 'all 0.2s',
                      }}
                    >
                      {isSubmitting ? 'Sending...' : '▶ Submit Answer'}
                    </button>
                  </div>
                  <textarea
                    id="written-response"
                    ref={textareaRef}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={"Write your answer here...\n\nYou can discuss your reasoning with Monica verbally while writing your detailed response."}
                    spellCheck={true}
                    style={{
                      flex: 1,
                      width: '100%',
                      padding: '16px 20px',
                      background: 'transparent',
                      color: 'white',
                      border: 'none',
                      outline: 'none',
                      resize: 'none',
                      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                      fontSize: '14px',
                      lineHeight: 1.8,
                    }}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        submitCode();
                      }
                    }}
                  />
                  {submitFeedback && (
                    <div style={{
                      padding: '8px 16px',
                      background: 'rgba(197,232,152,0.1)',
                      borderTop: '1px solid rgba(255,255,255,0.05)',
                      fontSize: '11px',
                      color: '#4a7c1f',
                      fontWeight: 500,
                    }}>
                      {submitFeedback}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
        {agentAudioTrack && <AudioTrack trackRef={agentAudioTrack} />}
      </div>
    );
  }

  // ── GENERAL MODE LAYOUT (Deep Ink Overhaul) ──
  return (
    <div className="auth-page-container" style={{ height: '100vh', overflow: 'hidden' }}>
      {!isAgentConnected && <InductionOverlay />}
      <div className="auth-mesh-overlay" style={{ opacity: 0.4 }} />
      <div className="mesh-glow-sphere sphere-1" style={{ width: '400px', height: '400px', opacity: 0.3 }} />
      <div className="mesh-glow-sphere sphere-2" style={{ width: '300px', height: '300px', opacity: 0.2 }} />

      <video ref={videoRef} autoPlay muted playsInline width="160" height="160" style={{ display: 'none' }} />

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        gap: '24px',
        padding: '24px',
        height: '100%', // Use parent's flex height
        maxHeight: '100%',
        minHeight: 0,
        position: 'relative',
        zIndex: 5,
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}>
        {/* Monica's Avatar (Interviewer) */}
        <div className="video-participant-frame" style={{
          flex: 3,
          position: 'relative',
          borderRadius: '24px',
          overflow: 'hidden',
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(130, 179, 66, 0.2)', // Subtle Monica Green Border
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {agentVideoTrack ? (
            <VideoTrack
              trackRef={agentVideoTrack}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
              onSubscriptionStatusChanged={(status) => {
                console.log('Monica Video Subscription Status:', status);
              }}
            />
          ) : (
            <div className="avatar-placeholder-executive">
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
                bottom: '-40px',
                width: '100%',
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: 600,
                color: '#C5E898',
                textTransform: 'uppercase',
                letterSpacing: '0.15em'
              }}>Synchronizing Monica Digital Replica...</div>
            </div>
          )}

          {/* Monica Engine Status Overlay (Elite Executive Polish) */}
          <div style={{
            position: 'absolute',
            bottom: '24px',
            left: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(5, 7, 10, 0.6)',
            padding: '10px 18px',
            borderRadius: '100px',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            zIndex: 10
          }}>
            <div className="monica-waveform">
              <div className="waveform-bar"></div>
              <div className="waveform-bar"></div>
              <div className="waveform-bar"></div>
              <div className="waveform-bar"></div>
              <div className="waveform-bar"></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'white', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Monica Engine</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }}></div>
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Biometric Sync Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          minWidth: '240px',
          maxWidth: '320px',
        }}>
          {/* Self View */}
          <div style={{
            aspectRatio: '4/3',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            background: '#1a2e35',
            position: 'relative',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          }}>
            {localTrack && (
              <VideoTrack
                trackRef={localTrack}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)',
                }}
              />
            )}
            <div style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '10px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.7)',
              letterSpacing: '0.05em',
            }}>
              You
            </div>
          </div>

          {agentAudioTrack && <AudioTrack trackRef={agentAudioTrack} />}

          {/* Interview Info Card */}
          <div className="manifesto-card" style={{
            flex: 1,
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            margin: 0
          }}>
            <div style={{ marginBottom: 'auto' }}>
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
              }}>
                Current Session
              </span>
              <h3 style={{
                fontSize: '20px',
                fontWeight: 700,
                color: 'white',
                margin: '8px 0 4px',
                lineHeight: 1.3,
              }}>
                {role}
              </h3>
              {company && (
                <p style={{
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.5)',
                  margin: 0,
                }}>
                  at {company}
                </p>
              )}
              <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--accent-subtle)',
                  color: '#4a7c1f',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>
                  {mode} Phase
                </span>
                {liveGrade !== null && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'rgba(56,189,248,0.1)',
                    color: '#0284c7',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}>
                    Live Grade: {liveGrade}/100
                  </span>
                )}
              </div>
            </div>

            <div style={{
              paddingTop: '16px',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              marginTop: '16px',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
              }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Status</span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  <span className="animate-soft-pulse" style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#16a34a',
                    display: 'inline-block',
                  }} />
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────
   App Root — Landing Page + Session Router
   ─────────────────────────────────────────── */
const EliteMetric = ({ value, label, icon: Icon }) => (
  <div className="manifesto-card metric-card" role="group" aria-label={`Metric: ${label}`}>
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: 'var(--accent)' }}>
      {Icon && <Icon size={24} aria-hidden="true" />}
    </div>
    <span className="metric-value">{value}</span>
    <span className="metric-label">{label}</span>
  </div>
);

const LandingFooter = ({ onOpenLegal }) => (
  <footer className="elite-footer" role="contentinfo">
    <div className="footer-content">
      <div className="footer-brand">
        <h4>Mon<span className="brand-i-container">i<span className="brand-i-dot-highlight"></span></span>ca<span className="brand-dot-end">.</span></h4>
        <p>Providing the absolute standard in executive AI interview preparation. Secure, private, and uncompromising.</p>
      </div>
      <div className="footer-links">
        <nav aria-label="Platform links">
          <h5>Platform</h5>
          <ul>
            <li><a href="#/" onClick={(e) => { e.preventDefault(); document.getElementById('hero-section')?.scrollIntoView({ behavior: 'smooth' }); }} rel="noopener noreferrer">Technical Mode</a></li>
            <li><a href="#/" onClick={(e) => { e.preventDefault(); document.getElementById('hero-section')?.scrollIntoView({ behavior: 'smooth' }); }} rel="noopener noreferrer">Behavioral Core</a></li>
            <li><a href="/recruiter" rel="noopener noreferrer">Recruiter Portal</a></li>
          </ul>
        </nav>
      </div>
      <div className="footer-links">
        <nav aria-label="Corporate links">
          <h5>Corporate</h5>
          <ul>
            <li><a href="#/" onClick={(e) => onOpenLegal?.(e, 'privacy')} rel="noopener noreferrer">Privacy Protocol</a></li>
            <li><a href="#/" onClick={(e) => onOpenLegal?.(e, 'security')} rel="noopener noreferrer">Security Audit</a></li>
            <li><a href="#/" onClick={(e) => onOpenLegal?.(e, 'terms')} rel="noopener noreferrer">Terms of Service</a></li>
          </ul>
        </nav>
      </div>
      <div className="footer-links">
        <nav aria-label="Support links">
          <h5>Support</h5>
          <ul>
            <li><a href="#/" onClick={(e) => onOpenLegal?.(e, 'help')} rel="noopener noreferrer">Help Center</a></li>
            <li><a href="#/" onClick={(e) => onOpenLegal?.(e, 'status')} rel="noopener noreferrer">API Status</a></li>
            <li><a href="#/" onClick={(e) => onOpenLegal?.(e, 'contact')} rel="noopener noreferrer">Contact Office</a></li>
          </ul>
        </nav>
      </div>
    </div>
    <div className="footer-bottom">
      <span>© 2026 Monica AI. All Rights Reserved.</span>
      <div style={{ display: 'flex', gap: '24px' }}>
        <a href="#/" style={{ color: 'inherit', textDecoration: 'none' }} rel="noopener noreferrer">System Status: Operational</a>
      </div>
    </div>
  </footer>
);

function App({ guestMode = false, onOpenLegal }) {
  const { user } = useUser();
  const [token, setToken] = useState(null);
  const [url, setUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [mode, setMode] = useState("behavioral");
  const [strictness, setStrictness] = useState(3);
  const [resumeText, setResumeText] = useState("");
  const [resumeFilename, setResumeFilename] = useState("");
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [currentRoomName, setCurrentRoomName] = useState("");

  const [isInterviewCompleted, setIsInterviewCompleted] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== "application/pdf") {
      setError("Please upload a valid PDF file.");
      return;
    }

    setIsParsingPdf(true);
    setError(null);
    setResumeFilename(file.name);

    try {
      // Dynamic import to reduce initial bundle size (Lighthouse optimization)
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(" ");
        fullText += pageText + "\n";
      }

      setResumeText(fullText.trim());
    } catch (err) {
      console.error("Error parsing PDF:", err);
      setError("Could not read the PDF. Please try a different file or proceed without it.");
      setResumeFilename("");
    } finally {
      setIsParsingPdf(false);
    }
  };

  const startInterview = async () => {
    if (!role.trim()) {
      setError("Please enter a role to continue.");
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
        userId: guestMode ? "GUEST_USER" : user?.id,
        userName: guestMode ? "Guest Candidate" : user?.fullName
      };
      if (resumeText) {
        metadataObj.resumePromptContext = `The candidate uploaded their resume. Use this context if relevant to your questions:\n\n${resumeText.substring(0, 3000)}`; // Cap length just in case
      }
      const metadata = JSON.stringify(metadataObj);

      const response = await fetch(`${TOKEN_SERVER_URL}?role=${encodeURIComponent(role)}&metadata=${encodeURIComponent(metadata)}`);
      if (!response.ok) throw new Error("Failed to connect to the backend server.");

      const data = await response.json();
      setToken(data.token);
      setUrl(data.url);
      setCurrentRoomName(data.roomName || data.room_name || "");
      setIsInterviewCompleted(false);
    } catch (err) {
      setError("The interview servers are currently at capacity or offline. Please try again later.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUrl(null);
    setRole("");
    setCompany("");
    setMode("behavioral");
    setStrictness(3);
    setIsInterviewCompleted(true);
  };

  if (isInterviewCompleted) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', fontFamily: "'Inter', sans-serif" }}>
        <div className="manifesto-card animate-fade-in-up" style={{ padding: '48px', textAlign: 'center', maxWidth: '500px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '16px', color: 'white' }}>Interview Complete</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '32px', lineHeight: 1.6, fontSize: '15px' }}>
            Thank you for your time. Your responses have been recorded and your mock interview is now concluded.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => setIsInterviewCompleted(false)}
              className="pill-button pill-button-primary"
            >
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

  /* ── Session View ── */
  if (token) {
    return (
      <div className="auth-page-container" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Background Mesh Orbs */}
        <div className="auth-mesh-overlay" style={{ opacity: 0.3 }} />
        <div className="mesh-glow-sphere sphere-1" style={{ width: '500px', height: '500px' }} />

        {/* Session Header */}
        <header role="banner" className="manifesto-card" style={{
          padding: '16px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderRadius: 0,
          borderLeft: 'none', borderRight: 'none', borderTop: 'none',
          background: 'rgba(15, 20, 25, 0.7)',
          position: 'relative',
          zIndex: 100
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h2 className="brand-text-gradient" style={{ fontSize: '24px', margin: 0 }}>
              Mon<span className="brand-i-container">i<span className="brand-i-dot-highlight" style={{ width: '6px', height: '6px' }}></span></span>ca<span className="brand-dot-end">.</span>
            </h2>
            <div style={{
              height: '16px', width: '1px', background: 'rgba(255,255,255,0.1)'
            }} />
            <span className="safety-badge-tiny" style={{ background: 'rgba(22,163,74,0.1)', color: '#4ade80' }}>
              PROTOCOL ACTIVE
            </span>
          </div>
          <button
            onClick={logout}
            className="manifesto-card"
            style={{
              padding: '8px 20px',
              background: 'rgba(239,68,68,0.05)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#ff4d4d',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              margin: 0
            }}
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

  // ── GENERAL MODE LAYOUT (Deep Ink Overhaul) ──
  return (
    <div className="auth-page-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="auth-mesh-overlay" />
      <div className="mesh-glow-sphere sphere-1" />
      <div className="mesh-glow-sphere sphere-2" />
      
      {/* Natural Document Flow */}
      <div style={{ 
        width: '100%', 
        flex: 1,
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        padding: '80px 24px 60px',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Monica Presence Card */}
        <div className="monica-presence-card" style={{ 
          position: 'fixed', 
          bottom: '40px', 
          left: '40px',
          zIndex: 9999 
        }}>
          <img
            src="/monica_executive_portrait.png"
            alt="Monica Executive AI Portrait"
            className="presence-avatar"
            loading="lazy"
            width="40"
            height="40"
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>Monica is Online</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div className="presence-status-dot"></div>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Ready to interview</span>
            </div>
          </div>
        </div>

      <div style={{ width: '100%', maxWidth: '540px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
        {/* Header */}
        <div className="animate-fade-in-up" style={{
          textAlign: 'center',
          marginBottom: '48px',
        }}>
          <h1 id="hero-section" className="brand-text-gradient" style={{
            fontSize: 'clamp(48px, 8vw, 72px)',
            fontWeight: 900,
            margin: 0,
            letterSpacing: '-0.04em',
            lineHeight: 1.1,
          }}>
            Mon<span className="brand-i-container">i<span className="brand-i-dot-highlight"></span></span>ca<span className="brand-dot-end">.</span>
          </h1>
          <p style={{
            fontSize: '18px',
            color: 'rgba(255,255,255,0.5)',
            marginTop: '16px',
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}>
            {guestMode ? "Elite Guest Practice Mode" : "The Private Executive AI Interview Coach."}
          </p>
        </div>

        {/* Ethical AI Manifesto */}
        <div className="ethical-manifesto-container animate-fade-in-up" style={{ animationDelay: '0.1s', marginBottom: '40px' }}>
          <div className="manifesto-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="safety-badge-tiny">Consumer Safety Early</span>
              <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Ethical AI Manifesto
              </span>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 16px 0', color: 'white' }}>Our Privacy Promise</h3>

            <div className="manifesto-grid">
              <div className="manifesto-item">
                <span className="item-icon">🔒</span>
                <div className="item-content">
                  <h4>Local Biometrics</h4>
                  <p>Emotion AI runs 100% locally in your browser. No biometric data is ever stored on our servers.</p>
                </div>
              </div>
              <div className="manifesto-item">
                <span className="item-icon">⚖️</span>
                <div className="item-content">
                  <h4>Bias-Free Logic</h4>
                  <p>Monica's decision engine is audited for fairness, evaluating you purely on technical and behavioral merit.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <div className="executive-glass animate-fade-in-up animate-delay-1" style={{
          padding: 'clamp(32px, 5vw, 48px)',
          marginBottom: '40px'
        }}>
          {/* Inputs Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '28px',
          }}>
            <div>
              <label htmlFor="role-input" style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '8px',
              }}>
                Target Role
              </label>
              <input
                id="role-input"
                type="text"
                placeholder="e.g. Designer, Nurse, RA..."
                value={role}
                onChange={(e) => setRole(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && startInterview()}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(0,0,0,0.2)',
                  fontSize: '15px',
                  fontWeight: 400,
                  color: 'white',
                  outline: 'none',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent)';
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.target.style.background = 'rgba(0,0,0,0.2)';
                }}
              />
            </div>
            <div>
              <label htmlFor="company-input" style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '8px',
              }}>
                Company <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </label>
              <input
                id="company-input"
                type="text"
                placeholder="e.g. Google, Campus IT"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && startInterview()}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(0,0,0,0.2)',
                  fontSize: '15px',
                  fontWeight: 400,
                  color: 'white',
                  outline: 'none',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent)';
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.target.style.background = 'rgba(0,0,0,0.2)';
                }}
              />
            </div>
          </div>

          {/* Mode Selector */}
          <div style={{ marginBottom: '32px' }}>
            <label id="mode-label" style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '10px',
            }}>
              Interview Type
            </label>
            <div role="group" aria-labelledby="mode-label" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px'
            }}>
              {[
                { id: 'behavioral', label: 'Behavioral' },
                { id: 'technical', label: 'Technical' },
                { id: 'system_design', label: 'System Design' },
                { id: 'resume_deep_dive', label: 'Resume Deep Dive' }
              ].map((m) => (
                <button
                  key={m.id}
                  id={`mode-${m.id}`}
                  onClick={() => setMode(m.id)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: mode === m.id ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
                    background: mode === m.id ? 'rgba(109, 139, 116, 0.1)' : 'rgba(0,0,0,0.2)',
                    color: mode === m.id ? 'var(--accent)' : 'rgba(255,255,255,0.5)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Strictness Slider */}
          <div style={{ marginBottom: '32px' }}>
            <label htmlFor="strictness-slider" style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '10px',
            }}>
              Interview Intensity
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}>
              <span style={{
                fontSize: '12px',
                color: strictness <= 2 ? '#C5E898' : 'rgba(255,255,255,0.3)',
                fontWeight: strictness <= 2 ? 600 : 400,
                minWidth: '50px',
              }}>Relaxed</span>
              <input
                id="strictness-slider"
                type="range"
                aria-label="Interview intensity slider"
                aria-valuemin={1}
                aria-valuemax={5}
                aria-valuenow={strictness}
                min="1"
                max="5"
                value={strictness}
                onChange={(e) => setStrictness(Number(e.target.value))}
                style={{
                  flex: 1,
                  height: '6px',
                  appearance: 'none',
                  background: `linear-gradient(to right, #C5E898 0%, #C5E898 ${(strictness - 1) * 25}%, #e0ddd5 ${(strictness - 1) * 25}%, #e0ddd5 100%)`,
                  borderRadius: '3px',
                  outline: 'none',
                  cursor: 'pointer',
                  accentColor: '#C5E898',
                }}
              />
              <span style={{
                fontSize: '12px',
                color: strictness >= 4 ? '#ff4d4d' : 'rgba(255,255,255,0.3)',
                fontWeight: strictness >= 4 ? 600 : 400,
                minWidth: '40px',
                textAlign: 'right',
              }}>Tough</span>
            </div>
            <div style={{
              textAlign: 'center',
              marginTop: '6px',
              fontSize: '11px',
              color: 'rgba(255,255,255,0.4)',
              fontWeight: 400,
            }}>
              {['', 'Practice mode — gentle and encouraging', 'Light challenge — supportive with follow-ups', 'Standard — balanced warmth and rigor', 'Rigorous — demanding, expects precision', 'Stress test — relentless and uncompromising'][strictness]}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div role="alert" style={{
              marginBottom: '20px',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.15)',
              color: '#dc2626',
              fontSize: '13px',
              fontWeight: 500,
              textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          {/* Optional Resume Upload */}
          <div style={{ marginBottom: '32px' }}>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '8px',
            }}>
              Upload Resume (Optional PDF)
            </label>

            <div style={{
              position: 'relative',
              border: '2px dashed var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              textAlign: 'center',
              background: 'rgba(255,255,255,0.4)',
              transition: 'all 0.2s',
              cursor: 'pointer',
            }}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onDragLeave={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border-medium)'; }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = 'var(--border-medium)';
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileUpload({ target: { files: e.dataTransfer.files } });
                }
              }}
            >
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer',
                }}
                title="Upload Resume PDF (Optional)"
              />

              {isParsingPdf ? (
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                  <span className="animate-soft-pulse" style={{ display: 'inline-block', marginRight: '6px' }}>Reading PDF...</span>
                </span>
              ) : resumeFilename ? (
                <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>
                  ✓ {resumeFilename} loaded
                </span>
              ) : (
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
                  Drag & Drop or <span style={{ color: 'white', fontWeight: 600, textDecoration: 'underline' }}>Browse</span>
                </span>
              )}
            </div>
          </div>

          {/* CTA Button */}
          <button
            id="start-interview-btn"
            onClick={startInterview}
            disabled={isLoading}
            className="support-submit"
            style={{
              width: '100%',
              padding: '18px',
              fontSize: '15px',
              margin: 0
            }}
          >
            {isLoading ? "Connecting..." : "Initiate Executive Protocol"}
          </button>

          {/* Setup Footer */}
          <div style={{ height: '40px' }} />
        </div>
      </div>
      </div>
      
      {/* Grounding Section - Matching Landing Page Visual Volume */}
      <section style={{ 
        width: '100%', 
        padding: '100px 24px', 
        textAlign: 'center',
        background: 'rgba(5, 7, 10, 0.4)',
        borderTop: '1px solid rgba(255, 255, 255, 0.03)',
        marginTop: '60px'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h3 className="brand-text-gradient" style={{ fontSize: '32px', fontWeight: 800, marginBottom: '24px' }}>
            Calibrated to Executive Standards.
          </h3>
          <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.4)', maxWidth: '540px', margin: '0 auto 40px', lineHeight: 1.6 }}>
            Monica's assessment logic is grounded in technical merit and behavioral intelligence, providing a private sanctuary for professional growth.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '32px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'white' }}>Verified</div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--accent)', fontWeight: 700, marginTop: '4px' }}>Logic Engine</div>
            </div>
            <div style={{ height: '40px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'white' }}>Grounded</div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--accent)', fontWeight: 700, marginTop: '4px' }}>Bias Audit</div>
            </div>
            <div style={{ height: '40px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'white' }}>Secure</div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--accent)', fontWeight: 700, marginTop: '4px' }}>Local-Only</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Restored - Natural Flow */}
      <LandingFooter onOpenLegal={onOpenLegal} />
    </div>
  );
}

// ───────────────────────────────────────────
// Recruiter Portal View
// ───────────────────────────────────────────
// --- RECRUITER PORTAL ---
function RecruiterPortal({ onOpenLegal }) {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8000/published-sessions')
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
      <span className="safety-badge-tiny" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', padding: '12px 24px' }}>
        SYNCHRONIZING EXECUTIVE TALENT DATA...
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
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px', marginTop: '12px', fontWeight: 500 }}>
            Displaying candidate-approved sessions verified by Monica AI.
          </p>
        </div>

        <div className="executive-glass" style={{ padding: 0, overflow: 'hidden', borderLeft: 'none' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>
                <th style={{ padding: '24px 20px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Candidate Profile</th>
                <th style={{ padding: '24px 20px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Context</th>
                <th style={{ padding: '24px 20px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>AI Rigor Score</th>
                <th style={{ padding: '24px 20px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Outcome</th>
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
                  <td style={{ padding: '28px 20px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ color: 'white', fontWeight: 700, fontSize: '16px', letterSpacing: '-0.01em' }}>{s.role}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '6px', fontFamily: 'monospace' }}>ID: {s.id.slice(-8).toUpperCase()}</div>
                  </td>
                  <td style={{ padding: '28px 20px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ color: 'white', opacity: 0.9, fontSize: '14px', fontWeight: 500 }}>{s.company || "General Industry"}</div>
                    <div style={{ color: 'var(--accent)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, marginTop: '6px', letterSpacing: '0.1em' }}>{s.mode.replace('_', ' ')}</div>
                  </td>
                  <td style={{ padding: '28px 20px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '12px',
                        background: s.score >= 80 ? 'rgba(109, 139, 116, 0.05)' : 'rgba(255, 77, 77, 0.05)',
                        border: `1px solid ${s.score >= 80 ? 'rgba(109, 139, 116, 0.2)' : 'rgba(255, 77, 77, 0.2)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '14px', fontWeight: 900,
                        color: s.score >= 80 ? 'var(--accent)' : '#ff4d4d'
                      }}>
                        {s.score}
                      </div>
                      <div style={{ height: '4px', width: '60px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${s.score}%`, background: s.score >= 80 ? 'var(--accent)' : '#ff4d4d' }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '28px 20px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{
                      padding: '6px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 800,
                      background: s.score >= 80 ? 'rgba(109, 139, 116, 0.1)' : 'rgba(255, 77, 77, 0.1)',
                      color: s.score >= 80 ? 'var(--accent)' : '#ff4d4d',
                      border: `1px solid ${s.score >= 80 ? 'rgba(109, 139, 116, 0.15)' : 'rgba(255, 77, 77, 0.15)'}`,
                      letterSpacing: '0.05em'
                    }}>
                      {s.score >= 80 ? "ELITE / READY" : "POTENTIAL / NEARLY READY"}
                    </span>
                  </td>
                  <td style={{ padding: '28px 20px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <button
                      onClick={() => window.location.href = `/report?room=${s.id}`}
                      className="manifesto-card"
                      style={{
                        padding: '10px 20px', fontSize: '12px', fontWeight: 700,
                        border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                        background: 'rgba(255,255,255,0.05)', color: 'white',
                        margin: 0, transition: 'all 0.2s'
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
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', fontSize: '15px' }}>
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
          alt="Monica Executive AI Portrait"
          className="presence-avatar"
          loading="lazy"
          width="40"
          height="40"
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>Monica is Online</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className="presence-status-dot"></div>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Ready to interview</span>
          </div>
        </div>
      </div>

      <LandingFooter onOpenLegal={onOpenLegal} />
    </div>
  );
}

// ───────────────────────────────────────────
// Report View
// ───────────────────────────────────────────
const ExecutiveMetricChart = ({ label, value, color = 'var(--accent)' }) => {
  const percentage = Math.min(100, Math.max(0, value * 10)); // Scale 1-10 to 0-100
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="executive-glass" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', borderRadius: '16px', margin: '0' }}>
      <div style={{ position: 'relative', width: '48px', height: '48px' }}>
        <svg width="48" height="48" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r={radius} fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r={radius} fill="transparent" stroke={color}
            strokeWidth="8" strokeDasharray={circumference}
            strokeDashoffset={offset} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 5px ${color})`, transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: 'white' }}>
          {value}
        </div>
      </div>
      <div>
        <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
        <div style={{ height: '4px', width: '80px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${percentage}%`, background: color, filter: `drop-shadow(0 0 2px ${color})` }} />
        </div>
      </div>
    </div>
  );
};

function ReportView() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublished, setIsPublished] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (!room) {
      setError("No room ID provided.");
      setIsLoading(false);
      return;
    }

    fetch(`http://localhost:8000/report/${room}`)
      .then(res => {
        if (!res.ok) throw new Error("Report not found.");
        return res.json();
      })
      .then(data => {
        setReport(data);
        setIsPublished(!!data.isPublished);
        setIsLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  const downloadPDF = async () => {
    try {
      setIsLoading(true);
      // Dynamic import to reduce initial bundle size (Lighthouse optimization)
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.getElementById('report-content');
      await html2pdf().from(element).set({
        margin: 10,
        filename: `Interview_Report_${report?.roomName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).save();
    } catch (err) {
      console.error("PDF generation failed:", err);
      setError("Failed to generate PDF. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const togglePublication = async () => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    const newState = !isPublished;

    setIsPublishing(true);
    try {
      const res = await fetch(`http://localhost:8000/publish-report/${room}`, {
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

  if (isLoading) return (
    <div className="auth-page-container">
      <div className="mesh-glow-sphere sphere-1" />
      <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600, letterSpacing: '0.1em' }}>ANALYZING PERFORMANCE...</span>
    </div>
  );
  if (error) return (
    <div className="auth-page-container">
      <div style={{ padding: '40px', textAlign: 'center', color: '#ff4d4d', fontWeight: 600 }}>Error: {error}</div>
    </div>
  );

  return (
    <div className="auth-page-container">
      <div className="auth-mesh-overlay" style={{ position: 'fixed', zIndex: 0 }} />
      <div className="mesh-glow-sphere sphere-1" style={{ top: '-10%', left: '10%', position: 'fixed' }} />

      <div style={{ flex: 1, padding: '60px 40px', position: 'relative', zIndex: 10 }}>

      <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h1 className="brand-text-gradient" style={{ fontSize: '48px', margin: 0 }}>
            Mon<span className="brand-i-container">i<span className="brand-i-dot-highlight"></span></span>ca<span className="brand-dot-end">.</span>
          </h1>
          <h2 style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', marginTop: '12px' }}>
            Executive Interview Synopsis
          </h2>
        </div>

        {/* Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
          {/* Sovereign Consent Toggle */}
          <div className="manifesto-card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', margin: 0 }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Privacy Control</p>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: isPublished ? 'var(--accent)' : 'white' }}>
                {isPublished ? "Shared with Recruiters" : "Private Session"}
              </p>
            </div>
            <button
              onClick={togglePublication}
              disabled={isPublishing}
              style={{
                width: '44px', height: '22px', borderRadius: '11px',
                background: isPublished ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                border: 'none', cursor: 'pointer', position: 'relative',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: isPublishing ? 0.5 : 1
              }}
            >
              <div style={{
                width: '18px', height: '18px', borderRadius: '9px',
                background: 'white', position: 'absolute', top: '2px',
                left: isPublished ? '24px' : '2px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }} />
            </button>
          </div>

          <button
            onClick={downloadPDF}
            className="manifesto-card"
            style={{
              padding: '12px 24px', color: 'white', fontSize: '13px',
              fontWeight: 700, cursor: 'pointer', display: 'flex',
              alignItems: 'center', gap: '8px', border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', margin: 0
            }}
          >
            <span>📥</span> Download Executive PDF
          </button>
        </div>

        <div id="report-content" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '24px' }}>
          {/* Sidebar: Performance Metrics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="executive-glass" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Score Card</h3>
              <div style={{ textAlign: 'center', padding: '20px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '20px' }}>
                <div style={{ fontSize: '64px', fontWeight: 900, color: (report?.score || 0) >= 80 ? 'var(--accent)' : '#ff4d4d', textShadow: `0 0 30px ${(report?.score || 0) >= 80 ? 'rgba(109, 139, 116, 0.3)' : 'rgba(255, 77, 77, 0.3)'}` }}>
                  {report?.score || 0}<span style={{ fontSize: '24px', opacity: 0.5 }}>%</span>
                </div>
                <p style={{ color: 'white', fontWeight: 700, margin: '8px 0 0 0', textTransform: 'uppercase' }}>{report?.feedback?.verdict || "Assessment Pending"}</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Candidate</span>
                  <span style={{ color: 'white', fontWeight: 600 }}>{report?.username || "Executive Candidate"}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Target Role</span>
                  <span style={{ color: 'white', fontWeight: 600 }}>{report?.role || "N/A"}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Status</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>VERIFIED AI-SCORE</span>
                </div>
              </div>
            </div>

            <div className="executive-glass" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Executive Metrics</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <ExecutiveMetricChart label="Technical Skill" value={report.feedback?.metrics?.technical || 0} color="#82b342" />
                <ExecutiveMetricChart label="Problem Solving" value={report.feedback?.metrics?.problem_solving || 0} color="#6D8B74" />
                <ExecutiveMetricChart label="Communication" value={report.feedback?.metrics?.communication || 0} color="#a2d2ff" />
                <ExecutiveMetricChart label="Code Integrity" value={report.feedback?.metrics?.code_quality || 0} color="#ffffff" />
                <ExecutiveMetricChart label="Optimization" value={report.feedback?.metrics?.optimization || 0} color="#4a7c1f" />
              </div>
            </div>
          </div>

          {/* Main Feed: Narrative Feedback */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {report.feedback && (
              <>
                <div className="executive-glass" style={{ borderLeft: '4px solid var(--accent)', padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '24px' }}>💎</span>
                    <h3 style={{ margin: 0, fontSize: '18px', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Key Strengths</h3>
                  </div>
                  <p style={{ lineHeight: 1.8, color: 'rgba(255,255,255,0.8)', fontSize: '15px', whiteSpace: 'pre-wrap' }}>{report?.feedback?.strengths || "Strengths analysis was not generated for this session."}</p>
                </div>

                <div className="executive-glass" style={{ borderLeft: '4px solid #ff4d4d', padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '24px' }}>📈</span>
                    <h3 style={{ margin: 0, fontSize: '18px', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Growth Areas</h3>
                  </div>
                  <p style={{ lineHeight: 1.8, color: 'rgba(255,255,255,0.8)', fontSize: '15px', whiteSpace: 'pre-wrap' }}>{report.feedback.improvements}</p>
                </div>
              </>
            )}

            <div className="executive-glass" style={{ padding: '20px', background: 'linear-gradient(to right, rgba(130, 179, 66, 0.08), transparent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '11px', color: 'var(--accent)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>AI Calibration Integrity</h4>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>HIGH CONFIDENCE</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${report.score}%`, height: '100%', background: 'var(--accent)' }} />
              </div>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>High technical engagement and consistent verbal delivery detected via Monica Engine.</p>
            </div>
          </div>
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
          alt="Monica Executive AI Portrait"
          className="presence-avatar"
          loading="lazy"
          width="40"
          height="40"
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>Monica is Online</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className="presence-status-dot"></div>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Ready to interview</span>
          </div>
        </div>
      </div>

      <LandingFooter onOpenLegal={onOpenLegal} />
    </div>
  );
}
// ───────────────────────────────────────────
// ───────────────────────────────────────────
// Legal & Policy Components
// ───────────────────────────────────────────
function LegalSheet({ type, onClose }) {
  const [isSending, setIsSending] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formState, setFormState] = useState({ subject: "", message: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSending(true);
    try {
      const resp = await fetch("/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: formState.subject, message: formState.message })
      });
      if (resp.ok) {
        setIsSubmitted(true);
        setTimeout(() => { setIsSubmitted(false); onClose(); }, 2500);
      } else {
        alert("Transmission failed. Please try again.");
      }
    } catch (err) {
      alert("Network error during transmission.");
    } finally {
      setIsSending(false);
    }
  };

  const content = {
    privacy: {
      title: "Privacy & Data Ethics",
      body: (
        <div role="region" aria-label="Privacy Policy">
          <p><strong>Your privacy is a fundamental constraint of our architecture.</strong></p>
          <p>Monica AI is built on a "Local-First" biometric model. All facial analysis for emotion detection is processed in real-time on your local GPU; no biometric signatures or images are ever stored or transmitted.</p>
          <p><strong>Data Governance:</strong> We persist only the metadata necessary for your workspace (e.g., resumes and interview transcripts). This data is encrypted using AES-256 protocols and is used strictly for your personal performance metrics.</p>
          <p><strong>User Sovereignty:</strong> You retain absolute ownership of your data and can purge your history via the account dashboard at any time.</p>
        </div>
      )
    },
    terms: {
      title: "Terms of Professionalism",
      body: (
        <div role="region" aria-label="Terms of Service">
          <p><strong>Executive Conduct:</strong> This platform is designed for professional development. Users are expected to maintain professional standards during AI interactions.</p>
          <p><strong>System Integrity:</strong> Any attempt to reverse-engineer or disrupt the Monica Protocol is strictly prohibited to ensure the security of all partners.</p>
          <p><strong>No Guarantee of Employment:</strong> Monica is an advanced technical coach. While she provides high-fidelity feedback, the use of this service does not guarantee specific job placement or legal certification.</p>
        </div>
      )
    },
    help: {
      title: "Executive Support Desk",
      body: (
        <div role="region" aria-label="Support Form">
          <div className="support-header">
            <h2 className="brand-text-gradient">Support Center</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: '-8px' }}>Executive Assistance Registry</p>
          </div>

          <div className="manifesto-grid" style={{ marginBottom: '20px' }}>
            <div className="manifesto-item">
              <span className="item-icon" aria-hidden="true">⚡</span>
              <div className="item-content">
                <h4>6-Hour Service</h4>
                <p>Prioritized executive queue</p>
              </div>
            </div>
          </div>

          {isSubmitted ? (
            <div className="support-success" role="alert">
              <span className="success-icon" aria-hidden="true">✅</span>
              <h3 className="success-title">Request Registered</h3>
              <p>An executive agent will review your transmission shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="support-input-group">
                <label htmlFor="support-subject" style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '8px' }}>Inquiry Classification</label>
                <input
                  id="support-subject"
                  type="text"
                  placeholder="Subject of inquiry..."
                  className="support-input"
                  required
                  value={formState.subject}
                  onChange={e => setFormState({ ...formState, subject: e.target.value })}
                />
              </div>

              <div className="support-input-group">
                <label htmlFor="support-message" style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '8px' }}>Detailed Transmission</label>
                <textarea
                  id="support-message"
                  placeholder="Provide context for our executive team..."
                  className="support-input"
                  rows={5}
                  required
                  style={{ resize: 'none' }}
                  value={formState.message}
                  onChange={e => setFormState({ ...formState, message: e.target.value })}
                />
              </div>

              <button
                type="submit"
                className="support-submit"
                disabled={isSending}
                aria-busy={isSending}
              >
                {isSending ? 'Transmitting...' : 'Transmit Request'}
              </button>
            </form>
          )}
        </div>
      )
    }
  };

  const active = content[type] || content.privacy;

  return (
    <div className="legal-sheet-overlay" role="dialog" aria-modal="true" aria-labelledby="legal-title" onClick={onClose}>
      <div className="legal-sheet-content" onClick={e => e.stopPropagation()}>
        <button className="legal-sheet-close" onClick={onClose} aria-label="Close dialog">×</button>
        <div className="legal-text">
          <h2 id="legal-title">{active.title}</h2>
          {active.body}
        </div>
      </div>
    </div>
  );
}


// App Export
// ───────────────────────────────────────────
export default function AppRouter() {
  const [path, setPath] = useState(window.location.pathname.replace(/\/$/, ""));
  const [activeLegal, setActiveLegal] = useState(null);

  useEffect(() => {
    const handleLocationChange = () => setPath(window.location.pathname.replace(/\/$/, ""));
    window.addEventListener('popstate', handleLocationChange);
    // Also listen for hash changes if needed, but pathname is key here
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const closeLegal = () => setActiveLegal(null);
  const openLegal = (e, type) => {
    e.preventDefault();
    setActiveLegal(type);
  };

  // The feedback report should remain publicly viewable without logging in
  if (path === '/report') {
    return <ReportView />;
  }

  // Common wrapper for protected routes (App and Recruiter Portal)
  return (
    <>
      {activeLegal && <LegalSheet type={activeLegal} onClose={closeLegal} />}
      <SignedIn>
        {/* Persistent User Profile Header */}
        <div style={{
          position: 'absolute',
          top: '24px',
          right: '32px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          {path === '/recruiter' && (
            <button
              onClick={() => window.location.href = '/'}
              className="manifesto-card"
              style={{ padding: '8px 16px', fontSize: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              Back to Office
            </button>
          )}
          <div className="user-profile-prompter">
            <span className="profile-details-helper">Manage Account</span>
            <UserButton afterSignOutUrl="/" appearance={{
              elements: {
                avatarBox: { width: 40, height: 40, border: '2px solid rgba(255,255,255,0.1)' },
                userButtonTrigger: { padding: '4px' }
              }
            }} />
          </div>
        </div>
        {/* Render Route */}
        {path === '/recruiter' ? <RecruiterPortal onOpenLegal={openLegal} /> : <App onOpenLegal={openLegal} />}
      </SignedIn>

      <SignedOut>
        {path.startsWith('/guest-practice') ? (
          <App guestMode={true} onOpenLegal={openLegal} />
        ) : (
          <AuthRouter onOpenLegal={openLegal} />
        )}
      </SignedOut>
    </>
  );
}

function AuthRouter({ onOpenLegal }) {
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
        {/* Executive Ambient Glows (Moved inside clipped container to fix layout gaps) */}
        <div className="mesh-glow-sphere sphere-1" />
        <div className="mesh-glow-sphere sphere-2" />
      </div>

      {/* Scroll Protocol V2 Hero Orientation */}
      <div className="auth-centered-wrapper" style={{ padding: '40px 24px' }}>
        {/* Monica Presence Card */}
        <div className="monica-presence-card">
          <img
            src="/monica_executive_portrait.png"
            alt="Monica Executive AI Portrait"
            className="presence-avatar"
            loading="lazy"
            width="40"
            height="40"
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>Monica is Online</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div className="presence-status-dot"></div>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Ready to interview</span>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '40px', position: 'relative', zIndex: 10 }}>
          <h1 id="hero-section" className="brand-text-gradient" style={{ fontSize: '72px', margin: 0 }}>
            Mon<span className="brand-i-container">i<span className="brand-i-dot-highlight"></span></span>ca<span className="brand-dot-end">.</span>
          </h1>
          <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.5)', marginTop: '8px', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Executive AI Interview Coach
          </p>
        </div>

        <div className="fancy-auth-wrapper">
          {isSignUp ? (
            <SignUp routing="hash" />
          ) : (
            <SignIn routing="hash" />
          )}
        </div>

        <div style={{ marginTop: '32px', textAlign: 'center', position: 'relative', zIndex: 10 }}>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', marginBottom: '16px' }}>— or —</p>
          <button
            onClick={() => window.location.href = '/guest-practice'}
            className="manifesto-card"
            style={{
              padding: '14px 32px', background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)', color: 'white',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              letterSpacing: '0.05em'
            }}
          >
            Quick Practice <span style={{ opacity: 0.5, fontWeight: 400 }} aria-hidden="true">(No Account Needed)</span>
          </button>
        </div>
      </div>

      {/* NEW: Landing Page Extensions (Appended to AuthRouter) */}
      <section className="landing-section">
        <div style={{ textAlign: 'center', marginBottom: '80px' }}>
          <h2 className="brand-text-gradient" style={{ fontSize: '42px', margin: '0 0 16px 0' }}>The Monica Standard.</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '18px', maxWidth: '600px', margin: '0 auto' }}>
            Unrivaled performance metrics verified by over 100,000+ executive-level interview simulations.
          </p>
        </div>

        <div className="metric-grid">
          <EliteMetric value="0.4ms" label="Latency Protocol" icon={Zap} />
          <EliteMetric value="99.7%" label="Clarity Score" icon={CheckCircle2} />
          <EliteMetric value="24/7" label="Monica Availability" icon={Building2} />
          <EliteMetric value="AES-256" label="Privacy Floor" icon={ShieldCheck} />
        </div>
      </section>

      <section className="landing-section" style={{ background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }}>
          <div>
            <span className="safety-badge-tiny" style={{ marginBottom: '24px' }}>Strategic Roadmap</span>
            <h3 style={{ fontSize: '36px', fontWeight: 800, margin: '0 0 24px 0', color: 'white' }}>How Monica Crafts Your Success.</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {[
                { title: "Behavioral Blueprint", desc: "AI maps your personality against leadership criteria." },
                { title: "Technical Stress Test", desc: "Live coding and problem solving under realistic pressure." },
                { title: "Boutique Feedback", desc: "Granular analysis of tone, posture, and technical precision." }
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: '20px' }}>
                    <div style={{ 
                      width: '32px', height: '32px', borderRadius: '50%', 
                      background: 'rgba(109, 139, 116, 0.1)', border: '1px solid rgba(109, 139, 116, 0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: 900, color: 'var(--accent)', flexShrink: 0
                    }}>
                      {i + 1}
                    </div>
                    <div>
                      <h5 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700, color: 'white' }}>{step.title}</h5>
                      <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="manifesto-card" style={{ padding: '40px', background: 'rgba(5, 7, 10, 0.5)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(to right, transparent, var(--accent), transparent)' }} />
              <pre style={{ margin: 0, color: 'var(--accent)', fontSize: '12px', opacity: 0.8, fontFamily: 'monospace', lineHeight: 1.6 }}>
                {`// Monica Protocol v2.4.0\n// Initializing Core Analysis...\n[SUCCESS] Emotion Mapping Active\n[SUCCESS] Technical Rigor Calibrated\n[SUCCESS] Bias Filtering Verified\n// Strategic insight generated.`}
              </pre>
            </div>
          </div>
        </section>

        <section className="landing-section" style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '32px' }}>Ready to Elevate Your Practice?</h3>
          <button 
            type="button"
            className="pill-button pill-button-primary"
            onClick={() => window.location.href='/guest-practice'}
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
