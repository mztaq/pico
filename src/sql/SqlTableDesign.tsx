import { useRef, useState } from 'react';
import { KeyRound, Table2, Upload, Save } from 'lucide-react';
import { inspectCsv, MAX_CSV_BYTES, tableName } from './csv';
import { columnTypes, columnTypeLabels, type ColumnType, type ManualColumn, validateTableSchema } from './manual-table';
import type { CsvImportFile, TableDesign, TableInfo } from './engine';
import { Modal } from './SqlDialog';

function FieldGrid({ columns, disabled, samples, onChange }: { columns: ManualColumn[]; disabled: boolean; samples?: string[][]; onChange: (columns: ManualColumn[]) => void }) {
  const update = (i: number, change: Partial<ManualColumn>) => onChange(columns.map((column,j)=>i===j?{...column,...change}:column));
  return <div className="sql-design-grid"><table><thead><tr><th aria-label="Primary key"/><th>Field name</th><th>Data type</th>{samples && <th>Sample values</th>}</tr></thead><tbody>
    {columns.map((column,i)=><tr key={i}><td><button type="button" title={column.primaryKey?'Remove primary key':'Set primary key'} aria-label={column.name + ' primary key'} aria-pressed={column.primaryKey} disabled={disabled} className={'topbar-icon sql-key-toggle'+(column.primaryKey?' active':'')} onClick={()=>update(i,{primaryKey:!column.primaryKey})}><KeyRound size={16}/></button></td><td><input aria-label={'Field '+(i+1)+' name'} value={column.name} maxLength={100} disabled={disabled} onChange={e=>update(i,{name:e.target.value})}/></td><td><select aria-label={'Field '+(i+1)+' data type'} value={column.type} disabled={disabled} onChange={e=>update(i,{type:e.target.value as ColumnType})}>{columnTypes.map(type=><option key={type} value={type}>{columnTypeLabels[type]}</option>)}</select></td>{samples && <td className="sql-design-sample">{samples[i]?.join(', ') || '—'}</td>}</tr>)}
  </tbody></table></div>;
}

export function CsvImportDesign({ existingNames, files, onChange, disabled, onReading }: { existingNames: string[]; files: CsvImportFile[]; onChange: (files: CsvImportFile[]) => void; disabled: boolean; onReading:(reading:boolean)=>void }) {
  const [selected,setSelected]=useState(0);
  const [reading,setReading]=useState(false);
  const [error,setError]=useState('');
  const [preview,setPreview]=useState<{ count:number; samples:string[][] }[]>([]);
  const input=useRef<HTMLInputElement>(null);
  const request=useRef(0);
  async function read(chosen:File[]) {
    if (!chosen.length || reading || disabled) return;
    if (chosen.length>10 || chosen.some(file=>! /\.csv$/i.test(file.name)||file.size>MAX_CSV_BYTES) || chosen.reduce((sum,file)=>sum+file.size,0)>20*1024*1024) {setError('Choose up to 10 CSV files, at most 5 MB each and 20 MB total.');return;}
    const id=++request.current;
    setError('');setReading(true);onReading(true);
    try {
      const taken=new Set(existingNames.map(name=>name.toLowerCase()));
      const loaded=await Promise.all(chosen.map(async file=>({name:file.name,text:await file.text()})));
      const info=loaded.map(file=>{
        const data=inspectCsv(file.text);
        return {file:{...file,tableName:tableName(file.name,taken),columns:data.names.map((name,i)=>({name,type:data.types[i] as ColumnType,primaryKey:false}))}, count:data.rows.length, samples:data.names.map((_,i)=>data.rows.slice(0,5).map(row=>row[i]).filter(Boolean).slice(0,3).map(cell=>cell.slice(0,70)))};
      });
      if (id===request.current) { onChange(info.map(item=>item.file));setPreview(info.map(({count,samples})=>({count,samples})));setSelected(0); }
    } catch (cause) { if(id===request.current)setError(cause instanceof Error?cause.message:String(cause)); }
    finally { if(id===request.current){setReading(false);onReading(false);} }
  }
  const index=Math.min(selected,Math.max(0,files.length-1));
  const file=files[index];
  function update(change:Partial<CsvImportFile>){onChange(files.map((item,i)=>i===index?{...item,...change}:item));setError('');}
  return <>
    <div className="sql-import-picker"><input ref={input} type="file" multiple accept=".csv,text/csv" hidden disabled={disabled||reading} onChange={event=>{const chosen=Array.from(event.target.files??[]);event.target.value='';void read(chosen);}}/><button type="button" className="subtle-button" disabled={disabled||reading} onClick={()=>input.current?.click()}><Upload size={16}/>{reading?'Reading files…':files.length?'Choose different files':'Choose CSV files'}</button>{files.length>0&&<span>{files.length} {files.length===1?'file':'files'} selected</span>}</div>
    {file && <>
      {files.length>1&&<label>File<select value={index} disabled={disabled||reading} onChange={e=>setSelected(Number(e.target.value))}>{files.map((item,i)=><option key={i} value={i}>{item.name}</option>)}</select></label>}
      <label>Table name<input value={file.tableName??''} disabled={disabled||reading} maxLength={100} onChange={e=>update({tableName:e.target.value})}/></label>
      <div className="sql-form-heading"><h3>Field design</h3>{preview[index]&&<span className="sql-form-note">{preview[index].count} records</span>}</div>
      <FieldGrid columns={file.columns??[]} disabled={disabled||reading} samples={preview[index]?.samples} onChange={columns=>update({columns})}/>
      <p className="sql-form-note">Review detected data types. Select the key icon to set a primary key. All records are validated before import.</p>
    </>}
    {error&&<p role="alert" className="sql-dialog-error">{error}</p>}
  </>;
}

export function DesignView({table,busy,error,onSave,onClose,onStop}:{table:TableInfo;busy:boolean;error:string;onSave:(design:TableDesign)=>void;onClose:()=>void;onStop:()=>void}){
  const unsupported=table.columns.some(column=>!columnTypes.includes(column.type as ColumnType));
  const [columns,setColumns]=useState<ManualColumn[]>(()=>table.columns.map(column=>({name:column.name,type:columnTypes.includes(column.type as ColumnType)?column.type as ColumnType:'TEXT',primaryKey:Boolean(column.primaryKey)})));
  const [validation,setValidation]=useState('');
  const changed=columns.some((column,i)=>column.name!==table.columns[i]?.name||column.type!==table.columns[i]?.type||column.primaryKey!==Boolean(table.columns[i]?.primaryKey));
  function save(){try{validateTableSchema({name:table.name,columns});setValidation('');onSave({name:table.name,columns});}catch(cause){setValidation(cause instanceof Error?cause.message:String(cause));}}
  return <Modal title="Design View" onClose={onClose} busy={busy}>
    <div className="sql-dialog-form"><div className="sql-dialog-db"><Table2 size={16}/>{table.name}</div>
      {unsupported?<div className="sql-design-grid"><table><thead><tr><th>Field name</th><th>Data type</th></tr></thead><tbody>{table.columns.map(column=><tr key={column.name}><td>{column.name}</td><td>{column.type}</td></tr>)}</tbody></table><p className="sql-form-note">Custom SQL data types must be edited using SQL.</p></div>:<FieldGrid columns={columns} disabled={busy} onChange={next=>{setColumns(next);setValidation('');}}/>}
      <p className="sql-form-note">Changes apply to existing records. Invalid conversions or duplicate primary keys leave the original table unchanged.</p>
      {(validation||error)&&<p className="sql-dialog-error" role="alert">{validation||error}</p>}
      <div className="sql-dialog-actions">{busy?<button type="button" className="toolbar-button stop-button" onClick={onStop}>Stop</button>:<button type="button" className="subtle-button" onClick={onClose}>Cancel</button>}<button type="button" className="run-button" disabled={busy||unsupported||!changed} onClick={save}><Save size={15}/> Save changes</button></div>
    </div>
  </Modal>;
}
