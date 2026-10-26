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

// Cache the homepage shell for offline preview, not the functional workspaces.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then(async registration => {
      const assets = Array.from(document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src],link[rel="stylesheet"][href],link[rel="modulepreload"][href]'))
        .map(element => element instanceof HTMLScriptElement ? element.src : element.href)
        .map(url => new URL(url).pathname);
      (registration.active || (await navigator.serviceWorker.ready).active)?.postMessage({ type: 'CACHE_PICO_HOME', assets });
    }).catch(() => {});
  }, { once: true });
}
