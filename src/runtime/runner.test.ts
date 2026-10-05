import { afterEach, describe, expect, it, vi } from 'vitest';
import { compile } from '../language';
import { startExecution } from './runner';
import { runRequests, type InputMessage, type WorkerReply, type WorkerRequest } from './worker';
class TestWorker {
  static current: TestWorker;
  onmessage?: (event: { data: WorkerReply }) => void;
  onerror?: (event: { preventDefault: () => void }) => void;
  terminated = false;
  request?: WorkerRequest;
  inputs: InputMessage[] = [];
  constructor() {
    TestWorker.current = this;
  }
  postMessage(request: WorkerRequest | InputMessage) {
    if ('type' in request) this.inputs.push(request);
    else this.request = request;
  }
  terminate() {
    this.terminated = true;
  }
  complete() {
    this.onmessage?.({ data: runRequests(this.request!) });
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('pauses the timeout while waiting and preserves the remaining running-time budget', async () => {
  vi.useFakeTimers(); vi.stubGlobal('Worker', TestWorker);
  const onInput = vi.fn(); const onOutput = vi.fn();
  const job = startExecution({ ast: compile('DECLARE N : INTEGER\nINPUT N').ast, runs: [{ inputs: [], options: {} }], interactive: true }, { onInput, onOutput });
  const worker = TestWorker.current;
  await vi.advanceTimersByTimeAsync(4000);
  worker.onmessage?.({ data: { type: 'output', lines: ['Prompt'] } });
  worker.onmessage?.({ data: { type: 'input', request: { id: 1, variable: 'N', dataType: 'INTEGER', line: 2 } } });
  await vi.advanceTimersByTimeAsync(60000);
  expect(worker.terminated).toBe(false);
  expect(onOutput).toHaveBeenCalledWith(['Prompt']); expect(onInput).toHaveBeenCalledOnce();
  expect(job.provideInput(99, '2')).toBe(false);
  expect(job.provideInput(1, '2')).toBe(true);
  expect(job.provideInput(1, '2')).toBe(false);
  expect(worker.inputs).toEqual([{ type: 'input', id: 1, value: '2' }]);
  await vi.advanceTimersByTimeAsync(5999);
  expect(worker.terminated).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect((await job.promise)[0]?.error?.code).toBe('timeout');
});

it('stops while waiting and ignores late input, output, and completion', async () => {
  vi.useFakeTimers(); vi.stubGlobal('Worker', TestWorker);
  const onInput = vi.fn(); const onOutput = vi.fn();
  const job = startExecution({ ast: compile('DECLARE N : INTEGER\nINPUT N').ast, runs: [{ inputs: [], options: {} }], interactive: true }, { onInput, onOutput });
  const worker = TestWorker.current;
  worker.onmessage?.({ data: { type: 'input', request: { id: 1, variable: 'N', dataType: 'INTEGER', line: 2 } } });
  job.cancel();
  worker.onmessage?.({ data: { type: 'output', lines: ['late'] } });
  worker.onmessage?.({ data: { type: 'input', request: { id: 2, variable: 'N', dataType: 'INTEGER', line: 2 } } });
  worker.onmessage?.({ data: { type: 'complete', replies: [{ result: runRequests(worker.request!)[0]?.result }] } });
  expect(job.provideInput(1, '2')).toBe(false);
  expect((await job.promise)[0]?.error?.code).toBe('cancelled');
  expect(onInput).toHaveBeenCalledOnce(); expect(onOutput).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
describe('execution worker lifecycle', () => {
  it('returns results and terminates finished workers', async () => {
    vi.stubGlobal('Worker', TestWorker);
    const job = startExecution({
      ast: compile('OUTPUT 7').ast,
      runs: [{ inputs: [], options: {} }],
    });
    TestWorker.current.complete();
    expect((await job.promise)[0]!.result?.output).toEqual(['7']);
    expect(TestWorker.current.terminated).toBe(true);
  });
  it('cancels a pending job and ignores later messages', async () => {
    vi.stubGlobal('Worker', TestWorker);
    const job = startExecution({
      ast: compile('OUTPUT 7').ast,
      runs: [{ inputs: [], options: {} }],
    });
    job.cancel();
    TestWorker.current.complete();
    expect((await job.promise)[0]!.error?.code).toBe('cancelled');
    expect(TestWorker.current.terminated).toBe(true);
  });
  it('times out a stuck worker', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', TestWorker);
    const job = startExecution({
      ast: compile('OUTPUT 7').ast,
      runs: [{ inputs: [], options: {} }],
    });
    await vi.advanceTimersByTimeAsync(10000);
    expect((await job.promise)[0]!.error?.code).toBe('timeout');
    expect(TestWorker.current.terminated).toBe(true);
  });
});

it('reports a worker construction failure without rejecting the UI promise', async () => {
  vi.stubGlobal(
    'Worker',
    class {
      constructor() {
        throw new Error('Blocked');
      }
    },
  );
  const result = await startExecution({
    ast: compile('OUTPUT 7').ast,
    runs: [{ inputs: [], options: {} }],
  }).promise;
  expect(result[0]!.error?.code).toBe('worker');
});
