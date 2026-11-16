// Register /admin/ as a Pages Function so the auth middleware runs before
// Cloudflare serves the built static dashboard.
export async function onRequestGet(context) {
  return context.next();
}
