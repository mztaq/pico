import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { autocompletion, completeFromList } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { HighlightStyle, bracketMatching, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { lintGutter, setDiagnostics, type Diagnostic } from '@codemirror/lint';
import { sql } from '@codemirror/lang-sql';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLine, hoverTooltip, keymap, lineNumbers, placeholder } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import type { PicoTheme } from '../app/themes';
import { completionItems, helpForWord } from './editorHelp';

export interface SqlEditorOptions { autocomplete: boolean; hoverDocs: boolean; fixSuggestions: boolean }
export interface SqlEditorHandle { replace: (text: string) => void; replaceRange: (from: number, to: number, text: string) => void; focus: () => void }
interface Props { value: string; onChange: (text: string) => void; onRun: () => void; theme: PicoTheme; options: SqlEditorOptions; diagnostic: Diagnostic | null }

function hoverDocumentation() {
  return hoverTooltip((view, position) => {
    const line = view.state.doc.lineAt(position);
    const offset = position - line.from;
    let from = offset; let to = offset;
    while (from > 0 && /[\w]/.test(line.text[from - 1]!)) from--;
    while (to < line.text.length && /[\w]/.test(line.text[to]!)) to++;
    if (from === to) return null;
    const help = helpForWord(line.text.slice(from, to));
    if (!help) return null;
    return { pos: line.from + from, end: line.from + to, above: true, create: () => {
      const dom = document.createElement('div'); dom.className = 'sql-hover-doc';
      const title = document.createElement('strong'); title.textContent = help.title;
      const description = document.createElement('p'); description.textContent = help.description;
      dom.append(title, description);
      if (help.example) { const example = document.createElement('code'); example.textContent = help.example; dom.append(example); }
      return { dom };
    } };
  }, { hoverTime: 450 });
}

function optionExtensions(options: SqlEditorOptions): Extension[] {
  const extensions: Extension[] = [];
  if (options.autocomplete) extensions.push(autocompletion({ override: [completeFromList(completionItems())], activateOnTyping: true, maxRenderedOptions: 8 }));
  if (options.hoverDocs) extensions.push(hoverDocumentation());
  return extensions;
}

function colourExtensions(theme: PicoTheme): Extension[] {
  const { syntax, ui } = theme;
  return [
    EditorView.theme({
      '&': { height: '100%', color: theme.text, backgroundColor: theme.bg },
      '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-code)', fontSize: '15px', lineHeight: '1.7' },
      '.cm-content': { padding: '17px 12px 36px', caretColor: theme.accent, minHeight: '100%' },
      '.cm-line': { paddingLeft: '8px' },
      '.cm-gutters': { backgroundColor: theme.bg, borderRight: `1px solid ${ui.borderSoft}`, color: ui.gutter, minWidth: '47px' },
      '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 5px', minWidth: '30px', textAlign: 'right' },
      '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: ui.lineHighlight },
      '.cm-cursor': { borderLeftColor: theme.accent, borderLeftWidth: '2px' },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: `${ui.selection} !important` },
      '.cm-tooltip': { backgroundColor: ui.tooltipBg, border: `1px solid ${ui.tooltipBorder}`, color: theme.text, borderRadius: '9px', boxShadow: '0 12px 34px #0005' },
      '.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--font-code)', fontSize: '12px', maxHeight: '260px' },
      '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: ui.accentSoft, color: theme.text },
      '.cm-completionDetail': { color: theme.muted, fontStyle: 'normal', marginLeft: '12px' },
      '.cm-diagnostic': { color: theme.text, backgroundColor: ui.surfaceRaised },
      '.cm-diagnostic-error': { borderLeftColor: 'var(--red)' },
    }, { dark: theme.appearance === 'dark' }),
    syntaxHighlighting(HighlightStyle.define([
      { tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword], color: syntax.keyword, fontWeight: '650' },
      { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: syntax.func },
      { tag: [tags.variableName, tags.propertyName, tags.attributeName], color: syntax.variable },
      { tag: tags.typeName, color: syntax.type },
      { tag: tags.number, color: syntax.number },
      { tag: tags.string, color: syntax.string },
      { tag: tags.comment, color: syntax.comment, fontStyle: 'italic' },
      { tag: tags.operator, color: syntax.operator },
      { tag: tags.punctuation, color: syntax.punctuation },
      { tag: tags.bool, color: syntax.bool },
    ], { themeType: theme.appearance === 'dark' ? 'dark' : 'light' })),
  ];
}

export const SqlEditor = forwardRef<SqlEditorHandle, Props>(function SqlEditor({ value, onChange, onRun, theme, options, diagnostic }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  const onRunRef = useRef(onRun); onRunRef.current = onRun;
  const optionsRef = useRef(options); optionsRef.current = options;
  const optionCompartment = useRef(new Compartment());
  useImperativeHandle(ref, () => ({
    replace: text => { const view = editor.current; if (!view) return; view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, selection: { anchor: text.length } }); view.focus(); },
    replaceRange: (from, to, text) => { const view = editor.current; if (!view) return; view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } }); view.focus(); },
    focus: () => editor.current?.focus(),
  }), []);
  useEffect(() => {
    if (!host.current) return;
    host.current.dataset.picoCodeEmpty = value.length === 0 ? 'true' : 'false';
    const view = new EditorView({ parent: host.current, state: EditorState.create({ doc: value, extensions: [
      lineNumbers(), history(), sql(), bracketMatching(), indentOnInput(), indentUnit.of('  '), drawSelection(), highlightActiveLine(), lintGutter(),
      placeholder('Write a SELECT query, or choose an example…'), EditorView.lineWrapping,
      EditorView.contentAttributes.of({ 'aria-label': 'SQL editor', 'aria-describedby': 'sql-editor-help' }),
      keymap.of([{ key: 'Mod-Enter', run: () => { onRunRef.current(); return true; } }, ...defaultKeymap, ...historyKeymap]),
      optionCompartment.current.of(optionExtensions(optionsRef.current)), ...colourExtensions(theme),
      EditorView.updateListener.of(update => { if (update.docChanged) { if (host.current) host.current.dataset.picoCodeEmpty = update.state.doc.length === 0 ? 'true' : 'false'; onChangeRef.current(update.state.doc.toString()); } }),
    ] }) });
    editor.current = view;
    return () => { view.destroy(); editor.current = null; };
  }, [theme.id]);
  useEffect(() => { const view = editor.current; if (view) view.dispatch({ effects: optionCompartment.current.reconfigure(optionExtensions(options)) }); }, [options]);
  useEffect(() => { const view = editor.current; if (view) view.dispatch(setDiagnostics(view.state, diagnostic ? [diagnostic] : [])); }, [diagnostic]);
  return <div className="sql-editor" ref={host} />;
});
