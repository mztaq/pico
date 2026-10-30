# Downloads page

`/downloads` is Pico's first-party release page. It uses the existing React/Vite app and theme tokens.

## Data source

The page reads `/download-assets/manifest.json`, which is published alongside the website by `.github/workflows/publish-downloads.yml`. The manifest is Pico's runtime source of truth for the release title, version, publication date, notes, filenames, sizes and checksums. Visitors do not call GitHub's API and Pico does not proxy GitHub release assets.

Every download action links to `/downloads/<filename>`. Cloudflare Pages Functions reconstruct the file from Pico-hosted chunks, preserve the original filename, and support `GET`, `HEAD`, byte ranges, ETags and caching. Filenames are allowlisted by the Function and validated against the hosted manifest.

Installer formats identify the platform; explicit filename tokens identify architecture. Unknown formats remain under “Other files.” The page does not infer minimum OS versions or other compatibility claims.

## Publishing

The publishing workflow retrieves the designated build during deployment, verifies and splits the six binaries, writes release metadata into the manifest, builds Pico, and deploys the complete site through Wrangler. GitHub is used by the deployment workflow as an internal build input; the deployed website and its visitors rely only on Pico's Cloudflare-hosted assets.

Keep automatic Cloudflare production branch deployments disabled so they cannot replace a workflow deployment with a build that lacks installer chunks. See `docs/download-deployment.md` for setup and verification.

## Verification

Run `pnpm test` and `pnpm build`. For a production-like local check after staging binaries, run `wrangler pages dev dist` and verify `/downloads`, `/download-assets/manifest.json`, and at least one full and ranged `/downloads/<filename>` response. Compare the downloaded SHA-256 with the hosted manifest.
