// @vitest-environment jsdom
import { autocompletion, closeCompletion, completionStatus, startCompletion } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { handleTab, insertCambridgeNewline } from './CodeEditor';
import { completionSource } from './completions';

let view: EditorView | undefined;
afterEach(() => { view?.destroy(); view = undefined; });
function editor(autocomplete = true) {
  const doc = 'DECLARE StudentName : STRING\nOUTPUT Stud';
  view = new EditorView({ state: EditorState.create({ doc, selection: { anchor: doc.length },
    extensions: autocomplete ? [autocompletion({ override: [completionSource], interactionDelay: 0 })] : [],
  }) });
  return view;
}

describe('completion acceptance and indentation', () => {
  it.each([['Tab', handleTab], ['Enter', insertCambridgeNewline]] as const)('accepts a declared name with %s instead of inserting whitespace', async (_key, run) => {
    const editorView = editor();
    startCompletion(editorView);
    await new Promise(resolve => setTimeout(resolve, 70));
    expect(completionStatus(editorView.state)).toBe('active');
    run(editorView);
    expect(editorView.state.doc.toString()).toBe('DECLARE StudentName : STRING\nOUTPUT StudentName');
    expect(completionStatus(editorView.state)).toBeNull();
  });

  it('preserves normal Tab and Enter behavior when autocomplete is disabled', () => {
    const editorView = editor(false);
    handleTab(editorView);
    expect(editorView.state.doc.toString()).toMatch(/OUTPUT Stud {4}$/);
    insertCambridgeNewline(editorView);
    expect(editorView.state.doc.toString()).toMatch(/Stud {4}\n$/);
  });

  it('allows dismissal before inserting a normal newline', async () => {
    const editorView = editor();
    startCompletion(editorView);
    await new Promise(resolve => setTimeout(resolve, 70));
    closeCompletion(editorView);
    insertCambridgeNewline(editorView);
    expect(editorView.state.doc.toString()).toBe('DECLARE StudentName : STRING\nOUTPUT Stud\n');
  });
});
