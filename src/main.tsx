import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { PicoTelemetry } from './telemetry/PicoTelemetry';
import './app/styles/accessibility.css';

function SkipToContent() {
  return <a className="pico-skip-link" href="#root" onClick={event => {
    const target = document.querySelector<HTMLElement>('main, [role="main"]');
    if (!target) return;
    event.preventDefault();
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus();
  }}>Skip to content</a>;
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SkipToContent />
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
