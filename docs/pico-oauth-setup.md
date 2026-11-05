# Pico MCP OAuth setup (public GitHub sign-in)

This is an independent Worker. It does **not** change Pico's normal website, D1 database, emails or existing MCP bearer-token authentication.

## Setup (free-tier)

1. In Cloudflare, create a separate Workers KV namespace `pico-oauth-kv`. Record its namespace ID. KV has a free usage tier; review quota limits.
2. In GitHub Developer Settings, create an **OAuth App** (not a GitHub App). Set Homepage URL to the OAuth Worker's hostname. Set Authorization callback URL to `https://YOUR-OAUTH-WORKER.workers.dev/callback`. Keep its client secret private.
3. In `oauth/wrangler.jsonc`, replace the hostname and KV namespace ID. The `AUTH_ISSUER` must exactly match the deployed OAuth Worker URL. The resource must remain `https://picompiler.pages.dev/app/mcp`.
4. Run `cd oauth && npm install && npx wrangler secret put GITHUB_CLIENT_ID && npx wrangler secret put GITHUB_CLIENT_SECRET`. `GITHUB_ALLOWED_ID` is only required in private mode, where it must be a **numeric GitHub account ID**, not a username. Never place secrets in git, screenshots, chat or frontend code.
5. `GITHUB_ACCESS_MODE` in `oauth/wrangler.jsonc` is set to `public` for this launch. Deploy the Worker with `npm run deploy`. Confirm `/.well-known/oauth-authorization-server` loads. With public mode, any authenticated GitHub account may approve access. Remove or change this variable to `private` to restore the numeric-ID restriction.
6. Add a service binding called `PICO_OAUTH` referencing the **pico-oauth** Worker on the **Preview** deployment first, plus environment variable `PICO_OAUTH_ISSUER` equal to the OAuth Worker URL. Retain `PICO_MCP_RATE_GATE`. The legacy `PICO_MCP_TOKEN` is ignored by default unless `PICO_MCP_LEGACY_AUTH=enabled` is explicitly set as a temporary rollback.
7. Only after Preview tests, add the same OAuth binding and issuer variable in Production and redeploy.

OAuth metadata is published at `/.well-known/oauth-protected-resource/app/mcp`. New clients request the `mcp:run` scope. The original shared bearer token is disabled by default. Existing CLI users must switch to OAuth or receive an explicitly controlled temporary rollback.

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

Public access is an explicit deploy-time opt-in: `GITHUB_ACCESS_MODE=public`. The GitHub OAuth app client ID and secret are still required, but the private `GITHUB_ALLOWED_ID` secret is ignored in public mode and may be retained for rollback. Never disable the OAuth bearer-token validation, service binding, authorization consent, or rate gate. Existing D1, emails, and project storage are not exposed by the OAuth code.

Changing GitHub authorization permissions does **not** publish the ChatGPT plugin to a shared directory. Other users need to add Pico's MCP endpoint in an MCP-compatible client, and account capabilities vary. Public usage consumes Cloudflare Worker, KV, and rate-limit quotas; monitor Cloudflare usage and abuse before promoting broadly.

## OAuth-only migration and secret retirement

Pico's Pages MCP handler now accepts the legacy shared secret **only** when the Pages text variable `PICO_MCP_LEGACY_AUTH` equals `enabled`. With that variable absent (the secure default), `PICO_MCP_TOKEN` has no authentication effect. Do not enable this rollback mode for public clients.

1. Confirm ChatGPT or another OAuth client authenticates and calls `pico_capabilities` against Preview first.
2. Deploy this PR to Pages with `PICO_OAUTH`, `PICO_OAUTH_ISSUER` and `PICO_MCP_RATE_GATE` intact. Do not configure `PICO_MCP_LEGACY_AUTH`.
3. Verify valid OAuth calls work and that the *old* `PICO_MCP_TOKEN` gets HTTP 401 in both Preview and Production. **Never paste the token into a chat, screenshot, issue, or log.**
4. Only after verification, remove the obsolete `PICO_MCP_TOKEN` secret from Cloudflare Pages Production and Preview. If a local CLI depends on it, migrate that CLI to OAuth first.
5. Keep `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `OAUTH_KV`, `PICO_OAUTH`, `PICO_OAUTH_ISSUER`, `PICO_MCP_RATE_GATE`, and unrelated site/email/database keys. They are independent.

Temporary rollback: for a preexisting trusted CLI only, set the Pages text variable `PICO_MCP_LEGACY_AUTH=enabled` **and** retain a strong `PICO_MCP_TOKEN`, redeploy, then remove the variable after migration. This allows any holder of that shared secret to skip GitHub OAuth and is not appropriate for public release.

## Security checks

Run from the repository root with Node.js 24 or later:

```bash
node oauth/scripts/test-token-lifecycle.mjs
```

The browser-assisted test checks a newly registered client with PKCE, rejected redirect replacement, rejected missing PKCE, invalid callback state, explicit unverified-app labeling for potentially impersonating DCR clients, authorization-code reuse, refresh, revocation and scoped MCP access. A malicious redirect must fail **before** consent. The test uses the preview resource by default, so configure `PICO_TEST_RESOURCE` to the production URL for a separate production test.

The negative altered-redirect token request uses an already-redeemed code, so it confirms a failed request but **does not independently prove** token-endpoint redirect binding. To prove that invariant, a second fresh authorization code and an altered redirect must be tested before its first redemption. Do not describe that condition as verified until it has been run.

Client names from Dynamic Client Registration are self-asserted. Pico labels those clients as unverified and no longer fetches their remote logo URLs. HTTPS client metadata identities may load remote raster logos only from their metadata host or a narrow first-party CDN exception for ChatGPT. The Worker uses Cloudflare's `global_fetch_strictly_public` flag and additional URL restrictions. These mitigations reduce SSRF exposure but do not replace a full penetration test. Never equate the presence of a logo with verified identity.

Review authorization/refresh behavior, token expiry, and rate-limit quotas before a large public launch.
