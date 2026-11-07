<div align="center">
  <img src="public/pico-logo.svg" alt="Pico logo" width="76" height="76">

  # Pico.

  **Built by students, for students.**

  Pico is a browser-based learning platform for exploring programming, algorithms, digital logic and computer architecture. No installation or account is required.

  **[Visit Pico](https://picompiler.pages.dev)** · **[Open the browser app](https://picompiler.pages.dev/app)** · **[MCP Docs](https://picompiler.pages.dev/mcp-docs)**
</div>

## Features

- **Pseudocode Compiler** — Write, run and debug Cambridge-style pseudocode with interactive input and syntax assistance.
- **Python Compiler** — Run real Python in your browser, with an editor, console and debugger.
- **Bug Solving** — Find and fix Python bugs with a themed editor, progressive hints and automated tests.
- **Flowchart Builder** — Build and run flowcharts, convert them to pseudocode, and import projects from files or pasted JSON.
- **Logic Sim** — Build and simulate logic circuits, view truth tables, and import circuits from files or pasted JSON.
- **CPU Studio** — Explore the fetch–decode–execute cycle with animated CPU components and registers.

Pico includes customizable themes, guided tutorials and browser-based project saving. 

## Desktop apps

Pico is also available as an **online-only desktop app** for Windows, macOS and Linux.
Desktop packages are built by the [Desktop installers GitHub Actions workflow](https://github.com/mztaq/pico/actions/workflows/desktop.yml).
Website changes are picked up on the next desktop launch/refresh, without reinstalling. New desktop builds target `/app`. Previously released Tauri 2 installers still target `/`; Pico detects their native webview and shows the workspace there, while ordinary browsers see the landing page.

Pico retains **one existing GitHub release**, `desktop-v0.1.0-build.10`. Future desktop builds produce **one installer per OS**: `Pico_x64-setup.exe`, `Pico_universal.dmg` (both Intel and Apple Silicon) and `Pico_amd64.AppImage`. The existing release is upgraded in place during the verified Cloudflare publish workflow. Pico serves installers through Cloudflare Pages, so downloads keep working when the source repository is private. The prior six binaries are backed up before replacement. See [desktop build and update notes](docs/desktop.md).
See [desktop build and update notes](docs/desktop.md) for installer formats and signing limitations.
 
