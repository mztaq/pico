import React, { useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';
const App = lazy(() => import('./app/App'));
const LandingPage = lazy(() => import('./landing/LandingPage'));
const AiUsagePage = lazy(() => import('./landing/AiUsagePage'));
import { PicoTelemetry } from './telemetry/PicoTelemetry';
import { OfflineStatus } from './app/components/OfflineStatus';
import { WorkspaceContextMenu } from './app/components/WorkspaceContextMenu';
import { installSoundEffects } from './app/sound';
import { isPicoDesktopWebview, shouldRenderPicoWorkspace } from './app/entry-route';
import { workspaceFromLocation } from './app/workspace-deeplink';
import { informationPageFromPath } from './app/components/SiteInfo';
import { HomeLoading, WorkspaceLoading, type VisualWorkspace } from './app/components/WorkspaceLoading';
import './styles/tokens.css';
import './styles/motion.css';
import './styles/overlays.css';
import './app/styles/accessibility.css';

function LoadingScreen() {
  return <div className="pico-loading" role="status"><span className="pico-loading-label">Loading Pico…</span><div aria-hidden="true"><div className="pico-skeleton-nav"><div className="pico-skeleton pico-skeleton-logo"/><div className="pico-skeleton-links"><div className="pico-skeleton pico-skeleton-link" data-placeholder-for="#home"/><div className="pico-skeleton pico-skeleton-link" data-placeholder-for="#features"/><div className="pico-skeleton pico-skeleton-link" data-placeholder-for="#downloads"/></div></div><div className="pico-skeleton-hero"><div className="pico-skeleton-copy"><div className="pico-skeleton pico-skeleton-title"/><div className="pico-skeleton pico-skeleton-title"/><div className="pico-skeleton pico-skeleton-line"/><div className="pico-skeleton-actions"><div className="pico-skeleton pico-skeleton-button" data-placeholder-for="/app"/><div className="pico-skeleton pico-skeleton-button" data-placeholder-for="#downloads"/></div></div><div className="pico-skeleton pico-skeleton-preview"/></div><div className="pico-skeleton-cards"><div className="pico-skeleton pico-skeleton-card"/><div className="pico-skeleton pico-skeleton-card"/><div className="pico-skeleton pico-skeleton-card"/></div></div></div>;
}

/** The HTML home placeholder stays above Suspense until the real App commits. */
function AppBootReady() {
  useLayoutEffect(() => {
    document.querySelector('.pico-initial-home-loading')?.remove();
    document.querySelector('.pico-initial-traffic-loading')?.remove();
  }, []);
  return <App />;
}

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
const isHomePage = (window.location.pathname === '/' || window.location.pathname === '/index.html') && !inApp;
// AI usage is a Pico information page, served at /app but rendered outside the workspace shell.
const isAiUsagePage = /^\/app\/ai-usage\/?$/.test(window.location.pathname);
// Direct workspace paths and legacy query links share the same loading skeleton.
function directVisualWorkspace(pathname: string, search: string): VisualWorkspace | null {
  switch (workspaceFromLocation(pathname, search)) {
    case 'flowchart': return 'Flowchart Builder';
    case 'logic': return 'Logic Sim';
    case 'cpu': return 'CPU Studio';
    case 'binary': return 'Binary Lab';
    case 'traffic': return 'Traffic Storm';
    default: return null;
  }
}
const initialVisualWorkspace = inApp ? directVisualWorkspace(window.location.pathname, window.location.search) : null;
const initialHomeScreen = inApp &&
  !workspaceFromLocation(window.location.pathname, window.location.search) &&
  !informationPageFromPath(window.location.pathname) &&
  !window.location.hash;
installSoundEffects();
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SkipToContent />
    {inApp ? <><Suspense fallback={initialVisualWorkspace ? <WorkspaceLoading workspace={initialVisualWorkspace} /> : initialHomeScreen ? <HomeLoading /> : null}><AppBootReady /></Suspense><PicoTelemetry /><OfflineStatus /><WorkspaceContextMenu /></> : <Suspense fallback={isHomePage ? <LoadingScreen /> : null}>{isAiUsagePage ? <AiUsagePage /> : <LandingPage />}</Suspense>}
  </React.StrictMode>,
);

// Cache the Pico application and its dependencies for offline workspaces.
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
