/**
 * Stream a Pages-hosted desktop installer assembled from 16 MiB static assets.
 * Names are allowlisted; only the exact release manifest controls the parts.
 */
const ALLOWED = new Set([
  'Pico_x64-setup.exe',
  'Pico_x64_en-US.msi',
  'Pico_aarch64.dmg',
  'Pico_x64.dmg',
  'Pico_amd64.deb',
  'Pico_amd64.AppImage',
]);

const notAvailable = () => new Response('Downloads are not available yet', { status: 503 });

export async function onRequest({ request, env, params }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const filename = params.filename;
  if (typeof filename !== 'string' || !ALLOWED.has(filename)) {
    return new Response('File not found', { status: 404 });
  }

  const manifestResponse = await env.ASSETS.fetch(new URL('/download-assets/manifest.json', request.url));
  if (!manifestResponse.ok) return notAvailable();
  let manifest;
  try { manifest = await manifestResponse.json(); } catch { return notAvailable(); }
  const file = manifest?.files?.[filename];
  const size = file?.size;
  const chunk = manifest?.chunk;
  const parts = file?.parts;
  const hash = file?.sha256;
  if (
    !Number.isSafeInteger(size) || size <= 0 ||
    !Number.isSafeInteger(chunk) || chunk <= 0 || chunk > 25 * 1024 * 1024 ||
    !Number.isSafeInteger(parts) || parts !== Math.ceil(size / chunk) ||
    typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash)
  ) return notAvailable();

  let start = 0;
  let end = size - 1;
  let status = 200;
  const range = request.headers.get('Range');
  if (range !== null) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    }
    if (match[1]) {
      start = Number(match[1]);
      if (match[2]) end = Number(match[2]);
    } else {
      const suffix = Number(match[2]);
      start = Math.max(0, size - suffix);
    }
    if (
      !Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
      start >= size || start > end || start < 0
    ) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    end = Math.min(size - 1, end);
    status = 206;
  }
  const headers = new Headers({
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': String(end - start + 1),
    'Accept-Ranges': 'bytes',
    'ETag': `"${hash}"`,
    'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
  if (status === 206) headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  if (request.method === 'HEAD') return new Response(null, { status, headers });
  if (request.headers.get('If-None-Match') === `"${hash}"` && !range) {
    return new Response(null, { status: 304, headers: { ETag: `"${hash}"` } });
  }

  // Stream one chunk at a time with backpressure. Do not buffer the entire
  // 77 MiB AppImage inside a 128 MiB Cloudflare Worker.
  let index = Math.floor(start / chunk);
  const lastIndex = Math.floor(end / chunk);
  const stream = new ReadableStream({
    async pull(controller) {
      if (index > lastIndex) { controller.close(); return; }
      try {
        const url = new URL(
          '/download-assets/' + filename + '.part' + String(index).padStart(3, '0'),
          request.url,
        );
        const response = await env.ASSETS.fetch(url);
        if (!response.ok) throw new Error('Missing release chunk');
        const bytes = new Uint8Array(await response.arrayBuffer());
        const expectedLength = Math.min(chunk, size - index * chunk);
        if (bytes.length !== expectedLength) throw new Error('Release chunk has wrong size');

        const from = index === Math.floor(start / chunk) ? start - index * chunk : 0;
        const to = index === lastIndex ? end - index * chunk + 1 : bytes.length;
        controller.enqueue(bytes.subarray(from, to));
        index++;
      } catch (error) {
        controller.error(error);
      }
    },
  }, { highWaterMark: 1 });

  return new Response(stream, { status, headers });
}
