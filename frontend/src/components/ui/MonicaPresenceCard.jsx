export function MonicaPresenceCard() {
  return (
    <div className="monica-presence-card">
      <img
        src="/monica_executive_portrait.png"
        alt="Monica"
        className="presence-avatar"
        loading="lazy"
        width="40"
        height="40"
      />
      <div className="presence-info">
        <span className="presence-name">Monica is Online</span>
        <div className="presence-status">
          <div className="presence-status-dot" />
          <span className="presence-status-label">Ready to interview</span>
        </div>
      </div>
    </div>
  );
}