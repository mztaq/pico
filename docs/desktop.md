# Pico desktop apps

Pico desktop uses **Tauri 2** to display the live site at
https://picompiler.pages.dev. It requires an internet connection, just like the
website. The desktop app does not contain a second copy of the compilers.

## How updates work

- **Website changes:** Once a push to `main` is deployed to Cloudflare Pages,
  desktop users receive the new Pico UI/features on their **next app launch or
  refresh**. No new installer is needed. Existing open sessions are not
  forcibly refreshed, to avoid losing unsaved work.
- **Desktop wrapper changes:** The GitHub Actions **Desktop installers**
  workflow rebuilds Windows, macOS and Linux installers whenever `src-tauri`,
  the icon, or its workflow changes on `main`. It can also be started manually.
  Download the packages from the workflow run's **Artifacts** section.
  Native installer updates are **not yet installed automatically**. Signed
  releases and Tauri's updater would be needed for that.

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
