/**
 * Keep already-distributed Tauri 2 desktop installers working after moving
 * the browser workspace from / to /app.
 *
 * Older installers still request /, and Tauri injects this marker into its
 * webview independently of the optional window.__TAURI__ API.
 */
export function isPicoDesktopWebview(host: object): boolean {
  const native = host as {isTauri?: unknown; __TAURI_INTERNALS__?: unknown};
  return native.isTauri === true ||
    (typeof native.__TAURI_INTERNALS__ === 'object' && native.__TAURI_INTERNALS__ !== null);
}

/** The website's / stays the landing page; an old Tauri webview keeps Pico. */
export function shouldRenderPicoWorkspace(pathname: string, inTauriWebview: boolean): boolean {
  return pathname === '/app' ||
    /^\/app\/(pseudocode|python|flowchart|logic|cpu|binary|sql|traffic|games|learn|team|terms|privacy|cookies|report|ai-usage)\/?$/.test(pathname) ||
    pathname === '/app/' ||
    (pathname === '/' && inTauriWebview);
}
