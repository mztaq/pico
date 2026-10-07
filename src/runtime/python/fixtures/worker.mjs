// Run the production worker protocol against local WebAssembly in Node 24.
import { parentPort } from 'node:worker_threads';
import { loadPyodide } from 'pyodide';
import { installPythonWorker } from '../worker.ts';
// Browser TextDecoder rejects shared backing stores. Node's decoder is more permissive.
const NativeDecoder = globalThis.TextDecoder;
globalThis.TextDecoder = class extends NativeDecoder {
  decode(input, options) {
    if (input instanceof SharedArrayBuffer || (ArrayBuffer.isView(input) && input.buffer instanceof SharedArrayBuffer)) {
      throw new TypeError('TextDecoder input must not be backed by SharedArrayBuffer');
    }
    return super.decode(input, options);
  }
};
const scope = { onmessage: null, postMessage: reply => parentPort.postMessage(reply) };
installPythonWorker(scope, () => loadPyodide());
parentPort.on('message', data => scope.onmessage({ data }));
