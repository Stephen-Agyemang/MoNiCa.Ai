import { useState, useEffect } from 'react';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
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

  // /report is publicly accessible — no auth gate
  if (path === '/report') {
    return (
      <>
        {activeLegal && <LegalSheet type={activeLegal} onClose={closeLegal} />}
        <ReportView onOpenLegal={openLegal} />
      </>
    );
  }

  return (
    <>
      {activeLegal && <LegalSheet type={activeLegal} onClose={closeLegal} />}

      <SignedIn>
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