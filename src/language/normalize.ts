/** Normalize assignment arrows outside text and comments only. */
export function normalizeSource(source: string): string {
  return source
    .split('\n')
    .map((line) => {
      let result = '';
      let quote = '';
      let escaped = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]!;
        if (quote) {
          result += ch;
          if (!escaped && ch === quote) quote = '';
          escaped = !escaped && ch === '\\';
        } else if (line.startsWith('//', i)) {
          result += line.slice(i);
          break;
        } else if (ch === '"' || ch === "'") {
          quote = ch;
          result += ch;
        } else if (ch === '“') {
          // Curly delimiters are accepted without rewriting the string's contents.
          result += '"';
          for (i++; i < line.length && line[i] !== '”'; i++) result += line[i];
          if (i < line.length) result += '"';
        } else if (line.startsWith('<--', i)) {
          result += '←';
          i += 2;
        } else result += ch;
      }
      return result;
    })
    .join('\n');
}
