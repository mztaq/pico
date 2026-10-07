# Discord Updates Setup

Pico reads recent messages from the configured `#pico-logs` channel once when the app loads. Bot and webhook posts are excluded, blocked content is rejected as a whole, and accepted messages are sorted newest first.

## Local configuration file

Put the following in `.env.local` beside `package.json` (the app also accepts `.local.env`):

```text
DISCORD_CHANNEL_ID=1557441068629233694
DISCORD_BOT_TOKEN=your_rotated_bot_token
```

No `VITE_` prefix is required. Vite reads these files directly when it starts or builds the project. If both `.env.local` and `.local.env` exist, `.env.local` takes precedence. Restart `pnpm dev` after changing the file. The loader never logs the values. Existing `.env.local` and `.local.env` files are ignored by Git and are not included in the source archive.

The bot needs only **View Channel** and **Read Message History** for the channel. The server/guild ID is not needed.

## Live deployment

A local `.env.local` is available only on the computer doing the build. It is **not** automatically sent to Cloudflare Pages or another hosted CI builder. If you want the live website to use this file-based setup, build the site locally while the file is present, then deploy the generated `dist/` output using your chosen deployment process. A hosted automatic build needs a secure way to provide the file to that build; committing the real credential file to a public repository is not safe.

## Important credential warning

The token is read by Vite and inserted into the browser bundle at build time. Anyone visiting the site can recover it from the JavaScript or network request. Minification, splitting the value, disabling context menus, and blocking shortcuts do **not** make it secret. Do not use a privileged or valuable bot token on a public website. The safer design is a server-side read-only endpoint or a public, token-free feed.

If you knowingly accept the exposure for a low-impact experiment, use a dedicated bot with only read permissions and rotate its token after testing. Never commit `.env.local`, `.local.env`, or the generated `dist/` bundle with a real token.

## Limitations

- Pico reads only the latest 100 messages.
- The blocklist is a configurable text filter, not semantic moderation, and cannot guarantee detection of every unsafe message.
- The anti-inspection code is a casual deterrent only; it cannot prevent inspection of frontend source or requests.
- If no local token is found or Discord is unavailable, Pico continues normally and shows no popup (or uses an accepted feed already held in memory for the current page).
