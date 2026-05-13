import React, { useState } from 'react';

export function LegalSheet({ type, onClose }) {
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
          <p><strong>User Privacy:</strong> You retain absolute ownership of your data and can purge your history via the account dashboard at any time.</p>
        </div>
      )
    },
    terms: {
      title: "Terms of Professionalism",
      body: (
        <div role="region" aria-label="Terms of Service">
          <p><strong>Professional Conduct:</strong> This platform is designed for professional development. Users are expected to maintain professional standards during AI interactions.</p>
          <p><strong>System Integrity:</strong> Any attempt to reverse-engineer or disrupt the Monica Protocol is strictly prohibited to ensure the security of all partners.</p>
          <p><strong>No Guarantee of Employment:</strong> Monica is an advanced technical coach. While she provides high-fidelity feedback, the use of this service does not guarantee specific job placement or legal certification.</p>
        </div>
      )
    },
    help: {
      title: "Support Center",
      body: (
        <div role="region" aria-label="Support Form">
          <div className="support-header">
            <h2 className="brand-text-gradient">Support Center</h2>
            <p style={{ color: 'rgba(0,0,0,0.4)', marginTop: '-8px' }}>Support Registry</p>
          </div>

          <div className="feature-grid" style={{ marginBottom: '20px' }}>
            <div className="feature-item">
              <span className="item-icon" aria-hidden="true">⚡</span>
              <div className="item-content">
                <h4>6-Hour Service</h4>
                <p>Prioritized support queue</p>
              </div>
            </div>
          </div>

          {isSubmitted ? (
            <div className="support-success" role="alert">
              <span className="success-icon" aria-hidden="true">✅</span>
              <h3 className="success-title">Request Registered</h3>
              <p>A support agent will review your transmission shortly.</p>
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
                  placeholder="Provide context for our support team..."
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
