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
  workflow builds Windows, macOS and Linux packages on relevant code changes
  or manual dispatch. Every build stages exactly one installer per OS:
  Windows NSIS EXE, universal macOS DMG and Linux AppImage. A universal DMG
  supports both Apple Silicon and Intel. Builds are uploaded as temporary
  Actions artifacts and do not automatically change GitHub Releases.
- **Publishing:** Only a manual `workflow_dispatch` on `main`, with
  `publish_existing_release` enabled and every platform build successful,
  replaces assets on the **existing** `desktop-v0.1.0-build.10` release.
  That job backs up its previous assets, uploads the new three installers,
  deletes the superseded MSI, per-architecture DMGs and DEB, and verifies
  exactly three assets. It never creates a second release. Run this only
  after test/build checks are green.

## Releases and source archives

The existing stable [Pico for Desktop release](https://github.com/mztaq/pico/releases/tag/desktop-v0.1.0-build.10)
remains the sole release. On the first main-branch deployment after this
change, the publish workflow backs up the six existing release files, replaces
them with the three verified Windows, universal macOS and Linux installers,
then packages the three binaries for public Cloudflare Pages downloads.
Later deployments reuse the three existing release assets.

The website reads the public `/download-assets/manifest.json` and serves
downloads from `/downloads/` on Cloudflare, not from GitHub release URLs.
Therefore download visitors never need access to the GitHub repository, even
after the repository is made private.

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

- Windows: `Pico_x64-setup.exe` (NSIS)
- macOS: `Pico_universal.dmg` (one file for Apple Silicon and Intel)
- Linux: `Pico_amd64.AppImage` (x86-64 Linux)

The older `.msi`, separate architecture-specific `.dmg` and `.deb`
installers remain available only until the replacement files are verified
and published to the existing release.

The macOS and Windows builds are not signed/notarized for public distribution.
They may show security warnings. Signing/notarization should be configured
before distributing to schools or the public.

## Building locally

Install Rust, the Tauri 2 prerequisites for your OS, Node.js and the Tauri CLI:

```sh
npm install --global @tauri-apps/cli@^2
tauri icon public/pico-logo.svg --output src-tauri/icons
tauri build --bundles nsis    # Windows
# tauri build --bundles dmg --target universal-apple-darwin   # macOS
# tauri build --bundles appimage   # Linux
```

The `src-tauri/icons` directory is generated from Pico's SVG and ignored by
Git. The website's own offline connection overlay remains in charge of
connectivity once the page loads. On a fresh launch without a connection,
the system webview may initially show its network error page.
