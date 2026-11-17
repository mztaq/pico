/** Pages Function is a stateless same-origin proxy to the private room Worker. */
export async function onRequest({ request, env }) {
  if (!env.ARENA_SERVICE) {
    return Response.json({ error: 'Multiplayer is not connected. Bind ARENA_SERVICE to pico-arena-rooms.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  const url = new URL(request.url);
  if (request.method === 'POST' && request.headers.get('Origin') !== url.origin) {
    return Response.json({ error: 'Invalid origin.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    return await env.ARENA_SERVICE.fetch(request);
  } catch (error) {
    console.error('Arena Worker unavailable', String(error));
    return Response.json({ error: 'The multiplayer service is unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
