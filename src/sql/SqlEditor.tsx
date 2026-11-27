import { useEffect, useRef } from 'react';
import { autocompletion, closeBrackets, closeBracketsKeymap, type CompletionContext } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, StreamLanguage } from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, placeholder } from '@codemirror/view';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { tags } from '@lezer/highlight';
import { themeExtensions } from '../app/components/CodeEditor';
import type { PicoTheme } from '../app/themes';
import type { TableInfo } from './engine';
import { quoteIdentifier } from './csv';

const keywords = 'SELECT FROM WHERE AS DISTINCT JOIN INNER LEFT RIGHT FULL CROSS OUTER ON USING GROUP BY HAVING ORDER ASC DESC ASCENDING DESCENDING LIMIT OFFSET UNION ALL INTERSECT EXCEPT WITH RECURSIVE INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE VIEW INDEX DROP ALTER ADD COLUMN IF EXISTS NOT NULL IS IN LIKE BETWEEN AND OR CASE WHEN THEN ELSE END PRIMARY KEY FOREIGN REFERENCES DEFAULT UNIQUE CHECK BEGIN COMMIT ROLLBACK RETURNING PRAGMA EXPLAIN QUERY PLAN OVER PARTITION WINDOW'.split(' ');
const keywordSet = new Set(keywords);
const functions = 'COUNT SUM AVG MIN MAX ROUND LENGTH LOWER UPPER SUBSTR COALESCE NULLIF ABS TRIM REPLACE DATE DATETIME STRFTIME TOTAL GROUP_CONCAT'.split(' ');
const functionSet = new Set(functions);
const types = new Set(['INTEGER','REAL','TEXT','BLOB','NUMERIC','BOOLEAN','DATE','VARCHAR']);
export const sqlLanguage = StreamLanguage.define({
  startState: () => ({ comment: false, quote: '' }),
  tokenTable: { keyword: tags.keyword, number: tags.number, string: tags.string, comment: tags.comment, operator: tags.operator, variable: tags.variableName, type: tags.typeName, fn: tags.function(tags.variableName) },
  token(stream, state) {
    if (state.comment || stream.match('/*')) {
      state.comment = true;
      while (!stream.eol()) { if (stream.match('*/')) { state.comment = false; break; } stream.next(); }
      return 'comment';
    }
    if (state.quote || stream.match(/^['"`]/)) {
      if (!state.quote) state.quote = stream.current();
      const quote = state.quote;
      while (!stream.eol()) {
        if (stream.next() === quote) {
          if (stream.peek() === quote) stream.next();
          else { state.quote = ''; break; }
        }
      }
      return quote === "'" ? 'string' : 'variable';
    }
    if (stream.eatSpace()) return null;
    if (stream.match('--')) { stream.skipToEnd(); return 'comment'; }
    if (stream.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/)) return 'number';
    if (stream.match(/^(?:<>|!=|<=|>=|\|\||[=<>+*/%-])/)) return 'operator';
    if (stream.match(/^[a-z_][\w$]*/i)) {
      const word = stream.current().toUpperCase();
      return types.has(word) ? 'type' : keywordSet.has(word) ? 'keyword' : functionSet.has(word) ? 'fn' : 'variable';
    }
    stream.next(); return null;
  },
  languageData: { commentTokens: { line: '--', block: { open: '/*', close: '*/' } } },
});
interface Props { value: string; onChange: (value: string) => void; onRun: (value: string) => void; theme: PicoTheme; fontSize: number; tables: TableInfo[]; autocomplete: boolean; }
export function SqlEditor(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const palette = useRef(new Compartment());
  const preferences = useRef(new Compartment());
  function completion(context: CompletionContext) {
    const word = context.matchBefore(/[\w$]+/);
    if (!word && !context.explicit) return null;
    const schema = latest.current.tables.flatMap(table => [
      { label: table.name, type: 'class', apply: quoteIdentifier(table.name) },
      ...table.columns.map(column => ({ label: column.name, detail: table.name, type: 'property', apply: quoteIdentifier(column.name) })),
    ]);
    return { from: word?.from ?? context.pos, options: [
      ...keywords.map(label => ({ label, type: 'keyword' })),
      ...functions.map(label => ({ label, type: 'function' })),
      ...schema,
    ] };
  }
  function settings() {
    return [EditorView.theme({ '&': { fontSize: latest.current.fontSize + 'px', '--pico-completion-font-size': Math.max(12, latest.current.fontSize - 1) + 'px' } }),
      ...(latest.current.autocomplete ? [autocompletion({ override: [completion], maxRenderedOptions: 9 })] : [])];
  }
  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({ parent: host.current, state: EditorState.create({ doc: latest.current.value, extensions: [
      sqlLanguage, lineNumbers(), highlightActiveLine(), highlightActiveLineGutter(), drawSelection(), history(),
      bracketMatching(), closeBrackets(), highlightSelectionMatches(),
      placeholder('Enter a SQL query…'), EditorView.contentAttributes.of({ 'aria-label': 'SQL query', spellcheck: 'false' }),
      keymap.of([{ key: 'Mod-Enter', run: editor => { latest.current.onRun(editor.state.doc.toString()); return true; } }, ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
      palette.current.of(themeExtensions(latest.current.theme)), preferences.current.of(settings()),
      EditorView.updateListener.of(update => { if (update.docChanged) latest.current.onChange(update.state.doc.toString()); }),
    ] }) });
    view.current = editor;
    return () => { editor.destroy(); view.current = null; };
  }, []);
  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== props.value) editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: props.value } });
  }, [props.value]);
  useEffect(() => { view.current?.dispatch({ effects: palette.current.reconfigure(themeExtensions(props.theme)) }); }, [props.theme]);
  useEffect(() => { view.current?.dispatch({ effects: preferences.current.reconfigure(settings()) }); }, [props.fontSize, props.autocomplete]);
  return <div className="code-editor sql-code-editor" ref={host} />;
}
