# Pico — Cambridge Programming Booklet Gap Review

**Review date:** 4 October 2026  
**Source:** User-supplied `UnsolvedCopyofIGCSE_Programming_Student_Booklet.docx` (92 pages; examinations 2026–2028).  
**Project checked:** `/home/ubuntu/pico`  
**Text extraction used:** `/tmp/text_editor_extracts/UnsolvedCopyofIGCSE_Programming_Student_Booklet-cbfb24c174db-p1-92.txt`

> This review records gaps for the next requested code update. It does not change Pico's application code.

## Summary

Pico currently works as a focused Cambridge-pseudocode editor/runtime, but **it does not yet cover the complete Topic 8 booklet**. The booklet's syllabus map covers programming concepts, selection and all three loop styles, string routines, procedures/functions/scope, library routines, one- and two-dimensional arrays, and file handling (booklet pp. 5–6). The largest gaps are the unsupported language constructs and several valid Cambridge forms that the current parser rejects.

## Already implemented in Pico

- Declarations for one variable per line using `INTEGER`, `REAL`, `CHAR`, `STRING`, or `BOOLEAN`; named constants; assignments; `INPUT`; and `OUTPUT`.
- Arithmetic, comparisons, `AND`/`OR`/`NOT`, Boolean literals, comments, and `DIV`/`MOD` in the supported expression forms.
- `IF`/`ELSE`/`ENDIF`, `WHILE`/`ENDWHILE`, and inclusive `FOR`/`NEXT` loops with optional `STEP`, including negative steps.
- `LENGTH`, `UPPER`, `LOWER`, and `ROUND`; string concatenation; typed input conversion; helpful parse/runtime errors.
- Live tokens/AST, test cases, output, trace debugger, executed-line coverage, a basic flowchart, six introductory examples, and browser-local project/settings persistence.

These features were checked against the current lexer, parser, interpreter, example programs, and UI components. The project previously passed its TypeScript/build checks and 14 interpreter tests.

## Confirmed language and syllabus gaps

### 1. Valid Cambridge formatting is rejected

- **`THEN` on the next line:** Pico's parser currently insists that `THEN` appears on the same line as `IF`. The booklet's nested-selection example places it on the following line (lesson 7, booklet p. 39), and its control-structure reference does the same (p. 88). The supplied `IF Age < 12` / next-line `THEN` example therefore fails before it can run. Support the booklet's form; retaining same-line `THEN` as an accepted equivalent is also reasonable.
- **`DO` after `WHILE`:** Booklet examples/reference use `WHILE condition DO` (lesson 9, p. 46; reference p. 88). Pico currently expects the line to end immediately after the condition and does not accept `DO`.
- **Multiple names in `DECLARE`:** Pico expects one identifier followed by `:`. The booklet explicitly uses `DECLARE Index, Score, Total, PassCount : INTEGER` (lesson 11, p. 52) and `DECLARE Score, SavedScore : INTEGER` (p. 89). Consequently, the user's comma-separated declaration is valid for this booklet but rejected by Pico.

### 2. Selection and iteration constructs are missing

- **`CASE OF … OTHERWISE … ENDCASE`** is absent, including the single-value branches shown in lesson 7 (booklet pp. 38–41). The lexer/parser currently have no `CASE`, `OF`, `OTHERWISE`, or `ENDCASE` implementation.
- **`REPEAT … UNTIL condition`** is absent. The booklet teaches this post-condition loop and uses it for validation (lesson 10, pp. 49–51; reference p. 88). Pico only implements pre-condition `WHILE` and count-controlled `FOR` loops.

### 3. String and library routines do not match the booklet

- The booklet uses **`SUBSTRING(Text, Start, Length)`** with 1-based positions, **`UCASE(Text)`**, and **`LCASE(Text)`** (lesson 12, pp. 55–57; reference p. 89). Pico has no `SUBSTRING`; it offers `UPPER`/`LOWER` instead of the booklet's `UCASE`/`LCASE` names.
- **`RANDOM()`** is missing. The booklet specifies a real result in the inclusive range 0 to 1 and uses it in examples (lesson 17, p. 70 onward).
- The editor's completions and hover reference must be expanded along with any of these language features; adding parser support alone would leave the learning aids inconsistent.

### 4. Procedures, functions, parameters, and scope are missing

- No procedure definitions/calls (`PROCEDURE`, `ENDPROCEDURE`, `CALL`), typed parameters, or zero-to-three-parameter support (lesson 14, pp. 61–63).
- No function definitions (`FUNCTION … RETURNS … ENDFUNCTION`), returned values, or user-defined function calls in expressions (lesson 15, pp. 64–66). Pico currently explicitly reports `RETURN` as unsupported outside routines.
- No local/global scope or separate routine environments, including the local-variable behavior and shadowing discussed in lesson 16 (pp. 67–69).

### 5. Arrays are not supported

- No one-dimensional or two-dimensional declarations/access, such as `DECLARE Marks : ARRAY[1:5] OF INTEGER` or `DECLARE Grid : ARRAY[1:2,1:3] OF INTEGER` (lessons 19–20, pp. 76–80; reference p. 89).
- The lexer rejects `[` and `]`; the AST, parser, and runtime lack array values and indexed reads/writes. The booklet expects 1-based indexing in its examples, with a zero-or-one first index allowed by the syllabus map (p. 6).
- Nested-loop traversal itself is already possible, but it cannot yet read or write the booklet's array elements.

### 6. File handling is not supported

- The booklet's `OPENFILE "…" FOR READ/WRITE`, `READFILE`, `WRITEFILE`, and `CLOSEFILE` operations are absent (lesson 21, pp. 82–84; reference p. 89).
- Pico is browser-only, so implementing this needs an explicit client-side storage model (for example, project-scoped virtual text files with clear persistence/import/export behavior); it cannot silently assume unrestricted access to the user's computer filesystem.

## Other fidelity points to address during a full-scope update

- The current lexer accepts `<-` and `!=` alongside Cambridge's `←` and `<>`. The booklet's Cambridge reference distinguishes `<>` from Python's `!=` (p. 4). To keep Pico strictly Cambridge-focused, avoid presenting Python-only alternatives as Cambridge pseudocode.
- The runtime stores variable declarations' types but does not enforce those types on subsequent assignments. Consider clear type diagnostics consistent with the booklet's typed variables, while preserving its valid examples.
- The existing output evaluator joins `OUTPUT` expressions with a space. Confirm that formatting against labelled outputs like `OUTPUT "Score ", Score` and the booklet's expected examples so embedded spaces are not doubled.
- The interpreter, trace labels, line coverage, flowchart, examples, quick-reference terms, and tests all need to understand any new AST nodes; this is a cross-cutting language/runtime/UI change, not only a syntax-keyword addition.
- Conceptual material—such as meaningful names, accurate comments, sentinel handling, totals versus counters, boundary tests, and avoiding division by zero—is not all a parser feature. It can be supported through targeted examples, tests, reference notes, and diagnostics rather than inventing extra syntax (booklet pp. 5–6, 52–54, 73–75).

## Explicitly queued requests for the next code update

1. Correct Cambridge syntax issues, starting with next-line `THEN`, `WHILE … DO`, and comma-separated declarations.
2. Expand coverage toward the constructs in the booklet: `CASE`, `REPEAT UNTIL`, the documented string/library routines, procedures/functions/scope, arrays, and file handling.
3. **Make the workspace customizable:** allow the user to resize fields/panels, move or rearrange them, and choose where items such as **Standard Input** appear; remember the layout in browser-local preferences and provide a way to restore a default layout. Keep the controls usable at narrow/mobile widths.
4. Do not invent a separate language: use the Cambridge forms and examples in this booklet as the source of truth; keep the expanded lexer, autocomplete, hover docs, error messages, AST/token viewers, debugger, coverage, flowchart, tests, and examples in sync.

## Booklet evidence consulted

- Syllabus map and pseudocode reference: booklet pp. 4–6.
- `CASE`, nested `IF`, and next-line `THEN`: lesson 7, pp. 38–42.
- `FOR`/`NEXT`, `WHILE … DO`, and `REPEAT … UNTIL`: lessons 8–10, pp. 43–51; control reference p. 88.
- String routines: lesson 12, pp. 55–57.
- Procedures, functions, local/global scope: lessons 14–16, pp. 61–69.
- `RANDOM` and other library routines: lesson 17, p. 70 onward.
- 1D/2D arrays: lessons 19–20, pp. 76–80.
- File operations: lesson 21, pp. 82–84; consolidation scenario pp. 85–87; arrays/files reference p. 89.
