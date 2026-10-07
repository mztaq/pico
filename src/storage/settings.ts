import {
  DEFAULT_THEME_ID,
  normalizeThemeId,
  type ThemeId,
} from '../app/themes';

export type PanelKeyPreference =
  | 'console'
  | 'debugger'
  | 'tests'
  | 'flowchart';
export type LayoutPreset = 'coding' | 'debugging' | 'focus' | 'custom';
export interface PicoSettings {
  autocomplete: boolean;
  autocorrect: boolean;
  hoverDocs: boolean;
  autoDeclare: boolean;
  fontSize: number;
  theme: ThemeId;
  sidebarSide: 'left' | 'right';
  dockSide: 'bottom' | 'right';
  sidebarWidth: number;
  referenceWidth: number;
  referenceFontSize: number;
  dockSize: number;
  panelOrder: PanelKeyPreference[];
  layoutPreset: LayoutPreset;
  sidebarVisible: boolean;
  referenceVisible: boolean;
}
const KEY = 'pico.settings.v5';
const LEGACY_KEYS = ['pico.settings.v4', 'pico.settings.v3'];
export const defaultSettings: PicoSettings = {
  autocomplete: true,
  autocorrect: true,
  hoverDocs: true,
  autoDeclare: true,
  fontSize: 16,
  theme: DEFAULT_THEME_ID,
  sidebarSide: 'left',
  dockSide: 'bottom',
  sidebarWidth: 226,
  referenceWidth: 360,
  referenceFontSize: 13,
  dockSize: 33,
  panelOrder: [
    'console',
    'debugger',
    'tests',
    'flowchart',
  ],
  layoutPreset: 'coding',
  sidebarVisible: true,
  referenceVisible: true,
};
export function loadSettings(): PicoSettings {
  for (const key of [KEY, ...LEGACY_KEYS]) {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (value && typeof value === 'object') {
        const c = value as Partial<PicoSettings>;
        const requested = Array.isArray(c.panelOrder)
          ? c.panelOrder.filter((x): x is PanelKeyPreference =>
              defaultSettings.panelOrder.includes(x as PanelKeyPreference),
            )
          : [];
        const orders = [
          ...new Set([...requested, ...defaultSettings.panelOrder]),
        ];
        return {
          ...defaultSettings,
          autocomplete:
            typeof c.autocomplete === 'boolean' ? c.autocomplete : true,
          autocorrect:
            typeof c.autocorrect === 'boolean' ? c.autocorrect : true,
          hoverDocs: typeof c.hoverDocs === 'boolean' ? c.hoverDocs : true,
          sidebarSide: c.sidebarSide === 'right' ? 'right' : 'left',
          dockSide: c.dockSide === 'right' ? 'right' : 'bottom',
          layoutPreset:
            c.layoutPreset === 'debugging' ||
            c.layoutPreset === 'focus' ||
            c.layoutPreset === 'custom'
              ? c.layoutPreset
              : 'coding',
          sidebarVisible:
            typeof c.sidebarVisible === 'boolean' ? c.sidebarVisible : true,
          referenceVisible:
            typeof c.referenceVisible === 'boolean' ? c.referenceVisible : true,
          autoDeclare:
            typeof c.autoDeclare === 'boolean' ? c.autoDeclare : true,
          theme: normalizeThemeId(c.theme),
          panelOrder: orders.length ? orders : defaultSettings.panelOrder,
          fontSize:
            typeof c.fontSize === 'number' && Number.isFinite(c.fontSize)
              ? Math.min(20, Math.max(12, c.fontSize))
              : defaultSettings.fontSize,
          sidebarWidth:
            typeof c.sidebarWidth === 'number'
              ? Math.min(360, Math.max(170, c.sidebarWidth))
              : 226,
          referenceWidth:
            typeof c.referenceWidth === 'number' && Number.isFinite(c.referenceWidth)
              ? Math.min(600, Math.max(280, c.referenceWidth))
              : 360,
          referenceFontSize:
            typeof c.referenceFontSize === 'number' && Number.isFinite(c.referenceFontSize)
              ? Math.min(18, Math.max(12, c.referenceFontSize - (key === KEY ? 0 : 2)))
              : 13,
          dockSize:
            typeof c.dockSize === 'number'
              ? Math.min(60, Math.max(22, c.dockSize))
              : 33,
        };
      }
    } catch {
      /* Try the next storage key, then fall back to defaults. */
    }
  }
  return { ...defaultSettings };
}
export function saveSettings(settings: PicoSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
