# Pico MCP OAuth setup (private GitHub-only beta)

This is an independent Worker. It does **not** change Pico's normal website, D1 database, emails or existing MCP bearer-token authentication.

## Setup (free-tier)

1. In Cloudflare, create a separate Workers KV namespace `pico-oauth-kv`. Record its namespace ID. KV has a free usage tier; review quota limits.
2. In GitHub Developer Settings, create an **OAuth App** (not a GitHub App). Set Homepage URL to the OAuth Worker's hostname. Set Authorization callback URL to `https://YOUR-OAUTH-WORKER.workers.dev/callback`. Keep its client secret private.
3. In `oauth/wrangler.jsonc`, replace the hostname and KV namespace ID. The `AUTH_ISSUER` must exactly match the deployed OAuth Worker URL. The resource must remain `https://picompiler.pages.dev/app/mcp`.
4. Run `cd oauth && npm install && npx wrangler secret put GITHUB_CLIENT_ID && npx wrangler secret put GITHUB_CLIENT_SECRET && npx wrangler secret put GITHUB_ALLOWED_ID`. `GITHUB_ALLOWED_ID` is the **numeric GitHub account ID**, not username. No secrets belong in git, screenshots, chat or frontend code.
5. Deploy the Worker with `npm run deploy`. Confirm `/.well-known/oauth-authorization-server` loads. GitHub login is restricted to the configured numeric ID.
6. Add a service binding called `PICO_OAUTH` referencing the **pico-oauth** Worker on the **Preview** deployment first, plus environment variable `PICO_OAUTH_ISSUER` equal to the OAuth Worker URL. Retain `PICO_MCP_TOKEN` and `PICO_MCP_RATE_GATE`.
7. Only after Preview tests, add the same OAuth binding and issuer variable in Production and redeploy.

OAuth metadata is published at `/.well-known/oauth-protected-resource/app/mcp`. New clients request the `mcp:run` scope. The existing bearer token remains available for your private CLI while OAuth is in beta.

## Security constraints

OAuth tokens are resource-bound to the main MCP URL, checked over a private Service Binding, and independently throttled through Pico's existing rate gate. Missing OAuth Worker configuration fails closed for OAuth tokens. Do not enable an anonymous bypass. Never store GitHub upstream access tokens in MCP token props or response payloads.

OAuth compatibility does **not** guarantee your ChatGPT plan includes custom MCP connections. Test with a client that supports OAuth authorization-code flow + PKCE.

Do not merge this draft until the full OAuth login, consent, token refresh, revocation, wrong-GitHub-user, bad-resource and rate-limit tests are done.
