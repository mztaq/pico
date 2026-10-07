import { Worker as ThreadWorker } from 'node:worker_threads';
import { afterEach, expect, it, vi } from 'vitest';
import { startPythonExecution } from './runner';
import type { PythonRequest } from './config';
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
  postMessage(request:PythonRequest){this.thread.postMessage(request);}
  terminate(){this.termination=this.thread.terminate();}
}
afterEach(async()=>{await Promise.all(BrowserWorkerAdapter.all.map(worker=>worker.termination??worker.thread.terminate()));BrowserWorkerAdapter.all=[];vi.unstubAllGlobals();});
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
