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

## Input needs context

This input can be inferred as BOOLEAN:

```text
INPUT Ready
IF Ready THEN
    OUTPUT "Ready"
ENDIF
```

INTEGER-only contexts also provide enough information: `DIV`, `MOD`, array indexes, FOR bounds and INTEGER routine arguments. A known assignment or a suitable condition can establish REAL, STRING or CHAR as well.

`INPUT Value` alone has no type information. `Value * 2` allows either INTEGER or REAL, and `LENGTH(Value)` accepts either CHAR or STRING. Auto-declare leaves such ambiguity unresolved and the compiler asks for an explicit declaration. It does not guess a type from the variable name or a value entered at runtime. Type inference does not prove that a variable has been initialized on every execution path.

## Scope and editing

Inferred declarations are inserted at the start of the program or inside the relevant routine. Existing parameters, local declarations and nested block declarations retain their lexical scope. FOR counters are already introduced by Pico and do not need an extra generated declaration.

The editor records which declarations it generated. Those types are recalculated when the program changes; manual declarations are preserved. Changing a generated declaration's type manually relinquishes its tracking. If an edit introduces conflicting types, an existing generated declaration is retained so the normal compiler can report the mismatch. New variables with no consistent type are left for explicit declaration.

Inference runs only when the source parses completely. An unfinished expression, string or block is left untouched until it is complete. Comments and newline style are preserved.

## Arrays

Pico requires explicit ARRAY bounds. Accessing `Items[1]` does not establish the intended lower or upper bound, so Auto-declare does not invent an ARRAY declaration. Declare its shape and element type, then ordinary variables assigned from its elements can be inferred:

```text
DECLARE Items : ARRAY[1:10] OF STRING
Items[1] ← "Hello"
First ← Items[1]
```

Here `First` is inferred as STRING. The ARRAY declaration remains unchanged.
