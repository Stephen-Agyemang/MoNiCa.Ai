import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  useLocalParticipant,
  useRoomContext,
  useTracks,
  VideoTrack,
  AudioTrack,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useEmotionTracker } from '../../useEmotionTracker';

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
        <div className="avatar-placeholder" style={{ width: '120px', height: '120px', fontSize: '32px' }}>
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
        <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
          Synchronizing Digital Replica & Biometric Logic...
        </p>
      </div>

      <div style={{
        width: '200px',
        height: '2px',
        background: 'rgba(0,0,0,0.1)',
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
  const [hint, setHint] = useState('');
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

  // Grab the Tavus avatar's remote video track.
  // Tavus always uses identity 'tavus-avatar-agent'; also support name variants.
  const agentVideoTrack = tracks.find(
    t => !t.participant?.isLocal &&
      (
        t.participant?.identity === 'tavus-avatar-agent' ||
        t.participant?.name?.toLowerCase().includes('monica') ||
        t.participant?.identity?.includes('agent')
      ) &&
      t.publication?.kind === 'video'
  );

  const { isLoaded, getEmotionSummary, videoRef, emotions } = useEmotionTracker(localTrack);

  // Track Agent Connection — trigger on audio OR video, plus a 15s timeout failsafe
  useEffect(() => {
    if (agentVideoTrack || agentAudioTrack) {
      setIsAgentConnected(true);
    }
  }, [agentVideoTrack, agentAudioTrack]);

  // Failsafe: always dismiss overlay after 15 seconds so session is never permanently locked
  useEffect(() => {
    const timer = setTimeout(() => setIsAgentConnected(true), 15000);
    return () => clearTimeout(timer);
  }, []);

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
          setQuestion(data.content);
          setHint('');          // clear previous hints on new question
          setCode('');
          setSubmitFeedback('');
        }
        else if (data.type === 'hint') {
          setHint(prev => prev ? prev + '\n\n' + data.content : data.content);
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

  // ── EMOTION TRACKER HUD ──
  const renderEmotionHUD = () => {
    if (!isLoaded) return null;
    const currentEmotion = emotions && emotions.length > 0 ? emotions[emotions.length - 1].emotion : 'Scanning...';
    const recent = emotions ? emotions.slice(-20) : [];
    const positive = recent.filter(e => ['neutral', 'happy', 'surprised'].includes(e.emotion)).length;
    const composureScore = recent.length > 0 ? Math.round((positive / recent.length) * 100) : 100;
    
    // Determine color based on composure
    const scoreColor = composureScore >= 70 ? 'var(--accent)' : composureScore >= 40 ? '#fbbf24' : '#ef4444';

    return (
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '8px'
      }}>
        {/* Top Tag: Emotion Label */}
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <div style={{
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-pill)',
            fontSize: '10px',
            fontWeight: 700,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div className="animate-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: scoreColor }} />
            {currentEmotion.toUpperCase()}
          </div>
        </div>

        {/* Bottom Bar: Composure Meter */}
        <div style={{
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          padding: '6px 10px',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Composure</span>
            <span style={{ fontSize: '9px', fontWeight: 700, color: scoreColor }}>{composureScore}%</span>
          </div>
          <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${composureScore}%`, height: '100%', background: scoreColor, transition: 'all 0.3s ease' }} />
          </div>
        </div>
      </div>
    );
  };

  // ── TECHNICAL MODE LAYOUT ──
  if (mode === 'technical') {
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
        {!isAgentConnected && <InductionOverlay />}
        <video ref={videoRef} autoPlay muted playsInline style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', width: '1px', height: '1px' }} />
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
                    objectFit: 'cover',
                  }}
                />
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
                  fontSize: '9px', fontWeight: 600, color: 'rgba(0,0,0,0.7)',
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
              {renderEmotionHUD()}
            </div>

            {/* Session Info */}
            <div className="settings-card" style={{
              flex: 1,
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              margin: 0
            }}>
              <span style={{
                fontSize: '9px', fontWeight: 700, color: 'rgba(0,0,0,0.4)',
                textTransform: 'uppercase', letterSpacing: '0.15em',
              }}>Contextual Protocol</span>
              <h4 style={{
                fontSize: '16px', fontWeight: 700, color: '#1e293b',
                margin: '4px 0 2px', lineHeight: 1.3,
              }}>{role}</h4>
              {company && <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)', margin: 0 }}>at {company}</p>}
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
            <div className="settings-card" style={{
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
                    color: 'rgba(0,0,0,0.4)',
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
              }}>
                {question ? (
                  <>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                      {question}
                    </ReactMarkdown>
                    {hint && (
                      <div style={{
                        marginTop: '8px',
                        padding: '12px 16px',
                        background: 'rgba(251,191,36,0.08)',
                        border: '1px solid rgba(251,191,36,0.25)',
                        borderRadius: '10px',
                        fontSize: '13px',
                        color: '#fbbf24',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                      }}>
                        💡 {hint}
                      </div>
                    )}
                  </>
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
                        fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.5)',
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
                <div className="settings-card" style={{
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
                        fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.4)',
                        textTransform: 'uppercase', letterSpacing: '0.1em',
                      }}>Direct Response</label>
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
                      color: '#1e293b',
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
    <div className="auth-page-container" style={{ height: '100%', minHeight: 0, maxHeight: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {!isAgentConnected && <InductionOverlay />}
      <div className="auth-mesh-overlay" style={{ opacity: 0.2 }} />
      <div className="mesh-glow-sphere sphere-1" style={{ width: '400px', height: '400px', opacity: 0.3 }} />
      <div className="mesh-glow-sphere sphere-2" style={{ width: '300px', height: '300px', opacity: 0.2 }} />

      <video ref={videoRef} autoPlay muted playsInline style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', width: '1px', height: '1px' }} />

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        gap: '16px',
        padding: '16px 16px 20px',
        height: '100%',
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
          background: 'rgba(255,255,255,0.6)',
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
                objectFit: 'cover',
              }}
              onSubscriptionStatusChanged={(status) => {
                console.log('Monica Video Subscription Status:', status);
              }}
            />
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

          {/* Monica Engine Status Overlay */}
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
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
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Monica Engine</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }}></div>
                <span style={{ fontSize: '9px', color: 'rgba(0,0,0,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Biometric Sync Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div style={{
          width: '260px',
          minWidth: '220px',
          maxWidth: '280px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          flexShrink: 0,
        }}>
          {/* Self View */}
          <div style={{
            height: '180px',
            flexShrink: 0,
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
            {renderEmotionHUD()}
          </div>

          {agentAudioTrack && <AudioTrack trackRef={agentAudioTrack} />}

          {/* Interview Info Card */}
          <div className="settings-card" style={{
            flex: 1,
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            margin: 0,
            minHeight: 0,
            overflow: 'hidden'
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
                color: '#1e293b',
                margin: '8px 0 4px',
                lineHeight: 1.3,
              }}>
                {role}
              </h3>
              {company && (
                <p style={{
                  fontSize: '14px',
                  color: 'rgba(0,0,0,0.5)',
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
              marginTop: '8px',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
              }}>
                <span style={{ fontSize: '11px', color: 'rgba(0,0,0,0.4)', fontWeight: 500 }}>Status</span>
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
export default MainStage;
