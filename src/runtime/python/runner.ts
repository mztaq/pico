import type { ExecutionCallbacks, ExecutionJob } from '../runner';
import type { ExecutionReply, WorkerReply } from '../worker';
import { MAX_INPUT_BYTES, type PythonRequest, type PythonWorkerRequest } from './config.ts';

// Keep one idle interpreter. Busy runs never share workers or input buffers.
interface WorkerSlot { worker: Worker; disposed: boolean; cancel?: () => void; }
let idle: WorkerSlot | undefined;
const slots = new Set<WorkerSlot>();
function dispose(slot: WorkerSlot) {
  if (slot.disposed) return;
  slot.disposed = true;
  if (idle === slot) idle = undefined;
  slots.delete(slot);
  slot.worker.onmessage = null;
  slot.worker.onerror = null;
  slot.worker.terminate();
}
function park(slot: WorkerSlot) {
  if (slot.disposed) return;
  if (idle && idle !== slot) dispose(idle);
  idle = slot;
  slot.cancel = undefined;
  slot.worker.onmessage = event => {
    const message = event.data as WorkerReply;
    if (Array.isArray(message) || message.type === 'complete') dispose(slot);
  };
  slot.worker.onerror = event => { event.preventDefault(); dispose(slot); };
}
function acquire(): WorkerSlot {
  if (idle) { const slot = idle; idle = undefined; return slot; }
  const slot = { worker: new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }), disposed: false };
  slots.add(slot);
  return slot;
}
/** Download and initialize Python while the user starts editing. */
export function preloadPythonRuntime() {
  if (idle || slots.size) return;
  let slot: WorkerSlot | undefined;
  try {
    slot = acquire(); park(slot);
    slot.worker.postMessage({ type: 'prepare' } satisfies PythonWorkerRequest);
  } catch { if (slot) dispose(slot); }
}
/** Release idle and active interpreters when the owning page/test shuts down. */
export function disposePythonRuntime() { for (const slot of slots) { if (slot.cancel) slot.cancel(); else dispose(slot); } }

export function startPythonExecution(request: PythonRequest, callbacks: ExecutionCallbacks = {}): ExecutionJob {
  let slot: WorkerSlot;
  try { slot = acquire(); }
  catch { return { promise: Promise.resolve([{error:{code:'python-worker',message:'Python could not start. Reload this page and try again.'}}]), cancel:()=>{}, provideInput:()=>false }; }
  const worker = slot.worker;
  const inputBuffer = typeof SharedArrayBuffer === 'undefined' ? undefined : new SharedArrayBuffer(MAX_INPUT_BYTES + 8);
  const outputAck = typeof SharedArrayBuffer === 'undefined' ? undefined : new SharedArrayBuffer(4);
  let settled = false;
  let pendingId: number | undefined;
  let finish!: (replies: ExecutionReply[]) => void;
  let ackTimer: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<ExecutionReply[]>(resolve => { finish = resolve; });
  const settle = (replies: ExecutionReply[], reusable = false) => {
    if (settled) return;
    settled = true;
    clearTimeout(ackTimer);
    pendingId = undefined;
    if (reusable && !replies.some(reply => reply.error?.code === 'python-worker')) park(slot);
    else dispose(slot);
    finish(replies);
  };
  const acknowledge = () => {
    if (!outputAck || settled) return;
    ackTimer = setTimeout(() => {
      if (settled) return;
      const ack = new Int32Array(outputAck);
      Atomics.store(ack, 0, 1); Atomics.notify(ack, 0);
    }, 1);
  };
  worker.onmessage = (event: MessageEvent<WorkerReply>) => {
    if (settled) return;
    const reply = event.data;
    if (Array.isArray(reply)) { settle(reply, true); return; }
    if (reply.type === 'complete') { settle(reply.replies, true); return; }
    if (reply.type === 'output') { callbacks.onOutput?.(reply.lines); acknowledge(); return; }
    if (reply.type === 'stderr') { callbacks.onStderr?.(reply.lines); acknowledge(); return; }
    if (reply.type === 'status') { callbacks.onStatus?.(reply.message); return; }
    pendingId = reply.request.id;
    callbacks.onInput?.(reply.request);
  };
  slot.cancel = () => settle([{error:{code:'cancelled',message:'Execution stopped.'}}]);
  worker.onerror = event => { event.preventDefault(); settle([{error:{code:'python-worker',message:'Python worker failed. Reload this page and try again.'}}]); };
  try { worker.postMessage({ ...request, inputBuffer, outputAck }); }
  catch { settle([{error:{code:'python-worker',message:'Python could not receive this program.'}}]); }
  return {
    promise,
    // Termination also interrupts Atomics.wait and loops which never yield.
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
