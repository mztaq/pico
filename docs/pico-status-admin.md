# Private Pico Status Admin, without login or external authentication

The public Pico status page stays accessible at
`https://status.picompiler.pages.dev/`.

The private editor is at
`https://status.picompiler.pages.dev/admin/`.

- Unapproved browsers receive a **real HTTP 404** from the server.
- Approved browsers see the editor automatically with no login screen.
- An approved browser holds a private **30-day**, Secure, HttpOnly,
  SameSite=Strict cookie. No credential is stored in localStorage or JavaScript.
- Team members are approved once using a **single-use invitation link**.
- Sessions can be revoked from D1, and sign-out also revokes them.

**Security limitation:** This authenticates a browser session rather than a
human identity. Anyone with access to the approved, unlocked browser can
operate the editor. Avoid shared/school computers. Use browser/OS login
and two-factor authentication on Cloudflare accounts.

## 1. Apply D1 migrations (one-time)

Keep the existing database named `pico-db` and your existing
Pages Preview binding `DB`.

If you have **not** run `migrations/0006_status_admin.sql`, run it first.
It creates the `pico_status_admin_audit` table for the editor.

Back up `pico-db`. Run the four statements from
`migrations/0007_status_admin_devices.sql` in the D1 SQL Console.
The first two create invitation and session tables, and the last two
create indexes. These statements do not modify Pico user analytics.

Because the D1 Dashboard SQL Console has had trouble with pasted comments,
paste SQL statements without leading `--` comment lines.

Confirm:

```sql
SELECT name FROM sqlite_master WHERE type='table'
AND name IN ('pico_status_admin_invites','pico_status_admin_sessions','pico_status_admin_audit');
```

You should see all three names.

## 2. Generate a private activation link

On your computer, from your existing Pico repo checkout:

```sh
node scripts/create-status-admin-invite.mjs "My Laptop"
```

The script prints:

1. A SQL `INSERT INTO pico_status_admin_invites ...` command. Run that SQL
   on the **existing** `pico-db` D1 SQL Console.
2. A private invitation link ending with a `#` and a random secret.
   Open it **only on the browser** you wish to approve.

The invitation lasts 24 hours **from the moment you insert its SQL row**
and works only once. The secret never needs to be pasted into the repo,
a Cloudflare environment variable, or this chat.

**Never share your activation link.** Anyone holding an unused link is able
to activate their own browser.

## 3. Approve your browser

Open the private invitation link printed by the script. Select
**Approve this browser**.

The server checks the one-time token, marks it used in D1, creates
a new 30-day session and sets a browser-only signed-in cookie.
You will be redirected to:

`https://status.picompiler.pages.dev/admin/`

Later, simply visit that same URL on that approved browser.
No login screen, OAuth provider, email or password is required.

Each team member/device requires its own one-time invitation.
Avoid sending activation links through public channels.

## 4. How to remove a device

The editor has a **Sign out** control which immediately revokes the
current session in D1 and clears its cookie.

To revoke a device manually in Cloudflare D1:

```sql
SELECT id,label,created_at,expires_at,revoked_at
FROM pico_status_admin_sessions
ORDER BY created_at DESC;
```

After identifying the correct row, copy its exact `id` and run:

```sql
UPDATE pico_status_admin_sessions
SET revoked_at = unixepoch()
WHERE id = 'PASTE_EXACT_SESSION_ID_HERE';
```

The revoked browser now receives 404. To approve it again,
create a new single-use invitation.

Expired sessions are blocked automatically even if their D1 rows
have not yet been deleted.

## 5. Deploy and verify

Redeploy the latest GitHub `status` branch of `mztaq/pico`.
Do not configure GitHub OAuth or Cloudflare Access. The previous
GitHub OAuth callback routes have been deleted.

Verify:

1. In a private/incognito browser, `/admin/` returns an HTTP 404.
2. `/admin/api/incidents` also returns 404 without the cookie.
3. The public root `/`, `/history`, and `/api/status` stay public.
4. Activate your own browser using a private invitation and verify
   `/admin/` loads your dashboard.
5. Sign out and confirm `/admin/` returns 404 again.

**Critical Cloudflare setting:** Workers & Pages → `picompiler` →
Settings → Runtime → Fail open / closed → **Fail closed**.
Without it, running out of the free-tier Functions quota might
cause Cloudflare to serve static admin HTML without authentication.
Public data writes still require the Functions, but the UI should
not bypass the 404 guard.

## Security properties

- D1 stores SHA-256 hashes of one-time invitation tokens and session
  verifiers, not their plaintext secrets.
- Unapproved and revoked devices see the same server-side 404.
- A token in the invitation URL's fragment (`#...`) is not included
  in HTTP requests or standard referrer headers.
- One invitation yields at most one session. The D1 redemption update
  and session insertion are transactionally batched.
- Administration requires an unexpired, unrevoked database session
  for **every** page, asset and API request.
- Mutating operations verify the browser's exact request Origin.
- Incident updates and creations still use the existing D1 audit log.
- Admin HTML applies a restrictive Content Security Policy.
- No GitHub, Google, external login service or payment card.
- A stolen or shared session cookie would grant access until expiry
  or revocation. For stronger human identity verification, use passkeys.

If there are deployment or runtime errors, do not remove authorization
middleware. Inspect the Pages Function logs instead.
