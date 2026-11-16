# Pico Status Admin: GitHub OAuth, private 404 admin page

## What users see

- Public status page: `https://status.picompiler.pages.dev/`, available to everyone.
- Admin page: `https://status.picompiler.pages.dev/admin/`.
  Without an authorized session, it responds with an actual **HTTP 404**.
- Private sign-in entry: `https://status.picompiler.pages.dev/admin/auth/start`.
  A team member signs in with their **own** GitHub account once.
- Once signed in, returning to `/admin/` opens the editor directly for
  up to **14 days**. Sign-out immediately revokes that browser session.
- Any GitHub user whose **numeric account ID** is not allowlisted receives 404,
  including after successful GitHub authentication.

GitHub OAuth is free. No Cloudflare Zero Trust, payment card, shared
password, invitation tokens, email verification, or third-party auth vendor.

This protects the status **admin** only, not the public status page or the
public incident history. Grant admin rights only to team members authorized
to publish incident updates. Having access to the GitHub repository does not
automatically grant admin rights.

## 1. Register a GitHub OAuth App

Open https://github.com/settings/developers → **OAuth Apps** →
**New OAuth App**, under a GitHub account you control.

| Setting | Value |
| --- | --- |
| Application name | Pico Status Admin |
| Homepage URL | `https://status.picompiler.pages.dev/` |
| Authorization callback URL | `https://status.picompiler.pages.dev/admin/auth/callback` |

Keep the device flow disabled. Do not enable callback wildcard matching.
After saving, copy your **Client ID** and generate a **Client Secret**.

The app uses the authorization-code flow with **PKCE S256** and a signed,
10-minute state cookie. It requests **no repository or user-data scopes**:
the server only needs GitHub's basic numeric user ID from `/user`.
It does not save the GitHub access token or send it to the browser.

## 2. Get approved team members' GitHub IDs

Visit `https://api.github.com/users/USERNAME`, replacing USERNAME with
each person's GitHub username. Copy the JSON `id` number.

Add only the **numeric ID**, not the username/email. Numeric IDs do not
change when a person renames their GitHub account.

Example (placeholder IDs, not real team accounts):

`123456,789012`

## 3. Configure the existing Cloudflare Pages Preview

Cloudflare → Workers & Pages → **picompiler** → Settings →
**Variables and Secrets** → **Preview**.

Add four variables:

| Name | Value |
| --- | --- |
| `GITHUB_OAUTH_CLIENT_ID` | The OAuth App Client ID |
| `GITHUB_OAUTH_CLIENT_SECRET` | The OAuth App Client Secret |
| `STATUS_ADMIN_GITHUB_IDS` | Comma-separated approved numeric IDs |
| `STATUS_ADMIN_SESSION_SECRET` | A new, high-entropy random string of at least 40 characters |

Use **encrypted secrets** for the Client Secret and session secret.
The client ID and ID allowlist are identifiers but still belong in
server-only variables, not public JavaScript.

Generate a random 64-character hexadecimal session secret using Node.js
on your own computer:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

**Do not share secret values in chat, screenshots, or commits.**

Existing Preview D1 binding `DB` must still point to `pico-db`.
Keep `UPTIMEROBOT_API_KEY` and the separate scheduled archive Worker
unchanged.

If you previously added `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`
or `STATUS_ADMIN_EMAILS`, they are unused and can be deleted from Preview.
Old activation links and the `/enroll` page are retired.

## 4. Apply the D1 migrations

Back up the existing `pico-db` first.

In Cloudflare's D1 SQL Console, run **one SQL statement at a time**
without the leading `--` comment lines:

- `migrations/0006_status_admin.sql` (admin audit log), if not already applied.
- `migrations/0008_status_admin_github.sql` (GitHub session table and index), if
  not already applied.

You do **not** need migration `0007` or any invite table. If migration
`0007` was already applied, migration `0008` is safe because it uses
`IF NOT EXISTS`. Old device-only sessions are **not** accepted by the
GitHub allowlist check, even if their cookies still exist.

Verify that both required tables exist:

```sql
SELECT name FROM sqlite_master
WHERE type = 'table'
AND name IN ('pico_status_admin_audit','pico_status_admin_sessions');
```

## 5. Redeploy and test

Redeploy the latest `status` branch to
`https://status.picompiler.pages.dev/`.

Before logging in, use a private window to confirm:

- `/admin/` returns HTTP **404** and does **not** display the dashboard.
- `/admin/api/incidents` returns HTTP **404**.
- `/`, `/history`, `/api/status` and `/api/history` stay public.

Use the separate **private entry link** `/admin/auth/start` to open GitHub
sign-in. With an approved GitHub account, the callback saves a secure session
in D1 and redirects to `/admin/`.

For each unapproved GitHub account, the OAuth callback fails to 404, without
granting access. The admin UI remains hidden.

Sign out and confirm that `/admin/` returns 404 in the same browser.

Avoid publishing fake incidents in production purely for testing.

**Required Cloudflare setting:** Workers & Pages → **picompiler** →
Settings → Runtime → **Fail open / closed** → **Fail closed**.
If the Pages Functions request quota is exhausted, Cloudflare should
not serve private static admin HTML without its authentication middleware.

Cloudflare's `status-assets/_routes.json` explicitly includes
`/admin`, `/admin/*` and `/api/*` so Pages invokes Functions for all
protected admin HTML, CSS, JS, and API routes.

## Security and revocation

The server verifies the cookie's SHA-256 verifier hash against an unrevoked,
unexpired D1 row **on every admin request**. It separately checks the account
ID against the current `STATUS_ADMIN_GITHUB_IDS` allowlist. Removing a
user ID from Preview and redeploying revokes that user's access even if an
existing session cookie is present.

Sessions expire after 14 days. The browser holds an HttpOnly, Secure,
SameSite=Lax host-only cookie; no token is stored in localStorage.
State cookies have a 10-minute lifetime and are signed with an HMAC secret.

To inspect or manually revoke sessions:

```sql
SELECT id,label,created_at,expires_at,revoked_at
FROM pico_status_admin_sessions
ORDER BY created_at DESC;
```

```sql
UPDATE pico_status_admin_sessions
SET revoked_at = unixepoch()
WHERE id = 'PASTE_EXACT_SESSION_ID_HERE';
```

Use GitHub 2FA on approved accounts and protect your Cloudflare dashboard.
Every admin incident creation/update is written to the existing
`pico_status_admin_audit` table, with `github:<numeric-id>` in its
legacy `actor_email` column.

Never disable authorization middleware to fix a deployment error.
If login fails, inspect the Cloudflare Pages Function logs first.
