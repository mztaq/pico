import {describe,it,expect} from 'vitest';
import {attributeSeconds,buildUsageBatch,acknowledgeUsageBatch} from '../src/telemetry/usage-batches';

describe('Pico per-workspace usage queue',()=>{
  const id='123e4567-e89b-42d3-a456-426614174000';
  it('keeps time attributed to the workspace where it was recorded',()=>{
    const totals=new Map<string,number>();
    attributeSeconds(totals,'python',20);
    attributeSeconds(totals,'flowchart',20);
    attributeSeconds(totals,'cpu',20);
    const batch=buildUsageBatch(totals,id);
    expect(batch?.entries).toEqual([
      {workspace:'python',seconds:20},
      {workspace:'flowchart',seconds:20},
      {workspace:'cpu',seconds:20}
    ]);
    if(batch) acknowledgeUsageBatch(totals,batch);
    expect(totals.size).toBe(0);
  });
  it('caps a batch to 60 seconds and preserves pending time',()=>{
    const totals=new Map([['python',40],['flowchart',35]]);
    const batch=buildUsageBatch(totals,id);
    expect(batch?.entries).toEqual([
      {workspace:'python',seconds:40},
      {workspace:'flowchart',seconds:20}
    ]);
    if(batch) acknowledgeUsageBatch(totals,batch);
    expect(totals.get('flowchart')).toBe(15);
  });
  it('does not send fractions of seconds or invalid deltas',()=>{
    const totals=new Map<string,number>();
    attributeSeconds(totals,'python',0.6);
    attributeSeconds(totals,'python',Number.POSITIVE_INFINITY);
    expect(buildUsageBatch(totals,id)).toBeNull();
    attributeSeconds(totals,'python',0.5);
    expect(buildUsageBatch(totals,id)?.entries).toEqual([{workspace:'python',seconds:1}]);
  });
});
