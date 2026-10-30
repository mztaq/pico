# Pico desktop apps

Pico desktop uses **Tauri 2** to display the live site at
https://picompiler.pages.dev/app for new native builds. Previously published
installers instead open https://picompiler.pages.dev/ and Pico detects their
native Tauri webview to render the workspace instead of the public landing
page. Both routes require an internet connection. The desktop app does not
contain a second copy of the compilers.

## How updates work

- **Website changes:** Once a push to `main` is deployed to Cloudflare Pages,
  desktop users receive the new Pico UI/features on their **next app launch or
  refresh**. No new installer is needed. Existing open sessions are not
  forcibly refreshed, to avoid losing unsaved work.
- **Existing installers:** The website detects the Tauri 2 `isTauri` or
  `__TAURI_INTERNALS__` marker. Only the native app on `/` receives Pico's
  workspace. Regular browsers still receive the landing page. This avoids a
  forced reinstall on launch URL migration.
- **Desktop wrapper changes:** The GitHub Actions **Desktop installers**
  workflow builds Windows, macOS and Linux installers when `src-tauri`, the
  icon, or its workflow changes on `main`, or when started manually. Builds
  are available as temporary Actions artifacts. **No new GitHub releases are
  created automatically.** Native changes are not installed automatically;
  updated installers would still need to be distributed and installed.

## Releases and source archives

The existing stable [Pico for Desktop release](https://github.com/mztaq/pico/releases/tag/desktop-v0.1.0-build.10)
is kept as the single public installer download. Its existing Windows, macOS
and Linux installer assets stay unchanged.

The **Update desktop release source archives** workflow runs after every push
to `main` (or manually on `main`) and force-moves the existing
`desktop-v0.1.0-build.10` tag to the latest `main` commit. GitHub generates
**Source code (zip)** and **Source code (tar.gz)** from that tag, so their
contents follow `main` without creating a new release or uploading files.
GitHub/CDN caching may delay archive updates. This deliberately makes the
published release tag mutable; do not use it for reproducible builds or
commit-specific source references.

Website-only updates still reach desktop users through Cloudflare without
reinstalling the desktop app. Keep `logs.txt` and `public/logs.txt` in sync
for the site's changelog.

The Windows webview disables native file-drop interception so that HTML5
dragging from the Flowchart and Logic Sim component palettes works. Normal
dragging within those canvases uses pointer events.

## Installer outputs

- Windows: `.msi` and NSIS `-setup.exe`
- macOS: `.dmg` (Apple Silicon and Intel)
- Linux: `.deb` and `.AppImage`

The macOS and Windows builds are not signed/notarized for public distribution.
They may show security warnings. Signing/notarization should be configured
before distributing to schools or the public.

## Building locally

Install Rust, the Tauri 2 prerequisites for your OS, Node.js and the Tauri CLI:

```sh
npm install --global @tauri-apps/cli@^2
tauri icon public/pico-logo.svg --output src-tauri/icons
tauri build
```

The `src-tauri/icons` directory is generated from Pico's SVG and ignored by
Git. The website's own offline connection overlay remains in charge of
connectivity once the page loads. On a fresh launch without a connection,
the system webview may initially show its network error page.
