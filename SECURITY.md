# Security policy

Pico executes educational programs in the browser. Browser isolation, parsers and runtime limits reduce risk, but no browser interpreter should be regarded as a hardened sandbox for hostile workloads.

## Reporting a vulnerability
**Please do not publish exploit details in an issue.** Use [GitHub's private vulnerability reporting](https://github.com/mztaq/pico/security/advisories/new) if it is available for this repository. Otherwise open a non-sensitive issue asking maintainers how to submit a private report; do not post payloads, keys or user data.

Describe the affected version, reproducible steps, expected and observed behavior, and impact. We cannot promise a fixed response time.

## Supported versions
The currently deployed production version is the only actively maintained version. Old preview deployments and forks are not covered by this policy.

## Privacy and trusted content
- Projects and typed console inputs are stored locally in the browser; do not include private code or personal data in security reports.
- Optional consent-based analytics and preferences use Cloudflare Pages Functions and D1; no account is needed.
- Never commit API keys, D1 credentials, or rate-limit secrets.
- Audit service-worker behavior when changing caching: API responses, editor documents and user-generated projects must never be cached by the worker.

## Boundaries
Pico is an educational tool, not a secure remote code execution service. Users should avoid running untrusted code, and maintainers should continuously review isolation assumptions.
