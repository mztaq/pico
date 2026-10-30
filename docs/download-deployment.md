# Pico desktop downloads

This solution keeps a single source repository and uses existing Cloudflare Pages. No R2 or paid service required.

The GitHub Actions workflow fetches the six binaries from release `desktop-v0.1.0-build.10`, splits each into 16 MiB or smaller chunks, calculates SHA-256, builds the website, creates `favicon.ico` from the existing Pico SVG, then deploys all files with Wrangler.

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
2. Merge the download changes after tests. Run the `Publish Pico installers to Cloudflare Pages` workflow manually.
3. Ensure the resulting deployment includes Pages Functions. Check its `/download-assets/manifest.json` and `/favicon.ico` URLs.
4. Verify `curl -I` and range GET requests and compare full downloaded SHA-256 with the manifest.
5. Update Pico website and desktop auto-update URLs before making the GitHub source private.

## Important

Cloudflare Pages Git integration may overwrite a manual Wrangler deployment during the next Git push. **Do not make the repo private until an automated release and deployment path is verified for subsequent pushes.**

The function reconstructs 77+ MiB AppImage responses. Cloudflare Pages Functions CPU/memory/response-duration limits might affect large downloads. Confirm with a real end-to-end test.

This method does not upload executable binaries into Git history. Github release binaries are temporarily downloaded on a Github runner only.
