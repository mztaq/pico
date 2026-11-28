import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
describe('Interactive workspace fluid background',()=>{
  it('mounts the same theme-aware fluid in all eight workspaces, excluding the embedded CPU preview',()=>{
    for(const path of ['src/app/App.tsx','src/flowchart/FlowchartWorkspace.tsx','src/logic/LogicWorkspace.tsx','src/cpu/CpuStudio.tsx','src/binary/BinaryLab.tsx','src/sql/SqlPlayground.tsx','src/traffic/TrafficStorm.tsx']){
      expect(read(path)).toContain('<WorkspaceFluidBackground theme={theme}/>');
      expect(read(path)).toContain('workspace-fluid-surface');
    }
    expect(read('src/cpu/CpuStudio.tsx')).toContain('{!landingPreview && <WorkspaceFluidBackground theme={theme}/>}');
    expect(read('src/app/components/WorkspaceFluidBackground.tsx')).toContain('workspace disabled={theme.highContrast}');
  });
  it('keeps pointer interaction, limits workspace GPU cost and blurs only the decorative canvas',()=>{
    const engine=read('src/app/components/home-fluid-engine.js');
    const css=read('src/app/components/workspace-fluid.css');
    expect(engine).toContain('1000 / (workspace ? 30 : 60)');
    expect(engine).toContain("parent.addEventListener('pointermove', onPointer, {passive: true, capture: true});");
    expect(engine).toContain("parent.addEventListener('pointerdown', onPointer, {passive: true, capture: true});");
    expect(css).toContain('pointer-events: none');
    expect(css).toContain('.pico-workspace-fluid canvas {');
    expect(css).toContain('filter: blur(24px)');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(read('src/app/styles/ios-workspace.css')).toMatch(/\.run-button\s*\{\s*border-radius: var\(--ds-radius-md\)/);
  });
});
