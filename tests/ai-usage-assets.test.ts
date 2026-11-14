import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

describe('AI usage deployment assets', () => {
  it('publishes documented crawler preferences from Vite public assets', () => {
    const robots = read('public/robots.txt');
    for (const agent of [
      'ClaudeBot', 'Claude-User', 'Claude-SearchBot',
      'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
      'Google-Extended', 'PerplexityBot', 'Perplexity-User', 'Bytespider',
    ]) {
      expect(robots).toContain(`User-agent: ${agent}\nDisallow: /`);
    }
    expect(robots).not.toContain('User-agent: Claude-Code');
    expect(robots).toContain('User-agent: *\nAllow: /\nDisallow: /api/');
    expect(robots).toContain('Sitemap: https://picompiler.pages.dev/sitemap.xml');
  });

  it('rewrites both policy URL forms and lists the canonical URL', () => {
    const redirects = read('public/_redirects');
    expect(redirects).toContain('/legal/ai-usage / 200');
    expect(redirects).toContain('/legal/ai-usage/ / 200');
    expect(read('public/sitemap.xml')).toContain('https://picompiler.pages.dev/legal/ai-usage');
  });
});
