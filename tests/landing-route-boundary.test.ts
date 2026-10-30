import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

describe('Landing route migration leaves backend services available', () => {
  it('keeps Cloudflare Pages API, downloads and the new studio route enabled', () => {
    const routes = JSON.parse(read('public/_routes.json')) as { version: number; include: string[]; exclude: string[] };
    expect(routes.version).toBe(1);
    expect(routes.include).toEqual(expect.arrayContaining(['/api/*', '/downloads/*', '/app']));
    expect(routes.exclude).toEqual([]);
  });
  it('keeps D1-powered cookie and preferences endpoints in place', () => {
    expect(read('functions/api/cookies.ts')).toContain('ctx.env.DB');
    expect(read('functions/api/preferences.ts')).toContain('ctx.env.DB');
    expect(read('functions/api/usage.ts')).toContain('ctx.env.DB');
  });
  it('keeps bug reporting and Resend email integration in place', () => {
    const handler = read('functions/api/bug-report.ts');
    expect(handler).toContain('RESEND_API_KEY');
    expect(handler).toContain('BUG_REPORT_TO');
    expect(handler).toContain('ctx.env.DB');
  });
  it('keeps studio telemetry within the app route', () => {
    const entry = read('src/main.tsx');
    expect(entry).toContain('<PicoTelemetry />');
    expect(entry).toContain("window.location.pathname === '/app'");
  });
});
