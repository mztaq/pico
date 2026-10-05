import {afterEach,expect,it,vi} from 'vitest';
import {loadSettings} from './settings';
afterEach(()=>vi.unstubAllGlobals());
it('normalizes malformed settings and keeps all tool tabs available',()=>{
  vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify({autocomplete:'no',sidebarSide:'bad',dockSide:'bad',panelOrder:['tests','tests','bogus']})});
  const settings=loadSettings();expect(settings.autocomplete).toBe(true);expect(settings.sidebarSide).toBe('left');expect(settings.dockSide).toBe('bottom');expect(new Set(settings.panelOrder).size).toBe(7);expect(settings.panelOrder[0]).toBe('tests');
});
it('loads older reference preferences with readable limits and a default text size',()=>{
  vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify({referenceWidth:220})});
  expect(loadSettings().referenceWidth).toBe(280);expect(loadSettings().referenceFontSize).toBe(13);
  vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify({referenceWidth:900,referenceFontSize:32})});
  expect(loadSettings().referenceWidth).toBe(600);expect(loadSettings().referenceFontSize).toBe(18);
});

it('reduces reference sizes from v4 once and preserves later custom sizes',()=>{
  vi.stubGlobal('localStorage',{getItem:(key:string)=>key==='pico.settings.v4'?JSON.stringify({referenceFontSize:15}):null});
  expect(loadSettings().referenceFontSize).toBe(13);
  vi.stubGlobal('localStorage',{getItem:(key:string)=>key==='pico.settings.v5'?JSON.stringify({referenceFontSize:16}):null});
  expect(loadSettings().referenceFontSize).toBe(16);
});
