import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorkspaceLoading, type VisualWorkspace } from '../src/app/components/WorkspaceLoading';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Visual workspace loading skeletons',()=>{
  const workspaces: VisualWorkspace[]=['Flowchart Builder','Logic Sim','Binary Lab','CPU Studio','Traffic Storm'];

  it.each(workspaces)('provides an accessible, noninteractive skeleton for %s',(workspace)=>{
    const html=renderToStaticMarkup(createElement(WorkspaceLoading,{workspace}));
    expect(html).toContain(`data-loading-workspace="${workspace}"`);
    expect(html).toContain(`aria-label="Opening ${workspace}"`);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('pico-load-topbar');
    expect(html).not.toMatch(/<button\b|<a\b|<input\b/);
    expect(html).not.toContain('percent');
  });

  it('resembles the Flowchart workspace canvas, node palette, inspector and console dock',()=>{
    const html=renderToStaticMarkup(createElement(WorkspaceLoading,{workspace:'Flowchart Builder'}));
    for(const name of ['pico-load-flowchart-grid','pico-load-palette','pico-load-flow-node','pico-load-inspector','pico-load-dock']){
      expect(html).toContain(name);
    }
  });

  it('resembles the Logic Sim workspace toolbar, gates, palette and inspector',()=>{
    const html=renderToStaticMarkup(createElement(WorkspaceLoading,{workspace:'Logic Sim'}));
    for(const name of ['pico-load-logic-toolbar','pico-load-logic-grid','pico-load-logic-gate','pico-load-inspector']){
      expect(html).toContain(name);
    }
  });

  it('shows the eight binary bit placeholders and three value fields',()=>{
    const html=renderToStaticMarkup(createElement(WorkspaceLoading,{workspace:'Binary Lab'}));
    expect((html.match(/class="pico-load-bit-column"/g)??[])).toHaveLength(8);
    expect((html.match(/class="pico-load-value-card"/g)??[])).toHaveLength(3);
  });

  it('resembles CPU mode controls, registers, memory and step details',()=>{
    const html=renderToStaticMarkup(createElement(WorkspaceLoading,{workspace:'CPU Studio'}));
    for(const name of ['pico-load-cpu-controls','pico-load-cpu-registers','pico-load-cpu-memory','pico-load-cpu-info']){
      expect(html).toContain(name);
    }
  });

  it('matches the minimal Traffic Storm alias entry instead of CPU registers',()=> {
    const html=renderToStaticMarkup(createElement(WorkspaceLoading,{workspace:'Traffic Storm'}));
    for (const part of ['pico-load-storm-content','pico-load-storm-heading','pico-load-storm-label',
      'pico-load-storm-input','pico-load-storm-hint','pico-load-storm-counter','pico-load-storm-button']) {
      expect(html).toContain(part);
    }
    expect(html).not.toContain('pico-load-cpu-controls');
    expect(html).not.toContain('pico-load-cpu-registers');
    expect(html).not.toContain('pico-load-cpu-memory');
    const css=read('src/app/components/workspace-loading.css');
    expect(css).toContain('--pico-storm-load-bg:var(--pico-boot-bg,#1e1e2e)');
    expect(css).toContain('--pico-storm-load-accent:var(--pico-boot-accent,#cba6f7)');
    expect(css).toContain('--pico-storm-load-accent:var(--accent)');
    expect(css).toContain('background:var(--pico-storm-load-bg)');
    expect(css).not.toContain('var(--accent,var(--pico-boot-accent,#cba6f7))');
    expect(css).toContain('data-loading-workspace="Traffic Storm"');
  });

  it('keeps the saved theme during the HTML-to-React loading transition',()=> {
    const css=read('src/app/components/workspace-loading.css');
    const rootDefaults=read('src/app/styles/app.css');
    const page=read('index.html');
    expect(rootDefaults).toContain('--accent: #0e7ad3');
    expect(css).toContain('--pico-storm-load-accent:var(--pico-boot-accent,#cba6f7)');
    expect(css).toContain('--pico-load-shimmer-b:color-mix(in srgb,var(--pico-storm-load-accent)');
    expect(css).toContain('--pico-storm-load-bg:var(--pico-boot-bg,#1e1e2e)');
    expect(css).toContain('.pico-app .pico-load-stage[data-loading-workspace="Traffic Storm"]');
    expect(page).toContain("'--pico-boot-accent'");
    expect(page).toContain("'--pico-boot-bg'");
  });

  it('uses the saved theme for the first Traffic Storm skeleton before React starts',()=> {
    const html=read('index.html');
    const main=read('src/main.tsx');
    expect(html).toContain('pico-initial-traffic-route');
    expect(html).toContain('pico-initial-traffic-loading');
    expect(html).toContain('pico-initial-traffic-entry');
    expect(html).toContain("get('tool') === 'traffic'");
    expect(html).toContain("'--pico-boot-accent'");
    expect(html).toContain("'--pico-boot-foreground'");
    expect(main).toContain("document.querySelector('.pico-initial-traffic-loading')?.remove()");
  });

  it('uses Suspense for the real lazy workspace imports and deep-link startup',()=>{
    const app=read('src/app/App.tsx');
    const transition=read('src/app/components/WorkspaceTransition.tsx');
    const entry=read('src/main.tsx');
    expect(app).toContain('lazy(() => import(\'../flowchart/FlowchartWorkspace\')');
    expect(app).toContain('lazy(() => import(\'../logic/LogicWorkspace\')');
    expect(app).toContain('lazy(() => import(\'../cpu/CpuStudio\')');
    expect(app).toContain('lazy(() => import(\'../binary/BinaryLab\')');
    expect(transition).toContain('<Suspense fallback={<WorkspaceLoading workspace={workspace} />}');
    expect(entry).toContain('directVisualWorkspace(window.location.pathname, window.location.search)');
    expect(entry).toContain('fallback={initialVisualWorkspace ? <WorkspaceLoading workspace={initialVisualWorkspace} /> : initialHomeScreen ? <HomeLoading /> : null}');
    expect(read('src/app/components/workspace-loading.css')).toContain('prefers-reduced-motion:reduce');
  });
});
