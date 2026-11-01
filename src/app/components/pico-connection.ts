/** Check the live Pico origin. The service worker intentionally never caches this URL. */
export async function picoIsOnline(): Promise<boolean> {
  if (!navigator.onLine) return false;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch('/pico-online.txt?check=' + Date.now(), {
      cache: 'no-store',
      signal: controller.signal,
    });
    return response.ok && (await response.text()).trim() === 'pico-online';
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}
