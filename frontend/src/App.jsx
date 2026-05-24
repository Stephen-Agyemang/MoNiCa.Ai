/**
 * App.jsx — Pure Top-Level Router
 *
 * This file is intentionally minimal. Its only job is to:
 *  1. Listen for URL path changes
 *  2. Render the correct page component
 *  3. Manage the global LegalSheet modal state
 *
 * All page logic lives in src/pages/
 * All feature logic lives in src/features/
 * All reusable UI lives in src/components/
 */

import React, { useState, useEffect } from 'react';
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import { LegalSheet } from './components/ui/LegalSheet';
import { InterviewPage } from './pages/InterviewPage';
import { AuthPage } from './pages/AuthPage';
import { RecruiterPortal } from './pages/DashboardPage';
import { ReportView } from './pages/ReportPage';

import './App.css';
import './markdown.css';

export default function AppRouter() {
  const [path, setPath] = useState(window.location.pathname.replace(/\/$/, ''));
  const [activeLegal, setActiveLegal] = useState(null);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname.replace(/\/$/, ''));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const closeLegal = () => setActiveLegal(null);
  const openLegal = (e, type) => { e.preventDefault(); setActiveLegal(type); };

  // ── /report — publicly accessible, no auth required ──
  if (path === '/report') {
    return (
      <>
        {activeLegal && <LegalSheet type={activeLegal} onClose={closeLegal} />}
        <ReportView onOpenLegal={openLegal} />
      </>
    );
  }

  // ── All other routes ──
  return (
    <>
      {activeLegal && <LegalSheet type={activeLegal} onClose={closeLegal} />}

      <SignedIn>
        {/* Persistent user avatar — top-right corner on protected routes */}
        <div style={{ position: 'absolute', top: '24px', right: '32px', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '12px' }}>
          {path === '/recruiter' && (
            <button
              onClick={() => window.location.href = '/'}
              className="settings-card"
              style={{ padding: '8px 16px', fontSize: '12px', background: 'rgba(255,255,255,0.05)', color: '#ffffff', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              Back to Office
            </button>
          )}
          <div className="user-profile-prompter">
            <span className="profile-details-helper">Manage Account</span>
            <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: { width: 40, height: 40, border: '2px solid rgba(255,255,255,0.1)' }, userButtonTrigger: { padding: '4px' } } }} />
          </div>
        </div>

        {path === '/recruiter'
          ? <RecruiterPortal onOpenLegal={openLegal} />
          : <InterviewPage onOpenLegal={openLegal} />
        }
      </SignedIn>

      <SignedOut>
        {path.startsWith('/guest-practice')
          ? <InterviewPage guestMode={true} onOpenLegal={openLegal} />
          : <AuthPage onOpenLegal={openLegal} />
        }
      </SignedOut>
    </>
  );
}
