// @vitest-environment jsdom
import { autocompletion, closeCompletion, completionStatus, startCompletion } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { vi } from 'vitest';
import { CodeEditor, handleTab, insertCambridgeNewline } from './CodeEditor';
import { defaultSettings } from '../../storage/settings';
import { getTheme } from '../themes';
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
  it('applies the default and chosen text sizes to the editor and its gutter', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    try {
      for (const fontSize of [defaultSettings.fontSize, 19]) {
        await act(async () => root.render(<CodeEditor value="OUTPUT 1" onChange={() => {}} preferences={{...defaultSettings,fontSize}} theme={getTheme(defaultSettings.theme)} />));
        expect(getComputedStyle(host.querySelector('.cm-editor')!).fontSize).toBe(`${fontSize}px`);
        expect(host.querySelector('.cm-content')?.getAttribute('style') ?? '').not.toContain('font-size');
        expect(host.querySelector('.cm-lineNumbers')).not.toBeNull();
      }
    } finally {
      await act(async () => root.unmount());
      host.remove();
      vi.unstubAllGlobals();
    }
  });
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
