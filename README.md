# Pico — Cambridge Pseudocode Studio

A browser-only studio for writing, running, debugging and learning **Cambridge IGCSE Computer Science
pseudocode**. Everything runs in the browser: there is no backend and no account, and projects,
settings and practice files live in `localStorage`.

## The editor

- **VS Code-style syntax highlighting.** Cambridge pseudocode is tokenised into control keywords,
  statement keywords, data types, variables, routine and function calls, numbers, strings, comments,
  operators, punctuation and Boolean literals.
- **21 IDE themes.** Dark+, Light+, Dracula, Monokai, One Dark Pro, One Light, Nord, Tokyo Night,
  Catppuccin Mocha, Catppuccin Latte, Gruvbox Dark, Solarized Dark, Solarized Light, GitHub Dark,
  GitHub Light, Ayu Mirage, Night Owl, Palenight, Rosé Pine, SynthWave '84 and Cobalt2.
  Each theme ships a complete palette — syntax token colours, editor chrome (gutter, active line,
  caret, selection, bracket matching, tooltips) and the surrounding interface — rather than only a
  background colour. The picker previews every theme with its own token swatches and supports search
  plus dark/light grouping.
- **Readable nesting.** VS Code-style vertical indentation guides are drawn at every nesting level,
  follow the editor's real character width (so they stay aligned at any font size), and brighten on
  the active line. Tab inserts one nesting level; `Shift-Tab` outdents a selection.
- **IDE surface.** JetBrains Mono coding font, line numbers with active-gutter highlighting,
  active-line highlighting, a themed 2px caret, themed selection and selection-match highlighting,
  bracket matching and search highlights.
- **Viewport-safe menus.** The Options menu and the File menu are positioned from the viewport: they
  flip above their button when that side has more room, stay inside the horizontal margins, and
  scroll internally when taller than the available space.

There is **no AutoDeclare feature** — it is absent from the interface, the stored settings and the
compiler, and settings saved by earlier versions are normalised on load.

## The language

`DECLARE`/`CONSTANT`, typed `INPUT`/`OUTPUT`, `IF`/`ELSE`/`ENDIF` (including `THEN` on the next
line), `CASE OF`/`OTHERWISE`/`ENDCASE`, `WHILE…DO`/`ENDWHILE`, `FOR`/`TO`/`STEP`/`NEXT`,
`REPEAT`/`UNTIL`, `PROCEDURE`/`ENDPROCEDURE` and `FUNCTION…RETURNS…ENDFUNCTION` with parameters and
local scope, one- and two-dimensional `ARRAY`s, `OPENFILE`/`READFILE`/`WRITEFILE`/`CLOSEFILE` over a
browser-local virtual file system, and the library routines `LENGTH`, `SUBSTRING`, `UCASE`, `LCASE`,
`DIV`, `MOD`, `ROUND` and `RANDOM`.

## Tools

Run and output console, step-by-step visual debugger, test cases with expected versus actual output,
code coverage, AST viewer, token viewer, flowchart, Cambridge example programs, syntax cheat sheet,
autocomplete, autocorrect suggestions and hover documentation.

## Development

```sh
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # vitest: language, theme and panel-placement tests
pnpm build      # tsc --noEmit && vite build  →  dist/
pnpm preview    # serve the production build
```

## Source layout

| Path | Responsibility |
| --- | --- |
| `src/language/` | Lexer, parser, AST and the Cambridge syntax guards |
| `src/runtime/` | Interpreter, diagnostics and friendly error messages |
| `src/app/themes.ts` | Theme registry, palette derivation and CSS variables |
| `src/app/components/CodeEditor.tsx` | CodeMirror setup: highlighting, indent guides, editor chrome |
| `src/app/components/FloatingPanel.tsx` | Viewport-clamped anchored menus (`computePanelBox` is unit-tested) |
| `src/app/components/ThemePicker.tsx` | Searchable theme gallery with per-theme swatches |
| `src/app/Panels.tsx`, `App.tsx` | Tool dock, workspace layout and application shell |
| `src/storage/` | Browser-local projects and settings |
| `src/visual/` | Flowchart generation |