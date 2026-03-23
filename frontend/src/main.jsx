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
    colorPrimary: '#82b342', // Signature Monica Green
    colorText: '#ffffff',
    colorTextSecondary: 'rgba(255, 255, 255, 0.6)',
    colorBackground: 'rgba(255, 255, 255, 0.1)', // Lighter Clerk base
    colorInputBackground: 'rgba(255, 255, 255, 0.05)',
    colorInputText: '#ffffff',
    fontFamily: "'Inter', sans-serif",
    borderRadius: '16px',
  },
  elements: {
    rootBox: {
      background: 'transparent !important',
    },
    cardBox: {
      background: 'transparent !important',
      boxShadow: 'none !important',
    },
    clerkBranding: {
      display: 'none !important',
    },
    'div[class*="clerk-internal"]': {
      display: 'none !important',
    },
    card: {
      background: 'rgba(255, 255, 255, 0.3) !important', // Vibrant White Frosted Glass
      backdropFilter: 'blur(40px) !important',
      WebkitBackdropFilter: 'blur(40px) !important', 
      border: '1px solid rgba(255, 255, 255, 0.2) !important', // High-Contrast Tech Border
      boxShadow: `
        0 40px 100px -20px rgba(0, 0, 0, 0.5),
        0 0 1px 1px rgba(255, 255, 255, 0.05) inset
      !important`,
      width: '100% !important',
      maxWidth: '440px !important',
      padding: '32px 24px !important',
      margin: '0 auto !important',
    },
    headerTitle: {
      color: '#ffffff !important',
      fontSize: '28px !important',
      fontWeight: '800 !important',
      letterSpacing: '-0.03em !important',
    },
    headerSubtitle: {
      color: 'rgba(255,255,255,0.5) !important',
      fontSize: '15px !important',
    },
    socialButtonsBlockButton: {
      background: 'rgba(0, 0, 0, 0.15) !important', // Subtle dark punch on light glass
      border: '1px solid rgba(255,255,255,0.1) !important',
      borderRadius: '12px !important',
      padding: '12px !important',
      color: '#ffffff !important',
      boxShadow: 'none !important',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important',
      '&:hover': {
        background: 'rgba(255, 255, 255, 0.06) !important',
        borderColor: 'rgba(255,255,255,0.15) !important',
        transform: 'translateY(-2px) !important',
      },
      '&:active': {
        transform: 'scale(0.98) !important',
      }
    },
    socialButtonsBlockButtonText: {
      color: '#ffffff !important',
      fontWeight: '600 !important',
    },
    formButtonPrimary: {
      background: '#C5E898 !important',
      color: '#05070a !important', // High Contrast Ink
      fontSize: '15px !important',
      fontWeight: '700 !important',
      padding: '14px !important',
      borderRadius: '12px !important',
      textTransform: 'none !important',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important',
      '&:hover': {
        background: '#d4f2aa !important',
        transform: 'translateY(-2px) !important',
        boxShadow: '0 10px 25px rgba(197, 232, 152, 0.25) !important',
      },
      '&:active': {
        transform: 'scale(0.98) !important',
      }
    },
    formFieldLabel: {
      color: 'rgba(255,255,255,0.6) !important',
      fontSize: '13px !important',
      fontWeight: '500 !important',
    },
    formFieldInput: {
      background: 'rgba(255, 255, 255, 0.03) !important',
      border: '1px solid rgba(255,255,255,0.08) !important',
      padding: '12px 16px !important',
      color: '#ffffff !important',
      borderRadius: '12px !important',
      '&:focus': {
        borderColor: 'rgba(197, 232, 152, 0.4) !important',
        background: 'rgba(255, 255, 255, 0.05) !important',
      }
    },
    footerActionText: {
      color: 'rgba(0, 0, 0, 0.5) !important', // Dark contrast on light glass
    },
    footerActionLink: {
      color: '#558b2f !important', // Deeper green for readability
      fontWeight: '700 !important',
      '&:hover': {
        color: '#33691e !important',
      }
    },
    'button[tabindex="-1"]': { 
      display: 'none !important',
    },
    '[class^="cl-internal"]': {
      display: 'none !important',
    },
    footerActionText: {
      color: 'rgba(0, 0, 0, 0.6) !important',
    }
  }
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
