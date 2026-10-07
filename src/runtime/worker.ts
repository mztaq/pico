import type { Program } from '../language/ast';
import {
  execute,
  executeInteractive,
  RuntimeError,
  type ExecutionOptions,
  type RunResult,
  type InputRequest,
} from './interpreter';
export interface ExecutionFailure {
  message: string;
  line?: number;
  code?: string;
  diagnostic?: string;
}
export interface ExecutionReply {
  result?: RunResult;
  error?: ExecutionFailure;
}
export interface WorkerRequest {
  ast: Program;
  runs: { inputs: string[]; options: ExecutionOptions }[];
  interactive?: boolean;
  outputAck?: SharedArrayBuffer;
}
export interface PendingInput extends InputRequest { id: number; }
export interface InputMessage { type: 'input'; id: number; value: string; }
export type WorkerReply = ExecutionReply[]
  | { type: 'output'; lines: string[] }
  | { type: 'stderr'; lines: string[] }
  | { type: 'status'; message: string }
  | { type: 'input'; request: PendingInput }
  | { type: 'complete'; replies: ExecutionReply[] };

function failure(error: unknown): ExecutionReply {
  return {
    result: error instanceof RuntimeError ? error.result : undefined,
    error: {
      message: error instanceof Error ? error.message : 'Execution failed.',
      line: error instanceof RuntimeError ? error.line : undefined,
      code: error instanceof RuntimeError ? error.code : undefined,
    },
  };
}
export function runRequests(request: WorkerRequest): ExecutionReply[] {
  return request.runs.map((run) => {
    try {
      return { result: execute(request.ast, run.inputs, run.options) };
    } catch (error) {
      return failure(error);
    }
  });
}

/** Drive the same interpreter used by tests, suspending its stack at each INPUT. */
export function createInteractiveSession(request: WorkerRequest, post: (reply: WorkerReply) => void) {
  const execution = executeInteractive(request.ast, request.runs[0]?.options);
  let pendingId: number | undefined;
  let nextId = 0;
  let started = false;
  let finished = false;
  const advance = (value?: string) => {
    const lines: string[] = [];
    const flush = () => {
      if (!lines.length) return;
      const ack = request.outputAck ? new Int32Array(request.outputAck) : undefined;
      if (ack) Atomics.store(ack, 0, 0);
      post({ type: 'output', lines: lines.splice(0) });
      if (ack) while (Atomics.load(ack, 0) === 0) Atomics.wait(ack, 0, 0);
    };
    try {
      let step = value === undefined ? execution.next() : execution.next(value);
      while (!step.done) {
        if (step.value.type === 'input') {
          flush();
          pendingId = ++nextId;
          const { type: _type, ...input } = step.value;
          post({ type: 'input', request: { ...input, id: pendingId } });
          return;
        }
        lines.push(step.value.text);
        // Avoid a separate cross-thread message for every OUTPUT instruction.
        if (lines.length >= 64) flush();
        step = execution.next();
      }
      flush();
      finished = true;
      post({ type: 'complete', replies: [{ result: step.value }] });
    } catch (error) {
      flush();
      finished = true;
      post({ type: 'complete', replies: [failure(error)] });
    }
  };
  return {
    start: () => { if (!started) { started = true; advance(); } },
    input: (message: InputMessage) => {
      if (finished || pendingId === undefined || message.id !== pendingId) return;
      pendingId = undefined;
      advance(message.value);
    },
  };
}
// This module is also imported by tests, where WorkerGlobalScope is absent.
if (
  typeof document === 'undefined' &&
  typeof self !== 'undefined' &&
  'postMessage' in self
) {
  let session: ReturnType<typeof createInteractiveSession> | undefined;
  self.onmessage = (event: MessageEvent<WorkerRequest | InputMessage>) => {
    if ('type' in event.data) { session?.input(event.data); return; }
    if (event.data.interactive) {
      session = createInteractiveSession(event.data, reply => self.postMessage(reply));
      session.start();
    } else self.postMessage(runRequests(event.data));
  };
}
