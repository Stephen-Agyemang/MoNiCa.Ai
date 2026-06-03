import React from 'react';

const styleSheet = `
  @keyframes radar-sweep {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes radar-node-pulse {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1.3); }
  }
  @keyframes core-pulse {
    0%, 100% { transform: scale(1); box-shadow: 0 0 30px rgba(130, 179, 66, 0.4), inset 0 0 15px rgba(130, 179, 66, 0.2); }
    50% { transform: scale(1.03); box-shadow: 0 0 50px rgba(130, 179, 66, 0.6), inset 0 0 25px rgba(130, 179, 66, 0.3); }
  }
  @keyframes biometric-glow {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.7; }
  }
`;

export default function InductionOverlay({ show, fadeOut }) {
  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'radial-gradient(circle at 50% 50%, #0c0f14 0%, #05070a 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '40px',
      opacity: fadeOut ? 0 : 1,
      transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
      pointerEvents: fadeOut ? 'none' : 'auto',
    }}>
      <style dangerouslySetInnerHTML={{ __html: styleSheet }} />
      <div className="auth-mesh-overlay" style={{ opacity: 0.3 }} />
      <div className="mesh-glow-sphere sphere-1" style={{ width: '500px', height: '500px', background: '#4a7c1f', filter: 'blur(150px)', opacity: 0.4 }} />

      <div className="glass-panel-dark" style={{
        padding: '48px 64px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '32px',
        background: 'rgba(10, 15, 20, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        boxShadow: '0 50px 100px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '48px', position: 'relative' }}>

          {/* Left readout labels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'right', minWidth: '150px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', fontFamily: 'monospace' }}>SECURE PROTOCOL</span>
              <span style={{ fontSize: '11px', color: '#ffffff', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '0.05em' }}>M_LINK_SYNC: SECURE</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', fontFamily: 'monospace' }}>NEURAL SYNAPSE</span>
              <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '0.05em' }}>GRID_CORE_98.7%</span>
            </div>
          </div>

          {/* SVG Radar center */}
          <div style={{ position: 'relative', width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '1px solid rgba(130, 179, 66, 0.1)',
              animation: 'biometric-glow 3s infinite ease-in-out',
            }} />
            <div style={{
              position: 'absolute',
              inset: 20,
              borderRadius: '50%',
              border: '1px dashed rgba(130, 179, 66, 0.15)',
            }} />

            <svg style={{ position: 'absolute', width: '100%', height: '100%', transform: 'rotate(-90deg)', pointerEvents: 'none' }} viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="90" fill="none" stroke="var(--accent)" strokeWidth="0.5" strokeOpacity="0.15" />
              <circle cx="100" cy="100" r="70" fill="none" stroke="var(--accent)" strokeWidth="0.5" strokeOpacity="0.25" strokeDasharray="3, 3" />
              <circle cx="100" cy="100" r="50" fill="none" stroke="var(--accent)" strokeWidth="0.75" strokeOpacity="0.3" />
              <line x1="100" y1="100" x2="190" y2="100" stroke="var(--accent)" strokeWidth="1.5" strokeOpacity="0.6" style={{
                transformOrigin: '100px 100px',
                animation: 'radar-sweep 3s linear infinite',
              }} />
              <circle cx="150" cy="130" r="3" fill="var(--accent)" style={{ animation: 'radar-node-pulse 2s infinite ease-in-out' }} />
              <circle cx="60" cy="80" r="2" fill="var(--accent)" stroke="var(--accent)" strokeWidth="1" strokeOpacity="0.5" style={{ animation: 'radar-node-pulse 2.5s infinite ease-in-out' }} />
            </svg>

            <div style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: 'rgba(5, 7, 10, 0.95)',
              border: '2px solid var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
              fontSize: '32px',
              fontWeight: '900',
              color: '#ffffff',
              fontFamily: "'Outfit', 'Inter', sans-serif",
              textShadow: '0 0 15px rgba(255, 255, 255, 0.6)',
              animation: 'core-pulse 2s infinite ease-in-out',
            }}>
              M
            </div>
          </div>

          {/* Right readout labels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left', minWidth: '150px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', fontFamily: 'monospace' }}>BIOMETRIC SCAN</span>
              <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '0.05em' }}>BIOMETRIC_SYNC: LIVE</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', fontFamily: 'monospace' }}>AUDIO SYNTHESIS</span>
              <span style={{ fontSize: '11px', color: '#ffffff', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '0.05em' }}>BAND_DET_ACTIVE</span>
            </div>
          </div>

        </div>

        <div style={{ textAlign: 'center', zIndex: 10 }}>
          <h2 className="brand-text-gradient" style={{ fontSize: '28px', marginBottom: '8px', letterSpacing: '-0.02em' }}>
            Inducting Monica<span className="brand-dot-end">.</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.25em' }}>
            Synchronizing Digital Replica & Biometric Logic
          </p>
        </div>

        <div style={{
          width: '280px',
          height: '2px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '2px',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            height: '100%',
            width: '40%',
            background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
            animation: 'shimmer 1.8s infinite linear'
          }} />
        </div>
      </div>
    </div>
  );
}