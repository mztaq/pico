import type { Program } from '../language/ast';
import {
  execute,
  RuntimeError,
  type ExecutionOptions,
  type RunResult,
} from './interpreter';
export interface ExecutionFailure {
  message: string;
  line?: number;
  code?: string;
}
export interface ExecutionReply {
  result?: RunResult;
  error?: ExecutionFailure;
}
export interface WorkerRequest {
  ast: Program;
  runs: { inputs: string[]; options: ExecutionOptions }[];
}
export function runRequests(request: WorkerRequest): ExecutionReply[] {
  return request.runs.map((run) => {
    try {
      return { result: execute(request.ast, run.inputs, run.options) };
    } catch (error) {
      return {
        result: error instanceof RuntimeError ? error.result : undefined,
        error: {
          message: error instanceof Error ? error.message : 'Execution failed.',
          line: error instanceof RuntimeError ? error.line : undefined,
          code: error instanceof RuntimeError ? error.code : undefined,
        },
      };
    }
  });
}
// This module is also imported by tests, where WorkerGlobalScope is absent.
if (
  typeof document === 'undefined' &&
  typeof self !== 'undefined' &&
  'postMessage' in self
) {
  self.onmessage = (event: MessageEvent<WorkerRequest>) =>
    self.postMessage(runRequests(event.data));
}
