import type { ExecutionReply, WorkerRequest } from './worker';
export interface ExecutionJob {
  promise: Promise<ExecutionReply[]>;
  cancel: () => void;
}
export function startExecution(request: WorkerRequest): ExecutionJob {
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
    };
  }
  let finish: (reply: ExecutionReply[]) => void;
  let timer: ReturnType<typeof setTimeout>;
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
  worker.onmessage = (event: MessageEvent<ExecutionReply[]>) =>
    settle(event.data);
  worker.onerror = (event) => {
    event.preventDefault();
    fail('Execution worker failed. Try running the program again.', 'worker');
  };
  timer = setTimeout(
    () =>
      fail(
        'Execution timed out after 10 seconds. Simplify the program or test batch.',
        'timeout',
      ),
    10_000,
  );
  try {
    worker.postMessage(request);
  } catch {
    fail('Program could not be sent to the execution worker.', 'worker');
  }
  return { promise, cancel: () => fail('Execution stopped.', 'cancelled') };
}
