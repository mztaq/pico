import { onRequest as serveInstaller } from './[filename].js';

/**
 * Force Pages Functions routing for installer paths with file extensions.
 * Cloudflare may otherwise treat .exe/.dmg/.AppImage as static asset paths
 * and return the site's custom 404 before the dynamic route is evaluated.
 */
export async function onRequest(context) {
  const path = new URL(context.request.url).pathname;
  const match = /^\/downloads\/([^/]+)$/.exec(path);
  if (!match) return context.next();
  return serveInstaller({
    ...context,
    params: { ...context.params, filename: decodeURIComponent(match[1]) },
  });
}
