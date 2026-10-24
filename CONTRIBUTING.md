# Contributing to Pico

Thanks for helping make Pico more reliable for students.

## Local setup
- Install Node.js compatible with the versions required by Vite 8 and pnpm 11, then enable Corepack.
- Run `pnpm install --frozen-lockfile` and `pnpm dev`.
- Before proposing a change, run `pnpm check`, `pnpm test` and `pnpm build`.

## Scope and expectations
- Keep Pico free and account-free. Do not transmit source code, typed console input, project files or flowchart data to analytics.
- Preserve compatibility with Cambridge IGCSE pseudocode where applicable; clearly label non-syllabus CPU simulations as educational approximations.
- Include test cases for parsers, runners, storage, logic simulation, and import/export changes. Cover invalid input and edge cases.
- Do not add external execution or telemetry services without an explicit privacy and security review.
- Keep UI keyboard-accessible and test both light/dark and high-contrast themes.
- Prefer small, reviewable pull requests. Explain behavior changes, expected user impact, and manual reproduction steps.
- For vulnerability reports, follow [SECURITY.md](SECURITY.md) rather than public issues.

## Where to start
Read the [README](README.md) to understand the workspaces. Open a GitHub issue for a proposal or reproducible bug before large redesigns. Use a feature branch and submit a pull request. Maintainers decide what to merge.
