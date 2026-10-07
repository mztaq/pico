import { afterEach, expect, it, vi } from 'vitest';
import { startPythonExecution } from './runner';
import { MAX_INPUT_BYTES, type PythonRequest } from './config';
import type { WorkerReply } from '../worker';
class PythonWorker {
  static current: PythonWorker;
  request!: PythonRequest;
  terminated=false;
  onmessage?: (event:{data:WorkerReply})=>void;
  onerror?: (event:{preventDefault:()=>void})=>void;
  constructor(){PythonWorker.current=this;}
  postMessage(request:PythonRequest){this.request=request;}
  terminate(){this.terminated=true;}
  emit(data:WorkerReply){this.onmessage?.({data});}
}
const request={code:'input()',filename:'main.py',debug:true,files:{},sources:{}};
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it('exchanges UTF-8 input through shared memory, rejects stale input and ends cleanly',async()=>{
  vi.stubGlobal('Worker',PythonWorker);
  const onInput=vi.fn(),onStatus=vi.fn();
  const job=startPythonExecution(request,{onInput,onStatus});const worker=PythonWorker.current;
  worker.emit({type:'status',message:'Python 3.14.2'});
  worker.emit({type:'input',request:{id:1,variable:'input()',dataType:'STRING',line:1}});
  expect(onStatus).toHaveBeenCalledWith('Python 3.14.2');expect(onInput).toHaveBeenCalledOnce();
  expect(job.provideInput(2,'wrong')).toBe(false);expect(job.provideInput(1,'Ada 🌏')).toBe(true);
  const header=new Int32Array(worker.request.inputBuffer!,0,2);
  expect(Atomics.load(header,0)).toBe(1);
  expect(new TextDecoder().decode(new Uint8Array(worker.request.inputBuffer!,8,Atomics.load(header,1)))).toBe('Ada 🌏');
  expect(job.provideInput(1,'late')).toBe(false);
  worker.emit({type:'complete',replies:[{error:{code:'python',message:'ValueError'}}]});
  expect((await job.promise)[0]?.error?.message).toBe('ValueError');expect(worker.terminated).toBe(true);
});
it('never auto-times out and Stop cancels pending input and output acknowledgements',async()=>{
  vi.useFakeTimers();vi.stubGlobal('Worker',PythonWorker);
  const onOutput=vi.fn(),onStderr=vi.fn();
  const job=startPythonExecution(request,{onOutput,onStderr});const worker=PythonWorker.current;
  worker.emit({type:'output',lines:['before']});await vi.advanceTimersByTimeAsync(1);
  expect(new Int32Array(worker.request.outputAck!)[0]).toBe(1);
  worker.emit({type:'stderr',lines:['error']});await vi.advanceTimersByTimeAsync(3600000);
  expect(worker.terminated).toBe(false);expect(onStderr).toHaveBeenCalledWith(['error']);
  worker.emit({type:'input',request:{id:1,variable:'input()',dataType:'STRING',line:1}});
  worker.emit({type:'output',lines:['pending']});job.cancel();
  expect((await job.promise)[0]?.error?.code).toBe('cancelled');expect(worker.terminated).toBe(true);
  expect(job.provideInput(1,'late')).toBe(false);worker.emit({type:'output',lines:['late']});
  expect(onOutput).toHaveBeenCalledTimes(2);expect(vi.getTimerCount()).toBe(0);
});
it('rejects oversized input with a fatal error',async()=>{
  vi.stubGlobal('Worker',PythonWorker);const job=startPythonExecution(request);const worker=PythonWorker.current;
  worker.emit({type:'input',request:{id:1,variable:'input()',dataType:'STRING',line:1}});
  expect(job.provideInput(1,'a'.repeat(MAX_INPUT_BYTES+1))).toBe(false);
  expect((await job.promise)[0]?.error?.code).toBe('input');expect(worker.terminated).toBe(true);
});
it('handles worker construction errors and transport failures',async()=>{
  vi.stubGlobal('Worker',class {constructor(){throw Error('blocked');}});
  expect((await startPythonExecution(request).promise)[0]?.error?.code).toBe('python-worker');
  vi.stubGlobal('Worker',class extends PythonWorker {postMessage(){throw Error('blocked');}});
  expect((await startPythonExecution(request).promise)[0]?.error?.code).toBe('python-worker');
  expect(PythonWorker.current.terminated).toBe(true);
});
