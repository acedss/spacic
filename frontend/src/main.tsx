// main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import './index.css';
import AuthProvider from "./providers/AuthProvider.tsx"
import { AudioProvider } from "./providers/AudioProvider.tsx"



const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      signInFallbackRedirectUrl="/auth-callback"
      signUpFallbackRedirectUrl="/auth-callback"
    >
      <AuthProvider>
        <AudioProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AudioProvider>
      </AuthProvider>
    </ClerkProvider>
  </React.StrictMode>
);
