import React from 'react';
import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';
const App = lazy(() => import('./app/App'));
const LandingPage = lazy(() => import('./landing/LandingPage'));
import { OnlineOnlyGate } from './app/components/OnlineOnlyGate';
import { PicoTelemetry } from './telemetry/PicoTelemetry';
import { installSoundEffects } from './app/sound';
import { isPicoDesktopWebview, shouldRenderPicoWorkspace } from './app/entry-route';
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
// Previously released Tauri wrappers still load /. Render the full workspace
// there only inside their native webviews, without changing the browser URL.
const inApp = shouldRenderPicoWorkspace(window.location.pathname, isPicoDesktopWebview(window));
installSoundEffects();
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SkipToContent />
    {inApp ? <OnlineOnlyGate><Suspense fallback={null}><App /></Suspense><PicoTelemetry /></OnlineOnlyGate> : <Suspense fallback={<div style={{minHeight:'100vh',background:'#08070d'}}/>}><LandingPage /></Suspense>}
  </React.StrictMode>,
);

// Cache the homepage shell for offline preview, not the functional workspaces.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then(async registration => {
      // Include resources fetched before the service worker took control on
      // first visit, so the homepage can render on a later offline reload.
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
