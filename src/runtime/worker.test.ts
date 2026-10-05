import { describe, expect, it } from 'vitest';
import { compile } from '../language';
import { runRequests } from './worker';
describe('worker execution batches',()=>{
  it('returns positioned failures with partial output and independent test inputs',()=>{
    const ast=compile('DECLARE N : INTEGER\nINPUT N\nOUTPUT "before"\nOUTPUT 10 / N').ast;
    const results=runRequests({ast,runs:[{inputs:['0'],options:{trace:false}},{inputs:['2'],options:{trace:false}}]});
    expect(results[0]!.error).toMatchObject({line:4});expect(results[0]!.result?.output).toEqual(['before']);
    expect(results[1]!.error).toBeUndefined();expect(results[1]!.result?.output).toEqual(['before','5']);
  });
  it('isolates virtual file writes between test cases',()=>{
    const ast=compile('OPENFILE "data" FOR WRITE\nWRITEFILE "hello"').ast;
    const files={data:['old']};const results=runRequests({ast,runs:[{inputs:[],options:{files}},{inputs:[],options:{files}}]});
    expect(results.map(r=>r.result?.files)).toEqual([{data:['hello']},{data:['hello']}]);expect(files.data).toEqual(['old']);
  });
});
