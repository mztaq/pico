import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

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

  it('redirects old policy URLs and lists the new canonical address', () => {
    const redirects = read('public/_redirects');
    expect(redirects).toMatch(/^\/legal\/ai-usage\s+\/app\/ai-usage\s+301$/m);
    expect(redirects).toMatch(/^\/legal\/ai-usage\/\s+\/app\/ai-usage\s+301$/m);
    expect(read('public/sitemap.xml')).toContain('https://picompiler.pages.dev/app/ai-usage');
    expect(read('public/sitemap.xml')).not.toContain('/legal/ai-usage');
  });
  it('keeps the copyright footer minimal and links it to the policy', () => {
    const landing=read('src/landing/LandingPage.tsx');
    const policy=read('src/app/components/SiteInfo.tsx');
    const footer='© 2026 Pico Development Team. All rights reserved.';
    expect(landing).toContain('<a className="lp-footer-copyright" href="/app/ai-usage">'+footer+'</a>');
    expect(policy).toContain("{ id: 'ai-usage', title: 'Copyright & AI Usage', icon: FileText }");
    expect(policy).toContain('page === \'ai-usage\' ? <AiUsage />');
    expect(landing).not.toContain('Original site materials ©');
    expect(landing).not.toContain('lp-protected-notice');
    expect(policy).not.toContain('Pico · Legal');
    expect(policy).toContain("const aiUsageCanonicalUrl = 'https://picompiler.pages.dev/app/ai-usage'");
  });
});
