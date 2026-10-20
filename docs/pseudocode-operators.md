# Arithmetic and text output

Reference: [Cambridge IGCSE Computer Science 0478, 2026–2028 syllabus, version 6](https://www.cambridgeinternational.org/Images/697167-2026-2028-syllabus.pdf), section 4, Pseudocode. Page references below use the printed page numbers.

- Page 36, Basic data types and Literals (8.1.2): integers are whole numbers, and double-quoted literals are strings. Thus `3` and `"3"` have different types.
- Page 39, Arithmetic operations (8.1.4(f)): `+` denotes arithmetic addition. Page 40 describes arithmetic precedence.
- Page 39, Input and output (8.1.3): several values are output using commas. Its example combines text with a numeric variable in one OUTPUT statement.
- Page 41, String operations (8.1.4(e)): `LENGTH`, `LCASE`, `UCASE` and `SUBSTRING` are documented. These continue to work.

The guide does **not** specify implicit number-to-string conversion for `+`, a string concatenation operator, or the exact error behaviour of mixed-type addition. It is an examination notation, not a complete executable language specification. Pico must choose an explicit execution policy for that gap.

## Pico policy

`+` accepts INTEGER and REAL operands only. A numeric value plus a STRING, CHAR or BOOLEAN is rejected by the existing semantic type checker. The interpreter also rejects nonnumeric operands when supplied an AST directly, using its normal positioned `RuntimeError`. This rejection is a **Pico policy**, not a Cambridge-mandated runtime error. All-string `+` concatenation is also unsupported. No new concatenation operator is introduced.

Previously, Pico's type checker treated `+` involving text as STRING and the interpreter formatted both operands as text. With `Name = 3`, `Name2 = 4` and `TIME = "4"`, `Name + Name2 + TIME` therefore produced `"74"`: numeric addition first, then an undocumented implicit conversion. That extension has been removed.

Use commas to combine values for display:

```text
CONSTANT Name <- 3
CONSTANT Name2 <- 4
CONSTANT TIME <- "4"
OUTPUT Name + Name2        // 7
OUTPUT TIME                // 4 (the string is unchanged)
OUTPUT Name + Name2, TIME   // 74 (two separately evaluated output values)
OUTPUT "Hello", " ", "world"
```

Comma-separated OUTPUT evaluates each expression before formatting its value and joining the display text. It does not add the values or create a string expression usable in assignments. Existing output spacing, newline behaviour, constant parsing and expression precedence are unchanged. Older programs using text with `+` must replace that use with comma-separated OUTPUT where display is intended.
