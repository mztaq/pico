import type { ExecutionReply, PendingInput, WorkerReply, WorkerRequest } from './worker';
export interface ExecutionCallbacks {
  onOutput?: (lines: string[]) => void;
  onInput?: (request: PendingInput) => void;
}
export interface ExecutionJob {
  promise: Promise<ExecutionReply[]>;
  cancel: () => void;
  provideInput: (id: number, value: string) => boolean;
}
export function startExecution(request: WorkerRequest, callbacks: ExecutionCallbacks = {}): ExecutionJob {
  let worker: Worker;
  try {
    worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    });
  } catch {
    return {
      promise: Promise.resolve(
        request.runs.map(() => ({
          error: {
            message:
              'The execution worker could not start. Reload this page and try again.',
            code: 'worker',
          },
        })),
      ),
      cancel: () => {},
      provideInput: () => false,
    };
  }
  let finish: (reply: ExecutionReply[]) => void;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingId: number | undefined;
  let remainingTime = 10_000;
  let startedAt = 0;
  let settled = false;
  const promise = new Promise<ExecutionReply[]>((resolve) => {
    finish = resolve;
  });
  const settle = (reply: ExecutionReply[]) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    worker.terminate();
    finish(reply);
  };
  const fail = (message: string, code: string) =>
    settle(request.runs.map(() => ({ error: { message, code } })));
  const pauseTimer = () => {
    if (timer === undefined) return;
    remainingTime = Math.max(0, remainingTime - (performance.now() - startedAt));
    clearTimeout(timer);
    timer = undefined;
  };
  const armTimer = () => {
    startedAt = performance.now();
    timer = setTimeout(() => fail(
      'Execution timed out after 10 seconds of running. Simplify the program or test batch.', 'timeout',
    ), remainingTime);
  };
  worker.onmessage = (event: MessageEvent<WorkerReply>) => {
    if (settled) return;
    const reply = event.data;
    if (Array.isArray(reply)) { settle(reply); return; }
    if (reply.type === 'complete') { settle(reply.replies); return; }
    if (reply.type === 'output') { callbacks.onOutput?.(reply.lines); return; }
    pauseTimer();
    pendingId = reply.request.id;
    callbacks.onInput?.(reply.request);
  };
  worker.onerror = (event) => {
    event.preventDefault();
    fail('Execution worker failed. Try running the program again.', 'worker');
  };
  armTimer();
  try {
    worker.postMessage(request);
  } catch {
    fail('Program could not be sent to the execution worker.', 'worker');
  }
  return {
    promise,
    cancel: () => fail('Execution stopped.', 'cancelled'),
    provideInput: (id, value) => {
      if (settled || pendingId !== id) return false;
      pendingId = undefined;
      armTimer();
      try { worker.postMessage({ type: 'input', id, value }); }
      catch { fail('Input could not be sent to the execution worker.', 'worker'); return false; }
      return true;
    },
  };
}
