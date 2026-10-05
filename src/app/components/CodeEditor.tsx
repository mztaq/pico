import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { acceptCompletion, autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentLess, indentMore } from '@codemirror/commands';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { bracketMatching, foldGutter, foldKeymap, foldService, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState, type Extension, type Range } from '@codemirror/state';
import { Decoration, drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, hoverTooltip, keymap, lineNumbers, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { completionSource } from './completions';
import { documentationFor, type Suggestion } from '../../runtime/diagnostics';
import type { PicoTheme } from '../themes';
import '../styles/editor-folding.css';
import { pseudoLanguage } from './pseudocodeSyntax';

export interface EditorPreferences { autocomplete: boolean; hoverDocs: boolean; fontSize: number; }
export interface EditorHandle { applySuggestion: (suggestion: Suggestion) => void; focus: () => void; }
interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onFormat: () => void;
  preferences: EditorPreferences;
  theme: PicoTheme;
  coveredLines: number[];
  currentLine?: number;
  errorLine?: number;
}

/** Spaces per nesting level, shared by the indenter, Tab and the indent guides. */
const INDENT_WIDTH = 4;
const INDENT_TEXT = ' '.repeat(INDENT_WIDTH);
/** Matches the editor content padding so guides line up with the first column. */
const CONTENT_PADDING = '12px';

/** Editor chrome and syntax colours for one theme. */
function themeExtensions(theme: PicoTheme): Extension[] {
  const { ui, syntax } = theme;
  const dark = theme.appearance === 'dark';
  const chrome = EditorView.theme({
    '&': { height: '100%', color: theme.text, backgroundColor: theme.bg, fontSize: '14px' },
    '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-code)', lineHeight: '1.9', padding: '6px 0' },
    '.cm-content': { padding: `10px 0 28px`, caretColor: ui.cursor, minHeight: '100%' },
    '.cm-line': { padding: `0 20px 0 ${CONTENT_PADDING}` },
    '.cm-gutters': { backgroundColor: theme.bg, border: 'none', color: ui.gutter, minWidth: '58px', paddingLeft: '10px' },
    '.cm-lineNumbers .cm-gutterElement': { minWidth: '38px', padding: '0 12px 0 4px', textAlign: 'right', fontSize: '0.86em', letterSpacing: '0.2px' },
    '.cm-foldGutter .cm-gutterElement': { color: ui.gutter },
    '.cm-activeLine': { backgroundColor: ui.lineHighlight },
    '.cm-activeLineGutter': { color: ui.gutterActive, backgroundColor: ui.lineHighlight, fontWeight: '600' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: ui.cursor, borderLeftWidth: '2px' },
    '.cm-selectionBackground': { backgroundColor: `${ui.selection} !important` },
    '&.cm-focused .cm-selectionBackground, .cm-content ::selection': { backgroundColor: `${ui.selection} !important` },
    '.cm-selectionMatch': { backgroundColor: ui.accentSoft, borderRadius: '3px' },
    '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': { backgroundColor: ui.matchBracket, outline: `1px solid ${ui.cursor}`, borderRadius: '3px' },
    '.cm-searchMatch': { backgroundColor: ui.accentSoft, outline: `1px solid ${ui.cursor}`, borderRadius: '3px' },
    '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: ui.matchBracket },
    '.cm-panels': { backgroundColor: ui.surfaceRaised, color: theme.text },
    '.cm-panel.cm-search input, .cm-panel.cm-search button': { backgroundColor: ui.surfaceInput, color: theme.text, border: `1px solid ${ui.border}`, borderRadius: '6px' },
    '.cm-tooltip': { border: `1px solid ${ui.tooltipBorder}`, borderRadius: '10px', backgroundColor: ui.tooltipBg, color: theme.text, boxShadow: '0 18px 44px rgba(0,0,0,.4)' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: ui.surfaceHover, color: theme.text, outline: theme.highContrast ? `1px solid ${theme.text}` : 'none', outlineOffset: '-1px' },
    '.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--font-code)', fontSize: '12px' },
    '.cm-completionLabel': { color: syntax.func },
    '.cm-completionDetail': { color: theme.muted, fontStyle: 'normal', marginLeft: '10px' },
  }, { dark });

  const highlight = HighlightStyle.define([
    { tag: tags.controlKeyword, color: syntax.keyword, fontWeight: '600' },
    { tag: tags.keyword, color: syntax.keyword, fontWeight: '600' },
    { tag: tags.typeName, color: syntax.type },
    { tag: tags.variableName, color: syntax.variable },
    { tag: tags.function(tags.variableName), color: syntax.func },
    { tag: tags.standard(tags.variableName), color: syntax.func },
    { tag: tags.labelName, color: syntax.func },
    { tag: tags.number, color: syntax.number },
    { tag: tags.string, color: syntax.string },
    { tag: tags.comment, color: syntax.comment, fontStyle: 'italic' },
    { tag: tags.operator, color: syntax.operator },
    { tag: tags.punctuation, color: syntax.punctuation },
    { tag: tags.bool, color: syntax.bool, fontWeight: '600' },
    { tag: tags.atom, color: syntax.bool },
  ], { themeType: dark ? 'dark' : 'light' });

  return [chrome, syntaxHighlighting(highlight)];
}

function leadingColumns(text: string): number {
  const match = /^[ \t]*/.exec(text);
  if (!match) return 0;
  let columns = 0;
  for (const character of match[0]) columns += character === '\t' ? INDENT_WIDTH : 1;
  return columns;
}

/** VS Code-style vertical indentation guides, one per nesting level on a line. */
function computeGuides(view: EditorView): DecorationSet {
  const step = Math.max(6, view.defaultCharacterWidth * INDENT_WIDTH);
  const ranges: Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) {
    let line = view.state.doc.lineAt(from);
    while (true) {
      const levels = Math.floor(leadingColumns(line.text) / INDENT_WIDTH);
      if (levels > 0) {
        ranges.push(Decoration.line({
          attributes: {
            class: 'pico-guide-line',
            style: `--pico-indent-step:${step.toFixed(2)}px;--pico-indent-levels:${levels}`,
          },
        }).range(line.from));
      }
      if (line.to >= to || line.number >= view.state.doc.lines) break;
      line = view.state.doc.line(line.number + 1);
    }
  }
  return Decoration.set(ranges, true);
}

const indentationGuides = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) { this.decorations = computeGuides(view); }
  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged || update.geometryChanged || update.selectionSet) this.decorations = computeGuides(update.view);
  }
}, { decorations: instance => instance.decorations });

function createPreferences(preferences: EditorPreferences): Extension[] {
  const options: Extension[] = [EditorView.theme({ '.cm-content': { fontSize: `${preferences.fontSize}px` } })];
  if (preferences.autocomplete) {
    options.push(autocompletion({ override: [completionSource], activateOnTyping: true, maxRenderedOptions: 9, defaultKeymap: true }));
  }
  if (preferences.hoverDocs) options.push(hoverDocumentation());
  return options;
}

function hoverDocumentation() {
  return hoverTooltip((view, pos) => {
    const line = view.state.doc.lineAt(pos);
    const offset = pos - line.from;
    let from = offset;
    let to = offset;
    while (from > 0 && /[A-Za-z_]/.test(line.text[from - 1]!)) from -= 1;
    while (to < line.text.length && /[A-Za-z_]/.test(line.text[to]!)) to += 1;
    if (from === to) return null;
    const keyword = line.text.slice(from, to).toUpperCase();
    const description = documentationFor(keyword);
    if (!description) return null;
    return {
      pos: line.from + from,
      end: line.from + to,
      above: true,
      create() {
        const dom = document.createElement('div');
        dom.className = 'pico-doc-tooltip';
        const title = document.createElement('strong');
        title.textContent = keyword;
        const detail = document.createElement('span');
        detail.textContent = description;
        dom.append(title, detail);
        return { dom };
      },
    };
  }, { hoverTime: 420 });
}

export function insertCambridgeNewline(view: EditorView): boolean {
  if (acceptCompletion(view)) return true;
  const head = view.state.selection.main.head;
  const line = view.state.doc.lineAt(head);
  const before = line.text.slice(0, head - line.from);
  const leading = (before.match(/^\s*/) ?? [''])[0].length;
  const trimmed = before.trim().toUpperCase();
  const opens = /^(THEN\b|IF\b.*\bTHEN|WHILE\b.*\bDO|FOR\b.*|REPEAT\b|CASE\s+OF\b|PROCEDURE\b|FUNCTION\b)/.test(trimmed);
  const closes = /^(ELSE\b|OTHERWISE\b|ENDIF\b|ENDWHILE\b|NEXT\b|UNTIL\b|ENDCASE\b|ENDPROCEDURE\b|ENDFUNCTION\b)/.test(trimmed);
  const indent = Math.max(0, leading + (opens ? INDENT_WIDTH : 0) - (closes ? INDENT_WIDTH : 0));
  view.dispatch({ changes: { from: head, insert: `\n${' '.repeat(indent)}` }, selection: { anchor: head + 1 + indent } });
  return true;
}

/** Tab indents a selection, or inserts one nesting level at the cursor. */
export function handleTab(view: EditorView): boolean {
  if (acceptCompletion(view)) return true;
  if (view.state.selection.ranges.some(range => !range.empty)) return indentMore(view);
  view.dispatch(view.state.replaceSelection(INDENT_TEXT), { scrollIntoView: true, userEvent: 'input' });
  return true;
}

const foldPairs: Record<string, string> = { IF: 'ENDIF', WHILE: 'ENDWHILE', FOR: 'NEXT', REPEAT: 'UNTIL', CASE: 'ENDCASE', PROCEDURE: 'ENDPROCEDURE', FUNCTION: 'ENDFUNCTION' };
const foldClosers = new Set(Object.values(foldPairs));
function cambridgeFold(state: EditorState, lineStart: number) {
  const line = state.doc.lineAt(lineStart);
  const opener = /^\s*(IF|WHILE|FOR|REPEAT|CASE\s+OF|PROCEDURE|FUNCTION)\b/i.exec(line.text);
  if (!opener) return null;
  const openerName = opener[1]!.split(/\s+/)[0]!.toUpperCase();
  const closer = foldPairs[openerName];
  if (!closer) return null;
  const stack: string[] = [closer];
  for (let number = line.number + 1; number <= state.doc.lines; number += 1) {
    const candidate = state.doc.line(number);
    const word = /^\s*([A-Za-z]+)/.exec(candidate.text)?.[1]?.toUpperCase();
    if (!word) continue;
    if (foldPairs[word]) stack.push(foldPairs[word]);
    else if (foldClosers.has(word)) {
      if (word === stack.at(-1)) stack.pop();
      if (!stack.length) return { from: line.to, to: candidate.to };
    }
  }
  return null;
}

function goToLine(view: EditorView): boolean {
  const current = view.state.doc.lineAt(view.state.selection.main.head).number;
  const requested = window.prompt('Go to line', String(current));
  if (requested === null) return true;
  const lineNumber = Number.parseInt(requested.trim(), 10);
  if (!Number.isFinite(lineNumber)) return true;
  const line = view.state.doc.line(Math.max(1, Math.min(view.state.doc.lines, lineNumber)));
  view.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: 'center' }) });
  view.focus();
  return true;
}

function buildDecorations(view: EditorView, covered: number[], currentLine?: number, errorLine?: number) {
  const classes = new Map<number, string>();
  for (const line of covered) classes.set(line, 'pico-covered-line');
  if (currentLine) classes.set(currentLine, `${classes.has(currentLine) ? 'pico-covered-line ' : ''}pico-debug-line`);
  if (errorLine) classes.set(errorLine, 'pico-error-line');
  const ranges = [];
  for (const [number, className] of [...classes].sort(([a], [b]) => a - b)) {
    if (number >= 1 && number <= view.state.doc.lines) {
      ranges.push(Decoration.line({ attributes: { class: className } }).range(view.state.doc.line(number).from));
    }
  }
  return Decoration.set(ranges, true);
}

export const CodeEditor = forwardRef<EditorHandle, CodeEditorProps>(function CodeEditor({ value, onChange, onFormat, preferences, theme, coveredLines, currentLine, errorLine }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const prefs = useRef(new Compartment());
  const palette = useRef(new Compartment());
  const marks = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onFormatRef = useRef(onFormat);
  onFormatRef.current = onFormat;

  useImperativeHandle(ref, () => ({
    applySuggestion: suggestion => {
      const editor = view.current;
      if (!editor) return;
      const line = editor.state.doc.line(suggestion.line);
      editor.dispatch({ changes: { from: line.from + suggestion.column - 1, to: line.from + suggestion.endColumn - 1, insert: suggestion.replacement }, selection: { anchor: line.from + suggestion.column - 1 + suggestion.replacement.length } });
      editor.focus();
    },
    focus: () => view.current?.focus(),
  }), []);

  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      doc: value,
      parent: host.current,
      extensions: [
        lineNumbers(), foldGutter(), highlightActiveLineGutter(), highlightActiveLine(), drawSelection(), indentOnInput(), bracketMatching(), closeBrackets(), history(),
        highlightSelectionMatches(), EditorState.tabSize.of(INDENT_WIDTH), indentUnit.of(INDENT_TEXT),
        pseudoLanguage, foldService.of(cambridgeFold), indentationGuides,
        keymap.of([{ key: 'Enter', run: insertCambridgeNewline }, { key: 'Tab', run: handleTab }, { key: 'Shift-Tab', run: indentLess }, { key: 'Mod-g', run: goToLine }, { key: 'Shift-Alt-f', run: () => { onFormatRef.current(); return true; } }, ...foldKeymap, ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        palette.current.of(themeExtensions(theme)),
        prefs.current.of(createPreferences(preferences)),
        marks.current.of(EditorView.decorations.of(v => buildDecorations(v, coveredLines, currentLine, errorLine))),
        EditorView.updateListener.of(update => { if (update.docChanged) onChangeRef.current(update.state.doc.toString()); }),
      ],
    });
    view.current = editor;
    return () => { editor.destroy(); view.current = null; };
    // The view is intentionally mounted once; changing inputs are synchronized by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const editor = view.current;
    if (!editor || editor.state.doc.toString() === value) return;
    const previous = editor.state.doc.toString();
    let from = 0;
    while (from < previous.length && from < value.length && previous[from] === value[from]) from += 1;
    let previousEnd = previous.length;
    let valueEnd = value.length;
    while (previousEnd > from && valueEnd > from && previous[previousEnd - 1] === value[valueEnd - 1]) { previousEnd -= 1; valueEnd -= 1; }
    editor.dispatch({ changes: { from, to: previousEnd, insert: value.slice(from, valueEnd) } });
  }, [value]);
  useEffect(() => { view.current?.dispatch({ effects: prefs.current.reconfigure(createPreferences(preferences)) }); }, [preferences.autocomplete, preferences.hoverDocs, preferences.fontSize]);
  useEffect(() => { view.current?.dispatch({ effects: palette.current.reconfigure(themeExtensions(theme)) }); }, [theme]);
  useEffect(() => { view.current?.dispatch({ effects: marks.current.reconfigure(EditorView.decorations.of(v => buildDecorations(v, coveredLines, currentLine, errorLine))) }); }, [coveredLines, currentLine, errorLine]);

  return <div className="code-editor" ref={host} aria-label="Cambridge pseudocode editor" />;
});
