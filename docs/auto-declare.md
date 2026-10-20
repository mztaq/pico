# Auto-declare type inference

Auto-declare is an optional Pico editor convenience, enabled in Settings. It inserts ordinary `DECLARE` statements; it is not a Cambridge requirement or a dynamically typed execution mode. Turning it off leaves the compiler's declaration and type checks in place.

## Supported inference

| Code | Inferred declaration |
| --- | --- |
| `Count ← 3` | `INTEGER` |
| `Price ← 3.0` | `REAL` (the decimal spelling matters) |
| `Name ← "3"` | `STRING` |
| `Letter ← 'A'` | `CHAR` |
| `Ready ← TRUE` | `BOOLEAN` |
| `Average ← Total / Count` | `REAL`, when both operands are known numeric values |
| `Capital ← UCASE('a')` | `CHAR` |
| `Part ← SUBSTRING("Hello", 1, 2)` | `STRING` |

Inference follows dependencies through variables, constants, expressions, built-in operations and typed functions. It considers every assignment in the source, including branches. INTEGER and REAL assignments can share a REAL variable; CHAR and STRING assignments can share a STRING variable. Numeric and text assignments do not acquire an implicit conversion. Arithmetic `+` stays numeric, following [Pico's operator policy](pseudocode-operators.md).

The inference engine and compiler share literal, operator, assignment and library result type rules. In particular, `3.0` remains REAL in constant expressions and cannot be used with INTEGER-only operations such as `DIV` without an appropriate conversion. Output formatting is unchanged: displaying the numeric value `3.0` can still produce `3`.

## Input types from code or entered values

Code constraints take priority. This input is inferred as BOOLEAN before execution:

```text
INPUT Ready
IF Ready THEN
    OUTPUT "Ready"
ENDIF
```

INTEGER-only contexts such as `DIV`, `MOD`, array indexes, FOR bounds and INTEGER routine arguments also establish a clear type. Known assignments, conditions and typed routines establish the other types where unambiguous.

When the code does not establish one type, Auto-declare leaves the source without an invented type declaration and detects the type when the input arrives:

```text
INPUT Name
OUTPUT "Your name is ", Name
```

The name `Name` and the output message play no role. The same code works with any valid identifier. During input the console says that the type is detected automatically.

| Entered value | Detected type |
| --- | --- |
| `5`, `-3`, `003` | INTEGER |
| `5.0`, `-2.75` | REAL |
| `TRUE`, `FALSE` (case insensitive) | BOOLEAN |
| `Alex`, `A`, empty input | STRING |

The first accepted value fixes the variable's type for that run. Later inputs must match it. Each new run and routine invocation starts fresh. Types propagate through copies and constants, including the distinction between INTEGER `5` and REAL `5.0`. A single letter remains STRING unless the code establishes CHAR, since a one-character string and a character cannot be distinguished from raw input alone.

Constraints still apply to deferred input. For `Value * 2`, either INTEGER or REAL is accepted and text terminates execution. `LENGTH(Value)` establishes a text-only context, so `123` is read as the string `123`. Manually declared types and types established by code retain their original checks: REAL input still requires a decimal, INTEGER rejects text, and an invalid value stops the program rather than asking again. Declare STRING explicitly when values such as `003` or `TRUE` must remain text regardless of their appearance.

This runtime detection is an optional **Pico extension**, not an official Cambridge rule. It adds no new pseudocode data type or keyword. The internal compiler API opts into it with `compile(source, { autoDeclare: true })`; ordinary `compile(source)` remains strict. Unknown output-only identifiers, typos, conflicting assignments and missing ARRAY bounds still produce errors. Inference does not prove that variables are initialized on every execution path.

## Scope and editing

Inferred declarations are inserted at the start of the program or inside the relevant routine. Existing parameters, local declarations and nested block declarations retain their lexical scope. FOR counters are already introduced by Pico and do not need an extra generated declaration.

The editor records which declarations it generated. Those types are recalculated when the program changes; manual declarations are preserved. Changing a generated declaration's type manually relinquishes its tracking. If an edit leaves a generated declaration attached only to unresolved input, that generated declaration is removed so runtime detection applies. If an edit introduces conflicting types, the existing generated declaration is retained so the normal compiler can report the mismatch. New variables with no consistent type are left for explicit declaration.

Inference runs only when the source parses completely. An unfinished expression, string or block is left untouched until it is complete. Comments and newline style are preserved.

## Arrays

Pico requires explicit ARRAY bounds. Accessing `Items[1]` does not establish the intended lower or upper bound, so Auto-declare does not invent an ARRAY declaration. Declare its shape and element type, then ordinary variables assigned from its elements can be inferred:

```text
DECLARE Items : ARRAY[1:10] OF STRING
Items[1] ← "Hello"
First ← Items[1]
```

Here `First` is inferred as STRING. The ARRAY declaration remains unchanged.
