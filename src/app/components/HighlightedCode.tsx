import { useMemo } from 'react';
import { highlightTree, tagHighlighter, tags } from '@lezer/highlight';
import { pseudoLanguage } from './pseudocodeSyntax';

const referenceHighlighter = tagHighlighter([
  { tag: tags.keyword, class: 'syntax-keyword' },
  { tag: tags.typeName, class: 'syntax-type' },
  { tag: tags.variableName, class: 'syntax-variable' },
  { tag: [tags.function(tags.variableName), tags.standard(tags.variableName)], class: 'syntax-function' },
  { tag: tags.number, class: 'syntax-number' },
  { tag: tags.string, class: 'syntax-string' },
  { tag: tags.comment, class: 'syntax-comment' },
  { tag: tags.operator, class: 'syntax-operator' },
  { tag: tags.punctuation, class: 'syntax-punctuation' },
  { tag: tags.bool, class: 'syntax-bool' },
]);

interface CodePart { text: string; className?: string; }

/** Reuse the editor tokenizer and preserve every character for selection/copy. */
export function highlightPseudocode(code: string): CodePart[] {
  const parts: CodePart[] = [];
  let position = 0;
  highlightTree(pseudoLanguage.parser.parse(code), referenceHighlighter, (from, to, className) => {
    if (from > position) parts.push({ text: code.slice(position, from) });
    parts.push({ text: code.slice(from, to), className });
    position = to;
  });
  if (position < code.length) parts.push({ text: code.slice(position) });
  return parts;
}

export function HighlightedCode({ code }: { code: string }) {
  const parts = useMemo(() => highlightPseudocode(code), [code]);
  return <code className="highlighted-code">{parts.map((part, index) =>
    part.className ? <span className={part.className} key={index}>{part.text}</span> : part.text,
  )}</code>;
}
