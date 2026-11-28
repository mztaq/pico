import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
describe('Concentric cards and neutral home navigation',()=>{
  it('keeps blur without accent colour or saturation on the home navbar',()=>{
    const css=read('src/styles/ios-ui.css');
    const nav=css.match(/\.pico-home \.home-nav\s*\{[^}]*\}/)?.[0]??'';
    expect(nav).toContain('background: transparent');
    expect(nav).toContain('backdrop-filter: blur(18px) grayscale(1)');
    expect(nav).not.toContain('saturate(');
  });
  it('calculates inset panel radii instead of hardcoding independent corners',()=>{
    for(const path of ['src/binary/binary.css','src/learning/learning.css','src/sql/sql-playground.css','src/styles/compiler.css','src/traffic/traffic-storm.css','src/app/components/bug-report.css']){
      const css=read(path);
      expect(css).toContain('max(0px, calc(var(--pico-card-radius) - var(--pico-card-inset)))');
      expect(css).toContain('--pico-card-inset:');
      expect(css).toContain('--pico-card-radius:');
    }
    expect(read('src/styles/home.css')).toContain('max(0px, calc(var(--home-card-radius) - var(--home-card-padding)))');
  });
});
