#!/usr/bin/env python3
"""One-off patch that moves the stylesheet onto theme CSS variables and adds the
indentation-guide, floating-panel and theme-picker styles."""
import re
from pathlib import Path

CSS = Path(__file__).resolve().parents[1] / 'src' / 'app' / 'styles' / 'app.css'
source = CSS.read_text(encoding='utf-8')

replacements: list[tuple[str, str, int]] = [
    (
        "@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');",
        "@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');",
        1,
    ),
    (
        "  --bg: #0b0c10;", "  --bg: #1e1e1e;", 1,
    ),
    ("  --surface: #111318;", "  --surface: #252526;", 1),
    ("  --surface-raised: #15171e;", "  --surface-raised: #2a2b2c;", 1),
    ("  --surface-hover: #1c1f28;", "  --surface-hover: #313234;", 1),
    ("  --surface-input: #0e1015;", "  --surface-input: #141414;", 1),
    ("  --border: #242731;", "  --border: #3c3c3c;", 1),
    ("  --border-soft: #1d2029;", "  --border-soft: #2f3030;", 1),
    ("  --text: #e9eaf0;", "  --text: #d4d4d4;", 1),
    ("  --muted: #8d91a0;", "  --muted: #8a8a8a;", 1),
    ("  --dim: #656a78;", "  --dim: #6b6b6b;", 1),
    ("  --accent: #968cff;", "  --accent: #0e7ad3;", 1),
    ("  --accent-strong: #8179ef;", "  --accent-strong: #0c68b4;", 1),
    ("  --accent-soft: rgba(150, 140, 255, .12);", "  --accent-soft: rgba(14, 122, 211, .16);", 1),
    (
        "  --font-code: 'DM Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;",
        "  --font-code: 'JetBrains Mono', 'DM Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace;\n"
        "  --syntax-keyword: #c586c0;\n  --syntax-type: #4ec9b0;\n  --syntax-variable: #9cdcfe;\n  --syntax-function: #dcdcaa;\n"
        "  --syntax-number: #b5cea8;\n  --syntax-string: #ce9178;\n  --syntax-comment: #6a9955;\n  --syntax-operator: #d4d4d4;\n"
        "  --syntax-punctuation: #d4d4d4;\n  --syntax-bool: #569cd6;\n"
        "  --editor-bg: #1e1e1e;\n  --editor-gutter: #7c7c7c;\n  --editor-gutter-active: #d4d4d4;\n  --editor-line: rgba(14, 122, 211, .09);\n"
        "  --editor-selection: rgba(14, 122, 211, .3);\n  --editor-cursor: #0e7ad3;\n  --editor-match: rgba(14, 122, 211, .32);\n"
        "  --indent-guide: rgba(212, 212, 212, .16);\n  --indent-guide-active: rgba(212, 212, 212, .38);\n"
        "  --tooltip-bg: #34343a;\n  --tooltip-border: #4a4a4a;",
        1,
    ),
    # Debug/error line highlights must not reset the indent-guide background image.
    (
        ".cm-line.pico-debug-line { background: rgba(135,126,245,.15) !important; box-shadow: inset 2px 0 0 #aa9fff; }",
        ".cm-line.pico-debug-line { background-color: var(--editor-line) !important; box-shadow: inset 2px 0 0 var(--accent); }",
        1,
    ),
    (
        ".cm-line.pico-error-line { background: rgba(229,130,138,.11) !important; box-shadow: inset 2px 0 0 #e5828a; }",
        ".cm-line.pico-error-line { background-color: rgba(229,130,138,.14) !important; box-shadow: inset 2px 0 0 var(--red); }",
        1,
    ),
    (
        ".cm-line.pico-covered-line { box-shadow: inset 2px 0 0 rgba(95,190,151,.72); }",
        ".cm-line.pico-covered-line { box-shadow: inset 2px 0 0 var(--mint); }",
        1,
    ),
    # Popovers are positioned by FloatingPanel, so they only carry their own look.
    (
        ".settings-popover { position: absolute; width: 304px; top: 42px; right: -30px; padding: 14px; border: 1px solid #30333f; border-radius: 12px; background: #171920; box-shadow: 0 20px 70px rgba(0,0,0,.55); z-index: 50; }",
        ".settings-popover { width: 320px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-raised); box-shadow: 0 20px 70px rgba(0,0,0,.55); }",
        1,
    ),
    (
        ".file-menu { position: absolute; top: 38px; right: 0; width: 168px; padding: 6px; border: 1px solid #30333f; border-radius: 9px; background: #171920; box-shadow: 0 18px 50px rgba(0,0,0,.48); z-index: 60; }",
        ".file-menu { width: 172px; padding: 6px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-raised); box-shadow: 0 18px 50px rgba(0,0,0,.48); }",
        1,
    ),
    (
        ".file-menu button { width: 100%; display: flex; align-items: center; gap: 8px; padding: 9px 10px; border: 0; border-radius: 6px; background: transparent; color: #c4c5d0; font-size: 10px; text-align: left; cursor: pointer; }",
        ".file-menu button { width: 100%; display: flex; align-items: center; gap: 8px; padding: 9px 10px; border: 0; border-radius: 6px; background: transparent; color: var(--text); font-size: 10px; text-align: left; cursor: pointer; }",
        1,
    ),
    (
        ".file-menu button:hover { background: #252733; color: #f2f1fb; }",
        ".file-menu button:hover { background: var(--surface-hover); color: var(--text); }",
        1,
    ),
    (
        ".settings-popover select { width: 100%; margin-top: 8px; padding: 6px 8px; border: 1px solid #363945; border-radius: 5px; background: #101218; color: #d7d8e2; font-family: var(--font-code); font-size: 10px; }",
        ".settings-popover select { width: 100%; margin-top: 8px; padding: 6px 8px; border: 1px solid var(--border); border-radius: 5px; background: var(--surface-input); color: var(--text); font-family: var(--font-code); font-size: 10px; }",
        1,
    ),
    (
        ".reset-layout-button { width: 100%; margin-top: 12px; padding: 7px 8px; border: 1px solid #3c3b50; border-radius: 6px; background: rgba(150,140,255,.08); color: #c4beff; font-size: 9px; cursor: pointer; }",
        ".reset-layout-button { width: 100%; margin-top: 12px; padding: 7px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--accent-soft); color: var(--text); font-size: 9px; cursor: pointer; }",
        1,
    ),
    (
        ".reset-layout-button:hover { background: rgba(150,140,255,.16); }",
        ".reset-layout-button:hover { background: var(--accent-soft); border-color: var(--accent); }",
        1,
    ),
    # The editor chrome is themed by CodeMirror itself; keep the shell in sync.
    (
        '.pico-app[class*="theme-"] .cm-editor,\n.pico-app[class*="theme-"] .cm-scroller,\n.pico-app[class*="theme-"] .cm-gutters { background: var(--surface) !important; color: var(--text) !important; }',
        '.pico-app[data-pico-theme] .cm-editor,\n.pico-app[data-pico-theme] .cm-scroller,\n.pico-app[data-pico-theme] .cm-gutters { background: var(--editor-bg) !important; color: var(--text) !important; }',
        1,
    ),
    (
        '.pico-app[class*="theme-"] .cm-gutters { border-color: var(--border) !important; color: var(--muted) !important; }',
        '.pico-app[data-pico-theme] .cm-gutters { border-color: var(--border) !important; color: var(--editor-gutter) !important; }',
        1,
    ),
    (
        '.pico-app[class*="theme-"] .cm-activeLine { background: var(--accent-soft) !important; }',
        '.pico-app[data-pico-theme] .cm-activeLine { background-color: var(--editor-line) !important; }',
        1,
    ),
    (
        '.pico-app[class*="theme-"] .cm-tooltip { background: var(--surface-raised); border-color: var(--border); color: var(--text); }',
        '.pico-app[data-pico-theme] .cm-tooltip { background: var(--tooltip-bg); border-color: var(--tooltip-border); color: var(--text); }',
        1,
    ),
]

for index, (old, new, expected) in enumerate(replacements, start=1):
    found = source.count(old)
    if found != expected:
        raise SystemExit(f'css step {index} expected {expected} match(es) but found {found}: {old[:80]!r}')
    source = source.replace(old, new)

# Every remaining theme selector now keys off the theme attribute.
source = source.replace('.pico-app[class*="theme-"]', '.pico-app[data-pico-theme]')

# Drop the superseded palette blocks; palettes now arrive as inline CSS variables.
before = len(source.split('\n'))
source = re.sub(r'^\.theme-(?:light|coffee|matcha|cappuccino|mocha|raven) \{.*\}$\n?', '', source, flags=re.MULTILINE)
after = len(source.split('\n'))
if before - after != 6:
    raise SystemExit(f'expected to remove 6 legacy palette blocks, removed {before - after}')
if 'class*="theme-"' in source:
    raise SystemExit('legacy theme selectors still present')

CSS.write_text(source, encoding='utf-8')
print('app.css patched successfully')