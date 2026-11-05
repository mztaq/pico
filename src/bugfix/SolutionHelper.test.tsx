// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SolutionHelper, changedLines } from './SolutionHelper';
import { challenges } from './challenges';
import { runRequests, type WorkerRequest } from '../runtime/worker';
const cancels = vi.hoisted(() => [] as ReturnType<typeof vi.fn>[]);
vi.mock('../runtime/runner', () => ({ startExecution: (request: WorkerRequest) => {
  const cancel = vi.fn(); cancels.push(cancel);
  return { promise: Promise.resolve(runRequests(request)), cancel, provideInput: () => false };
} }));
let root: Root, box: HTMLDivElement;
const apply = vi.fn();
const button = (name: string) => [...box.querySelectorAll('button')].find(b => b.textContent === name)!;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); box = document.createElement('div'); document.body.append(box); root = createRoot(box); cancels.length = 0; apply.mockClear(); });
afterEach(async () => { vi.useRealTimers(); await act(async () => root.unmount()); box.remove(); vi.unstubAllGlobals(); });
async function render(code = challenges[0].starter) { await act(async () => root.render(<SolutionHelper challenge={challenges[0]} code={code} onApply={apply} onClose={() => {}} />)); }
it('aligns inserted lines without flagging unchanged following lines', () => {
  expect([...changedLines('A\nB\nC', 'A\nNEW\nB\nC')]).toEqual([]);
  expect([...changedLines('A\nBAD\nC', 'A\nGOOD\nC')]).toEqual([2]);
});
it('compares executed output and lets the student step and apply the reference', async () => {
  await render();
  expect(box.querySelector('.bf-helper-comparison')?.textContent).toContain('1\n2\n3\n4\n5');
  expect(box.querySelector('.bf-helper-code .is-different')?.textContent).toContain('TO 4');
  const first = box.querySelector('.bf-helper-controls span')?.textContent;
  await act(async () => button('Step').click());
  expect(box.querySelector('.bf-helper-controls span')?.textContent).not.toBe(first);
  await act(async () => button('Reference fix').click());
  expect(box.querySelector('.bf-helper-code')?.textContent).toContain('TO 5');
  await act(async () => button('Apply reference fix to editor').click());
  expect(apply).toHaveBeenCalledOnce();
});
it('animates snapshots and pauses without continuing in the background', async () => {
  await render(); vi.useFakeTimers();
  await act(async () => button('Play walkthrough').click());
  await act(async () => vi.advanceTimersByTime(900));
  expect(box.querySelector('.bf-helper-controls span')?.textContent).toContain('Step 2');
  await act(async () => button('Pause').click());
  await act(async () => vi.advanceTimersByTime(2000));
  expect(box.querySelector('.bf-helper-controls span')?.textContent).toContain('Step 2');
});
it('still reveals a working solution when current code has a syntax error', async () => {
  await render('DECLARE');
  expect(box.textContent).toContain('Execution stopped:');
  await act(async () => button('Reference fix').click());
  expect(box.querySelector('.bf-helper-controls span')?.textContent).toContain('Step 1');
});
it('cancels both workers when dismissed', async () => {
  await render(); await act(async () => root.unmount());
  expect(cancels).toHaveLength(2); cancels.forEach(cancel => expect(cancel).toHaveBeenCalled());
});
