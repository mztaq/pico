# Pico Desktop

An online-only Pico desktop app for Windows, macOS and Linux, built with Electron.
It opens the live [Pico website](https://picompiler.pages.dev/), so users get
the same workspaces and website updates without a separate desktop frontend.

## Run locally

From `desktop/`:

```sh
npm install
npm start
```

## Build installers

```sh
npm run dist -- --win nsis --x64
npm run dist -- --mac dmg --x64 --arm64
npm run dist -- --linux AppImage deb --x64
```

Build each target on its matching operating system, or run the **Desktop installers**
GitHub Actions workflow. Installers appear in `desktop/dist/`, or in the
workflow's downloadable artifacts. The workflow does not publish releases.

| Platform | Output |
| --- | --- |
| Windows x64 | `.exe` installer (NSIS) |
| macOS Intel / Apple Silicon | `.dmg` |
| Linux x64 | `.AppImage`, `.deb` |

### Internet required

The app opens the live website. If the connection drops after the page has
loaded, Pico's existing online-only overlay blocks the workspaces. After a
previous online visit, the website's cached homepage may be visible behind it.
If the app is launched for the first time with no internet, a minimal local
offline message appears until the server is reachable.

### Distribution

These builds are **unsigned**. Windows SmartScreen and macOS Gatekeeper may
warn users. Public distribution without warnings requires code signing; macOS
notarization requires an Apple Developer membership. This workflow does not
request signing credentials, enable auto-updates or incur paid services.

The desktop wrapper deliberately disables Node integration and renderer
privileges, blocks external navigation, and only opens HTTPS external links
in the default browser.
