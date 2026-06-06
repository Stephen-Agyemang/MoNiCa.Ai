import { useEffect, useRef } from 'react';

function formatTime(timestamp, sessionStartTime) {
  if (!sessionStartTime) return '';
  const secs = Math.floor((timestamp - sessionStartTime) / 1000);
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function TranscriptPanel({ entries, sessionStartTime, isSupported, compact = false }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  if (!isSupported) {
    return (
      <div style={{
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.06)',
        fontSize: '11px',
        color: 'rgba(255,255,255,0.35)',
        fontStyle: 'italic',
      }}>
        Transcription unavailable — use Chrome or Edge.
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      height: '100%',
    }}>
      <div style={{
        fontSize: '10px',
        fontWeight: 700,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
        marginBottom: '8px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: '#ef4444', boxShadow: '0 0 6px #ef4444',
          display: 'inline-block', flexShrink: 0,
          animation: 'soft-pulse 2s ease-in-out infinite',
        }} />
        Live Transcript
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        paddingRight: '2px',
        minHeight: 0,
      }}>
        {entries.length === 0 ? (
          <p style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.25)',
            fontStyle: 'italic',
            margin: 0,
          }}>
            Waiting for conversation to begin...
          </p>
        ) : (
          entries.map((entry, i) => (
            <TranscriptEntry
              key={i}
              entry={entry}
              sessionStartTime={sessionStartTime}
              compact={compact}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function TranscriptEntry({ entry, sessionStartTime, compact }) {
  const isMonica = entry.speaker === 'monica';
  const timeLabel = sessionStartTime ? formatTime(entry.timestamp, sessionStartTime) : null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      opacity: entry.isFinal ? 1 : 0.55,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <span style={{
          fontSize: '9px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: isMonica ? 'var(--accent)' : '#93c5fd',
          flexShrink: 0,
        }}>
          {isMonica ? 'Monica' : 'You'}
        </span>
        {timeLabel && (
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', fontWeight: 500 }}>
            {timeLabel}
          </span>
        )}
      </div>
      <p style={{
        margin: 0,
        fontSize: compact ? '11px' : '12px',
        color: isMonica ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.9)',
        lineHeight: 1.5,
        fontStyle: entry.isFinal ? 'normal' : 'italic',
      }}>
        {entry.text}
      </p>
    </div>
  );
}
