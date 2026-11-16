# Secure Pico Status Admin

The admin dashboard is at `https://status.picompiler.pages.dev/admin/`.
It is for approved team members only. **The public status page stays public.**
No passwords, Cloudflare API tokens or UptimeRobot secrets are sent to browsers.

## 1. Apply the database migration

Your existing `pico-db` D1 database already contains
`pico_status_incidents` and `pico_status_updates`.

Back up `pico-db`, then run `migrations/0006_status_admin.sql` in the D1 SQL Console.
This adds `pico_status_admin_audit` and indexes. It does not alter usage tables.

Verify:

```sql
SELECT name FROM sqlite_master
WHERE type = 'table' AND name = 'pico_status_admin_audit';
```

The audit log records the authorized editor's email, stage, time and public message.

## 2. Create a Cloudflare Access application protecting the admin path

In Cloudflare Dashboard → Zero Trust → Access controls → Applications:

1. Create a new **Self-hosted** application named `Pico Status Admin`.
2. Protect only `status.picompiler.pages.dev/admin/*`, including the admin HTML and its APIs.
3. Create an **Allow** policy listing only the email addresses of approved Pico editors. Do not select `Everyone`. Prefer your organization's SSO with MFA, or Access one-time PIN for approved inboxes.
4. Save the application. Copy its **Application Audience (AUD) Tag** from Additional settings.
5. Copy your Access **team domain** (such as `your-team.cloudflareaccess.com`).

**Critical:** Do not enable a site-wide Access policy for `picompiler.pages.dev` or for all `*.picompiler.pages.dev` previews. That would lock users out of the public status page.

Cloudflare's Access UI might require a domain belonging to your Cloudflare DNS zone for a manually configured self-hosted application. If the dashboard does not accept the `pages.dev` branch hostname with a path, **stop here**. Use a custom hostname in an owned Cloudflare zone or move the admin to a dedicated Access-protected Worker. Never remove API token verification as a workaround.

## 3. Add three server-only values to the status Pages preview

Open Cloudflare → Workers & Pages → `picompiler` → Settings →
Variables and Secrets → **Preview**. Create these values:

| Name | Value |
| --- | --- |
| `CF_ACCESS_TEAM_DOMAIN` | `your-team.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | The Application Audience (AUD) Tag from step 2 |
| `STATUS_ADMIN_EMAILS` | Approved editor email addresses, comma-separated |

Store them as encrypted secrets where supported. None of these names should be prefixed `VITE_`.
The existing Preview D1 binding named `DB` must still point to your `pico-db`.

The app validates the JWT's RSA signature using Cloudflare Access's published keys
and verifies issuer, audience, expiry and an exact email allowlist on **every API request**.
It also verifies POST Origin, restricts input lengths, parameterizes SQL and writes to an audit log.

## 4. Deploy and verify

Deploy the latest `status` branch.

- `https://status.picompiler.pages.dev/` must remain publicly accessible.
- Opening `https://status.picompiler.pages.dev/admin/` in a private browser should require Access sign-in.
- An unauthenticated GET to `/admin/api/incidents` must return HTTP 403 if it reaches Pico code.
- An approved signed-in editor should see the incident list.
- An unauthorized email must be rejected even if they know the URL.
- Do **not** create a fake incident on the public page solely to test the write API.
  When a genuine incident occurs, you can create or select it and publish an update.

## 5. Publishing

An incident starts as **Investigating**. Authorized editors then publish
**Identified**, **Monitoring** and **Resolved** updates as verified facts warrant.
The public `/history` page displays the complete timeline.

Automated UptimeRobot incidents and manual incidents share the same existing D1 tables.
The archive collector is unchanged and keeps running on its five-minute Cron Trigger.
The public status API caches results, so published changes might take a few minutes to appear.

## Security and maintenance

- Do not share Access AUD configuration as a substitute for secret authentication. The public AUD tag alone does not grant access, but the signed JWT does.
- Grant the minimum number of editors. Remove a former editor from both the Access Allow policy and `STATUS_ADMIN_EMAILS`, then redeploy if necessary.
- Protect the related Cloudflare and GitHub accounts with MFA.
- Back up D1 regularly and review the `pico_status_admin_audit` table when investigating changes.
- The admin exposes no delete endpoint.
- The administrator page is not linked from public navigation.
- Code deploys **do not** create the Access application, database table or secret values automatically. Until configured, publishing is blocked.
