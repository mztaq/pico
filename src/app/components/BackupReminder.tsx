import {useEffect,useState} from 'react';
import {Download,X} from 'lucide-react';
import './BackupReminder.css';
const KEY='pico.export-reminder.v1',INTERVAL=7*24*60*60*1000;
export function BackupReminder({workspace,onExport}:{workspace:'pseudocode'|'python'|'flowchart'|'logic';onExport:()=>void}){
 const [open,setOpen]=useState(false);
 useEffect(()=>{try{const last=Number(localStorage.getItem(KEY)||0);if(!last||Date.now()-last>=INTERVAL)setOpen(true);}catch{setOpen(true);}},[]);
 function dismiss(){setOpen(false);try{localStorage.setItem(KEY,String(Date.now()));}catch{/* Memory only. */}}
 if(!open)return null;
 const label=workspace==='logic'?'logic circuit':workspace==='flowchart'?'flowchart':workspace==='python'?'Python project':'pseudocode project';
 return <div role="dialog" aria-modal="true" aria-label="Export your work" className="pico-backup-backdrop"><div className="pico-backup-modal">
 <button className="pico-backup-close" aria-label="Dismiss export reminder" onClick={dismiss}><X size={17}/></button>
 <h2>Keep a backup of your work</h2><p>Browser storage is not a permanent backup. Clearing site data or switching devices might erase your work.</p>
 <p>Export your {label} to keep a separate copy.</p><div className="pico-backup-actions"><button onClick={dismiss}>Later</button><button className="pico-backup-export" onClick={()=>{onExport();dismiss();}}><Download size={15}/> Export file</button></div></div></div>;
}