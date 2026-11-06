import {useEffect, useRef, useState} from 'react';
import './paste-json-dialog.css';

interface Props {
  kind: 'flowchart' | 'circuit';
  onClose: () => void;
  onImport: (source: string) => boolean;
}

export function PasteJsonDialog({kind,onClose,onImport}:Props){
  const [source,setSource]=useState('');
  const [error,setError]=useState('');
  const input=useRef<HTMLTextAreaElement>(null);
  const title=kind==='flowchart'?'Paste flowchart JSON':'Paste circuit JSON';
  useEffect(()=>{input.current?.focus();},[]);
  function submit(){
    setError('');
    if(!source.trim()){setError('Paste your Pico JSON first.');return;}
    try {if(onImport(source))onClose();}
    catch(e){setError(e instanceof Error?e.message:'Could not import this JSON.');}
  }
  return <div className="pico-json-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section className="pico-json-dialog" role="dialog" aria-modal="true" aria-label={title} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose();}}}>
      <header><h2>{title}</h2><button type="button" aria-label="Close JSON import" onClick={onClose}>×</button></header>
      <p>Paste a Pico project JSON object, then import it.</p>
      <textarea ref={input} aria-label={title} spellCheck={false} value={source} onChange={e=>{setSource(e.target.value);if(error)setError('');}} placeholder={'{\n  "nodes": [],\n  "edges": []\n}'} rows={12} maxLength={2_000_000}/>
      {error&&<p className="pico-json-error" role="alert">{error}</p>}
      <footer><button type="button" onClick={onClose}>Cancel</button><button type="button" className="pico-json-submit" onClick={submit}>Import JSON</button></footer>
    </section>
  </div>;
}
