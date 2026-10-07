// Run the production worker protocol against local WebAssembly in Node 24.
import { parentPort } from 'node:worker_threads';
import { loadPyodide } from 'pyodide';
import { installPythonWorker } from '../worker.ts';
const scope = { onmessage: null, postMessage: reply => parentPort.postMessage(reply) };
installPythonWorker(scope, () => loadPyodide());
parentPort.on('message', data => scope.onmessage({ data }));
