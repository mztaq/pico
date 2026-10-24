# Pico public launch checklist

This is a suggested review, not a claim that any external accounts or campaigns have been created.

## Product proof
- Confirm all five workspaces can be launched and examples work, particularly typed INPUT and stopping long-running code.
- Check keyboard-only navigation, screen readers, mobile layouts, and high-contrast themes.
- Confirm user code never leaves the browser through optional telemetry.
- Verify Analytics and Preferences can be declined independently and revoked.

## Website and links
- Confirm `https://picompiler.pages.dev/` shows the expected title and description.
- Validate Open Graph previews in Discord, WhatsApp, LinkedIn and other supported platforms. **SVG preview images are not reliably supported by all platforms; replace with a tested raster 1200×630 card before a major launch.**
- Ensure `robots.txt` and `sitemap.xml` resolve.
- Test install prompts on several browsers; add 192px and 512px PNG fallback icons for broad compatibility.
- Test pages on a slow connection and after a Cloudflare deployment.

## Public profile
- Maintain clear usage instructions, release notes and internal security documentation.
- Announce a stable, verified build, not an untested preview branch.
- Publish accurate learning examples rather than invented performance claims.
- Keep credit consistent with the actual contributors and their respective roles.

## After launch
- Review accessibility feedback and browser compatibility reports.
- Monitor error rates, cache behavior and Cloudflare D1 quotas.
- Review dependency updates and security advisories internally; test updates before merging.
- Publish concise change notes for important releases.
