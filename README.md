<p align="center">
  <img src="public/pico-logo.svg" alt="Pico logo" width="80" height="80">
</p>

<h1 align="center">PICO</h1>

<p align="center">Write, run and debug pseudocode and Python in your browser.</p>

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

Pico is a browser-based pseudocode and Python editor built for Computer Science learning. Both compilers share themes, interactive console input, source tabs and recorded debugger steps. No account or backend is required.

Created by **Amar** and **Mustaqim** for students learning to turn algorithms into working programs.

## Getting started

Open [Pico](https://picompiler.pages.dev), choose **Pseudocode Compiler** or **Python Compiler**, enter a program and press **Run** in the top bar. Use the compiler switch to change languages or the back button to return home.

```text
DECLARE Name : STRING
OUTPUT "Enter your name"
INPUT Name
OUTPUT "Hello ", Name, "!"
```

When execution reaches `INPUT`, type your value in the Console and press Enter. Entering `Ada` produces `Hello Ada!`. Invalid typed values terminate the run and appear as a red **Error**, with a source line.

`INTEGER` accepts whole numbers; pseudocode `REAL` input requires digits on both sides of a decimal point, such as `5.0` or `-0.25`. Entering `5` for a `REAL` ends the run with an error; `BOOLEAN` accepts `TRUE` or `FALSE`; `CHAR` accepts one character. `STRING` preserves your text, including numeric text and spaces. Numbers must stay within the runtime’s supported finite and safe integer limits.


- Edit the workspace name in the top bar. On smaller screens, open **File** to rename it.
- Use **Debug** to record execution, then step through the results.
- Open **Reference** for keyword explanations and code examples.
- Use **File** to import a project or export a `.pico` copy.
- Open **Help** for the guided tutorial.

## Workspace

| Feature | What it does |
| --- | --- |
| **Editor** | A 19px default font, syntax colouring, declared-name autocomplete, indentation guides, folding, search and keyword documentation. |
| **Console** | Accepts input while the program waits. Keeps output and submitted values in order, with fatal errors shown in red. |
| **Debugger** | Replays recorded execution steps with variable values and output. |
| **Flowchart** | Shows the paths through pseudocode programs. |
| **Projects** | Keeps source tabs and practice files together in horizontal workspace tabs. Workspace names are unique, ignoring case and extra spaces. |
| **Quick reference** | Provides selectable examples with syntax colouring, adjustable text size and keyword search. |
| **Appearance** | Offers editor themes, high-contrast palettes, resizable panels and layout settings. Catppuccin Mocha is the first-launch default. |

Projects and settings save in this browser. Export a `.pico` copy to back up your work or move it to another device. Pseudocode and Python projects use separate storage. Python `.py` tabs also work as importable modules; pseudocode tabs run independently.

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

Interactive runs have no automatic step or time limit. A `WHILE TRUE` loop runs until **Stop** terminates its worker. Pseudocode retains safety limits of 100 nested routine calls and 100,000 allocated array cells. Output keeps the most recent 2,000 lines and limits each line to 8,192 characters to protect the interface during long runs.

Debugging records snapshots for replay. It does not provide live breakpoints. Trace recording has a separate memory budget, and Pico reports when recording is truncated.

Practice files are virtual text files stored with the project. Each run starts with a copy and saves its resulting text files after completion. They do not grant access to files on your computer.

## Python

```python
name = input("Enter your name: ")
print(f"Hello {name}!")
```

Python runs as real CPython in a dedicated Web Worker through [Pyodide](https://pyodide.org/en/stable/). This release pins Pyodide **314.0.7**, which supplies **Python 3.14.2**. The top bar displays `sys.version` from the running interpreter. This is the newest stable Pyodide distribution verified for this change, rather than the newest Python.org patch release.

- `input()` waits for a value in the Console. It returns a string.
- `int(input())` and `float(input())` use Python's own conversion rules. For example, Python accepts `float("5")`, while pseudocode REAL input requires `5.0`.
- Unhandled exceptions terminate execution, preserve earlier output, and display a red **Error** with a traceback. Programs that catch their own exceptions continue according to their code.
- **Debug** records Python line events, including function locals, for step-by-step replay. Trace recording stops at its memory budget while execution continues. This is recorded debugging, without live breakpoints.
- Use `.py` source tabs as modules, and project practice files with `open()`. Each run uses a fresh interpreter and virtual filesystem.
- **File** imports `.py` source or Python `.pico` projects and exports the active `.py` file or the complete `.pico` project.

The runtime downloads from jsDelivr when Python starts, so its first run needs an internet connection. Python standard-library code is supported; package installation and desktop features such as native windows and subprocesses are outside this interface.

Console input uses `SharedArrayBuffer`. Hosting must serve these headers, supplied by `public/_headers` for Cloudflare Pages and by the Vite development/preview servers:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Use HTTPS in production or `localhost` during development. Other hosting providers must configure the same headers. Runtime code and standard-library assets load using CORS from the pinned CDN URL.

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
| `pnpm test` | Run language, runtime, storage and interface tests, including real CPython and worker tests. |
| `pnpm check` | Check TypeScript types. |
| `pnpm build` | Check types and create the production build in `dist/`. |
| `pnpm preview` | Serve the production build at `http://localhost:3000`. |
| `pnpm update:log -- "IMPROVED UI"` | Append a dated update to `logs.txt` and sync the served copy. |

The application uses **React**, **TypeScript**, **CodeMirror**, **Vite**, **Pyodide** and **Mermaid**. GitHub Actions runs the tests and production build on pushes and pull requests.

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

For bug reports, include the language, source code, input values, expected result and actual result. For code changes, run `pnpm test` and `pnpm build` before opening a pull request.

## Creators

| Name | Role |
| --- | --- |
| **Amar** | Development |
| **[Mustaqim](https://github.com/mztaq)** | Deployment and releases |
