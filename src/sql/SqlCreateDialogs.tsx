import { useEffect, useState, type ClipboardEvent } from 'react';
import { Database, Plus, Table2, Trash2, Upload, X } from 'lucide-react';
import { Modal } from './SqlDialog';
import { CsvImportDesign } from './SqlTableDesign';
import type { CsvImportFile } from './engine';
import { columnTypes, type ColumnType, type ManualColumn, type ManualTable, validateManualTable, validateTableSchema, resizeManualGrid, columnTypeLabels } from './manual-table';

export function CreateDatabaseDialog({ names, onCreate, onClose }: { names: string[]; onCreate: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  return <Modal title="Create database" onClose={onClose}>
    <form className="sql-dialog-form" onSubmit={event => {
      event.preventDefault();
      const trimmed = name.trim();
      if (!trimmed || trimmed.length > 80) { setError('Enter a database name (1–80 characters).'); return; }
      if (names.some(existing => existing.toLowerCase() === trimmed.toLowerCase())) { setError('A database with this name already exists.'); return; }
      onCreate(trimmed);
    }}>
      <label>Database name<input autoFocus required maxLength={80} value={name} onChange={event => { setName(event.target.value); setError(''); }} placeholder="Enter a name"/></label>
      {error && <p role="alert" className="sql-dialog-error">{error}</p>}
      <div className="sql-dialog-actions"><button type="button" className="subtle-button" onClick={onClose}>Cancel</button><button type="submit" className="run-button" disabled={!name.trim()}><Database size={15}/> Create database</button></div>
    </form>
  </Modal>;
}

interface TableProps { databaseName: string; initialMode: 'manual' | 'csv'; busy: boolean; stoppable: boolean; error: string; onClose: () => void; onStop: () => void; onCreate: (table: ManualTable) => void; onImport: (files: CsvImportFile[]) => void; existingNames: string[]; }
const blankColumn = (): ManualColumn => ({ name:'', type:'TEXT', primaryKey:false });
export function CreateTableDialog({ databaseName, initialMode, busy, stoppable, error, onClose, onStop, onCreate, onImport, existingNames }: TableProps) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [columns, setColumns] = useState<ManualColumn[]>([blankColumn(), blankColumn()]);
  const [rows, setRows] = useState<string[][]>([['','']]);
  const [fieldCount, setFieldCount] = useState('2');
  const [recordCount, setRecordCount] = useState('1');
  const [recordPage, setRecordPage] = useState(0);
  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(recordPage, pageCount - 1);
  useEffect(() => { setFieldCount(String(columns.length)); setRecordCount(String(rows.length)); }, [columns.length, rows.length]);
  const [files, setFiles] = useState<CsvImportFile[]>([]);
  const [csvReading, setCsvReading] = useState(false);
  const [validation, setValidation] = useState('');
  function applySize() {
    const fields = Number(fieldCount), records = Number(recordCount);
    if (!fieldCount.trim() || !recordCount.trim() || !Number.isInteger(fields) || fields < 1 || fields > 100 || !Number.isInteger(records) || records < 0 || records > 1000) {
      setValidation('Choose 1–100 fields and 0–1,000 records.'); return;
    }
    const removesData = columns.slice(fields).some(column => column.name || column.primaryKey || column.type !== 'TEXT') ||
      rows.some((row, i) => (i >= records ? row : row.slice(fields)).some(cell => cell !== ''));
    if (removesData && !window.confirm('Reducing the size will remove some entered fields or records. Continue?')) return;
    const next = resizeManualGrid(columns, rows, fields, records);
    setColumns(next.columns); setRows(next.rows); setRecordPage(0); setValidation('');
  }
  function changeColumn(index: number, change: Partial<ManualColumn>) {
    setColumns(previous => previous.map((column,i) => i === index ? {...column,...change} : column));
    setValidation('');
  }
  function addColumn() {
    setColumns(previous => [...previous, blankColumn()]);
    setRows(previous => previous.map(row => [...row,'']));
  }
  function removeColumn(index: number) {
    setColumns(previous => previous.filter((_,i) => i !== index));
    setRows(previous => previous.map(row => row.filter((_,i) => i !== index)));
  }
  function changeCell(row: number, column: number, value: string) {
    setRows(previous => previous.map((cells,i) => i === row ? cells.map((cell,j) => j === column ? value : cell) : cells));
    setValidation('');
  }
  function pasteCells(event: ClipboardEvent<HTMLInputElement>, row: number, column: number) {
    const text = event.clipboardData.getData('text/plain');
    if (!text.includes('\t') && !/[\r\n]/.test(text)) return;
    event.preventDefault();
    const pasted = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').replace(/\n$/,'').split('\n').map(line => line.split('\t'));
    if (row + pasted.length > 1000 || pasted.some(cells => column + cells.length > columns.length)) {
      setValidation('Pasted data must fit the defined columns and 1,000-row limit. Add columns first.'); return;
    }
    setRows(previous => {
      const next = previous.map(cells => [...cells]);
      while (next.length < row + pasted.length) next.push(columns.map(() => ''));
      pasted.forEach((cells,i) => cells.forEach((cell,j) => { next[row+i][column+j]=cell; }));
      return next;
    });
    setValidation('');
  }
  function submit() {
    if (mode === 'csv') {
      if (!files.length || csvReading) return;
      try {
        const taken = new Set(existingNames.map(name=>name.toLowerCase()));
        for (const file of files) {
          const schema = validateTableSchema({name:file.tableName??'',columns:file.columns??[]});
          if (taken.has(schema.name.toLowerCase())) throw new Error('Table "' + schema.name + '" already exists.');
          taken.add(schema.name.toLowerCase());
        }
        setValidation(''); onImport(files);
      } catch (cause) { setValidation(cause instanceof Error?cause.message:String(cause)); }
      return;
    }
    if (fieldCount !== String(columns.length) || recordCount !== String(rows.length)) { setValidation('Select Set size before creating the table.'); return; }
    const table = { name, columns, rows: rows.filter(row => row.some(cell => cell !== '')) };
    try { validateManualTable(table); setValidation(''); onCreate(table); }
    catch (cause) { setValidation(cause instanceof Error ? cause.message : String(cause)); }
  }
  return <Modal title="Create table" busy={busy || csvReading} onClose={onClose}>
    <div className="sql-dialog-form sql-table-form">
      <div className="sql-dialog-db"><Database size={15}/>{databaseName}</div>
      <div className="sql-mode-switch" role="group" aria-label="Table source">
        <button type="button" className={'subtle-button' + (mode === 'manual' ? ' active' : '')} aria-pressed={mode === 'manual'} disabled={busy || csvReading} onClick={() => { setMode('manual'); setValidation(''); }}><Table2 size={16}/> Enter manually</button>
        <button type="button" className={'subtle-button' + (mode === 'csv' ? ' active' : '')} aria-pressed={mode === 'csv'} disabled={busy || csvReading} onClick={() => { setMode('csv'); setValidation(''); }}><Upload size={16}/> Import CSV</button>
      </div>
      {mode === 'manual' ? <>
        <label>Table name<input autoFocus disabled={busy} value={name} onChange={event => setName(event.target.value)} maxLength={100} placeholder="Enter a table name"/></label>
        <div className="sql-table-size">
          <label>Number of fields<input type="number" min={1} max={100} step={1} value={fieldCount} disabled={busy} onChange={event => setFieldCount(event.target.value)}/></label>
          <label>Number of records<input type="number" min={0} max={1000} step={1} value={recordCount} disabled={busy} onChange={event => setRecordCount(event.target.value)}/></label>
          <button type="button" className="subtle-button" disabled={busy || (fieldCount === String(columns.length) && recordCount === String(rows.length))} onClick={applySize}>Set size</button>
        </div>
        <div className="sql-form-heading"><h3>Fields <span className="sql-count">({columns.length})</span></h3><button className="toolbar-button" type="button" disabled={busy || columns.length >= 100} onClick={addColumn}><Plus size={15}/> Add field</button></div>
        <div className="sql-field-list">
          <div className="sql-field-row sql-field-labels"><span>Field name</span><span>Data type</span><span>Primary key</span><span/></div>
          {columns.map((column,i) => <div className="sql-field-row" key={i}>
            <input aria-label={'Field ' + (i+1) + ' name'} disabled={busy} maxLength={100} value={column.name} placeholder={'Field ' + (i+1)} onChange={event => changeColumn(i,{name:event.target.value})}/>
            <select aria-label={'Field ' + (i+1) + ' type'} disabled={busy} value={column.type} onChange={event => changeColumn(i,{type:event.target.value as ColumnType})}>{columnTypes.map(type => <option key={type} value={type}>{columnTypeLabels[type]}</option>)}</select>
            <input type="checkbox" aria-label={'Field ' + (i+1) + ' primary key'} disabled={busy} checked={column.primaryKey} onChange={event => changeColumn(i,{primaryKey:event.target.checked})}/>
            <button type="button" className="topbar-icon" aria-label={'Remove field ' + (i+1)} disabled={busy || columns.length === 1} onClick={() => removeColumn(i)}><Trash2 size={15}/></button>
          </div>)}
        </div>
        <div className="sql-form-heading"><h3>Records <span className="sql-count">({rows.length})</span></h3><button type="button" className="toolbar-button" disabled={busy || rows.length >= 1000} onClick={() => { setRows(previous => [...previous,columns.map(()=>'')]); setRecordPage(Math.floor(rows.length / pageSize)); }}><Plus size={15}/> Add row</button></div>
        <div className="sql-record-grid"><table><thead><tr><th>#</th>{columns.map((column,i)=><th key={i}>{column.name || 'Field ' + (i+1)}</th>)}<th/></tr></thead><tbody>
          {rows.slice(page * pageSize, (page + 1) * pageSize).map((row,index)=>{ const i = page * pageSize + index; return <tr key={i}><td>{i+1}</td>{row.map((cell,j)=><td key={j}><input aria-label={'Row ' + (i+1) + ', field ' + (j+1)} disabled={busy} value={cell} maxLength={4096} onChange={event => changeCell(i,j,event.target.value)} onPaste={event => pasteCells(event,i,j)}/></td>)}<td><button type="button" className="topbar-icon" aria-label={'Remove row ' + (i+1)} disabled={busy} onClick={() => setRows(previous => previous.filter((_,index)=>index!==i))}><X size={15}/></button></td></tr>; })}
        </tbody></table></div>
        {pageCount > 1 && <div className="sql-record-pages"><span>Records {page * pageSize + 1}–{Math.min(rows.length, (page + 1) * pageSize)} of {rows.length}</span><button type="button" className="toolbar-button" disabled={page === 0 || busy} onClick={() => setRecordPage(page - 1)}>Previous</button><button type="button" className="toolbar-button" disabled={page + 1 >= pageCount || busy} onClick={() => setRecordPage(page + 1)}>Next</button></div>}
        <p className="sql-form-note">Type records or paste spreadsheet cells. Empty cells become NULL. Fully blank rows are skipped. Use YYYY-MM-DD or HH:MM[:SS] for dates and times.</p>
      </> : <>
        <CsvImportDesign existingNames={existingNames} files={files} onChange={setFiles} disabled={busy} onReading={setCsvReading}/>
      </>}
      {(validation || error) && <p role="alert" className="sql-dialog-error">{validation || error}</p>}
      <div className="sql-dialog-actions">
        {busy ? <button type="button" className="toolbar-button stop-button" disabled={!stoppable} onClick={onStop}>Stop</button> : <button type="button" className="subtle-button" disabled={csvReading} onClick={onClose}>Cancel</button>}
        <button type="button" className="run-button" disabled={busy || csvReading || (mode === 'manual' ? !name.trim() : !files.length)} onClick={submit}>{busy ? 'Working…' : mode === 'manual' ? 'Create table' : 'Import CSV'}</button>
      </div>
    </div>
  </Modal>;
}
