# Pico desktop downloads

This solution keeps a single source repository and uses existing Cloudflare Pages. No R2 or paid service required.

The GitHub Actions workflow fetches the six binaries from release `desktop-v0.1.0-build.10`, splits each into 16 MiB or smaller chunks, calculates SHA-256, builds the website, then deploys all files with Wrangler.

The Cloudflare Pages Function at `/downloads/[filename]` reconstructs downloads, supports HTTP byte ranges, and keeps complete binaries out of the Git repository.

## URLs after publishing

- `/downloads/Pico_x64-setup.exe`
- `/downloads/Pico_x64_en-US.msi`
- `/downloads/Pico_aarch64.dmg`
- `/downloads/Pico_x64.dmg`
- `/downloads/Pico_amd64.deb`
- `/downloads/Pico_amd64.AppImage`

## Required first-time setup

1. GitHub repository Actions secrets: `CLOUDFLARE_API_TOKEN` (Cloudflare Pages Edit permission) and `CLOUDFLARE_ACCOUNT_ID`.
2. In Cloudflare Workers & Pages > picompiler > Settings > Builds > Branch control, disable automatic production branch deployments and save. Leave Preview branch deployments enabled for PR checks.\n3. Merge the download changes after tests. The workflow will run for every push to `main`; you can also run it manually using Actions > Publish Pico installers to Cloudflare Pages > Run workflow.
4. Ensure the resulting deployment includes Pages Functions. Check its `/download-assets/manifest.json` URL.
5. Verify `curl -I` and range GET requests and compare full downloaded SHA-256 with the manifest.
6. Update Pico website and desktop auto-update URLs before making the GitHub source private.

## Important

**Automatic Cloudflare production builds must be disabled before merge.** Otherwise their unbundled Git build could race against GitHub Actions and replace the release assets. After merge the GitHub Actions workflow deploys installers on every push to main. Do not make the repository private until binary integrity checks pass.

The function reconstructs 77+ MiB AppImage responses. Cloudflare Pages Functions CPU/memory/response-duration limits might affect large downloads. Confirm with a real end-to-end test.

This method does not upload executable binaries into Git history. Github release binaries are temporarily downloaded on a Github runner only.

Windows installer icons are generated during native builds by `.github/workflows/desktop.yml` using `tauri icon public/pico-logo.svg --output src-tauri/icons`. The `src-tauri/tauri.conf.json` bundle icon list includes `icons/icon.ico`; rebuilding the NSIS installer embeds the Pico icon into the new executable. Existing published installers are unchanged until rebuilt and reuploaded.
