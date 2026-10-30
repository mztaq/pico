/**
 * Keep already-distributed Tauri 2 desktop installers working after moving
 * the browser workspace from / to /app.
 *
 * Older installers still request /, and Tauri injects this marker into its
 * webview independently of the optional window.__TAURI__ API.
 */
export function isPicoDesktopWebview(host: {
  isTauri?: unknown;
  __TAURI_INTERNALS__?: unknown;
}): boolean {
  return host.isTauri === true ||
    (typeof host.__TAURI_INTERNALS__ === 'object' && host.__TAURI_INTERNALS__ !== null);
}

/** The website's / stays the landing page; an old Tauri webview keeps Pico. */
export function shouldRenderPicoWorkspace(pathname: string, inTauriWebview: boolean): boolean {
  return pathname === '/app' ||
    pathname.startsWith('/app/') ||
    (pathname === '/' && inTauriWebview);
}
