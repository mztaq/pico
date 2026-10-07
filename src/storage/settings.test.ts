import {afterEach,expect,it,vi} from 'vitest';
import {loadSettings} from './settings';
afterEach(()=>vi.unstubAllGlobals());
it('starts with Catppuccin Mocha and preserves saved theme choices',()=>{
  vi.stubGlobal('localStorage',{getItem:()=>null});
  expect(loadSettings().theme).toBe('catppuccin-mocha');
  for (const [stored, expected] of [['dark-plus','dark-plus'],['high-contrast-yellow','high-contrast-yellow'],['dark','dark-plus']]) {
    vi.stubGlobal('localStorage',{getItem:(key:string)=>key==='pico.settings.v5'?JSON.stringify({theme:stored}):null});
    expect(loadSettings().theme).toBe(expected);
  }
});
it('normalizes malformed settings and keeps all tool tabs available',()=>{
  vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify({autocomplete:'no',sidebarSide:'bad',dockSide:'bad',panelOrder:['tests','tests','bogus']})});
  const settings=loadSettings();expect(settings.autocomplete).toBe(true);expect(settings.sidebarSide).toBe('left');expect(settings.dockSide).toBe('bottom');expect(new Set(settings.panelOrder).size).toBe(3);expect(settings.panelOrder).not.toContain('tests');
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

it('uses a 19px editor default, preserves chosen sizes, and removes retired panels',()=>{
  vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify({panelOrder:['tokens','tests','coverage','ast','console'],fontSize:17})});
  expect(loadSettings().panelOrder).toEqual(['console','debugger','flowchart']);
  expect(loadSettings().fontSize).toBe(17);
  vi.stubGlobal('localStorage',{getItem:()=>null});
  expect(loadSettings().fontSize).toBe(19);
});

it('migrates the old default size and preserves a new explicit preference',()=>{
  vi.stubGlobal('localStorage',{getItem:(key:string)=>key==='pico.settings.v5'?JSON.stringify({fontSize:16}):null});
  expect(loadSettings().fontSize).toBe(19);
  vi.stubGlobal('localStorage',{getItem:(key:string)=>key==='pico.settings.v6'?JSON.stringify({fontSize:16}):null});
  expect(loadSettings().fontSize).toBe(16);
});
