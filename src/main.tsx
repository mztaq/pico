import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { OnlineOnlyGate } from './app/components/OnlineOnlyGate';
import { PicoTelemetry } from './telemetry/PicoTelemetry';
import { installSoundEffects } from './app/sound';
import './styles/tokens.css';
import './styles/motion.css';
import './styles/overlays.css';
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
installSoundEffects();
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SkipToContent />
    <OnlineOnlyGate><App /><PicoTelemetry /></OnlineOnlyGate>
  </React.StrictMode>,
);

// Retire the previous offline-first service worker and cached shell.
if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then(registrations =>
    Promise.all(registrations.filter(reg => new URL(reg.scope).origin === location.origin).map(reg => reg.unregister()))
  ).catch(() => {});
}
if ('caches' in window) {
  void caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('pico-shell-')).map(key => caches.delete(key)))).catch(() => {});
}
