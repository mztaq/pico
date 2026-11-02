# Pico MCP v1 (private beta)

Pico MCP exposes `https://picompiler.pages.dev/mcp` as a stateless, authenticated MCP Streamable HTTP endpoint. This is a **draft integration**, not a public anonymous API.

## Cloudflare setup

Configure the `PICO_MCP_TOKEN` secret in Cloudflare Pages settings. Generate a random token containing at least 32 characters, and keep it outside the repository. Each client sends `Authorization: Bearer <token>`.

Cloudflare Pages Functions do not expose the Workers Rate Limiting binding directly. Deploy the private companion Worker in `workers/mcp-rate-gate.ts` using `wrangler.mcp-rate-gate.jsonc` and bind it as a **Service** named `PICO_MCP_RATE_GATE` to the Pages project. This Worker uses a 20-requests-per-60-seconds Cloudflare Rate Limiting binding. Deploy it without a public route (`workers_dev: false`), using a namespace ID unique to your account. Configure the Service binding in **Workers & Pages → Pico → Settings → Bindings → Add → Service binding** and redeploy Pages. **The MCP handler refuses all requests when either the secret or service binding is missing.** Cloudflare's rate-limit counters are approximate and location-scoped; this is abuse throttling, not a strict global quota. This first beta uses one shared token and a shared quota, not per-user accounts. Rotate the token if it is disclosed. Do not publish or distribute the shared token.

Server implementation: `functions/mcp.ts`; tool adapter: `src/mcp/tools.ts`.

## Operations

- `initialize`, `ping`, `tools/list`, `tools/call` and `notifications/initialized` over JSON-RPC 2.0
- Nine tools: execute and debug pseudocode; create, compile and execute Pico flowcharts; create and simulate Pico circuits; generate static truth tables; inspect capability references
- Pico's existing interpreter, flowchart compiler and logic engine, including native project formats
- Request size <=32 KiB, pseudocode <=16 KiB, execution <=10,000 steps, debug trace <=120 entries, flowcharts <=100 nodes, circuits <=100 nodes / 200 wires, truth tables <=8 switches
- Stateless: no access to D1, production analytics, private projects, Resend or hosting credentials
- Document generation returns native Pico import file contents and a URL for the matching workspace; users manually save the file and use Pico's Import control. No direct write access to anyone's local projects

## Important limits

The v1 beta does **not** implement cross-origin browser access, OAuth discovery, public per-user authorization, or one-click project import. Generated projects can be opened through Pico's existing file import UI after saving the returned JSON as a file. For ChatGPT or other clients that demand OAuth, implement an OAuth provider with scoped tokens and proper authorization-server metadata before publishing there. Do not represent bearer-token-only beta as automatically ChatGPT compatible.

Shared tokens and location-scoped rate limits reduce misuse but are not a complete public abuse-prevention solution. Benchmark Workers CPU usage and confirm execution exhaustion behavior before any public rollout. Keep the endpoint disabled by omitting the secret and rate-limit binding until ready for controlled testing.

## Development

Run `pnpm test` and `pnpm build`; confirm request authentication, rate limits, malformed JSON, oversized input and code timeouts. Test all tools against an MCP client and evaluate off-host behavior before merging. No D1 migrations or email/API changes are required.
