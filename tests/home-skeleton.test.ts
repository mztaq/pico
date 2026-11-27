import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { HomeLoading } from '../src/app/components/WorkspaceLoading';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Pico workspace-selector home skeleton',()=>{
  it('matches the Code, Visual Labs and Data Lab card counts',()=>{
    const html=renderToStaticMarkup(createElement(HomeLoading));
    expect(html).toContain('data-loading-workspace="Home"');
    expect(html).toContain('aria-label="Opening Pico home"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-hidden="true"');
    expect((html.match(/class="pico-load-home-card"/g)??[])).toHaveLength(8);
    expect((html.match(/class="pico-load-home-section /g)??[])).toHaveLength(3);
    expect(html).toContain('pico-load-home-section--code');
    expect(html).toContain('pico-load-home-section--visual');
    expect(html).toContain('pico-load-home-section--data');
    const document = new JSDOM(html).window.document;
    for (const [kind, count] of [['code', 2], ['visual', 4], ['data', 2]] as const) {
      expect(document.querySelectorAll('.pico-load-home-section--' + kind + ' .pico-load-home-card')).toHaveLength(count);
    }
    expect(html).not.toContain('pico-load-home-section--games');
    expect(html).not.toMatch(/<button\b|<a\b|<input\b/);
  });

  it('uses a real lazy import fallback on /app without delaying the loaded UI',()=>{
    const entry=read('src/main.tsx');
    expect(entry).toContain("const initialHomeScreen = inApp &&");
    expect(entry).toContain('!workspaceFromLocation(window.location.pathname, window.location.search)');
    expect(entry).toContain('initialHomeScreen ? <HomeLoading /> : null');
    expect(entry).toContain('<AppBootReady /></Suspense>');
    expect(entry).toContain("document.querySelector('.pico-initial-home-loading')?.remove();");
    expect(entry).toContain('useLayoutEffect(() => {');
    expect(read('src/app/components/workspace-loading.css')).toContain('prefers-reduced-motion:reduce');
  });

  it('renders a matching initial HTML shell only for the /app home route',()=>{
    const initialHtml=read('index.html');
    const cases=[
      {path:'/app',show:true},
      {path:'/app/',show:true},
      {path:'/',show:false},
      {path:'/app?tool=flowchart',show:false},
      {path:'/app?tool=binary',show:false},
      {path:'/app?tool=sql',show:false},
      {path:'/app/sql',show:false},
      {path:'/app?tool=pseudocode',show:false},
      {path:'/app/pseudocode',show:false},
      {path:'/app/flowchart',show:false},
      {path:'/app#privacy',show:false},
    ];
    for(const {path,show} of cases){
      const document=new JSDOM(initialHtml,{url:'https://picompiler.pages.dev'+path,runScripts:'dangerously'}).window.document;
      expect(document.documentElement.classList.contains('pico-initial-home-route')).toBe(show);
      const home=document.querySelector('.pico-initial-home-loading');
      expect(home).not.toBeNull();
      expect(home?.parentElement?.tagName).toBe('BODY');
      expect(home?.previousElementSibling?.id).toBe('root');
      expect(document.defaultView!.getComputedStyle(home!).position).toBe('fixed');
      expect(document.defaultView!.getComputedStyle(home!).display==='block').toBe(show);
      const landing=document.querySelector('.pico-loading')!;
      expect(document.defaultView!.getComputedStyle(landing).display==='none').toBe(path!=='/');
    }
    const home=new JSDOM(initialHtml).window.document.querySelector('.pico-initial-home-loading');
    expect(home?.querySelectorAll('.pico-initial-home-card')).toHaveLength(8);
    expect(home?.querySelectorAll('.pico-initial-home-group')).toHaveLength(3);
    expect(home?.querySelectorAll('.pico-initial-home-data .pico-initial-home-card')).toHaveLength(2);
  });
});
