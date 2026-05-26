import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { LesgeversProvider } from './contexts/LesgeversContext.js';
import { ConfirmProvider } from './contexts/ConfirmContext.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';
import './styles/theme.css';

// Registreer alleen firebase-messaging-sw.js als service worker.
// Geen VitePWA/Workbox - die zou de FCM SW verdringen en push meldingen blokkeren.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
      .then(reg => {
        console.log('FCM SW geregistreerd:', reg.scope);
      })
      .catch(err => {
        console.warn('FCM SW registratie mislukt:', err);
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
          <ConfirmProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </ConfirmProvider>
        </LesgeversProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
