import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { PicoTelemetry } from './telemetry/PicoTelemetry';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <PicoTelemetry />
  </React.StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Installation is an enhancement; Pico stays usable without it.
    });
  }, { once: true });
}
