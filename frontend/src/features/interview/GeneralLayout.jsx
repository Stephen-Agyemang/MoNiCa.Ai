import React, { useState } from 'react';
import { VideoTrack, AudioTrack } from '@livekit/components-react';
import InductionOverlay from './InductionOverlay';
import TavusPlayer from './TavusPlayer';
import EmotionHUD from './EmotionHUD';
import TranscriptPanel from './TranscriptPanel';

export default function GeneralLayout({
  role, company, mode,
  showOverlay, isOverlayFadingOut,
  videoRef, localTrack,
  agentVideoTrack, agentAudioTrack,
  isLoaded, emotions,
  liveGrade,
  transcriptEntries, sessionStartTime,
  isTranscriptionSupported,
  getLiveWpm, getLiveFillerCount,
  isRecording,
}) {
  const [showTranscript, setShowTranscript] = useState(true);

  const composureScore = emotions.length > 0
    ? Math.round(
        emotions.slice(-20).filter(e => ['neutral', 'happy', 'surprised'].includes(e.emotion)).length /
        Math.min(emotions.length, 20) * 100
      )
    : null;

  return (
    <div className="auth-page-container" style={{ height: '100%', minHeight: 0, maxHeight: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {showOverlay && <InductionOverlay show={showOverlay} fadeOut={isOverlayFadingOut} />}
      <div className="auth-mesh-overlay" style={{ opacity: 0.2 }} />
      <div className="mesh-glow-sphere sphere-1" style={{ width: '400px', height: '400px', opacity: 0.3 }} />
      <div className="mesh-glow-sphere sphere-2" style={{ width: '300px', height: '300px', opacity: 0.2 }} />

      <video ref={videoRef} autoPlay muted playsInline style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', width: '1px', height: '1px' }} />

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
          background: 'rgba(15, 20, 25, 0.45)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(130, 179, 66, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
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
            background: 'rgba(15, 20, 25, 0.65)',
            padding: '10px 18px',
            borderRadius: '100px',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            zIndex: 10
          }}>
            <div className="monica-waveform" style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '14px' }}>
              <style dangerouslySetInnerHTML={{ __html: `
                @keyframes waveform-jump {
                  0% { height: 4px; }
                  100% { height: 16px; }
                }
              `}} />
              <div className="waveform-bar" style={{ width: '2px', background: 'var(--accent)', borderRadius: '1px', height: '4px', animation: 'waveform-jump 0.6s ease-in-out infinite alternate', animationDelay: '0.1s' }}></div>
              <div className="waveform-bar" style={{ width: '2px', background: 'var(--accent)', borderRadius: '1px', height: '4px', animation: 'waveform-jump 0.6s ease-in-out infinite alternate', animationDelay: '0.3s' }}></div>
              <div className="waveform-bar" style={{ width: '2px', background: 'var(--accent)', borderRadius: '1px', height: '4px', animation: 'waveform-jump 0.6s ease-in-out infinite alternate', animationDelay: '0.2s' }}></div>
              <div className="waveform-bar" style={{ width: '2px', background: 'var(--accent)', borderRadius: '1px', height: '4px', animation: 'waveform-jump 0.6s ease-in-out infinite alternate', animationDelay: '0.4s' }}></div>
              <div className="waveform-bar" style={{ width: '2px', background: 'var(--accent)', borderRadius: '1px', height: '4px', animation: 'waveform-jump 0.6s ease-in-out infinite alternate', animationDelay: '0.5s' }}></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>Monica Engine</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }}></div>
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Biometric Sync Active</span>
              </div>
            </div>
          </div>

          {/* Recording indicator */}
          {isRecording && (
            <div style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(15, 20, 25, 0.65)',
              padding: '6px 12px',
              borderRadius: '100px',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.08)',
              zIndex: 10,
            }}>
              <div style={{
                width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444',
                boxShadow: '0 0 8px #ef4444',
                animation: 'soft-pulse 1.5s ease-in-out infinite',
              }} />
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#ffffff', letterSpacing: '0.08em', textTransform: 'uppercase' }}>REC</span>
            </div>
          )}
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
          minHeight: 0,
          overflow: 'hidden',
        }}>
          {/* Self View */}
          <div style={{
            height: '160px',
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
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              />
            )}
            <EmotionHUD isLoaded={isLoaded} emotions={emotions} />
          </div>

          {agentAudioTrack && !agentVideoTrack && <AudioTrack trackRef={agentAudioTrack} />}

          {/* Session Info + Engagement Card */}
          <div className="settings-card" style={{
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            margin: 0,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              Current Session
            </span>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', margin: '6px 0 2px', lineHeight: 1.3 }}>
              {role}
            </h3>
            {company && (
              <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', margin: '0 0 8px' }}>at {company}</p>
            )}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--accent-subtle)', color: '#4a7c1f', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {mode} Phase
              </span>
              {liveGrade !== null && (
                <span style={{ fontSize: '10px', fontWeight: 600, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'rgba(56,189,248,0.1)', color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Live Grade: {liveGrade}/100
                </span>
              )}
            </div>

            {/* Engagement metrics row */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>WPM</span>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#93c5fd', lineHeight: 1.2 }}>
                  {getLiveWpm()}
                </div>
              </div>
              {composureScore !== null && (
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Composure</span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: composureScore >= 70 ? '#4ade80' : composureScore >= 40 ? '#fbbf24' : '#f87171', lineHeight: 1.2 }}>
                    {composureScore}%
                  </div>
                </div>
              )}
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Fillers</span>
                <div style={{ fontSize: '18px', fontWeight: 800, color: getLiveFillerCount() > 10 ? '#f87171' : 'rgba(255,255,255,0.7)', lineHeight: 1.2 }}>
                  {getLiveFillerCount()}
                </div>
              </div>
            </div>
          </div>

          {/* Live Transcript Card */}
          <div className="settings-card" style={{
            flex: 1,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            margin: 0,
            minHeight: 0,
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexShrink: 0 }}>
              <button
                onClick={() => setShowTranscript(v => !v)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.15em',
                  display: 'flex', alignItems: 'center', gap: '4px', padding: 0,
                }}
              >
                Transcript {showTranscript ? '▾' : '▸'}
              </button>
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', fontWeight: 500 }}>
                {transcriptEntries.filter(e => e.isFinal).length} entries
              </span>
            </div>
            {showTranscript && (
              <TranscriptPanel
                entries={transcriptEntries}
                sessionStartTime={sessionStartTime}
                isSupported={isTranscriptionSupported}
                compact
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
