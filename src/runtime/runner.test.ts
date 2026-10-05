import { afterEach, describe, expect, it, vi } from 'vitest';
import { compile } from '../language';
import { startExecution } from './runner';
import { runRequests, type WorkerRequest } from './worker';
class TestWorker {
  static current: TestWorker;
  onmessage?: (event: { data: ReturnType<typeof runRequests> }) => void;
  onerror?: (event: { preventDefault: () => void }) => void;
  terminated = false;
  request?: WorkerRequest;
  constructor() {
    TestWorker.current = this;
  }
  postMessage(request: WorkerRequest) {
    this.request = request;
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
