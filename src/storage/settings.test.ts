import {afterEach,expect,it,vi} from 'vitest';
import {loadSettings} from './settings';
afterEach(()=>vi.unstubAllGlobals());
it('normalizes malformed settings and keeps all tool tabs available',()=>{
  vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify({autocomplete:'no',sidebarSide:'bad',dockSide:'bad',panelOrder:['tests','tests','bogus']})});
  const settings=loadSettings();expect(settings.autocomplete).toBe(true);expect(settings.sidebarSide).toBe('left');expect(settings.dockSide).toBe('bottom');expect(new Set(settings.panelOrder).size).toBe(7);expect(settings.panelOrder[0]).toBe('tests');
});
