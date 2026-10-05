#!/usr/bin/env python3
"""One-off patch that wires the new editor/theming UI into the Pico app shell."""
from pathlib import Path

APP = Path(__file__).resolve().parents[1] / 'src' / 'app' / 'App.tsx'
source = APP.read_text(encoding='utf-8')

replacements: list[tuple[str, str, int]] = [
    # 1. imports
    (
        "import { loadSettings, saveSettings, type PicoSettings } from '../storage/settings';\nimport '../app/styles/app.css';",
        "import { loadSettings, saveSettings, type PicoSettings } from '../storage/settings';\n"
        "import { cssVariables, getTheme } from '../app/themes';\n"
        "import { FloatingPanel } from './components/FloatingPanel';\n"
        "import { ThemePicker } from './components/ThemePicker';\n"
        "import '../app/styles/app.css';",
        1,
    ),
    # 2. anchor refs
    (
        "  const editorRef = useRef<EditorHandle>(null);",
        "  const editorRef = useRef<EditorHandle>(null);\n"
        "  const settingsAnchorRef = useRef<HTMLDivElement>(null);\n"
        "  const fileAnchorRef = useRef<HTMLDivElement>(null);",
        1,
    ),
    # 3. resolved theme
    (
        "  const activeProject = projects.find(project => project.id === activeId) ?? projects[0]!;",
        "  const activeProject = projects.find(project => project.id === activeId) ?? projects[0]!;\n"
        "  const theme = getTheme(settings.theme);",
        1,
    ),
    # 4. drop auto-declare from the editor pipeline
    (
        "    code = code.replace(/<--/g, '←').replace(/[“”]/g, '\"');\n    if (settings.autoDeclare) code = autoDeclare(code, settings.autoDeclareType);\n",
        "    code = code.replace(/<--/g, '←').replace(/[“”]/g, '\"');\n",
        1,
    ),
    # 5. Escape closes both menus
    (
        "      if (event.key === 'Escape') setSettingsOpen(false);",
        "      if (event.key === 'Escape') { setSettingsOpen(false); setFileMenuOpen(false); }",
        1,
    ),
    # 6. close menus when clicking outside them
    (
        "    window.addEventListener('keydown', onKeyDown);\n    return () => window.removeEventListener('keydown', onKeyDown);\n  });",
        "    window.addEventListener('keydown', onKeyDown);\n    return () => window.removeEventListener('keydown', onKeyDown);\n  });\n"
        "  useEffect(() => {\n"
        "    const onPointerDown = (event: PointerEvent) => {\n"
        "      const target = event.target as Node;\n"
        "      if (settingsAnchorRef.current && !settingsAnchorRef.current.contains(target)) setSettingsOpen(false);\n"
        "      if (fileAnchorRef.current && !fileAnchorRef.current.contains(target)) setFileMenuOpen(false);\n"
        "    };\n"
        "    document.addEventListener('pointerdown', onPointerDown);\n"
        "    return () => document.removeEventListener('pointerdown', onPointerDown);\n"
        "  }, []);",
        1,
    ),
    # 7. theme variables on the shell
    (
        "  return <div className={`pico-app theme-${settings.theme}`} style={{ '--sidebar-width': `${settings.sidebarWidth}px`, '--reference-width': `${settings.referenceWidth}px`, '--dock-size': `${settings.dockSize}%` } as React.CSSProperties}>",
        "  return <div className=\"pico-app\" data-pico-theme={theme.id} style={{ ...cssVariables(theme), '--sidebar-width': `${settings.sidebarWidth}px`, '--reference-width': `${settings.referenceWidth}px`, '--dock-size': `${settings.dockSize}%` } as React.CSSProperties}>",
        1,
    ),
    # 8. settings anchor ref
    (
        "<div className=\"settings-anchor\"><button className={`topbar-icon ${settingsOpen ? 'active' : ''}`}",
        "<div className=\"settings-anchor\" ref={settingsAnchorRef}><button className={`topbar-icon ${settingsOpen ? 'active' : ''}`}",
        1,
    ),
    # 9. settings popover becomes a clamped floating panel
    (
        "{settingsOpen && <div className=\"settings-popover\"><div className=\"settings-title\">",
        "{<FloatingPanel anchor={settingsAnchorRef} open={settingsOpen} className=\"settings-popover\"><div className=\"settings-title\">",
        1,
    ),
    # 10. remove the auto-declare controls
    (
        "<SettingRow title=\"Auto-declare\" detail={`Infer and insert DECLARE types (${settings.autoDeclareType} fallback)`} checked={settings.autoDeclare} onChange={value => changeSettings({ autoDeclare: value })} /><label className=\"font-setting\"><span>Auto-declare type</span><select value={settings.autoDeclareType} onChange={event => changeSettings({ autoDeclareType: event.target.value as PicoSettings['autoDeclareType'] })}>{['INTEGER','REAL','CHAR','STRING','BOOLEAN'].map(type => <option key={type}>{type}</option>)}</select></label>",
        "",
        1,
    ),
    # 11. theme select becomes the theme gallery
    (
        "<label className=\"font-setting\"><span>Theme</span><select value={settings.theme} onChange={event => changeSettings({ theme: event.target.value as PicoSettings['theme'] })}>{['dark','light','coffee','matcha','cappuccino','mocha','raven'].map(theme => <option key={theme}>{theme}</option>)}</select></label>",
        "<ThemePicker value={settings.theme} onChange={id => changeSettings({ theme: id })} />",
        1,
    ),
    # 12. close the settings floating panel
    (
        "Saved locally in this browser · drag dock tabs to reorder</div></div>}",
        "Saved locally in this browser · drag dock tabs to reorder</div></FloatingPanel>}",
        1,
    ),
    # 13. file menu anchor ref
    (
        "<div className=\"file-menu-anchor\"><button className={`help-button ${fileMenuOpen ? 'active' : ''}`}",
        "<div className=\"file-menu-anchor\" ref={fileAnchorRef}><button className={`help-button ${fileMenuOpen ? 'active' : ''}`}",
        1,
    ),
    # 14. file menu becomes a clamped floating panel that closes on use
    (
        "{fileMenuOpen && <div className=\"file-menu\"><button onClick={() => fileInputRef.current?.click()}>",
        "{<FloatingPanel anchor={fileAnchorRef} open={fileMenuOpen} className=\"file-menu\"><button onClick={() => { setFileMenuOpen(false); fileInputRef.current?.click(); }}>",
        1,
    ),
    (
        "<button onClick={() => exportProject(activeProject)}><Download size={14} /> Export .pico</button></div>}<input ref={fileInputRef}",
        "<button onClick={() => { exportProject(activeProject); setFileMenuOpen(false); }}><Download size={14} /> Export .pico</button></FloatingPanel>}<input ref={fileInputRef}",
        1,
    ),
    # 15. editor receives the active theme
    (
        "preferences={settings} coveredLines={result?.coverage ?? []}",
        "preferences={settings} theme={theme} coveredLines={result?.coverage ?? []}",
        1,
    ),
]

for index, (old, new, expected) in enumerate(replacements, start=1):
    found = source.count(old)
    if found != expected:
        raise SystemExit(f'patch step {index} expected {expected} match(es) but found {found}: {old[:90]!r}')
    source = source.replace(old, new)

# 16. delete the now-unused auto-declare helper
lines = source.split('\n')
kept = [line for line in lines if not line.startswith('function autoDeclare(')]
if len(kept) != len(lines) - 1:
    raise SystemExit('expected to remove exactly one autoDeclare helper line')
source = '\n'.join(kept)

if 'autoDeclare' in source:
    raise SystemExit('autoDeclare references still remain in App.tsx')

APP.write_text(source, encoding='utf-8')
print('App.tsx patched successfully')