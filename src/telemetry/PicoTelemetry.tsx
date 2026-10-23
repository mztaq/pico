import { useEffect, useRef, useState } from 'react';
import './cookie-consent.css';
import { loadSettings } from '../storage/settings';

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
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    if (!choice?.analytics) return;
    let closed = false;
    const totals = new Map<string, number>();
    let pending: {batchId:string, entries:{workspace:string, seconds:number}[]} | null = null;
    let posting = false;
    let lastTick = performance.now();
    let activeWorkspace = workspaces[document.title] ?? null;

    const totalSeconds = () => [...totals.values()].reduce((a,b) => a+b,0);
    const record = () => {
      const current = performance.now();
      const delta = Math.min(2,Math.max(0,(current-lastTick)/1000));
      lastTick = current;
      if (activeWorkspace && !document.hidden && document.hasFocus() &&
          Date.now()-lastActivity.current < 120000) {
        totals.set(activeWorkspace,(totals.get(activeWorkspace) ?? 0)+delta);
      }
    };
    const flush = async (keepalive = false) => {
      if (closed || posting) return;
      if (!pending) {
        const entries:{workspace:string,seconds:number}[] = [];
        let remaining=60;
        for (const [name, value] of totals) {
          const seconds=Math.min(remaining,Math.floor(value));
          if (seconds > 0) { entries.push({workspace:name,seconds}); remaining-=seconds; }
          if (remaining===0) break;
        }
        if (!entries.length) return;
        pending={batchId:crypto.randomUUID(),entries};
      }
      const batch = pending;
      posting=true;
      try {
        const response=await fetch('/api/usage',{
          method:'POST',credentials:'same-origin',keepalive,
          headers:{'content-type':'application/json'},
          body:JSON.stringify(batch),
        });
        if (!response.ok) throw new Error('Usage sync failed');
        if (closed) return;
        for (const entry of batch.entries) {
          const left=(totals.get(entry.workspace) ?? 0)-entry.seconds;
          if(left>0) totals.set(entry.workspace,left); else totals.delete(entry.workspace);
        }
        pending=null;
      } catch {
        // Retain the same batch identifier, so a retry cannot count twice.
      } finally {posting=false;}
    };
    const syncWorkspace = () => {
      record();
      const next = workspaces[document.title] ?? null;
      if(next!==activeWorkspace) {
        activeWorkspace=next;
        if(totalSeconds()>=5) void flush();
      }
    };
    const title=document.querySelector('title');
    const observer=new MutationObserver(syncWorkspace);
    if(title) observer.observe(title,{childList:true,characterData:true,subtree:true});
    const noteActivity=()=>{lastActivity.current=Date.now();};
    for(const type of ['pointerdown','keydown','wheel']) {
      window.addEventListener(type,noteActivity,{passive:true});
    }
    const onVisibility = () => {
      record();
      if(document.hidden) void flush(true);
      lastTick=performance.now();
    };
    document.addEventListener('visibilitychange',onVisibility);
    const onPageHide=()=>{record();void flush(true);};
    window.addEventListener('pagehide',onPageHide);
    const timer=window.setInterval(()=>{
      record();
      if(totalSeconds()>=30) void flush();
    },1000);
    return ()=>{
      closed=true;
      window.clearInterval(timer);
      observer.disconnect();
      document.removeEventListener('visibilitychange',onVisibility);
      window.removeEventListener('pagehide',onPageHide);
      for(const type of ['pointerdown','keydown','wheel']) window.removeEventListener(type,noteActivity);
    };
  },[choice?.analytics]);

  // Local settings remain authoritative on this device. Only consented preferences sync.
  useEffect(() => {
    if (!choice?.preferences) return;
    let cancelled = false;
    let timer: number | undefined;
    let lastSent = '';
    let inFlight = false;
    let pending = false;
    const payload = () => {
      const settings = loadSettings();
      return JSON.stringify({
        theme: settings.theme,
        lastWorkspace: workspaces[document.title] ?? null,
        settings,
      });
    };
    const upload = async () => {
      if (cancelled || inFlight) { pending = true; return; }
      const serialized = payload();
      if (serialized === lastSent) return;
      inFlight = true;
      try {
        const response = await fetch('/api/preferences', {
          method: 'PUT',
          credentials: 'same-origin',
          headers: {'content-type':'application/json'},
          body:serialized,
        });
        if (!response.ok) throw new Error('Preference sync failed');
        if (!cancelled) lastSent = serialized;
      } catch {
        // Keep settings locally and retry on the next settings change.
      } finally {
        inFlight = false;
        if (pending && !cancelled) { pending = false; schedule(); }
      }
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void upload(), 1200);
    };
    const start = async () => {
      let hasLocalSettings = false;
      try { hasLocalSettings = localStorage.getItem('pico.settings.v6') !== null; }
      catch { /* Browser-local storage may be blocked. */ }
      if (!hasLocalSettings) {
        try {
          const response = await fetch('/api/preferences', {credentials:'same-origin',cache:'no-store'});
          if (response.ok) {
            const remote: unknown = await response.json();
            if (cancelled) return;
            if (remote && typeof remote === 'object' && 'settings' in remote) {
              const saved = (remote as {settings:unknown}).settings;
              if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
                // Normalized by loadSettings on the next mount. No code or projects are synced.
                try {
                  localStorage.setItem('pico.settings.v6',JSON.stringify(saved));
                  window.location.reload();
                  return;
                } catch { /* Continue with local defaults */ }
              }
            }
          }
        } catch { /* Offline use remains available */ }
      }
      if (!cancelled) schedule();
    };
    const onSaved = () => schedule();
    window.addEventListener('pico:settings-saved', onSaved);
    void start();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('pico:settings-saved',onSaved);
    };
  }, [choice?.preferences]);

  const save = async (next:Choice) => {
    setBusy(true);setError('');
    try {
      await post('/api/cookies',next);
      localStorage.setItem(KEY,JSON.stringify(next));
      setChoice(next);setDraft(next);setEditing(false);
    } catch {
      setError('Settings were not saved. Check your connection and try again.');
    } finally {setBusy(false);}
  };

  useEffect(() => {
    if (!editing) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && choice) setEditing(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [editing, choice]);

  return <>
    {choice && !editing && <button className="pico-cookie-reopen" type="button"
      onClick={() => { setDraft(choice); setEditing(true); }} aria-label="Open cookie settings">
      Cookie Settings
    </button>}

    {!choice && !editing && <section className="pico-cookie-banner" aria-label="Cookie consent">
      <p>
        We use cookies to remember your settings and improve Pico. Choose what works for you. <a href="#cookies">Cookie Policy</a>
      </p>
      {error && <span className="pico-cookie-error" role="alert">{error}</span>}
      <div className="pico-cookie-actions">
        <button className="pico-cookie-btn pico-cookie-outline" type="button"
          onClick={() => { setDraft({analytics:false, preferences:false}); setEditing(true); }}>
          Cookie Settings
        </button>
        <button className="pico-cookie-btn pico-cookie-neutral" type="button" disabled={busy}
          onClick={() => void save({analytics:false, preferences:false})}>Reject All</button>
        <button className="pico-cookie-btn pico-cookie-primary" type="button" disabled={busy}
          onClick={() => void save({analytics:true, preferences:true})}>Accept All</button>
      </div>
    </section>}

    {editing && <div className="pico-cookie-overlay"
      onMouseDown={event => { if (event.target === event.currentTarget && choice) setEditing(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="pico-cookie-title"
        aria-describedby="pico-cookie-description" className="pico-cookie-modal">
        <header className="pico-cookie-modal-head">
          <div>
            <span className="pico-cookie-eyebrow">PRIVACY PREFERENCES</span>
            <h2 id="pico-cookie-title">Cookie Settings</h2>
          </div>
          {choice && <button className="pico-cookie-close" type="button"
            onClick={() => setEditing(false)} aria-label="Close cookie settings">×</button>}
        </header>
        <p id="pico-cookie-description" className="pico-cookie-description">
          Choose how Pico uses optional cookies. You can update your choices at any time.
        </p>
        <div className="pico-cookie-categories">
          <div className="pico-cookie-category">
            <div><strong>Strictly Necessary</strong><p>Remember your cookie choices.</p></div>
            <span className="pico-cookie-required">Always active</span>
          </div>
          <label className="pico-cookie-category">
            <div><strong>Analytics</strong><p>Measure feature usage to improve Pico.</p></div>
            <input aria-label="Allow analytics cookies" type="checkbox" checked={draft.analytics}
              onChange={event => setDraft(v => ({...v, analytics:event.target.checked}))} />
          </label>
          <label className="pico-cookie-category">
            <div><strong>Preferences</strong><p>Save your settings for future visits in this browser.</p></div>
            <input aria-label="Allow preference cookies" type="checkbox" checked={draft.preferences}
              onChange={event => setDraft(v => ({...v, preferences:event.target.checked}))} />
          </label>
        </div>
        <a className="pico-cookie-policy" href="#cookies" onClick={() => setEditing(false)}>Cookie Policy →</a>
        {error && <p className="pico-cookie-error" role="alert">{error}</p>}
        <div className="pico-cookie-modal-actions">
          <button className="pico-cookie-btn pico-cookie-outline" type="button" disabled={busy}
            onClick={() => void save({analytics:false, preferences:false})}>Reject All</button>
          <button className="pico-cookie-btn pico-cookie-neutral" type="button" disabled={busy}
            onClick={() => void save(draft)}>Save Preferences</button>
          <button className="pico-cookie-btn pico-cookie-primary" type="button" disabled={busy}
            onClick={() => void save({analytics:true, preferences:true})}>Accept All</button>
        </div>
      </section>
    </div>}
  </>;
}
