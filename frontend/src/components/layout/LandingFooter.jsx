import React from 'react';

export const LandingFooter = ({ onOpenLegal }) => (
  <footer className="data-footer" role="contentinfo">
    <div className="footer-content">
      <div className="footer-brand">
        <h4>Mon<span className="brand-i-container">i<span className="brand-i-dot-highlight"></span></span>ca<span className="brand-dot-end">.</span></h4>
        <p>Providing the absolute standard in professional AI interview preparation. Secure, private, and uncompromising.</p>
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
            <li><a href="#/" onClick={(e) => onOpenLegal?.(e, 'help')} rel="noopener noreferrer">Contact Office</a></li>
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
