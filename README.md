<p align="center">
  <img src="public/pico-logo.svg" alt="Pico logo" width="80" height="80">
</p>

<h1 align="center">PICO</h1>

<p align="center">Write, run and inspect Cambridge-style pseudocode in your browser.</p>

<p align="center">
  <a href="https://picompiler.pages.dev">Open Pico</a> · 
  <a href="#getting-started">Getting started</a> ·
  <a href="#language-support">Language support</a> ·
  <a href="#development">Development</a>
</p>

<p align="center">
  <a href="https://github.com/mztaq/pico/actions/workflows/checks.yml">
    <img src="https://github.com/mztaq/pico/actions/workflows/checks.yml/badge.svg?branch=main" alt="Tests and production build">
  </a>
</p>

Pico is a browser-based pseudocode editor and interpreter built for Computer Science learning. It brings source code, interactive input, execution traces and testing into one workspace, with no account or backend required.

Created by **Amar** and **Mustaqim** for students learning to turn algorithms into working programs.

## Getting started

Open [Pico](https://picompiler.pages.dev), enter a program and press **Run** in the top bar.

```text
DECLARE Name : STRING
OUTPUT "Enter your name"
INPUT Name
OUTPUT "Hello ", Name, "!"
```

When execution reaches `INPUT`, type your value in the Console and press Enter. Entering `Ada` produces `Hello Ada!`. Invalid values show a retry prompt without restarting the program.

`INTEGER` accepts whole numbers; `REAL` accepts whole numbers, decimals and scientific notation; `BOOLEAN` accepts `TRUE` or `FALSE`; `CHAR` accepts one character. `STRING` preserves your text, including numeric text and spaces. Numbers must stay within the runtime’s supported finite and safe integer limits.


- Edit the workspace name in the top bar. On smaller screens, open **File** to rename it.
- Use **Debug** to record execution, then step through the results.
- Open **Reference** for keyword explanations and code examples.
- Use **File** to import a project or export a `.pico` copy.
- Open **Help** for the guided tutorial.

## Workspace

| Feature | What it does |
| --- | --- |
| **Editor** | A 16px default font, syntax colouring, declared-name autocomplete, indentation guides, folding, search and keyword documentation. |
| **Console** | Accepts input while the program waits. Keeps output and submitted values in order, with errors and retry prompts. |
| **Debugger** | Replays recorded execution steps with variable values and output. |
| **Test cases** | Runs saved inputs and compares expected output with actual output. |
| **Flowchart** | Shows the paths through the current program. |
| **Projects** | Keeps source tabs, test cases and practice files together. Workspace names are unique, ignoring case and extra spaces. |
| **Quick reference** | Provides selectable examples with syntax colouring, adjustable text size and keyword search. |
| **Appearance** | Offers editor themes, high-contrast palettes, resizable panels and layout settings. Catppuccin Mocha is the first-launch default. |

Projects and settings save in this browser. Export a `.pico` copy to back up your work or move it to another device. Source tabs are separate programs, rather than linked modules.

## Language support

Pico implements a Cambridge-style pseudocode subset:

| Area | Supported constructs |
| --- | --- |
| **Values** | `DECLARE`, `CONSTANT`, `INTEGER`, `REAL`, `STRING`, `CHAR`, `BOOLEAN`. |
| **Input and output** | Typed `INPUT` and comma-separated `OUTPUT` expressions. |
| **Selection** | `IF` / `ELSE` / `ENDIF` and `CASE OF` / `OTHERWISE` / `ENDCASE`. |
| **Iteration** | `FOR` / `TO` / `STEP` / `NEXT`, `WHILE` / `ENDWHILE` and `REPEAT` / `UNTIL`. |
| **Routines** | Procedures, functions, parameters, return values and local scope. |
| **Arrays** | One- and two-dimensional arrays with explicit bounds. |
| **Files** | `OPENFILE`, `READFILE`, `WRITEFILE` and `CLOSEFILE` using project practice files. |
| **Built-ins** | `LENGTH`, `SUBSTRING`, `UCASE`, `LCASE`, `DIV`, `MOD`, `ROUND` and `RANDOM`. |

Variables require declarations. An undeclared `FOR` counter is introduced as an `INTEGER` automatically. The optional **Auto-declare** editor setting inserts inferred declarations for assignments and is enabled by default. Disable it in Settings to practise writing declarations yourself.

`OUTPUT` joins expressions without inserting spaces. Include spaces in string literals where needed.

### Execution model

Source passes through the lexer, parser and semantic checks, then runs in an interpreter inside a Web Worker. **Stop** cancels the active run, including one waiting for input.

The default execution limits are 10,000 steps, 100 nested routine calls and 100,000 allocated array cells. Worker jobs have a 10-second running-time budget. Waiting for input does not use that budget.

Debugging records snapshots for replay. It does not provide live breakpoints. Trace recording has a separate memory budget, and Pico reports when recording is truncated.

Practice files are virtual text files stored with the project. Test cases receive independent copies, so tests do not overwrite saved file contents.

## Development

Use **Node.js 24** and **pnpm 11.25.0**, matching the GitHub Actions configuration.

```sh
git clone https://github.com/mztaq/pico.git
cd pico
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`.

| Command | Purpose |
| --- | --- |
| `pnpm test` | Run the language, runtime, worker, storage and interface tests. |
| `pnpm check` | Check TypeScript types. |
| `pnpm build` | Check types and create the production build in `dist/`. |
| `pnpm preview` | Serve the production build at `http://localhost:3000`. |
| `pnpm update:log -- "IMPROVED UI"` | Append a dated update to `logs.txt` and sync the served copy. |

The application uses **React**, **TypeScript**, **CodeMirror**, **Vite** and **Mermaid**. GitHub Actions runs the tests and production build on pushes and pull requests.

### Local updates and changelog

Updates are stored in the root `logs.txt`, one per line as `[YYYY-MM-DD] : UPDATE TEXT`. Add entries with `pnpm update:log -- "FIXED LOGIN BUG"` (or provide a date with `--date YYYY-MM-DD`). The command appends instead of replacing earlier entries and syncs `public/logs.txt` for static production hosting. The local app checks the file at startup, on tab focus, and every 30 seconds. Each browser stores its last-seen update in local storage; dismissing the toast or opening **Updates** marks the latest entry as seen. No external notification service is used.

### Project structure

| Directory | Responsibility |
| --- | --- |
| [`src/language/`](src/language/) | Lexer, parser, syntax tree, semantic checks and formatting. |
| [`src/runtime/`](src/runtime/) | Interpreter, worker execution, diagnostics and input handling. |
| [`src/app/`](src/app/) | Workspace interface, editor, tool panels, themes and tutorial. |
| [`src/storage/`](src/storage/) | Projects and settings persistence. |
| [`src/visual/`](src/visual/) | Flowchart generation and execution visualisation. |

### Contributing

For bug reports, include the pseudocode, expected result and actual result. For code changes, run `pnpm test` and `pnpm build` before opening a pull request.

## Creators

| Name | Role |
| --- | --- |
| **Amar** | Development |
| **[Mustaqim](https://github.com/mztaq)** | Deployment and releases |
