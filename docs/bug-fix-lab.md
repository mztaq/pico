# Adding bug-fixing challenges

Edit **`src/bugfix/bugs.json`**. This file is the source for every challenge in Bug Fix Lab. Add an object to its `challenges` array; no React or TypeScript edits are needed. The home card, challenge list, and progress total adapt automatically after rebuilding.

Copy an existing challenge, or use this example:

```json
{
  "id": "double-a-number",
  "title": "Double trouble",
  "topic": "Arithmetic",
  "difficulty": "Easy",
  "brief": "Read an integer and print twice its value. The current code adds two instead.",
  "hints": ["Doubling means multiplying by two."],
  "starter": "DECLARE Number : INTEGER\nINPUT Number\nOUTPUT Number + 2",
  "solution": "DECLARE Number : INTEGER\nINPUT Number\nOUTPUT Number * 2",
  "explanation": "Multiplication doubles any input; adding two only happens to work when the input is two.",
  "tests": [
    { "name": "Positive value", "inputs": ["3"], "expected": ["6"] },
    { "name": "Negative value", "inputs": ["-4"], "expected": ["-8"] }
  ]
}
```

- Use a unique lowercase slug for `id`. Keep it stable: saved code and completion badges belong to that ID. Give a replacement exercise a new ID.
- `difficulty` can be `Easy`, `Medium`, or `Hard`.
- Separate code lines with `\n`. Escape quotes inside JSON strings with `\"`. Do not add comments or trailing commas.
- `inputs` are strings supplied to successive `INPUT` statements. `expected` contains the exact output lines, also as strings. An empty output is `[]`; one blank line is `[""]`.
- Add at least one test. Include boundary or negative cases where useful. Checks run with a 2,000-instruction limit per case, so keep solutions small.
- `starter` should fail at least one case (a syntax error also counts); `solution` must compile and pass every case. Solutions are reference content for validation, not secret answers.
- `hints` is required but may be `[]`. Supply hints in the order they should be revealed.

`bugs.schema.json` provides editor assistance. Runtime validation names malformed fields, and the challenge tests verify the actual interpreter behavior.

Run `pnpm test -- src/bugfix` and `pnpm build`, then open `/app/bugfix`. Commit and push your JSON changes to update the preview. Editing this source file requires rebuilding; it is not a live database.

## Guided solution helper

“Walk me through it” executes the student's current code and `solution` against the same test inputs. It selects the first failing case, animates real execution snapshots, compares final output and reveals the reference answer. `explanation` supplies the teaching text; line differences are computed automatically and are labeled as differences rather than guaranteed errors. No extra JSON fields are needed. Keep explanations specific about the bug and its effect on output. Students can pause, step, replay, switch sources or apply the reference fix; they must still run checks to earn completion. With reduced motion enabled, playback advances one step per click.
