// Local WebAssembly measurements. Network download and browser rendering are excluded.
import { performance } from 'node:perf_hooks';
import { Worker as ThreadWorker } from 'node:worker_threads';
import { startPythonExecution, disposePythonRuntime } from '../src/runtime/python/runner.ts';
const threads = new Set();
const terminations = [];
class BrowserWorker {
  constructor() {
    this.thread = new ThreadWorker(new URL('../src/runtime/python/fixtures/worker.mjs', import.meta.url));
    threads.add(this);
    this.thread.on('message', data => this.onmessage?.({data}));
    this.thread.on('error', () => this.onerror?.({preventDefault(){}}));
  }
  postMessage(request) { this.thread.postMessage(request); }
  terminate() { threads.delete(this); terminations.push(this.thread.terminate()); }
}
globalThis.Worker = BrowserWorker;
const request = {code:'name=input("Name? ")\nprint(f"Hello {name}!")',filename:'main.py',debug:false,files:{},sources:{}};
async function run(code=request.code) {
  const start = performance.now();
  let job;
  job = startPythonExecution({...request,code},{onInput:input=>job.provideInput(input.id,'Mustaqim')});
  const [reply] = await job.promise;
  if (reply?.error) throw new Error(reply.error.message);
  return performance.now()-start;
}
try {
  const cold = await run();
  const warm = [];
  for (let index=0;index<5;index++) warm.push(await run());
  const outputBatch = await run('for i in range(1000):\n    print(i)');
  console.log(JSON.stringify({environment:'Node 24, local CPython WebAssembly, production worker protocol',coldMs:Math.round(cold),warmMs:warm.map(ms=>Math.round(ms)),warmAverageMs:Math.round(warm.reduce((a,b)=>a+b,0)/warm.length),print1000Ms:Math.round(outputBatch)},null,2));
} finally {
  disposePythonRuntime();
  await Promise.all(terminations);
}
