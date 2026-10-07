import { Worker as ThreadWorker } from 'node:worker_threads';
import { afterEach, expect, it, vi } from 'vitest';
import { startPythonExecution, disposePythonRuntime, preloadPythonRuntime } from './runner';
import type { PythonWorkerRequest } from './config';
import type { WorkerReply } from '../worker';
class BrowserWorkerAdapter {
  static all: BrowserWorkerAdapter[]=[];
  thread: ThreadWorker;
  onmessage?: (event:{data:WorkerReply})=>void;
  onerror?: (event:{preventDefault:()=>void})=>void;
  termination?: Promise<number>;
  constructor(){
    BrowserWorkerAdapter.all.push(this);
    this.thread=new ThreadWorker(new URL('./fixtures/worker.mjs',import.meta.url));
    this.thread.on('message',(data:WorkerReply)=>this.onmessage?.({data}));
    this.thread.on('error',()=>this.onerror?.({preventDefault:()=>{}}));
  }
  postMessage(request:PythonWorkerRequest){this.thread.postMessage(request);}
  terminate(){this.termination=this.thread.terminate();}
}
afterEach(async()=>{disposePythonRuntime();await Promise.all(BrowserWorkerAdapter.all.map(worker=>worker.termination??worker.thread.terminate()));BrowserWorkerAdapter.all=[];vi.unstubAllGlobals();});
it('runs the production Python worker through real shared-memory input, output and debugger snapshots',async()=>{
  vi.stubGlobal('Worker',BrowserWorkerAdapter);
  const output:string[]=[];
  const statuses:string[]=[];
  let job:ReturnType<typeof startPythonExecution>;
  job=startPythonExecution({code:'name=input("Name? ")\nprint(f"Hello {name}!")',filename:'main.py',debug:true,files:{},sources:{}},{
    onOutput:lines=>output.push(...lines),onStatus:status=>statuses.push(status),onInput:request=>{expect(job.provideInput(request.id,'Ada 🌏')).toBe(true);},
  });
  const [reply]=await job.promise;
  expect(reply?.error).toBeUndefined();expect(reply?.result?.variables.name).toBe('Ada 🌏');
  expect(output).toEqual(['Name? ','Hello Ada 🌏!']);
  expect(statuses).toContain('Python 3.14.2');expect(reply?.result?.trace.at(-1)?.variables.name).toBe('Ada 🌏');
},60000);
it('terminates invalid numeric Python input without asking for another value',async()=>{
  vi.stubGlobal('Worker',BrowserWorkerAdapter);
  let count=0;
  let job:ReturnType<typeof startPythonExecution>;
  job=startPythonExecution({code:'n=int(input())\nprint("After")',filename:'main.py',debug:true,files:{},sources:{}},{onInput:request=>{count++;job.provideInput(request.id,'bad');}});
  const [reply]=await job.promise;
  expect(reply?.error?.message).toContain('ValueError');expect(count).toBe(1);expect(reply?.result?.output).not.toContain('After');
},60000);
it('stops a real infinite Python loop and starts another worker successfully',async()=>{
  vi.stubGlobal('Worker',BrowserWorkerAdapter);
  let ready!:()=>void;
  const started=new Promise<void>(resolve=>{ready=resolve;});
  const request={code:'while True:\n    pass',filename:'main.py',debug:true,files:{},sources:{}};
  const job=startPythonExecution(request,{onStatus:message=>{if(message.startsWith('Python '))ready();}});
  await started;
  await new Promise(resolve=>setTimeout(resolve,30));
  job.cancel();expect((await job.promise)[0]?.error?.code).toBe('cancelled');
  await BrowserWorkerAdapter.all[0]!.termination;
  const next=startPythonExecution({...request,code:'print("Fresh")'});
  expect((await next.promise)[0]?.result?.output).toEqual(['Fresh']);
},60000);

it('preloads Python and reuses the interpreter while resetting variables, files, modules and input',async()=>{
  vi.stubGlobal('Worker',BrowserWorkerAdapter);preloadPythonRuntime();
  const code='import builtins, os, sys, math\nfrom helper import value\nimport __main__\nname=input("Name? ")\nprint(__main__.name, value)\nwith open("old.txt", "w") as f: f.write("old")\nbuiltins.leaked=42\nmath.sqrt=lambda x: 99\nos.environ["PICO_LEAK"]="old"\nsys.argv.append("old")';
  let first:ReturnType<typeof startPythonExecution>;
  first=startPythonExecution({code,filename:'main.py',debug:true,files:{},sources:{'helper.py':'value=1'}},{onInput:request=>first.provideInput(request.id,'Mustaqim 🌏')});
  const [result]=await first.promise;expect(result?.error).toBeUndefined();expect(result?.result?.output).toContain('Mustaqim 🌏 1');
  const worker=BrowserWorkerAdapter.all[0]!;expect(worker.termination).toBeUndefined();
  const nextCode='import math, builtins, os, sys\nfrom helper import value\nprint(math.sqrt(9), hasattr(builtins,"leaked"), "PICO_LEAK" in os.environ, os.path.exists("old.txt"), "old" in sys.argv)\nprint(value)';
  const second=startPythonExecution({code:nextCode,filename:'main.py',debug:true,files:{},sources:{'helper.py':'value=2'}});
  const [reply]=await second.promise;
  expect(reply?.error).toBeUndefined();expect(reply?.result?.output).toEqual(['3.0 False False False False','2']);
  expect(reply?.result?.variables).not.toHaveProperty('name');expect(BrowserWorkerAdapter.all).toHaveLength(1);
  expect(first.provideInput(1,'stale')).toBe(false);first.cancel();expect(worker.termination).toBeUndefined();
},60000);
it('streams large output in ordered batches instead of waiting once per line',async()=>{
  vi.stubGlobal('Worker',BrowserWorkerAdapter);const batches:string[][]=[];
  const job=startPythonExecution({code:'for i in range(256):\n    print(i)',filename:'main.py',debug:false,files:{},sources:{}},{onOutput:lines=>batches.push(lines)});
  expect((await job.promise)[0]?.error).toBeUndefined();
  expect(batches.some(lines=>lines.length>1)).toBe(true);expect(batches.every(lines=>lines.length<=64)).toBe(true);expect(batches.flat()).toEqual(Array.from({length:256},(_,i)=>String(i)));
},60000);
it('accepts empty input through the strict browser decoder and keeps input requests separate',async()=>{
  vi.stubGlobal('Worker',BrowserWorkerAdapter);const values=['','Ada'];const ids:number[]=[];
  let job:ReturnType<typeof startPythonExecution>;
  job=startPythonExecution({code:'a=input("First? ")\nb=input("Second? ")\nprint(repr(a),repr(b))',filename:'main.py',debug:false,files:{},sources:{}},{onInput:request=>{ids.push(request.id);job.provideInput(request.id,values.shift()!);}});
  const [reply]=await job.promise;expect(reply?.error).toBeUndefined();expect(reply?.result?.output).toEqual(['First? ','Second? ',"'' 'Ada'"]);expect(ids).toEqual([1,2]);
},60000);

it('shows the first output and explicit flushes before a busy loop is stopped',async()=>{
  vi.stubGlobal('Worker',BrowserWorkerAdapter);let visible!:()=>void;const started=new Promise<void>(resolve=>{visible=resolve;});const lines:string[]=[];
  const job=startPythonExecution({code:'print("Starting")\nprint("Working",flush=True)\nwhile True:\n    pass',filename:'main.py',debug:false,files:{},sources:{}},{onOutput:batch=>{lines.push(...batch);if(lines.includes('Working'))visible();}});
  await started;expect(lines).toEqual(['Starting','Working']);job.cancel();expect((await job.promise)[0]?.error?.code).toBe('cancelled');
},60000);
