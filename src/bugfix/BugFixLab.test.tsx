// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BugFixLab } from './BugFixLab';
import { challenges } from './challenges';
import { loadProgress } from './progress';
import type { WorkerRequest, ExecutionReply } from '../runtime/worker';
const jobs = vi.hoisted(() => [] as { resolve: (replies: ExecutionReply[]) => void; cancel: ReturnType<typeof vi.fn>; request: WorkerRequest }[]);
const cue = vi.hoisted(() => vi.fn());
vi.mock('../app/sound', () => ({ playCue: cue, soundEnabled: () => true, onSoundChange: () => () => {}, setSoundEnabled: vi.fn() }));
vi.mock('../app/components/CodeEditor', () => ({ CodeEditor: ({ value, onChange }: { value: string; onChange: (code: string) => void }) => <textarea aria-label="Challenge code" value={value} onChange={event => onChange(event.target.value)} /> }));
vi.mock('../runtime/runner', () => ({ startExecution: (request: WorkerRequest) => {
  let resolve!: (replies: ExecutionReply[]) => void;
  const promise = new Promise<ExecutionReply[]>(done => { resolve = done; });
  const cancel = vi.fn(); jobs.push({ request, resolve, cancel });
  return { promise, cancel, provideInput: () => false };
} }));
let root: Root, container: HTMLDivElement;
const button = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(element => element.textContent?.trim() === label)!;
async function click(element: HTMLElement) { await act(async () => element.click()); }
async function edit(code: string) {
  await act(async () => {
    const editor = container.querySelector('textarea')!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(editor, code);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
beforeEach(async () => {
  localStorage.clear(); jobs.length = 0; cue.mockClear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<BugFixLab onHome={() => {}} />));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('saves edits and progressive hints independently for each challenge', async () => {
  await edit(challenges[0].solution); await click(button('Need a hint?'));
  await click(container.querySelectorAll<HTMLButtonElement>('.bf-challenge')[1]);
  expect(container.querySelector('textarea')!.value).toBe(challenges[1].starter);
  await click(container.querySelectorAll<HTMLButtonElement>('.bf-challenge')[0]);
  expect(container.querySelector('textarea')!.value).toBe(challenges[0].solution);
  expect(container.textContent).toContain('Look at the end value');
  expect(loadProgress()[challenges[0].id].hints).toBe(1);
});
it('marks successful execution, explains the fix and plays its success cue', async () => {
  await edit(challenges[0].solution); await click(button('Check my fix'));
  const { runRequests } = await import('../runtime/worker');
  await act(async () => jobs[0].resolve(runRequests(jobs[0].request)));
  expect(container.textContent).toContain('Bug squashed. Nicely done.');
  expect(loadProgress()[challenges[0].id].solved).toBe(true);
  expect(cue).toHaveBeenCalledWith('success');
  await click(button('Next challenge'));
  expect(container.querySelector('#bf-challenge-title')?.textContent).toBe(challenges[1].title);
});
it('rejects stale results after changing challenge and cancels on unmount', async () => {
  await click(button('Check my fix'));
  await click(container.querySelectorAll<HTMLButtonElement>('.bf-challenge')[1]);
  expect(jobs[0].cancel).toHaveBeenCalled();
  await act(async () => jobs[0].resolve([{ error: { message: 'Old run' } }]));
  expect(container.textContent).not.toContain('Old run');
  await click(button('Check my fix'));
  await act(async () => root.unmount());
  expect(jobs[1].cancel).toHaveBeenCalled();
});
it('shows compile errors and failed checks without marking them solved', async () => {
  await edit('DECLARE'); await click(button('Check my fix'));
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(jobs).toHaveLength(0);
  await edit(challenges[0].starter); await click(button('Check my fix'));
  const { runRequests } = await import('../runtime/worker');
  await act(async () => jobs[0].resolve(runRequests(jobs[0].request)));
  expect(container.textContent).toContain('Needs a fix');
  expect(loadProgress()[challenges[0].id].solved).toBe(false);
  expect(cue).toHaveBeenCalledWith('error');
});
it('validates stored progress and tolerates blocked storage', () => {
  localStorage.setItem('pico.bugfix.v1', JSON.stringify({ [challenges[0].id]: { code: 'OUTPUT 1', hints: 999, solved: 'yes' }, unknown: {} }));
  expect(loadProgress()).toEqual({ [challenges[0].id]: { code: 'OUTPUT 1', hints: 2, solved: false } });
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
  expect(loadProgress()).toEqual({});
});
