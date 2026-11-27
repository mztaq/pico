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
  it('accepts all eight workspace counters including SQL Playground', () => {
    const all=['logic','python','pseudocode','flowchart','cpu','binary','traffic','sql'];
    const entries=all.map(workspace=>({workspace,seconds:7}));
    expect(validateBatch({batchId:id,entries})).toEqual({id,entries});
    expect(Object.keys(WORKSPACE_COLUMNS)).toEqual(all);
    for(const workspace of all) expect(isWorkspace(workspace)).toBe(true);
    expect(WORKSPACE_COLUMNS.binary).toBe('binary_lab_seconds');
    expect(WORKSPACE_COLUMNS.traffic).toBe('traffic_storm_seconds');
    expect(WORKSPACE_COLUMNS.sql).toBe('sql_playground_seconds');
  });
  it('includes the Binary Lab migration and client-side title mapping', () => {
    const migration=readFileSync(new URL('../migrations/0003_binary_lab_usage.sql',import.meta.url),'utf8');
    const telemetry=readFileSync(new URL('../src/telemetry/PicoTelemetry.tsx',import.meta.url),'utf8');
    const api=readFileSync(new URL('../functions/api/usage.ts',import.meta.url),'utf8');
    expect(migration).toContain('CREATE TABLE pico_usage_reordered (');
    expect(migration).toContain('binary_lab_seconds INTEGER NOT NULL DEFAULT 0');
    expect(migration).toContain('FOREIGN KEY (visitor_id) REFERENCES pico_visitors(visitor_id) ON DELETE CASCADE');
    const columnDeclarations = migration.slice(
      migration.indexOf('CREATE TABLE pico_usage_reordered ('),
      migration.indexOf('FOREIGN KEY (visitor_id)')
    );
    const columns = [...columnDeclarations.matchAll(/^\s{2}([a-z_]+) (?:TEXT|INTEGER)\b/gm)].map(match => match[1]);
    expect(columns).toEqual([
      'visitor_id', 'last_updated', 'logic_sim_seconds', 'python_seconds',
      'pseudocode_seconds', 'flowchart_seconds', 'cpu_studio_seconds', 'binary_lab_seconds'
    ]);
    expect(migration).toContain('  visitor_id,\n  last_updated,\n  logic_sim_seconds,');
    expect(migration).toContain('SELECT\n  visitor_id,\n  last_updated,\n  logic_sim_seconds,');
    expect(migration).toContain('INSERT INTO pico_usage_reordered (');
    expect(migration).toContain('FROM pico_usage;');
    expect(migration).toContain('DROP TABLE pico_usage;');
    expect(migration).toContain('ALTER TABLE pico_usage_reordered RENAME TO pico_usage;');
    expect(migration).toContain('PRAGMA foreign_key_check;');
    expect(migration).not.toContain('ALTER TABLE pico_usage\\n  ADD COLUMN');
    expect(telemetry).toContain("'Pico | Binary Lab': 'binary'");
    expect(api).toContain('cpu_studio_seconds,binary_lab_seconds,traffic_storm_seconds,sql_playground_seconds FROM pico_usage');
  });
  it('includes Traffic Storm D1 migration, consented time tracking, and the API column', () => {
    const migration=readFileSync(new URL('../migrations/0004_traffic_storm_usage.sql',import.meta.url),'utf8');
    const telemetry=readFileSync(new URL('../src/telemetry/PicoTelemetry.tsx',import.meta.url),'utf8');
    const api=readFileSync(new URL('../functions/api/usage.ts',import.meta.url),'utf8');
    const title=readFileSync(new URL('../src/app/App.tsx',import.meta.url),'utf8');
    expect(migration).toContain('ALTER TABLE pico_usage');
    expect(migration).toContain('traffic_storm_seconds INTEGER NOT NULL DEFAULT 0');
    expect(migration).not.toContain('DROP TABLE pico_usage;');
    expect(telemetry).toContain("'Pico | Traffic Storm': 'traffic'");
    expect(title).toContain("'Pico | Traffic Storm'");
    expect(api).toContain("traffic:'traffic_storm_seconds'");
    expect(api).toContain('input.entries.length > 8');
    expect(telemetry).toContain('if (!choice?.analytics) return;');
    expect(telemetry).toContain('!document.hidden && document.hasFocus()');
  });
  it('rejects nine entries, while allowing eight unique workspace counters', () => {
    const eight=Object.keys(WORKSPACE_COLUMNS).map(workspace => ({workspace, seconds:1}));
    expect(validateBatch({batchId:id,entries:eight})).toEqual({id,entries:eight});
    expect(validateBatch({batchId:id,entries:[...eight,{workspace:'traffic',seconds:1}]})).toBeNull();
    expect(validateBatch({batchId:id,entries:[{workspace:'traffic',seconds:1},{workspace:'traffic',seconds:1}]})).toBeNull();
  });
  it('includes the SQL Playground migration and consented tracking',()=>{
    const migration=readFileSync(new URL('../migrations/0005_sql_playground_usage.sql',import.meta.url),'utf8');
    const telemetry=readFileSync(new URL('../src/telemetry/PicoTelemetry.tsx',import.meta.url),'utf8');
    const api=readFileSync(new URL('../functions/api/usage.ts',import.meta.url),'utf8');
    expect(migration).toContain('sql_playground_seconds INTEGER NOT NULL DEFAULT 0');
    expect(telemetry).toContain("'Pico | SQL Playground': 'sql'");
    expect(api).toContain("sql:'sql_playground_seconds'");
    expect(telemetry).toContain('if (!choice?.analytics) return;');
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
