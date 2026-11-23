<div align="center">
  <img src="public/pico-logo.svg" alt="Pico logo" width="76" height="76">

  # Pico.

  **Built by students, for students.**

  An interactive platform for learning programming, algorithms, computer systems and digital logic.

  **[Website](https://picompiler.pages.dev)** · **[Open Pico](https://picompiler.pages.dev/app)** · **[Desktop downloads](https://picompiler.pages.dev/#downloads)** · **[MCP Docs](https://picompiler.pages.dev/mcp-docs)**
</div>

## Workspaces

- **[Pseudocode Compiler](https://picompiler.pages.dev/app/pseudocode)** — Write, execute and debug Cambridge-style pseudocode with interactive input and editor assistance.
- **[Python Compiler](https://picompiler.pages.dev/app/python)** — Run Python in your browser with a console, files and debugging tools.
- **[Flowchart Builder](https://picompiler.pages.dev/app/flowchart)** — Draw, connect, run and debug flowcharts, then convert them to pseudocode. Import projects from files or JSON.
- **[Logic Sim](https://picompiler.pages.dev/app/logic)** — Build and simulate logic circuits, inspect signals and generate truth tables. Import circuits from files or JSON.
- **[CPU Studio](https://picompiler.pages.dev/app/cpu)** — Step through the fetch–decode–execute cycle and explore registers, buses and other CPU components.
- **[Binary Lab](https://picompiler.pages.dev/app/binary)** — Explore 8-bit values, binary and hexadecimal, shifts, overflow and two's complement.
- **[Traffic Storm](https://picompiler.pages.dev/app/traffic)** — Explore a visual, fictional network-traffic simulation with botnets, proxies, servers and overload behaviour.

## Learn and play

- **[Learn](https://picompiler.pages.dev/app/learn)** — Study computer science topics with notes, interactive questions and locally saved progress.
- **[Games](https://picompiler.pages.dev/app/games)** — Play [Blackout Protocol](https://picompiler.pages.dev/app/game/blackout-protocol), a 3D data-centre game with attack and defence modes.

Pico also includes guided tutorials, customizable themes, local project saving and workspace-specific right-click menus. The browser workspaces do not require an account.

## Pico MCP

Pico offers a remote [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for compatible AI clients. Its tools run and debug pseudocode, create and execute flowcharts, work with logic circuits and generate truth tables.

**Endpoint:** `https://picompiler.pages.dev/app/mcp`

Connection uses GitHub sign-in and authorization. See the [MCP setup guide](https://picompiler.pages.dev/mcp-docs) for supported tools and instructions.

## Desktop

Pico is available for **Windows, macOS and Linux** from the [downloads section](https://picompiler.pages.dev/#downloads). The desktop app displays the live Pico website and requires an internet connection. Website updates appear on the next launch or refresh without reinstalling the app.

See [desktop installation and update details](docs/desktop.md).

## Development

Pico is built with **React, TypeScript and Vite**, with **CodeMirror** for editing, **Pyodide** for Python execution and **Three.js** for 3D content. The web app is deployed on **Cloudflare Pages**.

Install Node.js and pnpm, then run:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

To check changes:

```bash
pnpm test
pnpm build
```

The app runs locally at `http://localhost:3000` by default. See [desktop build details](docs/desktop.md) for native app requirements.
