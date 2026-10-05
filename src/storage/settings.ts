import { DEFAULT_THEME_ID, normalizeThemeId, type ThemeId } from '../app/themes';

export type PanelKeyPreference = 'console' | 'debugger' | 'tests' | 'flowchart' | 'coverage' | 'ast' | 'tokens';
export type LayoutPreset = 'coding' | 'debugging' | 'focus' | 'custom';
export interface PicoSettings {
  autocomplete: boolean; autocorrect: boolean; hoverDocs: boolean; autoDeclare: boolean; fontSize: number;
  theme: ThemeId; promptForInput: boolean; sidebarSide: 'left' | 'right'; dockSide: 'bottom' | 'right';
  sidebarWidth: number; referenceWidth: number; dockSize: number; panelOrder: PanelKeyPreference[]; layoutPreset: LayoutPreset; sidebarVisible: boolean; referenceVisible: boolean;
}
const KEY = 'pico.settings.v4';
const LEGACY_KEYS = ['pico.settings.v3'];
export const defaultSettings: PicoSettings = {
  autocomplete: true, autocorrect: true, hoverDocs: true, autoDeclare: true, fontSize: 14,
  theme: DEFAULT_THEME_ID, promptForInput: true, sidebarSide: 'left', dockSide: 'bottom', sidebarWidth: 226, referenceWidth: 278, dockSize: 33,
  panelOrder: ['console','debugger','tests','flowchart','coverage','ast','tokens'], layoutPreset: 'coding', sidebarVisible: true, referenceVisible: true,
};
export function loadSettings(): PicoSettings {
  for (const key of [KEY, ...LEGACY_KEYS]) {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (value && typeof value === 'object') {
        const c = value as Partial<PicoSettings>;
        const orders = Array.isArray(c.panelOrder) ? c.panelOrder.filter((x): x is PanelKeyPreference => defaultSettings.panelOrder.includes(x as PanelKeyPreference)) : defaultSettings.panelOrder;
        return {
          ...defaultSettings, ...c,
          layoutPreset: c.layoutPreset === 'debugging' || c.layoutPreset === 'focus' || c.layoutPreset === 'custom' ? c.layoutPreset : 'coding',
          sidebarVisible: typeof c.sidebarVisible === 'boolean' ? c.sidebarVisible : true,
          referenceVisible: typeof c.referenceVisible === 'boolean' ? c.referenceVisible : true,
          autoDeclare: typeof c.autoDeclare === 'boolean' ? c.autoDeclare : true,
          theme: normalizeThemeId(c.theme),
          panelOrder: orders.length ? orders : defaultSettings.panelOrder,
          fontSize: typeof c.fontSize === 'number' ? Math.min(20, Math.max(12, c.fontSize)) : 14,
          sidebarWidth: typeof c.sidebarWidth === 'number' ? Math.min(360, Math.max(170, c.sidebarWidth)) : 226,
          referenceWidth: typeof c.referenceWidth === 'number' ? Math.min(460, Math.max(220, c.referenceWidth)) : 278,
          dockSize: typeof c.dockSize === 'number' ? Math.min(60, Math.max(22, c.dockSize)) : 33,
        };
      }
    } catch { /* Try the next storage key, then fall back to defaults. */ }
  }
  return { ...defaultSettings };
}
export function saveSettings(settings: PicoSettings): void { localStorage.setItem(KEY, JSON.stringify(settings)); }
