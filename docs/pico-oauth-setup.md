# Pico MCP OAuth setup (public GitHub sign-in)

This is an independent Worker. It does **not** change Pico's normal website, D1 database, emails or existing MCP bearer-token authentication.

## Setup (free-tier)

1. In Cloudflare, create a separate Workers KV namespace `pico-oauth-kv`. Record its namespace ID. KV has a free usage tier; review quota limits.
2. In GitHub Developer Settings, create an **OAuth App** (not a GitHub App). Set Homepage URL to the OAuth Worker's hostname. Set Authorization callback URL to `https://YOUR-OAUTH-WORKER.workers.dev/callback`. Keep its client secret private.
3. In `oauth/wrangler.jsonc`, replace the hostname and KV namespace ID. The `AUTH_ISSUER` must exactly match the deployed OAuth Worker URL. The resource must remain `https://picompiler.pages.dev/app/mcp`.
4. Run `cd oauth && npm install && npx wrangler secret put GITHUB_CLIENT_ID && npx wrangler secret put GITHUB_CLIENT_SECRET`. `GITHUB_ALLOWED_ID` is only required in private mode, where it must be a **numeric GitHub account ID**, not a username. Never place secrets in git, screenshots, chat or frontend code.
5. `GITHUB_ACCESS_MODE` in `oauth/wrangler.jsonc` is set to `public` for this launch. Deploy the Worker with `npm run deploy`. Confirm `/.well-known/oauth-authorization-server` loads. With public mode, any authenticated GitHub account may approve access. Remove or change this variable to `private` to restore the numeric-ID restriction.
6. Add a service binding called `PICO_OAUTH` referencing the **pico-oauth** Worker on the **Preview** deployment first, plus environment variable `PICO_OAUTH_ISSUER` equal to the OAuth Worker URL. Retain `PICO_MCP_TOKEN` and `PICO_MCP_RATE_GATE`.
7. Only after Preview tests, add the same OAuth binding and issuer variable in Production and redeploy.

OAuth metadata is published at `/.well-known/oauth-protected-resource/app/mcp`. New clients request the `mcp:run` scope. The existing bearer token remains available for your private CLI while OAuth is in beta.

## Security constraints

OAuth tokens are resource-bound to the main MCP URL, checked over a private Service Binding, and independently throttled through Pico's existing rate gate. Missing OAuth Worker configuration fails closed for OAuth tokens. Do not enable an anonymous bypass. Never store GitHub upstream access tokens in MCP token props or response payloads.

OAuth compatibility does **not** guarantee your ChatGPT plan includes custom MCP connections. Test with a client that supports OAuth authorization-code flow + PKCE.

Before opening public access, test a second GitHub account, verify that unauthenticated requests still fail, and monitor rate limiting. Public access means all GitHub accounts, not anonymous access. Existing OAuth users remain scoped to Pico MCP tools only.

## End-to-end token lifecycle smoke test (preview)

After deploying the OAuth Worker and enabling the Preview Pages service binding, run from the repository root:

```bash
node oauth/scripts/test-token-lifecycle.mjs
```

The test creates a fresh dynamically registered OAuth client with a loopback callback. On Windows it prints an authorization URL for you to open. Sign in with your permitted GitHub account and approve. No GitHub secrets or existing OAuth tokens are required. Tokens and codes are never printed.

It checks discovery, PKCE code issuance, MCP access, refresh-token rotation, access using the refreshed token, revocation, and rejected attempts to reuse revoked credentials. This affects the new test grant only, not your existing Inspector client.

Real-time expiry is optional, because the default access token lasts around one hour:

```bash
PICO_TEST_WAIT_FOR_EXPIRY=1 node oauth/scripts/test-token-lifecycle.mjs
```

On Windows PowerShell set `$env:PICO_TEST_WAIT_FOR_EXPIRY='1'` before invoking `node`. It waits for `expires_in` plus five seconds. This slow expiry check is not part of CI.

The test is browser-assisted and cannot run unattended in CI. The OAuth workflow syntax-checks the script. Check its results before merging. If HTTP 429 occurs during testing, let the shared rate-limit window reset and retry.

## Public access release

Public access is an explicit deploy-time opt-in: `GITHUB_ACCESS_MODE=public`. The GitHub OAuth app client ID and secret are still required, but the private `GITHUB_ALLOWED_ID` secret is ignored in public mode and may be retained for rollback. Never disable the MCP bearer-token check, service binding, authorization consent, or rate gate. Existing D1, emails, and project storage are not exposed by the OAuth code.

Changing GitHub authorization permissions does **not** publish the ChatGPT plugin to a shared directory. Other users need to add Pico's MCP endpoint in an MCP-compatible client, and account capabilities vary. Public usage consumes Cloudflare Worker, KV, and rate-limit quotas; monitor Cloudflare usage and abuse before promoting broadly.
