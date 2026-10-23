import {describe,it,expect} from 'vitest';
import {validateBatch} from './usage';

describe('Pico usage validation', () => {
  const id='123e4567-e89b-42d3-a456-426614174000';
  it('accepts an idempotent multi-workspace batch', () => {
    expect(validateBatch({batchId:id,entries:[
      {workspace:'python',seconds:20},
      {workspace:'flowchart',seconds:25},
      {workspace:'cpu',seconds:15},
    ]})).toEqual({id,entries:[
      {workspace:'python',seconds:20},
      {workspace:'flowchart',seconds:25},
      {workspace:'cpu',seconds:15},
    ]});
  });
  it('rejects duplicate workspaces', () => {
    expect(validateBatch({batchId:id,entries:[
      {workspace:'python',seconds:10},{workspace:'python',seconds:10}
    ]})).toBeNull();
  });
  it('rejects more than one minute of claimed activity', () => {
    expect(validateBatch({batchId:id,entries:[
      {workspace:'python',seconds:40},{workspace:'cpu',seconds:40}
    ]})).toBeNull();
  });
  it('rejects invalid identifiers and fractional durations', () => {
    expect(validateBatch({batchId:'invalid',entries:[{workspace:'python',seconds:30}]})).toBeNull();
    expect(validateBatch({batchId:id,entries:[{workspace:'python',seconds:0.5}]})).toBeNull();
    expect(validateBatch({batchId:id,entries:[{workspace:'unknown',seconds:5}]})).toBeNull();
  });
});
