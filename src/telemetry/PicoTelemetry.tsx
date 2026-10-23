import { useEffect, useRef, useState } from 'react';

type Choice = { analytics: boolean; preferences: boolean };
const KEY = 'pico.consent.v1';
const workspaces: Record<string,string> = {
  'Pico | Logic Sim': 'logic',
  'Pico | Python Compiler': 'python',
  'Pico | Pseudocode Compiler': 'pseudocode',
  'Pico | Flowchart Builder': 'flowchart',
  'Pico | CPU Studio': 'cpu',
};

async function post(path: string, value: unknown) {
  const response = await fetch(path, {
    method:'POST', credentials:'same-origin',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(value),
  });
  if (!response.ok) throw new Error('Unable to save Pico privacy settings.');
  return response.json();
}
function storedChoice(): Choice | null {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Choice | null;
    return data && typeof data.analytics === 'boolean' && typeof data.preferences === 'boolean' ? data : null;
  } catch { return null; }
}
export function PicoTelemetry() {
  const [choice,setChoice] = useState<Choice | null>(()=>storedChoice());
  const [editing,setEditing] = useState(false);
  const [draft,setDraft] = useState<Choice>(()=>storedChoice() ?? {analytics:false,preferences:false});
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const seconds = useRef(0);
  const lastActivity = useRef(Date.now());
  const workspace = useRef<string | null>(null);

  useEffect(()=>{
    if (!choice?.analytics) return;
    let stopped = false;
    const syncWorkspace = () => {workspace.current = workspaces[document.title] ?? null;};
    syncWorkspace();
    const observer = new MutationObserver(syncWorkspace);
    const title = document.querySelector('title');
    if (title) observer.observe(title,{childList:true,characterData:true,subtree:true});
    const noteActivity = () => {lastActivity.current = Date.now();};
    for(const type of ['pointerdown','keydown','wheel']) window.addEventListener(type,noteActivity,{passive:true});
    let sending = false;
    const flush = async () => {
      if (stopped || sending || seconds.current < 50 || !workspace.current) return;
      const duration = Math.min(60,seconds.current);
      sending = true;
      try {
        await post('/api/usage',{workspace:workspace.current,seconds:duration});
        seconds.current -= duration;
      } catch { /* Don't interrupt compilers when analytics is unavailable. */ }
      finally { sending = false; }
    };
    const timer = window.setInterval(()=>{
      if (!document.hidden && workspace.current && Date.now()-lastActivity.current < 120000) seconds.current++;
      if (seconds.current>=60) void flush();
    },1000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      observer.disconnect();
      for(const type of ['pointerdown','keydown','wheel']) window.removeEventListener(type,noteActivity);
    };
  },[choice?.analytics]);

  const save = async (next:Choice) => {
    setBusy(true);setError('');
    try {
      await post('/api/consent',next);
      localStorage.setItem(KEY,JSON.stringify(next));
      setChoice(next);setDraft(next);setEditing(false);
    } catch {
      setError('Settings were not saved. Check your connection and try again.');
    } finally {setBusy(false);}
  };

  return <>
    {!editing && choice && <button type="button" onClick={()=>{setDraft(choice);setEditing(true);}}
      style={{position:'fixed',bottom:12,right:12,zIndex:9999,padding:'6px 10px',fontSize:12,
        border:'1px solid #707070',borderRadius:6,background:'#171b24',color:'#f4f4f4',cursor:'pointer'}}>
      Privacy settings
    </button>}
    {(!choice || editing) && <div role="dialog" aria-label="Pico privacy choices" aria-modal="false"
      style={{position:'fixed',bottom:16,left:16,zIndex:10000,maxWidth:390,width:'calc(100% - 32px)',
        padding:18,borderRadius:10,background:'#181b24',color:'#fff',border:'1px solid #515866',
        boxShadow:'0 6px 30px #0009',fontFamily:'system-ui,sans-serif',fontSize:14}}>
      <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>Pico privacy settings</div>
      <p style={{lineHeight:1.45,margin:'0 0 12px'}}>Pico works without optional tracking. You choose whether to share anonymous workspace usage and save preferences in the cloud.</p>
      <label style={{display:'flex',gap:10,marginBottom:12,alignItems:'center'}}>
        <input type="checkbox" checked={draft.analytics} onChange={e=>setDraft(v=>({...v,analytics:e.target.checked}))}/>
        Anonymous usage analytics
      </label>
      <label style={{display:'flex',gap:10,marginBottom:14,alignItems:'center'}}>
        <input type="checkbox" checked={draft.preferences} onChange={e=>setDraft(v=>({...v,preferences:e.target.checked}))}/>
        Store preferences on Pico's database
      </label>
      {error && <p role="alert" style={{color:'#ff9999'}}>{error}</p>}
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <button type="button" disabled={busy} onClick={()=>void save({analytics:false,preferences:false})}>Reject optional</button>
        <button type="button" disabled={busy} onClick={()=>void save(draft)}>Save choices</button>
        <button type="button" disabled={busy} onClick={()=>void save({analytics:true,preferences:true})}>Accept all</button>
      </div>
    </div>}
  </>;
}
