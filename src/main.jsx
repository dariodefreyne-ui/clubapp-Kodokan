import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { LesgeversProvider } from './contexts/LesgeversContext.jsx';
import { GroepenProvider } from './contexts/GroepenContext.jsx';
import { ConfirmProvider } from './contexts/ConfirmContext.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';
import './styles/theme.css';

// Registreer de gecombineerde Workbox + FCM service worker (gebouwd door VitePWA
// injectManifest). Eén SW op scope '/' voor zowel offline precaching als push.
// firebaseMessaging.js gebruikt navigator.serviceWorker.ready om deze registratie
// op te halen bij getToken() — geen dubbele registratie nodig.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('SW geregistreerd:', reg.scope);
      })
      .catch(err => {
        console.warn('SW registratie mislukt:', err);
      });
  });
}

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LesgeversProvider>
          <GroepenProvider>
            <ConfirmProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </ConfirmProvider>
          </GroepenProvider>
        </LesgeversProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
