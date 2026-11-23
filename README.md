<div align="center">
  <img src="public/pico-logo.svg" alt="Pico logo" width="76" height="76">

  # Pico.

  **Built by students, for students.**

  Learn computer science by writing code, building diagrams, testing circuits and exploring how computers work.

  **[Visit Pico](https://picompiler.pages.dev)** · **[Open the app](https://picompiler.pages.dev/app)** · **[Play Blackout Protocol](https://picompiler.pages.dev/app/game/blackout-protocol)** · **[Connect Pico to AI](https://picompiler.pages.dev/mcp-docs)**
</div>

## Why Pico exists

Pico began as a pseudocode editor after we found that the tools we were using lacked features needed for our computer science specification. Instead of working around those limitations, we started building our own.

In October 2026, Pico expanded from one editor to two compilers, then to visual tools for flowcharts, logic and CPU architecture. It has since grown into a browser-based learning platform with seven interactive workspaces, lessons, simulations, games and an MCP connection for AI assistants.

## Explore Pico

| Workspace | What you do |
| --- | --- |
| **[Pseudocode Compiler](https://picompiler.pages.dev/app/pseudocode)** | Write Cambridge-style pseudocode, handle input, find errors and debug execution step by step. |
| **[Python Compiler](https://picompiler.pages.dev/app/python)** | Run real Python through Pyodide in the browser, with an editor, files, console and debugger. |
| **[Flowchart Builder](https://picompiler.pages.dev/app/flowchart)** | Drag and connect blocks, run or debug a flowchart, and convert it into pseudocode. |
| **[Logic Sim](https://picompiler.pages.dev/app/logic)** | Connect logic gates, change inputs, inspect live signals, and generate truth tables. |
| **[CPU Studio](https://picompiler.pages.dev/app/cpu)** | Follow the fetch–decode–execute cycle with animated registers, buses and CPU components. |
| **[Binary Lab](https://picompiler.pages.dev/app/binary)** | Toggle eight bits, compare binary, decimal and hexadecimal, and try shifts, overflow and two's complement. |
| **[Traffic Storm](https://picompiler.pages.dev/app/traffic)** | Change simulated botnet size, proxies and server capacity, then observe traffic, response time and server health. |

Pico also offers:

- **[Learn](https://picompiler.pages.dev/app/learn):** Topic notes, questions, interactive practice and progress stored in your browser.
- **[Blackout Protocol](https://picompiler.pages.dev/app/game/blackout-protocol):** A 3D data-centre game where you play on the attack or defence side of a simulated network incident.
- **Everyday tools:** Guided tutorials, adjustable themes, local project saving, and streamlined right-click actions for different workspaces.

Traffic Storm and Blackout Protocol are educational simulations. Their traffic and attack figures are fictional, not measurements of actual networks.

## Pico in numbers

The following figures come from a **30-day Cloudflare HTTP traffic snapshot included in our project presentation**. They describe that reporting period, not today's live traffic.

| Visits | HTTP requests | Page views | API requests | Data transferred |
| :---: | :---: | :---: | :---: | :---: |
| **1.33k** | **65.49k** | **4.14k** | **4.98k** | **6.47 GB** |

*Visits, requests and page views measure different things. The numbers above should not be interpreted as a count of unique users.*

## Pico meets AI

Pico exposes a remote **Model Context Protocol (MCP)** server. Compatible AI clients, including ChatGPT when remote MCP connections are supported, can call Pico's tools to:

- Run pseudocode and return its output.
- Debug pseudocode and report syntax or execution errors.
- Create, validate and run flowcharts.
- Create and simulate logic circuits.
- Generate truth tables and inspect Pico's supported capabilities.

### Example: Ask ChatGPT to execute code with Pico

> Use Pico MCP to execute this pseudocode and return the output.

\`\`\`text
FOR Index <- 1 TO 5
    OUTPUT Index
NEXT Index
\`\`\`

Expected output:

\`\`\`text
1
2
3
4
5
\`\`\`

### Example: Ask ChatGPT to find the error

> Use Pico MCP to debug this pseudocode and explain what needs fixing.

\`\`\`text
FOR Index <- 1 TO 5
    OUTPUT Index
\`\`\`

Pico reports that the \`NEXT\` statement is missing. The AI assistant can use that result to explain the error and show the corrected loop. Both types of interaction are demonstrated in the project presentation.

**MCP endpoint:** \`https://picompiler.pages.dev/app/mcp\`

Connecting an AI client requires GitHub sign-in and authorization. See the [MCP documentation](https://picompiler.pages.dev/mcp-docs) for connection instructions and available tools.

## Built around student feedback

Pico includes optional analytics and preference controls, so visitors choose whether to allow those cookies. Its bug-reporting form lets users describe a problem and attach screenshots, with reports sent to the team by email.

Teachers have also responded positively to the project. In feedback shared with the team, Computer Science teacher Mr Boyle expressed interest in using Pico during Year 10 and Year 11 lessons.

## Use Pico anywhere

Use Pico directly in your browser without installing software or creating an account for the workspaces. A desktop version is also available for **Windows, macOS and Linux**. It opens the same live platform and requires an internet connection.

**[Open Pico](https://picompiler.pages.dev/app)** · **[Download for desktop](https://picompiler.pages.dev/#downloads)**

---

<div align="center">
  <strong>Pico.</strong><br>
  Built by students, for students.<br>
  Created by Amar Ayache and Muhammad Mustaqim.
</div>
