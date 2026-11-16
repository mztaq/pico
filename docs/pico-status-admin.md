# Pico Status Admin: GitHub sign-in, no Zero Trust

The private incident editor is at `https://status.picompiler.pages.dev/admin/`.
Its login is GitHub OAuth. No Cloudflare Zero Trust account, card, extra database, GitHub repository permission, or outside service is needed.

## 1. One-time D1 setup

In your existing `pico-db`, back up the database and run the statements in
`migrations/0006_status_admin.sql`. This adds the admin audit log table.
If you already applied that migration, do not change anything.

The audit table column `actor_email` is retained for backwards compatibility,
but the new login stores an immutable identifier such as `github:12345678`
instead of an email. This avoids relying on mutable GitHub usernames or emails.

## 2. Create a GitHub OAuth app (free)

Go to https://github.com/settings/developers and select
**OAuth Apps** → **New OAuth App**.

Use these values:

| Field | Value |
| --- | --- |
| Application name | `Pico Status Admin` |
| Homepage URL | `https://status.picompiler.pages.dev/` |
| Authorization callback URL | `https://status.picompiler.pages.dev/admin/auth/callback` |

Keep **callback URL wildcard matching disabled**. Leave **device flow disabled**.

Register the application, note its **Client ID**, and generate a **Client Secret**.
Do not paste the Client Secret in GitHub source code, screenshots, or chat.

The sign-in flow requests no extra OAuth scopes. It uses PKCE S256 and a signed,
short-lived state cookie. After receiving the authorized GitHub account's numeric
user ID, the server discards its GitHub access token and issues an HttpOnly,
Secure, SameSite=Lax signed session cookie valid for at most 8 hours.

## 3. Find each approved team member's GitHub numeric ID

Open `https://api.github.com/users/USERNAME` in a browser, replacing USERNAME.
The top-level `id` field is that GitHub account's permanent numeric ID.

Use numeric IDs rather than display names or usernames, which users can change.

## 4. Add four encrypted Preview secrets to your existing Pages project

In Cloudflare → Workers & Pages → `picompiler` → Settings →
**Variables and Secrets** → **Preview**, add:

| Name | Value |
| --- | --- |
| `GITHUB_OAUTH_CLIENT_ID` | Client ID of the GitHub OAuth app |
| `GITHUB_OAUTH_CLIENT_SECRET` | Its Client Secret |
| `STATUS_ADMIN_GITHUB_IDS` | Numeric account IDs separated by commas, e.g. `12345,67890` |
| `STATUS_ADMIN_SESSION_SECRET` | A random secret of at least 40 characters |

Use **Encrypt** for secrets, especially Client Secret and session secret.
Generate the session secret locally with Node.js:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

The existing **Preview** D1 binding `DB` must point to `pico-db`.
Do not prefix any of these names with `VITE_`.

Do not configure `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` or
`STATUS_ADMIN_EMAILS`. Those were used in the earlier Zero Trust version
and are no longer needed.

## 5. Redeploy and verify

Deploy the latest `status` branch. Open:

- Public status: `https://status.picompiler.pages.dev/`, accessible to everyone.
- Admin: `https://status.picompiler.pages.dev/admin/`, which redirects to GitHub
  sign-in for visitors without a valid session.
- Admin API: `https://status.picompiler.pages.dev/admin/api/incidents`,
  returns HTTP 401 without a valid approved session.

Sign in using an approved GitHub account and verify that the dashboard loads.
Try from a private browser session without signing in, and an unapproved GitHub
account, and verify both lack access to the API.

Avoid adding fake public incidents solely to test login. Genuine incidents
and updates appear on the public incident timeline at `/history`.

## Security notes

- The server checks the exact `status.picompiler.pages.dev` hostname, the
  session HMAC signature, its expiration, and the GitHub numeric ID allowlist
  on every admin API request.
- Signed sessions expire after 8 hours. An authorized editor logs out through
  the dashboard; removing an ID from the Preview allowlist blocks it on subsequent
  requests even if an earlier cookie still exists.
- POST requests require the exact same Origin as the status site.
- Server code validates incident fields, uses parameterized D1 SQL, limits writes
  by audit history, and saves updates to `pico_status_admin_audit`.
- No GitHub access token is stored in D1 or sent to the public UI.
- Public status pages and automated archive ingestion are unchanged.
- Protect all approved GitHub accounts and your Cloudflare account with 2FA.
- In Pages **Settings → Runtime**, set **Fail closed** for Functions requests if
  offered. Do not let the status admin bypass authentication when Functions quotas
  are exhausted. If the status service requires static fail-open behavior, ensure
  the admin's API never fails open and monitor the quota.
- If you rotate `STATUS_ADMIN_SESSION_SECRET`, all existing editor sessions
  become invalid.
- A successfully committed code change doesn't configure GitHub or Cloudflare
  secrets automatically. Until configured, the admin fails closed.
