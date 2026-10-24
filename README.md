<p align="center">
  <img src="public/pico-logo.svg" alt="Pico logo" width="80" height="80">
</p>

<h1 align="center">Pico.</h1>

<p align="center">Write code, build flowcharts and simulate logic circuits in your browser.</p>

<p align="center">
  <a href="https://picompiler.pages.dev">Open Pico</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#language-support">Language support</a> ·
  <a href="#development">Development</a>
</p>

Pico is a browser-based Computer Science learning tool with five workspaces: Pseudocode Compiler, Python Compiler, Flowchart Builder, Logic Sim and CPU Studio. Themes are shared across workspaces. Projects are stored in your browser. No account is required.

## Install, offline use and privacy

Pico works as a website without an account. Supported browsers can also install it as an app using the **Install** action in the browser menu. The service worker caches the homepage and previously visited static workspace bundles, but full offline execution is **not guaranteed**: Python's large runtime and Pico's optional APIs require network access. A simple offline page appears for uncached navigation.

Projects and editor files remain in your browser. Optional analytics and preferences only operate with consent. Export projects regularly to keep backups; browser storage can be cleared.

## Project resources

- [Contributing](CONTRIBUTING.md)
- [Security reporting](SECURITY.md)
- [Production readiness checklist](docs/production-readiness.md)

**Licensing:** No project license is declared in this repository. Do not assume that the absence of a license gives permission to redistribute or modify the source; the maintainers should choose and add an explicit license before soliciting outside contributions.

## Getting started

Open [Pico](https://picompiler.pages.dev) and choose **Pseudocode Compiler**, **Python Compiler**, **Flowchart Builder**, or **Logic Sim**. In either compiler, enter a program and press **Run** in the top bar. Use the compiler switch to change languages or the back button to return home.

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
- Open **Help** for the guided tutorial. Some familiar faces from the Computer Science department receive a hidden greeting when their names are entered.

## Workspace

| Feature | What it does |
| --- | --- |
| **Editor** | A 19px default font, syntax colouring, declared-name autocomplete, indentation guides, folding, search and keyword documentation. |
| **Console** | Accepts input while the program waits. Keeps output and submitted values in order, with fatal errors shown in red. |
| **Debugger** | Replays recorded execution steps with variable values and output. |
| **Flowchart Builder** | Drag editable blocks onto a canvas, connect branches and loops, run with typed console input, and convert to pseudocode. |
| **Logic Sim** | Draw schematic logic circuits, connect terminals, simulate signals, and inspect truth tables and Boolean expressions. |
| **CPU Studio** | Assemble tiny instruction programs and step through fetch–decode–execute with live registers, buses, RAM and ALU animations. |
| **Projects** | Keeps source tabs and practice files together in horizontal workspace tabs. Workspace names are unique, ignoring case and extra spaces. |
| **Quick reference** | Provides selectable examples with syntax colouring, adjustable text size and keyword search. |
| **Appearance** | Offers editor themes, high-contrast palettes, resizable panels and layout settings. Catppuccin Mocha is the first-launch default. |

Projects and settings save in this browser. Export `.pico` projects, `.picochart` flowcharts and `.logic.json` circuits to keep copies. When a workspace has changed since opening or exporting, the browser may display its native leave-site confirmation when you close or refresh the tab. Pseudocode and Python projects use separate storage. Python `.py` tabs also work as importable modules; pseudocode tabs run independently.

## Flowchart Builder

Choose **Flowchart Builder** on the home screen. New workspaces contain only their name and an empty black canvas. The centred prompt disappears when you add a block. There are no preset charts or example menus.

First-time users complete a required, highlighted walkthrough. They build their own temporary chart by adding Start, Output, and End, editing an expression, dragging connections, running the chart, and converting it to pseudocode. Next unlocks after each exercise. There is no Skip or Escape dismissal. Completion saves in this browser, Help replays the walkthrough, and saved charts stay untouched.

Drag a block from the palette or click to add it. Select a block to edit its expression and input type. Drag an outgoing port onto a destination block and release. A live line follows your pointer and the destination highlights. Dropping on empty space cancels the attempt, and Escape cancels a line drag. Keyboard users also have port selection and destination selectors. Decisions have separate Yes and No ports. Connect a branch back to an earlier step to make a loop.

**Run** uses the existing pseudocode engine with interactive console input. Invalid input ends execution. Syntax, connection, and runtime errors highlight the affected block in red. **Stop** ends the worker, including infinite loops. **Debug** records variables and highlights each block as you step through the trace. Blocks use the same syntax tokenizer and theme colours as the editors.

**Convert to pseudocode** provides highlighted code with Copy, Download `.pico`, and **Open in Pseudocode Compiler** actions. Opening code creates a new compiler workspace. Standard selections and pre-test loops convert to `IF` and `WHILE`. More complex graphs use a control variable with `WHILE` and `CASE` to preserve their connections. Typed Input blocks declare scalar variables. Assignment types are inferred. The palette has no Variable declaration block. Existing imported declaration blocks remain readable for compatibility.

Workspaces save separately from compiler projects. Export/Import `.picochart` backs up an editable chart or moves it between devices. The canvas supports zoom, panning, keyboard movement, undo/redo, and a resizable console. Limits are 250 blocks per chart and 50 workspaces per browser.

## Logic Sim

Open **Logic Sim** from the home screen. It begins with an empty canvas and offers a skippable seven-step walkthrough on the first visit. Use **Help** to replay the tutorial.

- Select a gate, switch, clock or indicator from the component palette and click to place it, or drag it onto the canvas.
- Connect circuits by dragging an output terminal onto an input terminal. Move, rotate, box-select, delete, duplicate, copy or paste components. Zoom and pan around the canvas.
- Available parts include NOT, AND, NAND, OR, NOR, XOR and XNOR gates, buffers, input switches, constant sources, bulbs, a four-bit hex display, clocks, and SR, D, JK and T flip-flops.
- **Run**, **Pause**, **Step** and **Reset** control the simulation. Logic signals include 0, 1, unknown (X) and high impedance (Z). Floating inputs and conflicting connections are indicated.
- **Truth table** generates a table for combinational circuits containing up to eight toggle switches. Export as CSV.
- **Boolean Expression** reads connected combinational gates and shows Boolean word notation, algebraic symbols and programming notation. It also generates supported sum-of-products and product-of-sums forms for up to six inputs. It does not enumerate every possible equivalent expression.
- **Import** and **Export** use editable `.logic.json` files. Circuit data autosaves in the browser, but browser storage is not a permanent backup.
- Themes, including Dracula, follow the same preference as the other three workspaces.

Logic Sim is an educational digital model, not an analogue electrical simulator. It does not model real voltage, propagation delay or electrical power. It does not support reusable custom subcircuits yet.

## CPU Studio

CPU Studio follows Cambridge IGCSE Computer Science (0478/0984) section 3.1. It provides **Normal** and **Advanced** modes. Normal covers the complete fetch–decode–execute cycle. Advanced adds the decode unit, illustration-only Clock, Status Register and Interrupt Register, instruction decoding details and a step-by-step interrupt demonstration. These additional registers are marked as extended model components **(out of specification)**.

- The CPU diagram is based on the course architecture: PC, MAR, MDR, CIR, accumulator, ALU, control unit, CPU cache and RAM, with address, data and control buses. The links between components are drawn as smooth curves for readability, not electrical circuit schematics.
- Press **Step** to advance one micro-operation and **Back** to reverse it, or **Run** to replay the fixed CPU program continuously until paused, with no automatic stop at HLT. The explanation updates after each operation. **Pause** and **Reset** control playback. Manual Step still halts at HLT.
- RAM on the right displays the addresses and binary data while relevant boxes and bus routes highlight.
- A slider marked 0.5–9.2 GHz adjusts illustrative animation pacing, **not actual CPU speed**. Higher settings visibly accelerate Run.
- **Advanced** permits a triggered interrupt: the current instruction completes, state is saved, an interrupt-service routine is illustrated, and execution resumes. The exact simplified handler implementation is **(out of specification)**.
- Hover RAM binary addresses and cells for their meanings. Instruction words use an invented eight-bit teaching representation **(out of specification)**, not real machine-code instructions.
- The first visit opens a skippable 10-stage spotlight tutorial; use **Tutorial** to view it again.
- Uses the current shared Pico theme and automatically applies theme changes from other workspaces.

The home screen arranges every card as title, description, then an unfaded code or diagram preview, with larger text. The CPU diagram carries the playful title **Central Processing BRAINROT / Unit**; the correct term for exams is **Central Processing Unit (CPU)**. The simulation uses a fixed teaching program internally. No assembly editor, code examples menu, file import/export or unrelated ISA extensions are presented. The machine model is simplified for teaching and is not a hardware-accurate timing simulation.

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

Variables require declarations. An undeclared `FOR` counter is introduced as an `INTEGER` automatically. The optional **Auto-declare** editor setting infers `INTEGER`, `REAL`, `CHAR`, `STRING` and `BOOLEAN` from assignments and unambiguous usage, and is enabled by default. It updates declarations it generated while preserving manual declarations. Ambiguous inputs and arrays with unknown bounds still need explicit declarations. See [Auto-declare type inference](docs/auto-declare.md) for examples and limitations. Disable it in Settings to practise writing declarations yourself.

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
- Use `.py` source tabs as modules, and project practice files with `open()`. Completed runs reuse the loaded interpreter with a fresh program namespace and reset project files. Python restores standard-module attributes, builtins, environment variables and arguments between runs. Stop terminates the worker, so the next run starts a new interpreter.
- **File** imports `.py` source or Python `.pico` projects and exports the active `.py` file or the complete `.pico` project.

Python begins loading when you enter its workspace. The build copies the pinned runtime from the npm package to `/python-runtime/314.0.7/` and serves it from Pico’s own host. Versioned assets have immutable cache headers. Its first load needs an internet connection, while completed runs reuse the initialized worker. Python standard-library code is supported; package installation and desktop features such as native windows and subprocesses are outside this interface.

Console input uses `SharedArrayBuffer`. Hosting must serve these headers, supplied by `public/_headers` for Cloudflare Pages and by the Vite development/preview servers:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Use HTTPS in production or `localhost` during development. Other hosting providers must configure the same headers. Runtime code and standard-library assets load from the same origin. Vite serves these assets directly from the installed package during development and copies them into `dist/` during the production build.

## Development

Use **Node.js 24** and **pnpm 11.25.0**, matching the GitHub Actions configuration.

```sh
git clone <repository-url>
cd pico
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`.

| Command | Purpose |
| --- | --- |
| `pnpm test` | Run language, runtime, storage and interface tests, including real CPython and worker tests. |
| `node scripts/benchmark-python.mjs` | Measure cold/warm Python execution and console batching using local WebAssembly. Network and browser rendering are excluded. |
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
| [`src/flowchart/`](src/flowchart/) | Flowchart editing, execution and conversion. |
| [`src/logic/`](src/logic/) | Circuit symbols, editor, four-state simulation, expressions and tests. |
| [`src/visual/`](src/visual/) | Flowchart generation and execution visualisation. |

### Contributing

For bug reports, include the language, source code, input values, expected result and actual result. For code changes, run `pnpm test` and `pnpm build` before opening a pull request.
