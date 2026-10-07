import { PYODIDE_INDEX_URL, type PythonWorkerRequest } from './config.ts';
import { runPythonProgram, type PythonRuntime } from './engine.ts';
import type { WorkerReply } from '../worker';

export interface PythonWorkerScope {
  onmessage: ((event: MessageEvent<PythonWorkerRequest>) => void) | null;
  postMessage: (reply: WorkerReply) => void;
}
async function loadRuntime(): Promise<PythonRuntime> {
  const indexURL = new URL(PYODIDE_INDEX_URL, globalThis.location.href).href;
  const moduleUrl = `${indexURL}pyodide.mjs`;
  const { loadPyodide } = await import(/* @vite-ignore */ moduleUrl) as { loadPyodide: (options: { indexURL: string }) => Promise<PythonRuntime> };
  return loadPyodide({ indexURL });
}

export function installPythonWorker(scope: PythonWorkerScope, load: () => Promise<PythonRuntime> = loadRuntime) {
  let runtime: PythonRuntime | undefined;
  let loading: Promise<PythonRuntime> | undefined;
  let busy = false;
  const getRuntime = () => loading ??= load().then(value => {
    value.runPython('import json, os, traceback, io, types');
    runtime = value;
    return value;
  }).catch(error => { loading = undefined; throw error; });
  scope.onmessage = async event => {
    // Preparation only starts the shared load. Its completion never settles a run.
    if ('type' in event.data) { void getRuntime().catch(() => {}); return; }
    if (busy) return;
    busy = true;
    const request = event.data;
    const ack = request.outputAck ? new Int32Array(request.outputAck) : undefined;
    let inputId = 0;
    let lastFlush: number | undefined;
    let output: { type: 'output' | 'stderr'; lines: string[] } | undefined;
    const flushOutput = () => {
      if (!output?.lines.length) return;
      if (ack) Atomics.store(ack, 0, 0);
      scope.postMessage(output);
      output = undefined;
      lastFlush = performance.now();
      if (ack) while (Atomics.load(ack, 0) === 0) Atomics.wait(ack, 0, 0);
    };
    const postOutput = (type: 'output' | 'stderr', line: string) => {
      if (output?.type !== type) { flushOutput(); output = { type, lines: [] }; }
      output!.lines.push(line);
      // One acknowledgement per batch, rather than a timer for every print().
      if (lastFlush === undefined || output!.lines.length >= 64 || performance.now() - lastFlush >= 16) flushOutput();
    };
    try {
      if (!runtime) scope.postMessage({ type: 'status', message: 'Loading Python…' });
      const interpreter = await getRuntime();
      const version = String(interpreter.runPython('import sys; sys.version.split()[0]'));
      scope.postMessage({ type: 'status', message: `Python ${version}` });
      const reply = runPythonProgram(interpreter, request, {
        stdout: line => postOutput('output', line),
        stderr: line => postOutput('stderr', line),
        flush: flushOutput,
        readInput: (_prompt, line) => {
          flushOutput();
          if (!request.inputBuffer) throw new Error('Python input needs an updated browser and the site’s isolation headers. Reload this page.');
          const header = new Int32Array(request.inputBuffer, 0, 2);
          Atomics.store(header, 0, 0);
          scope.postMessage({ type: 'input', request: { id: ++inputId, variable: 'input()', dataType: 'STRING', line } });
          while (Atomics.load(header, 0) === 0) Atomics.wait(header, 0, 0);
          const length = Atomics.load(header, 1);
          // Browser decoders reject shared backing stores. Copy before decoding.
          const bytes = new Uint8Array(request.inputBuffer, 8, length).slice();
          return new TextDecoder().decode(bytes);
        },
      });
      flushOutput();
      scope.postMessage({ type: 'complete', replies: [reply] });
    } catch (error) {
      flushOutput();
      scope.postMessage({ type: 'complete', replies: [{ error: { code: 'python-worker', message: error instanceof Error ? error.message : 'Python failed to start. Reload this page and try again.' } }] });
    } finally { busy = false; }
  };
}

if (typeof self !== 'undefined' && typeof document === 'undefined' && 'postMessage' in self) {
  installPythonWorker(self as unknown as PythonWorkerScope);
}
