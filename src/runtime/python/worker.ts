import { PYODIDE_INDEX_URL, type PythonRequest } from './config.ts';
import { runPythonProgram, type PythonRuntime } from './engine.ts';
import type { WorkerReply } from '../worker';

export interface PythonWorkerScope {
  onmessage: ((event: MessageEvent<PythonRequest>) => void) | null;
  postMessage: (reply: WorkerReply) => void;
}
async function loadRuntime(): Promise<PythonRuntime> {
  const moduleUrl = `${PYODIDE_INDEX_URL}pyodide.mjs`;
  const { loadPyodide } = await import(/* @vite-ignore */ moduleUrl) as { loadPyodide: (options: { indexURL: string }) => Promise<PythonRuntime> };
  return loadPyodide({ indexURL: PYODIDE_INDEX_URL });
}

export function installPythonWorker(scope: PythonWorkerScope, load: () => Promise<PythonRuntime> = loadRuntime) {
  let started = false;
  scope.onmessage = async event => {
    if (started) return;
    started = true;
    const request = event.data;
    const ack = request.outputAck ? new Int32Array(request.outputAck) : undefined;
    const postOutput = (type: 'output' | 'stderr', line: string) => {
      if (ack) Atomics.store(ack, 0, 0);
      scope.postMessage({ type, lines: [line] });
      if (ack) while (Atomics.load(ack, 0) === 0) Atomics.wait(ack, 0, 0);
    };
    let inputId = 0;
    try {
      scope.postMessage({ type: 'status', message: 'Loading Python…' });
      const runtime = await load();
      const version = String(runtime.runPython('import sys; sys.version.split()[0]'));
      scope.postMessage({ type: 'status', message: `Python ${version}` });
      const reply = runPythonProgram(runtime, request, {
        stdout: line => postOutput('output', line),
        stderr: line => postOutput('stderr', line),
        readInput: (_prompt, line) => {
          if (!request.inputBuffer) throw new Error('Python input needs an updated browser and the site’s isolation headers. Reload this page.');
          const header = new Int32Array(request.inputBuffer, 0, 2);
          Atomics.store(header, 0, 0);
          scope.postMessage({ type: 'input', request: { id: ++inputId, variable: 'input()', dataType: 'STRING', line } });
          while (Atomics.load(header, 0) === 0) Atomics.wait(header, 0, 0);
          const length = Atomics.load(header, 1);
          return new TextDecoder().decode(new Uint8Array(request.inputBuffer, 8, length));
        },
      });
      scope.postMessage({ type: 'complete', replies: [reply] });
    } catch (error) {
      scope.postMessage({ type: 'complete', replies: [{ error: { code: 'python-worker', message: error instanceof Error ? error.message : 'Python failed to start. Reload this page and try again.' } }] });
    }
  };

}

if (typeof self !== "undefined" && typeof document === "undefined" && "postMessage" in self) {
  installPythonWorker(self as unknown as PythonWorkerScope);
}
