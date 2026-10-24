# Production readiness / release review

This is a practical checklist, **not** a claim that a formal penetration test, full accessibility audit or cross-browser QA has been completed.

## Performance
- React.lazy loads the Flowchart Builder, Logic Sim and CPU Studio only when opened. Verify the initial network waterfall is smaller than on `main` and that navigating repeatedly preserves user work.
- Run `pnpm build` and compare `dist/assets` chunk sizes. Validate actual first-visit performance with Lighthouse on mobile and desktop; do not infer measured improvements from splitting alone.
- The Pyodide runtime still downloads on demand for Python. It may be large and does not work offline unless its files were explicitly cached (this service worker deliberately excludes it).

## Security / Cloudflare
- Keep D1 binding `DB` and `RATE_LIMIT_SECRET` configured separately for Production and Preview.
- Confirm expired consent and rate-limit entries are deleted by the separate scheduled Worker.
- `_headers` adds no-sniff, referrer and permissions policy controls, as well as `frame-ancestors 'none'`. The existing COOP/COEP headers are retained for Python shared-array-buffer support.
- **Do not add a blanket CSP with `unsafe-eval`, block inline code or block WebAssembly until it has been verified against the language workers, theme editor and 404 page.** A stricter, nonce/hash-based CSP needs a dedicated test cycle.
- Cloudflare Pages `_headers` applies to static responses. Confirm Pages Functions set appropriate no-store and content-type headers themselves; review proxy/cache configuration.
- Keep the service-worker cache restricted to static same-origin shell and versioned `/assets/` files. Never store user files, interpreter traffic, API calls or anonymous identifiers in Cache Storage.
- Run dependency audits in CI or periodically and review advisories. No claim of zero vulnerabilities is made.

## Progressive web app
- The manifest offers standalone installation where browsers support SVG icons.
- The service worker caches the homepage and previously loaded versioned assets. It deliberately leaves `/api/` and `/python-runtime/` untouched.
- Offline mode is **best-effort only**. First install needs network, workspaces not previously downloaded may fail, and Python execution requires its runtime online.
- Verify Chrome/Edge installation, update behavior, offline fallback, storage limits, and iOS behavior on real devices.
- Service-worker updates may retain assets from old versions until activation; manually test deployment updates.

## SEO / sharing
- `index.html` includes title, description, canonical, Open Graph and Twitter metadata.
- Only the root URL is in the sitemap because Pico uses client-side workspace selection and hash-driven policy pages.
- **Current Open Graph image is SVG.** Some social platforms do not render SVG previews; create a 1200 × 630 PNG/JPEG asset and update `og:image` for reliable rich cards.
- Verify previews with each platform's link-debugging tools rather than assuming support.

## Accessibility / reliability
- Test the homepage and each workspace with keyboard-only navigation, focus order, visible focus, contrast, 200% zoom, reduced motion and screen readers.
- Validate on Chrome, Edge, Firefox and Safari, both desktop and mobile. A passing automated check does not establish WCAG conformance.
- Test import/export round trips, refresh, cancellation of infinite loops, consent withdrawal, bad/missing D1 bindings and 429 responses.
- Keep a documented path to restore database backups and roll back Cloudflare deployments; test those paths before a public release.

## Release checklist
1. `pnpm install --frozen-lockfile`
2. `pnpm check && pnpm test && pnpm build`
3. Verify preview, no runtime errors, and `/api/cookies` behavior.
4. Check CSP and COOP/COEP did not prevent Python worker startup.
5. Check `/manifest.webmanifest`, `/sw.js`, `/robots.txt`, `/sitemap.xml` and `/offline.html`.
6. Open all five workspaces, exercise project saving, and verify no API traffic is cached.
7. Merge only after preview and manual browser checks; monitor the Production deployment.
