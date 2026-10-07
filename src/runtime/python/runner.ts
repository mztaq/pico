import type { ExecutionCallbacks, ExecutionJob } from '../runner';
import type { ExecutionReply, WorkerReply } from '../worker';
import { MAX_INPUT_BYTES, type PythonRequest } from './config';

export function startPythonExecution(request: PythonRequest, callbacks: ExecutionCallbacks = {}): ExecutionJob {
  let worker: Worker;
  try { worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }); }
  catch { return { promise: Promise.resolve([{error:{code:'python-worker',message:'Python could not start. Reload this page and try again.'}}]), cancel:()=>{}, provideInput:()=>false }; }
  const inputBuffer = typeof SharedArrayBuffer === 'undefined' ? undefined : new SharedArrayBuffer(MAX_INPUT_BYTES + 8);
  const outputAck = typeof SharedArrayBuffer === 'undefined' ? undefined : new SharedArrayBuffer(4);
  let settled = false;
  let pendingId: number | undefined;
  let finish!: (replies: ExecutionReply[]) => void;
  let ackTimer: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<ExecutionReply[]>(resolve => { finish = resolve; });
  const settle = (replies: ExecutionReply[]) => {
    if (settled) return;
    settled = true;
    clearTimeout(ackTimer);
    worker.terminate();
    finish(replies);
  };
  const acknowledge = () => {
    if (!outputAck) return;
    ackTimer = setTimeout(() => {
      if (settled) return;
      const ack = new Int32Array(outputAck);
      Atomics.store(ack, 0, 1); Atomics.notify(ack, 0);
    }, 1);
  };
  worker.onmessage = (event: MessageEvent<WorkerReply>) => {
    if (settled) return;
    const reply = event.data;
    if (Array.isArray(reply)) { settle(reply); return; }
    if (reply.type === 'complete') { settle(reply.replies); return; }
    if (reply.type === 'output') { callbacks.onOutput?.(reply.lines); acknowledge(); return; }
    if (reply.type === 'stderr') { callbacks.onStderr?.(reply.lines); acknowledge(); return; }
    if (reply.type === 'status') { callbacks.onStatus?.(reply.message); return; }
    pendingId = reply.request.id;
    callbacks.onInput?.(reply.request);
  };
  worker.onerror = event => { event.preventDefault(); settle([{error:{code:'python-worker',message:'Python worker failed. Reload this page and try again.'}}]); };
  try { worker.postMessage({ ...request, inputBuffer, outputAck }); }
  catch { settle([{error:{code:'python-worker',message:'Python could not receive this program.'}}]); }
  return {
    promise,
    cancel: () => settle([{error:{code:'cancelled',message:'Execution stopped.'}}]),
    provideInput: (id, value) => {
      if (settled || pendingId !== id || !inputBuffer) return false;
      const bytes = new TextEncoder().encode(value);
      if (bytes.length > MAX_INPUT_BYTES) { settle([{error:{code:'input',message:'Input exceeds the 1 MB limit.'}}]); return false; }
      pendingId = undefined;
      new Uint8Array(inputBuffer, 8).set(bytes);
      const header = new Int32Array(inputBuffer, 0, 2);
      Atomics.store(header, 1, bytes.length); Atomics.store(header, 0, 1); Atomics.notify(header, 0);
      return true;
    },
  };
}
