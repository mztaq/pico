// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SqlWorkspace } from './SqlWorkspace';

vi.mock('./engine', async importOriginal => {
  const actual = await importOriginal<typeof import('./engine')>();
  return {
    ...actual,
    createDatabase: async () => ({ export: () => new Uint8Array(), close: () => {}, exec: () => [] }),
    sampleRows: () => ({ columns: ['StudentID'], rows: [[1]], changes: 0, kind: 'select', explanation: '', cues: [] }),
  };
});
vi.mock('./SqlEditor', async () => {
  const React = await import('react');
  const SqlEditor = React.forwardRef<{ replace: (text: string) => void; replaceRange: () => void; focus: () => void }, { value: string; onChange: (text: string) => void }>(function MockEditor({ value, onChange }, ref) {
    const [text, setText] = React.useState(value);
    React.useImperativeHandle(ref, () => ({ replace: next => { setText(next); onChange(next); }, replaceRange: () => {}, focus: () => {} }));
    return <textarea aria-label="SQL editor" value={text} readOnly />;
  });
  return { SqlEditor };
});

let root: Root;
let container: HTMLDivElement;
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<SqlWorkspace onHome={() => {}} />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function click(selector: string) {
  const button = container.querySelector<HTMLButtonElement>(selector);
  expect(button).not.toBeNull();
  await act(async () => button!.click());
}

it('inspects table and column without changing SQL; Try query is explicit', async () => {
  const editor = container.querySelector<HTMLTextAreaElement>('[aria-label="SQL editor"]')!;
  const original = editor.value;
  await click('.sql-table-card:nth-of-type(2) .sql-table-heading');
  expect(editor.value).toBe(original);
  await click('.sql-table-card:nth-of-type(2) .sql-column-select');
  expect(editor.value).toBe(original);
  await click('.sql-table-card:nth-of-type(2) .sql-browser-preview button');
  expect(editor.value).toBe('SELECT * FROM Clubs;');
});
