import { describe, expect, it } from 'vitest';
import { onRequest } from '../../functions/api/classroom/[[path]].js';

const base = 'https://picompiler.pages.dev/api/classroom/';

function request(path, { method = 'GET', origin, body } = {}) {
  return new Request(base + path, {
    method,
    headers: {
      ...(origin ? { Origin: origin } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe('Classroom API boundary', () => {
  it('fails closed when the D1 binding is missing', async () => {
    const response = await onRequest({ request: request('room'), env: {} });
    expect(response.status).toBe(503);
  });
  it('does not expose undefined endpoints', async () => {
    const response = await onRequest({ request: request('unknown'), env: { DB: {} } });
    expect(response.status).toBe(404);
  });
  it('rejects the wrong HTTP method', async () => {
    const response = await onRequest({ request: request('create'), env: { DB: {} } });
    expect(response.status).toBe(405);
  });
  it('rejects cross-site POST requests', async () => {
    const response = await onRequest({
      request: request('create', { method: 'POST', origin: 'https://evil.example', body: {} }),
      env: { DB: {} },
    });
    expect(response.status).toBe(403);
  });
  it('rejects invalid challenge IDs before database writes', async () => {
    const response = await onRequest({
      request: request('create', { method: 'POST', origin: 'https://picompiler.pages.dev', body: { challengeId: 'not-a-challenge' } }),
      env: { DB: {} },
    });
    expect(response.status).toBe(400);
  });
});
