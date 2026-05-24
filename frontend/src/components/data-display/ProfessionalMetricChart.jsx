import React from 'react';

export const ProfessionalMetricChart = ({ label, value, color = 'var(--accent)' }) => {
  const percentage = Math.min(100, Math.max(0, value * 10)); // Scale 1-10 to 0-100
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="glass-panel-dark" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', borderRadius: '16px', margin: '0', border: '1px solid rgba(255,255,255,0.04)' }}>
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
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: '#ffffff' }}>
          {value}
        </div>
      </div>
      <div>
        <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
        <div style={{ height: '4px', width: '80px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${percentage}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
        </div>
      </div>
    </div>
  );
};
