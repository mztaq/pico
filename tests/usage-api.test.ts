import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {validateBatch,WORKSPACE_COLUMNS} from '../functions/api/usage';
import {isWorkspace} from '../functions/_lib/core';

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
  it('accepts Binary Lab usage alongside the other five workspace counters', () => {
    const all=['logic','python','pseudocode','flowchart','cpu','binary'];
    const entries=all.map(workspace=>({workspace,seconds:10}));
    expect(validateBatch({batchId:id,entries})).toEqual({id,entries});
    expect(Object.keys(WORKSPACE_COLUMNS)).toEqual(all);
    for(const workspace of all) expect(isWorkspace(workspace)).toBe(true);
    expect(WORKSPACE_COLUMNS.binary).toBe('binary_lab_seconds');
  });
  it('includes the Binary Lab migration and client-side title mapping', () => {
    const migration=readFileSync(new URL('../migrations/0003_binary_lab_usage.sql',import.meta.url),'utf8');
    const telemetry=readFileSync(new URL('../src/telemetry/PicoTelemetry.tsx',import.meta.url),'utf8');
    const api=readFileSync(new URL('../functions/api/usage.ts',import.meta.url),'utf8');
    expect(migration).toContain('CREATE TABLE pico_usage_reordered (');
    expect(migration).toContain('binary_lab_seconds INTEGER NOT NULL DEFAULT 0');
    expect(migration).toContain('FOREIGN KEY (visitor_id) REFERENCES pico_visitors(visitor_id) ON DELETE CASCADE');
    expect(migration.indexOf('cpu_studio_seconds INTEGER')).toBeLessThan(migration.indexOf('binary_lab_seconds INTEGER'));
    expect(migration.indexOf('binary_lab_seconds INTEGER')).toBeLessThan(migration.indexOf('last_updated INTEGER'));
    expect(migration).toContain('INSERT INTO pico_usage_reordered (');
    expect(migration).toContain('FROM pico_usage;');
    expect(migration).toContain('DROP TABLE pico_usage;');
    expect(migration).toContain('ALTER TABLE pico_usage_reordered RENAME TO pico_usage;');
    expect(migration).toContain('PRAGMA foreign_key_check;');
    expect(migration).not.toContain('ALTER TABLE pico_usage\\n  ADD COLUMN');
    expect(telemetry).toContain("'Pico | Binary Lab': 'binary'");
    expect(api).toContain('cpu_studio_seconds,binary_lab_seconds FROM pico_usage');
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
