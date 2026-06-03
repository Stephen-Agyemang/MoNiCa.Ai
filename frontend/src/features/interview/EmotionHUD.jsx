import React from 'react';

export default function EmotionHUD({ isLoaded, emotions }) {
  if (!isLoaded) return null;

  const currentEmotion = emotions && emotions.length > 0 ? emotions[emotions.length - 1].emotion : 'Scanning...';
  const recent = emotions ? emotions.slice(-20) : [];
  const positive = recent.filter(e => ['neutral', 'happy', 'surprised'].includes(e.emotion)).length;
  const composureScore = recent.length > 0 ? Math.round((positive / recent.length) * 100) : 100;
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
}