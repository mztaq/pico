/** Existing Tauri 2 installers load Pico's root URL directly. */
export function isPicoDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Keep previous deep links and the workspace path working without a desktop update. */
export function shouldOpenWorkspace(pathname: string, hash: string, desktop: boolean): boolean {
  if (desktop || /^\/app\/?$/.test(pathname)) return true;
  return pathname === '/' && ['#team', '#privacy', '#cookies', '#terms'].includes(hash);
}
