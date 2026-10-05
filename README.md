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

Auto-declare is an optional editor setting, enabled by default. It inserts inferred declarations
for assignments and tracks declarations it generated. Explicit declarations
are preserved. Disable it when practicing declarations for exams. The compiler itself always
requires declared variables, except FOR counters. A FOR loop introduces an INTEGER counter
when it has not already been declared, even with Auto-declare disabled. Explicit counters
must still be mutable INTEGER scalars.

Help opens **Pico in a minute**, a seven-step spotlight tour with Back/Next navigation,
keyboard exit, and a completion screen. The tour preserves code and restores the previous layout.
The quick reference has larger keyword buttons, syntax-coloured examples, saved 12–18px text controls, a draggable divider
on wide screens, and an accessible Reference button that opens a drawer on smaller screens.
New source tabs use `.pico`; old `.pseudocode` names are migrated when loading projects or snapshots.

## The language

`DECLARE`/`CONSTANT`, typed `INPUT`/`OUTPUT`, `IF`/`ELSE`/`ENDIF` (including `THEN` on the next
line), `CASE OF`/`OTHERWISE`/`ENDCASE`, `WHILE…DO`/`ENDWHILE`, `FOR`/`TO`/`STEP`/`NEXT`,
`REPEAT`/`UNTIL`, `PROCEDURE`/`ENDPROCEDURE` and `FUNCTION…RETURNS…ENDFUNCTION` with parameters and
local scope, one- and two-dimensional `ARRAY`s, `OPENFILE`/`READFILE`/`WRITEFILE`/`CLOSEFILE` over a
project-scoped virtual file system, and the library routines `LENGTH`, `SUBSTRING`, `UCASE`, `LCASE`,
`DIV`, `MOD`, `ROUND` and `RANDOM`.

## Tools

Run and output console, recorded execution debugger, test cases with expected versus actual output,
code coverage, AST viewer, token viewer, flowchart, Cambridge example programs, syntax cheat sheet,
autocomplete, autocorrect suggestions and hover documentation.

## Execution and practice files

Run and test batches execute in a dedicated Web Worker. Stop cancels the active job. Each run
has a 10,000-step budget that includes empty loop iterations, a 100-call recursion limit, and
a total array allocation limit of 100,000 cells. Integer values must fit JavaScript's safe
integer range. Worker jobs also have a 10-second timeout.

The debugger replays immutable snapshots taken before instructions, plus a final snapshot.
It preserves partial output and history on runtime errors. It is a recorded debugger, not a
breakpoint-driven live debugger. History recording has a separate memory budget. When that
budget is exhausted, the UI explains that execution continued without additional snapshots.

The Console's **Project practice files** section lets you create and edit text files. File
contents are saved in the project, included in `.pico` export/import, and returned after runs.
Tests receive independent copies and never modify saved files. Opening FOR WRITE truncates a
file, opening FOR READ starts a new cursor, and reads do not delete file contents. Missing files,
incorrect modes, out-of-bounds indexes, unassigned values, and end-of-file reads produce errors.

```text
DECLARE Line : STRING
OPENFILE "notes.txt" FOR WRITE
WRITEFILE "notes.txt", "Hello Pico"
CLOSEFILE "notes.txt"
OPENFILE "notes.txt" FOR READ
READFILE "notes.txt", Line
OUTPUT Line
CLOSEFILE "notes.txt"
```

The previous implicit-file forms `READFILE Line`, `WRITEFILE expression`, and `CLOSEFILE`
remain supported for the most recently opened file. Routine and nested-block declarations
have local scope. Parameters and locals may shadow globals, and routines update globals when
no local binding shadows them. Functions must return a value on every statically checked path.
`CHAR` accepts single-quoted literals and one-character double-quoted literals. Array bounds
are retained, including zero and negative lower bounds. Comma-separated OUTPUT expressions
are concatenated without adding spaces. Use a literal space when needed.

Flowcharts show REPEAT conditions after their bodies, CASE branches, FOR initialization and
increments, and routine definitions in separate subgraphs. Coverage counts executable AST
instructions rather than block closing markers. Source tabs are independent programs, not
linked modules. The unused experimental BlockMode component is not exposed in the interface.

## Development

```sh
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # vitest: language, runtime, workers, storage and visualization tests
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
| `src/app/components/Panels.tsx`, `src/app/App.tsx` | Tool dock, workspace layout and application shell |
| `src/storage/` | Browser-local projects and settings |
| `src/visual/` | Flowchart generation |
GitHub Actions runs the tests and production build on pushes and pull requests.
