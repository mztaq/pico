<div align="center">
  <img src="public/pico-logo.svg" alt="Pico logo" width="76" height="76">

  # Pico.

  **Built by students, for students.**

  Pico is a browser-based learning platform for exploring programming, algorithms, digital logic and computer architecture. No installation or account is required.

  **[Visit Pico](https://picompiler.pages.dev)** · **[Open the browser app](https://picompiler.pages.dev/app)**
</div>

## Features

- **Pseudocode Compiler** — Write, run and debug Cambridge-style pseudocode with interactive input and syntax assistance.
- **Python Compiler** — Run real Python in your browser, with an editor, console and debugger.
- **Flowchart Builder** — Create and run flowcharts, then convert them into pseudocode.
- **Logic Sim** — Build digital circuits, simulate gates and inspect truth tables.
- **CPU Studio** — Explore the fetch–decode–execute cycle with animated CPU components and registers.
- **SQL Playground** — Explore sample databases, run IGCSE SQL locally, and solve guided challenges.

Pico includes customizable themes, guided tutorials and browser-based project saving. 

### SQL Playground

Open **SQL Playground** from the app home or the landing page. The sample database has Students, Clubs and Results tables. Click a table or column to inspect its columns, primary and foreign keys, and sample rows without changing your query. Use **Try query** when you want a table or column example in the editor. **Relationships** shows linked records.

Write one statement and press **Run** or **Ctrl+Enter**. The editor highlights SQL, indents lines, completes keywords and schema names, and shows short help when you hover over them. **Examples** supplies starting queries. Errors are marked in the editor, with an optional correction suggestion for common spelling mistakes. **Inspect query** explains the clauses in order and shows SQLite's query plan when available. Results appear in a scrollable table with a short explanation. A valid query with no rows is shown separately from a SQL error. The local SQLite engine supports SELECT, WHERE with AND/OR, ORDER BY, basic JOINs, COUNT, SUM, AVG, MIN, MAX, GROUP BY, INSERT, UPDATE and DELETE. Only SELECT, INSERT, UPDATE and DELETE are accepted in this practice workspace.

Switch to **Challenges** for short goals, stepwise hints and solution explanations. Completion compares query results or database effects, so equivalent SQL can succeed. **Reset data** restores the sample rows after confirmation; your current SQL and challenge progress stay saved. **Options** controls autocomplete, hover help and correction suggestions. The speaker button toggles sound effects. SQL, activity progress and practice data are saved in browser storage. Queries run in browser SQLite WebAssembly and are not submitted to a server.

## Desktop apps

Pico is also available as an **online-only desktop app** for Windows, macOS and Linux.
Desktop packages are built by the [Desktop installers GitHub Actions workflow](https://github.com/mztaq/pico/actions/workflows/desktop.yml).
Website changes are picked up on the next desktop launch/refresh, without reinstalling. New desktop builds target `/app`. Previously released Tauri 2 installers still target `/`; Pico detects their native webview and shows the workspace there, while ordinary browsers see the landing page.

Pico retains **one existing GitHub release**, `desktop-v0.1.0-build.10`. Future desktop builds produce **one installer per OS**: `Pico_x64-setup.exe`, `Pico_universal.dmg` (both Intel and Apple Silicon) and `Pico_amd64.AppImage`. The existing release is upgraded in place during the verified Cloudflare publish workflow. Pico serves installers through Cloudflare Pages, so downloads keep working when the source repository is private. The prior six binaries are backed up before replacement. See [desktop build and update notes](docs/desktop.md).
See [desktop build and update notes](docs/desktop.md) for installer formats and signing limitations.
 
