import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorkspaceLoading, type VisualWorkspace } from '../src/app/components/WorkspaceLoading';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Visual workspace loading skeletons',()=>{
  const workspaces: VisualWorkspace[]=['Flowchart Builder','Logic Sim','Binary Lab','CPU Studio'];

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
    expect((html.match(/class="pico-load-bit-column"/g)??[]).toHaveLength(8);
    expect((html.match(/class="pico-load-value-card"/g)??[])).toHaveLength(3);
  });

  it('resembles CPU mode controls, registers, memory and step details',()=>{
    const html=renderToStaticMarkup(createElement(WorkspaceLoading,{workspace:'CPU Studio'}));
    for(const name of ['pico-load-cpu-controls','pico-load-cpu-registers','pico-load-cpu-memory','pico-load-cpu-info']){
      expect(html).toContain(name);
    }
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
    expect(entry).toContain('directVisualWorkspace(window.location.search)');
    expect(entry).toContain('fallback={initialVisualWorkspace ? <WorkspaceLoading workspace={initialVisualWorkspace} /> : null}');
    expect(read('src/app/components/workspace-loading.css')).toContain('prefers-reduced-motion:reduce');
  });
});
