# Downloads and releases

`/downloads` is the first-party release browser for **mztaq/pico**. The home navigation links to it. It uses the existing React/Vite app, Pico theme tokens, and Cloudflare Pages Functions; no database or new production dependency is needed.

## Data and downloads

- `GET /api/releases?page=1` reads the public GitHub Releases API (20 releases per page), plus `/releases/latest` for GitHub's designated latest stable release. Drafts are excluded; prereleases appear in the expandable archive. Release versions and asset filenames are never hardcoded.
- Metadata uses Cloudflare's edge Cache API: five minutes fresh, conditional ETag revalidation, and up to 24 hours of explicitly labelled stale data during upstream failures. New releases normally appear within five minutes. A rate-limit response supplies `Retry-After` and the UI waits before retrying. No API token is used or needed for public releases.
- `GET /api/downloads/:id` resolves the asset in the fixed repository and streams its original `browser_download_url` through Pico. The endpoint accepts an asset ID, never an arbitrary upstream URL. Original filenames use both ASCII and UTF-8 `Content-Disposition` parameters. Range requests are forwarded. Files are not buffered in memory, stored, or republished. A failed download returns a Pico error page with a link back.
- Only uploaded assets get download controls. Installer formats identify the platform; explicit filename tokens identify architecture. Unknown formats stay under “Other files.” No minimum OS version or unsupported compatibility claim is inferred.
- Release notes support paragraphs, lists, headings, bold, inline code, and HTTP(S) links. HTML remains escaped text.

## Local development and verification

Run `pnpm install --frozen-lockfile`, then `pnpm dev`. Vite routes release requests to the same handler code as Pages Functions. Test `/downloads` directly and through the home link. Vite's development adapter does not emulate Cloudflare's edge cache; automated tests exercise cache hits, ETag revalidation and stale fallback separately.

Run `pnpm check`, `pnpm test`, and `pnpm build`. There is no lint command in this repository. Tests use clearly named fixtures to cover releases that do not yet exist in the real archive; fixtures are never shipped as release data.

## Cloudflare Pages

Keep the existing root-directory deployment, `pnpm build` build command and `dist` output directory. Pages compiles the root `functions/` directory; the existing `public/_routes.json` already includes `/api/*` and must retain the other APIs. `public/_redirects` rewrites only `/downloads` to the React entry point, preserving Pico's custom 404 page for genuinely unknown URLs. No hosting migration or environment variable is required.

For CLI deployments, run `wrangler pages deploy dist` from the repository root so Functions are included. A static-only upload of `dist`, or `pnpm preview` alone, does **not** run Functions. To check the production runtime locally, use `wrangler pages dev dist` from the root after building.

Before merging, verify the Pages preview's `/api/releases`, `/downloads` and one `/api/downloads/:id` response. Confirm the downloaded filename and bytes against the asset's GitHub size/digest. Publishing this PR does not itself deploy to production; merging follows the repository's existing deployment workflow.
