# Pico Learning Suite

Branch: feature/pico-learning-suite

This extends the existing /app/learn route. Other workspaces remain unchanged.
Modules load only when selected.

## Sections

- Notes: existing IGCSE Computer Science notes, diagrams and questions.
- Live Studio: Pico compiler and Web Worker, real output, variable snapshots,
  step-by-step execution and read-only AST flowchart. Execution limits:
  10,000 steps, 10 seconds, 12 KB source.
- Challenges: eight original graded pseudocode tasks, 3–4 test cases each.
  Results and draft code are stored in the student's browser. Client test
  cases are practice checks, not tamper-proof competition scores.
- Exam practice: timed objective questions from the existing question bank,
  explanations and weak-topic revision links. These are original questions,
  not official Cambridge exam papers.
- Classroom: six-character room codes, nicknames, teacher host, server-graded
  code submissions and live scoreboard via seven-second polling.
- Arcade: Bit Catcher (Canvas 2D) and Logic Rush (DOM 2D), original lightweight
  games with keyboard/touch controls and local high scores.

## Cloudflare D1 setup, Classroom only

1. Bind a Cloudflare D1 database in the main picompiler Pages project with
   binding name DB in the appropriate Preview and Production environments.
2. Execute migrations/0010_learning_classroom.sql against the same D1 database.
3. Deploy this feature branch to Pages Preview and visit /app/learn.
4. Start a classroom, join from another browser, submit a program, verify
   the server-graded score and close the room.
5. Verify room expiration, authorization errors and submission limits.

Without the DB binding, Classroom returns HTTP 503. All other learning sections
remain usable without a database.

## Operational limits and privacy

- Sessions expire after two hours. The host can close a room earlier.
- Each room holds up to 30 nicknames. Students should avoid real names.
- Scores are accessible only to holders of the room host or member token.
- Only the host session can close a room.
- Random 256-bit bearer tokens are issued per host/student session.
  Only SHA-256 hashes are stored in D1.
- Classroom submissions are executed server-side with a 3,000-step limit
  per test case. Submitted source code is not stored in D1.
- Rate limits protect room creation, joins and submissions. Consider
  additional Cloudflare WAF rules for widespread use.
- Expired room data is deleted when new rooms are created. For heavy use,
  schedule periodic cleanup to avoid retaining expired records.
- Classroom tokens authenticate a browser session, not a person's identity.
- Polling is used instead of paid real-time networking services.

## Checks before merging

    pnpm install --frozen-lockfile
    pnpm check
    pnpm test
    pnpm build

Review desktop/mobile layouts, Catppuccin Mocha/Latte, high-contrast themes,
keyboard controls and reduced-motion preferences. Test real Cloudflare Pages
Function bundling and D1 migration before enabling public classrooms.
