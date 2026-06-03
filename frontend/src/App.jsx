import { useState, useEffect, lazy, Suspense } from 'react';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { LegalSheet } from './components/ui/LegalSheet';

import './App.css';
import './markdown.css';

const InterviewPage  = lazy(() => import('./pages/InterviewPage').then(m => ({ default: m.InterviewPage })));
const AuthPage       = lazy(() => import('./pages/AuthPage').then(m => ({ default: m.AuthPage })));
const RecruiterPortal = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.RecruiterPortal })));
const ReportView     = lazy(() => import('./pages/ReportPage').then(m => ({ default: m.ReportView })));

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#05070a' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid rgba(130,179,66,0.2)', borderTopColor: '#82b342', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

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
        <Suspense fallback={<PageLoader />}>
          <ReportView onOpenLegal={openLegal} />
        </Suspense>
      </>
    );
  }

  return (
    <>
      {activeLegal && <LegalSheet type={activeLegal} onClose={closeLegal} />}

      <Suspense fallback={<PageLoader />}>
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
      </Suspense>
    </>
  );
}