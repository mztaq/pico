import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { LandingPage } from './app/components/LandingPage';
import { isPicoDesktop, shouldOpenWorkspace } from './app/entryRoute';
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
function PicoEntry() {
  const [, setLocationKey] = useState(() => location.pathname + location.hash);
  useEffect(() => {
    const onNavigate = () => setLocationKey(location.pathname + location.hash);
    window.addEventListener('popstate', onNavigate);
    window.addEventListener('hashchange', onNavigate);
    return () => {
      window.removeEventListener('popstate', onNavigate);
      window.removeEventListener('hashchange', onNavigate);
    };
  }, []);
  return shouldOpenWorkspace(location.pathname, location.hash, isPicoDesktop())
    ? <OnlineOnlyGate><App /><PicoTelemetry /></OnlineOnlyGate>
    : <LandingPage />;
}

installSoundEffects();
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SkipToContent />
    <PicoEntry />
  </React.StrictMode>,
);

// Cache the homepage shell for offline preview, not the functional workspaces.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then(async registration => {
      const assets = [...new Set([
        ...Array.from(document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src],link[rel="stylesheet"][href],link[rel="modulepreload"][href]'))
          .map(element => element instanceof HTMLScriptElement ? element.src : element.href),
        ...performance.getEntriesByType('resource').map(entry => entry.name),
      ].filter(url => {
        const parsed = new URL(url, location.href);
        return parsed.origin === location.origin && parsed.pathname.startsWith('/assets/');
      }).map(url => new URL(url, location.href).pathname))];
      (registration.active || (await navigator.serviceWorker.ready).active)?.postMessage({ type: 'CACHE_PICO_HOME', assets });
    }).catch(() => {});
  }, { once: true });
}
