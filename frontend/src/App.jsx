import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import * as pdfjsLib from 'pdfjs-dist';
// Configure worker for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
import html2pdf from 'html2pdf.js';
import { useEmotionTracker } from './useEmotionTracker';

import './App.css';
import './markdown.css';
import './markdown.css';
import './markdown.css';

const TOKEN_SERVER_URL = "http://localhost:8000/token";
const HEYGEN_TOKEN_URL = "http://localhost:8000/heygen-token";

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
  const textareaRef = useRef(null);

  // Subscribe to all tracks (Camera for self-view, Video + Audio + Unknown for Agent)
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.Unknown, withPlaceholder: false },
    { source: Track.Source.Microphone, withPlaceholder: false }
  ]);

  // Local camera for self-view
  const localTrack = tracks.find(
    t => t.participant?.identity === localParticipant?.identity && t.source === Track.Source.Camera
  );

  // Explicitly grab the agent's remote audio track
  const agentAudioTrack = tracks.find(
    t => !t.participant?.isLocal && (t.source === Track.Source.Microphone || t.source === Track.Source.Unknown) && t.publication?.kind === 'audio'
  );

  // Explicitly grab the agent's remote video track (Tavus Video Stream)
  const agentVideoTrack = tracks.find(
    t => !t.participant?.isLocal && t.source === Track.Source.Camera && t.publication?.kind === 'video'
  );

  const { isLoaded, getEmotionSummary, videoRef } = useEmotionTracker(localTrack);

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
        padding: '12px',
        height: '100%',
        background: '#f0f0eb',
        overflowY: 'auto',
      }}>
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
                <div style={{
                  width: '80px', height: '80px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: '32px', fontWeight: 'bold'
                }}>
                  M
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
            <div className="glass-card" style={{
              flex: 1,
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <span style={{
                fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.15em',
              }}>Session</span>
              <h4 style={{
                fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)',
                margin: '4px 0 2px', lineHeight: 1.3,
              }}>{role}</h4>
              {company && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>at {company}</p>}
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
            <div style={{
              minHeight: '120px',
              maxHeight: '40%',
              overflow: 'auto',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              border: '1px solid var(--border-light)',
              background: '#fff',
              display: 'flex',
              flexDirection: 'column',
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
              {/* Body */}
              <div className="markdown-content" style={{
                flex: 1,
                padding: '16px 20px',
                fontSize: '14px',
                lineHeight: 1.75,
                color: '#1e293b',
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
                <div className="glass-card" style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '12px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border-light)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px' }}>✍️</span>
                      <label htmlFor="written-response" style={{
                        fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.1em',
                      }}>Your Response</label>
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
                        color: code.trim() ? '#1a2e10' : 'var(--text-muted)',
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
                      color: 'var(--text-heading)',
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
                      background: 'rgba(197,232,152,0.15)',
                      borderTop: '1px solid var(--border-light)',
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

  // ── GENERAL MODE LAYOUT ──
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      padding: '16px',
      height: '100%',
      background: '#f0f0eb',
    }}>
      <video ref={videoRef} autoPlay muted playsInline width="160" height="160" style={{ display: 'none' }} />
      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        gap: '16px',
        minHeight: 0,
      }}>
        {/* Monica's Avatar (Interviewer) */}
        <div style={{
          flex: 3,
          position: 'relative',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
          background: '#111827',
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
            />
          ) : (
            <div style={{
              width: '120px', height: '120px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: '48px', fontWeight: 'bold'
            }}>
              M
            </div>
          )}

          {/* Live indicator overlay */}
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <div className="animate-soft-pulse" style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#ef4444',
            }} />
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.7)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              textShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}>
              Live • Monica
            </span>
            {isTyping && (
              <span className="animate-pulse" style={{
                fontSize: '11px', fontWeight: 700, color: '#C5E898',
                letterSpacing: '0.1em', textTransform: 'uppercase',
                textShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}> • Taking notes... 📝</span>
            )}
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
          <div className="glass-card" style={{
            flex: 1,
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
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
                color: 'var(--text-heading)',
                margin: '8px 0 4px',
                lineHeight: 1.3,
              }}>
                {role}
              </h3>
              {company && (
                <p style={{
                  fontSize: '14px',
                  color: 'var(--text-muted)',
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
              borderTop: '1px solid var(--border-light)',
              marginTop: '16px',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
              }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>Status</span>
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
function App() {
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
      const metadataObj = { role, company, mode, strictness };
      if (resumeText) {
        metadataObj.resumePromptContext = `The candidate uploaded their resume. Use this context if relevant to your questions:\n\n${resumeText.substring(0, 3000)}`; // Cap length just in case
      }
      const metadata = JSON.stringify(metadataObj);

      const response = await fetch(`${TOKEN_SERVER_URL}?role=${encodeURIComponent(role)}&metadata=${encodeURIComponent(metadata)}`);
      if (!response.ok) throw new Error("Failed to connect to the backend server.");

      const data = await response.json();
      setToken(data.token);
      setUrl(data.url);
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
        <div className="glass-card animate-fade-in-up" style={{ padding: '48px', textAlign: 'center', maxWidth: '500px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '16px', color: 'var(--text-heading)' }}>Interview Complete</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '32px', lineHeight: 1.6, fontSize: '15px' }}>
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
              href={`/report?room=${room?.name || 'latest'}`}
              target="_blank"
              rel="noreferrer"
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
      <div style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary)',
        fontFamily: "'Inter', sans-serif",
      }}>
        {/* Session Header */}
        <header role="banner" style={{
          padding: '16px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-card)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              fontSize: '18px',
              fontWeight: 800,
              color: 'var(--text-heading)',
              letterSpacing: '-0.02em',
            }}>
              Monica
            </span>
            <span style={{
              fontSize: '11px',
              fontWeight: 500,
              color: '#16a34a',
              background: 'rgba(22,163,74,0.08)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-pill)',
            }}>
              Session Active
            </span>
          </div>
          <button
            onClick={logout}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid rgba(239,68,68,0.2)',
              background: 'rgba(239,68,68,0.05)',
              color: '#dc2626',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.target.style.background = 'rgba(239,68,68,0.1)';
            }}
            onMouseOut={(e) => {
              e.target.style.background = 'rgba(239,68,68,0.05)';
            }}
          >
            End Session
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

  /* ── Landing Page ── */
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      fontFamily: "'Inter', sans-serif",
      background: 'var(--bg-primary)',
    }}>
      <div style={{ width: '100%', maxWidth: '540px' }}>
        {/* Header */}
        <div className="animate-fade-in-up" style={{
          textAlign: 'center',
          marginBottom: '48px',
        }}>
          <h1 style={{
            fontSize: 'clamp(48px, 8vw, 72px)',
            fontWeight: 900,
            color: 'var(--text-heading)',
            margin: 0,
            letterSpacing: '-0.04em',
            lineHeight: 1.1,
          }}>
            Monica<span style={{ color: 'var(--accent)' }}>.</span>
          </h1>
          <p style={{
            fontSize: '15px',
            color: 'var(--text-muted)',
            marginTop: '12px',
            fontWeight: 400,
            letterSpacing: '0.02em',
          }}>
            Executive Interview Coach
          </p>
        </div>

        {/* Form Card */}
        <div className="glass-card animate-fade-in-up animate-delay-1" style={{
          padding: 'clamp(32px, 5vw, 48px)',
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
                color: 'var(--text-muted)',
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
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-primary)',
                  fontSize: '15px',
                  fontWeight: 400,
                  color: 'var(--text-heading)',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#C5E898';
                  e.target.style.boxShadow = '0 0 0 3px rgba(197,232,152,0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border-medium)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
            <div>
              <label htmlFor="company-input" style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted)',
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
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-primary)',
                  fontSize: '15px',
                  fontWeight: 400,
                  color: 'var(--text-heading)',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#C5E898';
                  e.target.style.boxShadow = '0 0 0 3px rgba(197,232,152,0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border-medium)';
                  e.target.style.boxShadow = 'none';
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
              color: 'var(--text-muted)',
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
                    border: mode === m.id ? '2px solid var(--accent)' : '1px solid var(--border-medium)',
                    background: mode === m.id ? 'var(--accent-subtle)' : 'transparent',
                    color: mode === m.id ? '#4a7c1f' : 'var(--text-muted)',
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
              color: 'var(--text-muted)',
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
                color: strictness <= 2 ? '#4a7c1f' : 'var(--text-muted)',
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
                color: strictness >= 4 ? '#dc2626' : 'var(--text-muted)',
                fontWeight: strictness >= 4 ? 600 : 400,
                minWidth: '40px',
                textAlign: 'right',
              }}>Tough</span>
            </div>
            <div style={{
              textAlign: 'center',
              marginTop: '6px',
              fontSize: '11px',
              color: 'var(--text-muted)',
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
              color: 'var(--text-muted)',
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
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  <span className="animate-soft-pulse" style={{ display: 'inline-block', marginRight: '6px' }}>Reading PDF...</span>
                </span>
              ) : resumeFilename ? (
                <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>
                  ✓ {resumeFilename} loaded
                </span>
              ) : (
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Drag & Drop or <span style={{ color: 'var(--text-heading)', fontWeight: 600, textDecoration: 'underline' }}>Browse</span>
                </span>
              )}
            </div>
          </div>

          {/* CTA Button */}
          <button
            id="start-interview-btn"
            onClick={startInterview}
            disabled={isLoading}
            className="pill-button pill-button-primary"
            style={{
              width: '100%',
              padding: '18px',
              fontSize: '15px',
            }}
          >
            {isLoading ? "Connecting..." : "Start Interview"}
          </button>

          {/* Footer Text */}
          <p style={{
            textAlign: 'center',
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginTop: '24px',
            lineHeight: 1.6,
            fontWeight: 400,
          }}>
            Professional interview simulation.
            <br />
            Practice and prepare for any role.
          </p>
        </div>
      </div>
    </main>
  );
}

// ───────────────────────────────────────────
// Recruiter Portal View
// ───────────────────────────────────────────
function RecruiterPortal() {
  const [roomName, setRoomName] = useState("");
  const [token, setToken] = useState(null);
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const joinRoom = async () => {
    if (!roomName.trim()) {
      setError("Please enter a room name.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:8000/recruiter-token?room=${encodeURIComponent(roomName.trim())}`);
      if (!response.ok) throw new Error("Could not fetch recruiter token.");
      const data = await response.json();
      setToken(data.token);
      setUrl(data.url);
    } catch (err) {
      console.error(err);
      setError("Failed to join room. It may not exist.");
    } finally {
      setIsLoading(false);
    }
  };

  if (token) {
    return (
      <LiveKitRoom
        token={token}
        serverUrl={url}
        video={false}
        audio={true}
        connect={true}
        style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f0eb' }}
      >
        <RecruiterStage roomName={roomName} onLeave={() => { setToken(null); setUrl(null); }} />
        <RoomAudioRenderer />
      </LiveKitRoom>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', fontFamily: "'Inter', sans-serif" }}>
      <div className="glass-card animate-fade-in-up" autoFocus style={{ padding: '48px', width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>Recruiter Portal</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px' }}>Silently observe active live sessions.</p>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Active Room Name</label>
          <input type="text" value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="e.g. interview-a1b2c3d4" style={{ width: '100%', padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'rgba(255,255,255,0.6)', fontSize: '15px', color: 'var(--text-heading)' }} />
        </div>
        {error && <div style={{ color: '#dc2626', fontSize: '13px', textAlign: 'center' }}>{error}</div>}
        <button onClick={joinRoom} disabled={isLoading} className="pill-button pill-button-primary" style={{ width: '100%', padding: '16px' }}>
          {isLoading ? "Connecting..." : "Spectate Session"}
        </button>
      </div>
    </main>
  );
}

function RecruiterStage({ roomName, onLeave }) {
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: false },
    { source: Track.Source.Microphone, withPlaceholder: false }
  ]);

  // Find candidate and agent tracks
  const candidateVideo = tracks.find(t => t.participant?.identity.startsWith('user-') && t.source === Track.Source.Camera);
  const agentVideo = tracks.find(t => t.participant?.identity === 'Monica' && t.source === Track.Source.Camera);

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '16px 24px', borderRadius: 'var(--radius-md)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Recruiter Observation</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Room: {roomName}</span>
        </div>
        <button onClick={onLeave} style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', borderRadius: 'var(--radius-pill)', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Leave Session</button>
      </header>

      <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
        {/* Agent Feed */}
        <div style={{ flex: 1, background: '#111827', borderRadius: 'var(--radius-md)', overflow: 'hidden', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {agentVideo ? <VideoTrack trackRef={agentVideo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ color: '#fff', fontSize: '24px' }}>Waiting for Agent...</span>}
          <div style={{ position: 'absolute', bottom: '16px', left: '16px', background: 'rgba(0,0,0,0.6)', padding: '4px 12px', borderRadius: '16px', color: '#fff', fontSize: '12px', fontWeight: 600 }}>Monica (AI)</div>
        </div>

        {/* Candidate Feed */}
        <div style={{ flex: 1, background: '#111827', borderRadius: 'var(--radius-md)', overflow: 'hidden', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {candidateVideo ? <VideoTrack trackRef={candidateVideo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#fff', fontSize: '24px' }}>Waiting for Candidate...</span>}
          <div style={{ position: 'absolute', bottom: '16px', left: '16px', background: 'rgba(0,0,0,0.6)', padding: '4px 12px', borderRadius: '16px', color: '#fff', fontSize: '12px', fontWeight: 600 }}>Candidate</div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────
// Report View
// ───────────────────────────────────────────
function ReportView() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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
        setIsLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  const downloadPDF = () => {
    const element = document.getElementById('report-content');
    html2pdf().from(element).set({
      margin: 10,
      filename: `Interview_Report_${report?.roomName}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).save();
  };

  if (isLoading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Report...</div>;
  if (error) return <div style={{ padding: '40px', textAlign: 'center', color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '40px', background: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <button onClick={downloadPDF} className="pill-button pill-button-primary">Download PDF</button>
      </div>

      <div id="report-content" style={{ maxWidth: '800px', margin: '0 auto', background: '#fff', padding: '48px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
        <header style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '24px', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>AI Interview Feedback Report</h1>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', color: '#64748b', fontSize: '14px' }}>
            <div><strong>Role:</strong> {report.role}</div>
            <div><strong>Company:</strong> {report.company || 'N/A'}</div>
            <div><strong>Mode:</strong> {report.mode}</div>
            <div><strong>Date:</strong> {new Date(report.createdAt).toLocaleString()}</div>
            <div><strong>Final Score:</strong> <span style={{ color: report.score >= 80 ? '#16a34a' : '#ef4444', fontWeight: 700, fontSize: '18px' }}>{report.score}/100</span></div>
          </div>
        </header>

        {report.feedback && (
          <section style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#334155', marginBottom: '16px' }}>Executive Summary</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <h3 style={{ color: '#16a34a', fontSize: '16px', margin: '0 0 8px 0' }}>Strengths</h3>
                <p style={{ color: '#14532d', margin: 0, fontSize: '14px', lineHeight: 1.6 }}>{report.feedback.strengths || "Not recorded."}</p>
              </div>
              <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                <h3 style={{ color: '#dc2626', fontSize: '16px', margin: '0 0 8px 0' }}>Areas for Improvement</h3>
                <p style={{ color: '#7f1d1d', margin: 0, fontSize: '14px', lineHeight: 1.6 }}>{report.feedback.improvements || "Not recorded."}</p>
              </div>
            </div>
          </section>
        )}

        <section>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#334155', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>Session Transcript</h2>
          <div style={{ fontSize: '13px', lineHeight: 1.6, color: '#475569' }}>
            {report.transcript.length > 0 ? report.transcript.map((msg, i) => (
              <div key={i} style={{ marginBottom: '12px' }}>
                <strong style={{ color: msg.speaker === 'Interviewer' ? '#3b82f6' : '#1e293b' }}>{msg.speaker}:</strong>
                <span style={{ marginLeft: '8px' }}>{msg.text}</span>
              </div>
            )) : <p>No transcript available.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────
// App Export
// ───────────────────────────────────────────
export default function AppRouter() {
  const path = window.location.pathname;
  if (path === '/recruiter') {
    return <RecruiterPortal />;
  }
  if (path === '/report') {
    return <ReportView />;
  }
  return <App />;
}