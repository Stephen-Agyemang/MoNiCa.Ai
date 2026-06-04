import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.jsx'

// Import your publishable key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Publishable Key')
}

const clerkAppearance = {
  variables: {
    colorPrimary: '#82b342',
    colorText: '#ffffff',
    colorTextSecondary: 'rgba(255, 255, 255, 0.6)',
    colorInputBackground: 'rgba(255, 255, 255, 0.07)',
    colorInputText: '#ffffff',
    fontFamily: "'Inter', sans-serif",
    borderRadius: '12px',
  },
  elements: {
    rootBox: { background: 'transparent' },
    cardBox: { background: 'transparent', boxShadow: 'none' },
    clerkBranding: { display: 'none' },
  },
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      appearance={clerkAppearance}
      fallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      <App />
    </ClerkProvider>
  </StrictMode>,
)
