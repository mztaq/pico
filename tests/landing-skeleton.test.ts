import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

const read = (path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Skeleton loading matches production landing navigation',()=>{
  const html=read('index.html');
  const entry=read('src/main.tsx');
  const landing=read('src/landing/LandingPage.tsx');

  it('shows the skeleton only on the home route before React loads',()=>{
    for (const [path, expectedSkeleton] of [['/', true], ['/app', false], ['/app/cpu', false], ['/other', false]] as const) {
      const document = new JSDOM(html, { url: `https://picompiler.pages.dev${path}`, runScripts: 'dangerously' }).window.document;
      const skeleton = document.querySelector<HTMLElement>('.pico-loading')!;
      expect(document.documentElement.classList.contains('pico-app-route')).toBe(!expectedSkeleton);
      expect(document.defaultView!.getComputedStyle(skeleton).display === 'none').toBe(!expectedSkeleton);
      expect(document.querySelector('.pico-initial-app-loader')).toBeNull();
    }
    expect(entry).toContain('fallback={initialVisualWorkspace ? <WorkspaceLoading workspace={initialVisualWorkspace} /> : null}');
    expect(entry).toContain('const initialVisualWorkspace = inApp ? directVisualWorkspace(window.location.search) : null;');
  });

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
