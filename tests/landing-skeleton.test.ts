import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Skeleton loading matches production landing navigation',()=>{
  const html=read('index.html');
  const entry=read('src/main.tsx');
  const landing=read('src/landing/LandingPage.tsx');

  it('shows placeholders for only the three existing production navigation links',()=>{
    for(const destination of ['#home','#features','#downloads']){
      expect(html).toContain('data-placeholder-for="'+destination+'"');
      expect(entry).toContain('data-placeholder-for="'+destination+'"');
      expect(landing).toContain('href="'+destination+'"');
    }
    expect(html.match(/class="pico-skeleton pico-skeleton-link"/g)).toHaveLength(3);
    expect(entry.match(/className="pico-skeleton pico-skeleton-link"/g)).toHaveLength(3);
    expect(html).toContain('.pico-skeleton-links{display:flex;align-items:center;gap:32px;margin-left:auto}');
    expect(html).toContain('@media(max-width:700px){.pico-skeleton-links{display:none}');
  });

  it('matches both real hero buttons without creating clickable fake links',()=>{
    for(const destination of ['/app','#downloads']){
      expect(html).toContain('data-placeholder-for="'+destination+'"');
      expect(entry).toContain('data-placeholder-for="'+destination+'"');
    }
    expect(landing).toContain("const APP = '/app'");
    expect(landing).toContain("const DOWNLOADS = '#downloads'");
    expect(landing).toContain('href={APP}');
    expect(landing).toContain('href={DOWNLOADS}');
    expect(html.match(/class="pico-skeleton pico-skeleton-button"/g)).toHaveLength(2);
    expect(entry.match(/className="pico-skeleton pico-skeleton-button"/g)).toHaveLength(2);
    expect(html).not.toMatch(/<a[^>]*class="pico-skeleton/);
    expect(entry).not.toMatch(/<a[^>]*className="pico-skeleton/);
  });
});
